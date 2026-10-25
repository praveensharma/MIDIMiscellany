const assert=require('assert'),fs=require('fs'),vm=require('vm');
function harness(harmonyShared={}){
 let running=1; const midi=[],gates=[];
 let wall=0,pos=0,monitor=1,playing=-1,clip=null,reads=0,fires=0,playpos=0,jump=null;
 const jobs=new Map();
 const song={get(p){return {current_song_time:pos,is_playing:running,tempo:120,loop:1,loop_start:0,loop_length:2,signature_numerator:4,signature_denominator:4}[p];}};
 const track={unquotedpath:'live_set tracks 3',getcount(){return 4;},get(p){return {current_monitoring_state:monitor,playing_slot_index:playing}[p];},set(p,v){assert.equal(p,'current_monitoring_state');monitor=v;},call(){playing=-1;}};
 const slot={get(){return clip?1:0;},call(p,v){if(p==='delete_clip')clip=null;if(p==='create_clip')clip={length:v,notes:[]};if(p==='fire'){fires++;playing=0;playpos=0;}}};
 const api={get(p){return p==='playing_position'?playpos:clip[p];},set(p,v){clip[p]=v;},call(p,...args){if(p==='add_new_notes')clip.notes=JSON.parse(args[0].data).notes.map((n,i)=>({...n,note_id:i+1}));if(p==='apply_note_modifications'){for(const change of JSON.parse(args[0].data).notes){const note=clip.notes.find(n=>n.note_id===change.note_id);assert(note);Object.assign(note,change);}}if(p==='get_notes_extended'){reads++;return JSON.stringify({notes:reads===1?[]:clip.notes});}if(p==='move_playing_pos')jump=args[0];}};
 const displays=[];
 const c={Global:function(){return harmonyShared;},Date:{now:()=>wall},outlet(index,message,value){if(index===0)displays.push(value);if(index===3)midi.push(message);if(index===4)gates.push(message);},post(){},Dict:function(){this.parse=s=>this.data=s;this.freepeer=()=>{};},Task:function(fn,owner){this.schedule=ms=>jobs.set(this,{fn,owner,at:wall+ms});this.cancel=()=>jobs.delete(this);},LiveAPI:function(p){if(p==='live_set')return song;if(p==='this_device')return {unquotedpath:'live_set tracks 3 devices 2'};if(p==='live_set tracks 3')return track;if(/ clip$/.test(p))return api;if(/clip_slots/.test(p))return slot;throw Error(p);}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('device/midimiscellany.js','utf8'),c);
 function tick(){wall+=10;if(running)pos=(pos+0.02)%2;if(running&&playing===0)playpos=(playpos+0.02)%clip.length;if(jump!==null){playpos=(playpos+jump+clip.length)%clip.length;jump=null;}for(const[t,j]of [...jobs])if(j.at<=wall){jobs.delete(t);j.fn.call(j.owner);}}
 function advance(ms){for(let i=0;i<ms;i+=10)tick();}
 c.init();advance(250);assert.equal(c.hostTrack.unquotedpath,'live_set tracks 3');assert.equal(monitor,0);
 return {c,advance,tick,displays,midi,gates,setRunning(v){running=v;},setPlaypos(v){playpos=v;},setPlaying(v){playing=v;},get fires(){return fires;},get notes(){return clip.notes;},seek(v){pos=v;}};
}
const h=harness();
for(let cycle=0;cycle<40;cycle++){
 for(let b=0;b<4;b++){h.c.midi_note(60+b,100);h.advance(250);h.c.midi_note(60+b,0);h.advance(250);}
 h.c.requestLooping();const notes=h.c.pendingLaunch.notes;
 assert.equal(notes.length,4,'latest four notes only');notes.forEach((n,i)=>{assert.equal(n.pitch,60+i);assert(Math.abs(n.start_time-i)<0.0001);});
 if(cycle===0){h.advance(30);assert.equal(h.fires,0,'partial note readback blocks fire');}
 h.advance(200);assert.equal(h.c.state,'LOOPING');
 const size=h.c.events.length;h.c.midi_note(99,100);assert.equal(h.c.events.length,size,'exclude loop output');
 h.c.requestListening();h.advance(100);assert.equal(h.c.state,'LISTENING');
}
assert.equal(h.fires,40);
h.c.midi_note(70,100);h.seek(1.7);h.tick();assert.equal(h.c.events.length,0,'seek invalidates old history');
h.c.requestLooping();assert.equal(h.c.state,'LISTENING','reject incomplete history');
const held=harness();held.c.midi_note(48,90);held.advance(5000);held.c.requestLooping();
assert.equal(held.c.pendingLaunch.notes.length,1);assert.equal(held.c.pendingLaunch.notes[0].start_time,0);assert(Math.abs(held.c.pendingLaunch.notes[0].duration-4)<0.0001);
// Equal note counts are insufficient: timing and content must match too.
const expected=held.c.pendingLaunch;
const wrong=JSON.parse(JSON.stringify(expected.notes));wrong[0].pitch++;
assert.equal(held.c.verifyClipNotes({call(){return JSON.stringify({notes:wrong});}},expected),false);
// Cancel while verification is pending; stale launch callbacks must not fire.
held.c.requestListening();held.advance(300);assert.equal(held.fires,0);
assert.equal(held.c.state,'LISTENING');
held.c.hostTrack={get(){return [];},set(){throw Error('unsupported');}};
assert.equal(held.c.ensureTrackMonitoring(1,'test'),false,'invalid monitor reads must block launch');
const resized=harness();resized.advance(5000);resized.c.length_index(4);
resized.c.requestLooping();assert.equal(resized.c.state,'LISTENING','longer length requires refilling overwritten history');
console.log('runtime cycles: 40 captures, wraps, replace, delayed verification, seek, held notes passed');

// Quantize during playback updates existing IDs, never fires again, and Off
// restores timing even when capture itself started with quantization enabled.
for(const initial of [0,2]){
 const q=harness();q.c.quantize_index(initial);q.advance(70);
 q.c.midi_note(60,100);q.advance(200);q.c.midi_note(60,0);q.advance(1730);
 q.c.requestLooping();q.advance(200);assert.equal(q.c.state,'LOOPING');
 const original=q.c.managedOriginalNotes[0].start_time;
 assert(Math.abs(original-0.14)<0.0001);
 for(const grid of [4,1,3,2,0]){
  q.c.quantize_index(grid);q.advance(100);
  assert.equal(q.c.pendingQuantize,null);
  const step=q.c.RetrospectiveCore.gridBeats(q.c.QUANTIZE_LABELS[grid]);
  assert(Math.abs(q.notes[0].start_time-(step?Math.round(original/step)*step:original))<0.0001);
  assert.equal(q.notes[0].note_id,1);assert.equal(q.fires,1,'quantize must not relaunch');
 }
 q.c.quantize_index(4);q.advance(30);q.c.quantize_index(2);q.advance(100);
 assert.equal(q.c.managedQuantizeIndex,2,'latest grid wins during an in-flight update');
}
console.log('playing quantize: grid changes, original timing restoration, rapid changes and stable note IDs passed');

// Exercise both input entry points and the real capture/write/readback path.
// Quiet notes must remain quiet and loud notes must retain their exact velocity.
for (const rawBytes of [false, true]) {
 const v=harness();v.c.length_index(5);
 for (let velocity=1;velocity<=127;velocity++) {
  if(rawBytes){v.c.msg_int(0x90);v.c.msg_int(60);v.c.msg_int(velocity);}
  else v.c.midi_note(60,velocity);
  assert(v.displays.at(-1).includes('input vel '+velocity+';'));
  v.advance(10);
  if(rawBytes){v.c.msg_int(0x80);v.c.msg_int(60);v.c.msg_int(64);}
  else v.c.midi_note(60,0);
  v.advance(10);
 }
 v.advance(16000-2540);v.c.requestLooping();v.advance(200);
 assert.equal(v.c.state,'LOOPING');assert.equal(v.notes.length,127);
 v.notes.forEach((note,i)=>assert.equal(note.velocity,i+1));
 assert(v.displays.at(-1).includes('clip vel 1-127 verified'));
 const wrong=JSON.parse(JSON.stringify(v.notes));wrong[126].velocity=1;
 assert.equal(v.c.verifyClipNotes({call(){return JSON.stringify({notes:wrong});}},
  {length:32,notes:v.c.managedNotes}),false,'attenuated clip must fail readback');
 v.c.quantize_index(2);v.advance(100);
 v.notes.forEach((note,i)=>assert.equal(note.velocity,i+1));
}
console.log('velocity: all 127 values preserved through parsed/raw input, clip creation, readback and quantization');

// Harmony uses actual clip phase, carries left-edge state and returns to live.
const shared={plinkyLoopReceiverReady:JSON.stringify({at:0,enabled:true,blocked:false})};
function hardware(root,chord=0x91,scale=0xab5){
 shared.plinkyReceiverCache=JSON.stringify({v:1,lastChannel:1,states:{1:{root,chord,scale,channel:1}}});
}
hardware(60);
const harmony=harness(shared);
harmony.c.midi_note(60,100);harmony.advance(10);harmony.c.midi_note(60,0);
harmony.advance(990);hardware(65);harmony.tick();harmony.advance(990);
shared.plinkyLoopReceiverReady=JSON.stringify({at:2250,enabled:true,blocked:false});
harmony.c.requestLooping();
assert.equal(harmony.c.managedHarmony.length,2);
assert.equal(harmony.c.managedHarmony[0].beat,0);
assert.equal(harmony.c.managedHarmony[0].harmony.root,60);
harmony.advance(200);
assert.equal(harmony.c.state,'LOOPING');
assert.equal(JSON.parse(shared.plinkyLoopPlayback).harmony.root,60);
harmony.advance(1000);
assert.equal(JSON.parse(shared.plinkyLoopPlayback).harmony.root,65);
hardware(67);harmony.advance(900);
assert.equal(JSON.parse(shared.plinkyLoopPlayback).harmony.root,60,'loop wraps to initial harmony');
harmony.c.requestListening();
assert.equal(shared.plinkyLoopPlayback,'','Listening releases receiver immediately');
harmony.advance(100);
assert.equal(harmony.c.harmonyHistory[0].harmony.root,67,'new take starts with latest live harmony');
// Pruning a long held harmony retains the state at the window left edge.
harmony.advance(5000);harmony.c.midi_note(72,90);harmony.advance(20);harmony.c.midi_note(72,0);
// Use the simulated clock, rather than the host clock, for the heartbeat.
shared.plinkyLoopReceiverReady=JSON.stringify({at:harmony.c.Date.now(),enabled:true,blocked:false});
harmony.c.requestLooping();harmony.advance(200);
assert.equal(harmony.c.managedHarmony.length,1);
assert.equal(JSON.parse(shared.plinkyLoopPlayback).harmony.root,67);
harmony.c.notifydeleted();assert.equal(shared.plinkyLoopPlayback,'','delete releases lease');
// Outdated/disabled receivers must fail before any clip is created.
for(const readiness of [null,{at:2000,enabled:false,blocked:false},{at:2000,enabled:true,blocked:true}]){
 const bad={plinkyReceiverCache:shared.plinkyReceiverCache,plinkyLoopReceiverReady:JSON.stringify(readiness)};
 const x=harness(bad);x.c.midi_note(60,100);x.advance(2000);x.c.requestLooping();
 assert.equal(x.c.state,'LISTENING');assert.equal(x.fires,0);
 assert(x.displays.at(-1).includes('updated Plinky Harmony Receiver'));
}
console.log('harmony: captured progression, initial state, wraps, live isolation, release, history trim and old receiver rejection passed');

function bytes(h,...values){values.forEach(v=>h.c.msg_int(v));}
function messages(values){
 const result=[];
 for(let i=0;i<values.length;){const status=values[i++],n=(status&0xf0)===0xd0?1:2;result.push([status,...values.slice(i,i+n)]);i+=n;}
 return result;
}
function mpeHarness(){const x=harness();x.c.plinky_mpe_enabled(1);return x;}
const mpe=mpeHarness();
// Descending Plinky member channels, identical overlapping pitch, exact ordering.
for(const ch of [6,5,4,3,2]){
 bytes(mpe,0xd0|ch,23+ch,0xb0|ch,74,43+ch,0xe0|ch,10+ch,70,0x90|ch,60,90+ch);
}
mpe.advance(1000);
for(const ch of [6,5,4,3,2])bytes(mpe,0xd0|ch,80,0xb0|ch,74,90,0xe0|ch,0,65);
mpe.advance(1000);mpe.c.requestLooping();mpe.advance(200);
assert.equal(mpe.c.state,'LOOPING');
assert(mpe.notes.every(n=>n.mute===1),'Live visual notes must be muted');
assert.equal(mpe.notes.length,1,'same-pitch display is a union, raw voices remain separate');
assert.equal(Object.keys(mpe.c.mpeOutput.notes).length,5);
assert.equal(mpe.gates.at(-1),0,'raw input thru closed while MPE owns playback');
const ons=messages(mpe.midi).filter(m=>(m[0]&0xf0)===0x90);
assert.deepEqual(ons.slice(-5).map(m=>m[0]&15),[6,5,4,3,2],'original voice order preserved');
mpe.midi.length=0;mpe.advance(1000);
const expression=messages(mpe.midi).filter(m=>(m[0]&0xf0)!==0x80 && (m[0]&0xf0)!==0x90);
assert.deepEqual(expression.slice(0,3),[[0xd6,80],[0xb6,74,90],[0xe6,0,65]],'same-time expression retains input order');
// A phase jump reconstructs the destination instead of spraying missed notes.
mpe.midi.length=0;mpe.setPlaypos(0.1);mpe.tick();
assert.equal(messages(mpe.midi).filter(m=>(m[0]&0xf0)===0x80).length,5);
assert.equal(Object.keys(mpe.c.mpeOutput.notes).length,5);
assert.deepEqual(Array.from(mpe.c.mpeOutput.expression['6:208'].data),[29],'jump restores initial pressure');
// Natural wrap releases all held voices and restores the left-edge state.
mpe.midi.length=0;mpe.advance(2000);
assert(messages(mpe.midi).some(m=>(m[0]&0xf0)===0x80));
assert.equal(Object.keys(mpe.c.mpeOutput.notes).length,5);
mpe.setRunning(0);mpe.tick();assert.equal(Object.keys(mpe.c.mpeOutput.notes).length,0);
mpe.setRunning(1);mpe.tick();assert.equal(Object.keys(mpe.c.mpeOutput.notes).length,5);
mpe.c.requestListening();assert.equal(Object.keys(mpe.c.mpeOutput.notes).length,0);
assert.equal(mpe.gates.at(-1),1,'Listening restores direct thru');mpe.advance(100);
assert.equal(mpe.c.rawHistory.length,0);
// Expression older than the rolling buffer and a held left-edge note survive.
const edge=mpeHarness();bytes(edge,0xd2,51,0xb2,74,27,0xe2,0,80,0x92,64,100);
edge.advance(5000);bytes(edge,0x82,64,37);edge.advance(100);edge.c.requestLooping();
assert.equal(edge.c.managedMpe.initial.expression['2:208'].data[0],51);
assert.equal(Object.keys(edge.c.managedMpe.initial.notes).length,1);
assert(edge.c.managedMpe.events.some(e=>e.status===0x82&&e.data[1]===37),'release velocity preserved');
edge.advance(200);edge.c.panic();assert.equal(Object.keys(edge.c.mpeOutput.notes).length,0);
// Running status, interleaved realtime, and exact tied Note Off/On ordering.
const order=mpeHarness();bytes(order,0x93,60,90,0xf8,61,91,0x83,60,45,0x93,60,92);
order.advance(2000);order.c.requestLooping();
assert.deepEqual(Array.from(order.c.managedMpe.events,e=>e.status),[0x93,0x93,0x83,0x93]);
order.c.requestListening();order.advance(100);
// Explicit mode change returns to the unchanged ordinary-note engine.
order.c.plinky_mpe_enabled(0);bytes(order,0xd3,99,0xb3,74,23,0xe3,0,80,0x93,67,90);
assert.equal(order.c.rawHistory.length,0);order.advance(200);bytes(order,0x83,67,0);order.advance(1800);
order.c.quantize_index(2);order.c.overdub_enabled(1);order.c.requestLooping();order.advance(200);
assert.equal(order.c.state,'LOOPING');assert.equal(order.c.managedMpe,null);
assert(order.notes.every(n=>n.mute===0));assert.equal(order.gates.at(-1),1);
for(const option of ['quantize','overdub']){
 const blocked=mpeHarness();bytes(blocked,0x92,60,100);blocked.advance(2000);
 if(option==='quantize')blocked.c.quantize_index(2);else blocked.c.overdub_enabled(1);
 blocked.c.requestLooping();assert.equal(blocked.c.state,'LISTENING');assert.equal(blocked.fires,0);
}
const deleted=mpeHarness();bytes(deleted,0x92,60,100);deleted.advance(2000);deleted.c.requestLooping();deleted.advance(200);
deleted.c.notifydeleted();assert.equal(Object.keys(deleted.c.mpeOutput.notes).length,0);
console.log('Plinky MPE: opt-in isolation, channels/order, same pitches, expression, edges, wraps, jumps, transport, panic, deletion and ordinary MIDI return passed');
// Boundary launch emits tied left-edge messages in order; normal polls retain
// Note Off release velocity and same-pitch retriggers within the phrase.
const finite=mpeHarness();finite.c.immediate_launch_enabled(0);
bytes(finite,0xd4,10,0x94,60,91,0xd4,20);finite.advance(500);
bytes(finite,0x84,60,33,0xe4,3,70,0x94,60,92);finite.advance(300);
bytes(finite,0x84,60,44);finite.advance(1200);finite.c.requestLooping();
finite.midi.length=0;finite.advance(200);
assert.equal(finite.c.state,'LOOPING');
const finiteStart=messages(finite.midi);
const firstOn=finiteStart.findIndex(m=>m[0]===0x94);
assert.deepEqual(finiteStart.slice(firstOn-1,firstOn+2),[[0xd4,10],[0x94,60,91],[0xd4,20]]);
finite.midi.length=0;finite.advance(700);
assert.deepEqual(messages(finite.midi),[[0x84,60,33],[0xe4,3,70],[0x94,60,92],[0x84,60,44]]);
assert.equal(Object.keys(finite.c.mpeOutput.notes).length,0);
finite.setPlaying(-1);finite.tick();assert.equal(finite.c.mpePhase,null);
finite.setPlaying(0);finite.tick();finite.c.requestListening();finite.advance(100);
bytes(finite,0x95,70,80);finite.advance(2000);finite.c.requestLooping();finite.advance(200);
assert.equal(Object.keys(finite.c.mpeOutput.notes).length,1);
assert(finite.c.mpeOutput.notes['5:70']);
const patch=JSON.parse(fs.readFileSync('device/MIDIMiscellany.maxpat','utf8')).patcher;
const links=patch.lines.map(l=>JSON.stringify([l.patchline.source,l.patchline.destination]));
function linked(a,b){return links.includes(JSON.stringify([a,b]));}
assert(linked(['obj-midiin',0],['obj-thru-gate',1]));
assert(linked(['obj-thru-gate',0],['obj-midiout',0]));
assert(linked(['obj-midiin',0],['obj-note-deferlow',0]));
assert(linked(['obj-note-deferlow',0],['obj-js',0]));
assert(linked(['obj-js',3],['obj-midiout',0]));
assert(linked(['obj-js',4],['obj-thru-gate',0]));
assert(!patch.boxes.some(b=>b.box.id==='obj-midiparse'),'one raw parser owns capture');
assert.equal(patch.boxes.find(b=>b.box.id==='obj-js').box.numoutlets,5);
assert.equal(patch.boxes.find(b=>b.box.id==='obj-mpe-toggle').box.saved_attribute_attributes.valueof.parameter_initial[0],0);
console.log('MPE production patch: gated direct thru, raw FIFO, sidecar output, default Off; boundary event order, release velocity, clip stop and recapture passed');
