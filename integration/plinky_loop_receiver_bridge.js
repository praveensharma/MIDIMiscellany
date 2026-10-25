// Appended to Plinky Harmony Receiver by tools/prepare_plinky_receiver.py.
// Keep live decoding/cache independent from the temporary loop publisher.
var loopSnapshot=null,loopOwner='',loopApplied='',loopPublishing=false,loopWatch=null;
var originalLoopPublish=publish,originalLoopRender=render_harmony;
var originalLoopInit=init,originalLoopActive=active,originalLoopDeleted=notifydeleted;
publish=function(p){
    if(loopOwner&&!loopPublishing)return;
    originalLoopPublish(p);
};
render_harmony=function(p){originalLoopRender(loopOwner&&loopSnapshot?loopSnapshot:p);};
active=function(v){loopApplied='';originalLoopActive(v);};
function loop_effective_harmony(){return loopOwner&&loopSnapshot?loopSnapshot:latest;}
function loop_valid_snapshot(p){
    return p&&p.root===Math.floor(p.root)&&p.root>=0&&p.root<=127&&
        p.chord===Math.floor(p.chord)&&p.chord>=0&&p.chord<=4095&&
        p.scale===Math.floor(p.scale)&&p.scale>0&&p.scale<=4095&&
        p.channel===Math.floor(p.channel)&&p.channel>=1&&p.channel<=16;
}
function loop_poll(){
    try{
        shared.plinkyLoopReceiverReady=JSON.stringify({at:now(),instance:instance,enabled:enabled,blocked:blocked});
        var command=null;
        try{command=JSON.parse(shared.plinkyLoopPlayback||'null');}catch(e){}
        var valid=command&&typeof command.owner==='string'&&command.owner&&
            command.expires>now()&&command.expires<=now()+2000&&loop_valid_snapshot(command.harmony);
        if(valid){
            loopOwner=command.owner;loopSnapshot=command.harmony;
            var change=loopOwner+'|'+key(loopSnapshot);
            if(loopApplied!==change){
                loopApplied=change;originalLoopRender(loopSnapshot);
                loopPublishing=true;
                try{publish(loopSnapshot);}finally{loopPublishing=false;}
                trace('LOOP_HARMONY',JSON.stringify(loopSnapshot));
            }
        }else if(loopOwner){
            loopOwner='';loopSnapshot=null;loopApplied='';
            if(latest){originalLoopRender(latest);publish(latest);}
            trace('LOOP_RELEASE','live harmony restored');
        }
    }finally{if(loopWatch)loopWatch.schedule(10);}
}
init=function(){
    originalLoopInit();
    if(!loopWatch&&typeof Task!=='undefined')loopWatch=new Task(loop_poll,this);
    loop_poll();
};
notifydeleted=function(){
    if(loopWatch)loopWatch.cancel();loopWatch=null;
    shared.plinkyLoopReceiverReady='';originalLoopDeleted();
};
