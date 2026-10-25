// Run the receiver's own protocol/quantizer suite against the prepared update,
// then exercise loop ownership, live isolation, scale sync and timeout recovery.
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm');
const {execFileSync}=require('child_process');
const implementation=process.env.PLINKY_IMPLEMENTATION_ROOT||path.join(os.homedir(),'Documents/ChatGPT/Tetrachords Quantizer/implementation');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'midimiscellany-harmony-'));
try{
 const staged=path.join(temporary,'plinky_harmony_receiver.js');
 execFileSync('python3',[path.join(__dirname,'../tools/prepare_plinky_receiver.py'),'--source',path.join(implementation,'Plinky_Harmony_Receiver/plinky_harmony_receiver.js'),'--output',staged]);
 let suite=fs.readFileSync(path.join(implementation,'tests/test_plinky.js'),'utf8');
 suite=suite.replace("const root=path.join(__dirname,'..');",'const root='+JSON.stringify(implementation)+';');
 suite=suite.replace("fs.readFileSync(path.join(root,f),'utf8')", "fs.readFileSync(f==='Plinky_Harmony_Receiver/plinky_harmony_receiver.js'?"+JSON.stringify(staged)+":path.join(root,f),'utf8')");
 suite+=`
 h=harness();r=h.c;s=h.shared.tetrachords_harmony_v1;
 r.init();r.active(1);h.packet(60);h.advance(30);
 assert(JSON.parse(s.plinkyLoopReceiverReady).enabled);
 function loop(root,expires=r.now()+1000){s.plinkyLoopPlayback=JSON.stringify({owner:'test-loop',expires,harmony:{root,chord:0x91,scale:0xab5,channel:1}});}
 loop(65);h.advance(10);assert.equal(s.root,5);
 version=s.activeValidVersion;
 h.start(67);h.advance(30);
 assert.equal(s.root,5,'live Plinky cannot override loop');
 assert.equal(r.latest.root,67,'live cache continues updating');
 assert.equal(s.activeValidVersion,version,'unchanged loop does not spam publications');
 assert(h.outputs.filter(o=>o[0]===1).at(-1)[2].includes('MIDI 65'),'receiver displays loop harmony');
 r.livescalesync(1);h.advance(30);assert.equal(h.live.root_note,5);
 loop(62);h.advance(40);assert.equal(s.root,2);assert.equal(h.live.root_note,2);
 s.plinkyLoopPlayback='';h.advance(40);
 assert.equal(s.root,7,'Listening restores latest live harmony');assert.equal(h.live.root_note,7);
 loop(60,r.now()+25);h.advance(10);assert.equal(s.root,0);
 h.advance(50);assert.equal(s.root,7,'lost looper heartbeat restores live harmony');
 loop(65);h.advance(10);s.activeValidVersion++;r.tick();assert(r.blocked,'other publishers still trigger source conflict');
 s.plinkyLoopPlayback='';h.advance(10);r.active(1);assert.equal(s.root,7);
 r.notifydeleted();assert.equal(s.plinkyLoopReceiverReady,'');
 console.log('Receiver loop bridge: real NRPN decoder, live isolation, readouts, Live scales, release, lease expiry and source conflict passed');
 `;
 vm.runInNewContext(suite,{require,console,__dirname},{filename:'plinky_receiver_staged_integration.js'});
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
