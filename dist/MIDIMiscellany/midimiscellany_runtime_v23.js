autowatch = 1;
inlets = 1;
outlets = 5;

// Keep the runtime self-contained. Relative include() paths are not resolved
// consistently by Live before a device's Max editor has been opened.
var RetrospectiveCore = (function () {
    var EPSILON = 1e-9;
    var MIN_DURATION = 1 / 960;

    function barBeats(numerator, denominator) {
        return numerator * (4 / denominator);
    }

    function completedWindow(songBeat, windowBeats, alignmentBeats) {
        var alignment = alignmentBeats > 0 ? alignmentBeats : windowBeats;
        var end = Math.floor((songBeat + EPSILON) / alignment) * alignment;
        return { start: end - windowBeats, end: end, length: windowBeats };
    }

    function gridBeats(gridName) {
        return { "off": 0, "1/32": 0.125, "1/16": 0.25, "1/8": 0.5, "1/4": 1 }[gridName];
    }

    function makeNote(noteOn, noteOffBeat, window, quantizeStep) {
        var originalStart = Math.max(0, noteOn.beat - window.start);
        var originalEnd = Math.min(Math.max(noteOffBeat, noteOn.beat), window.end) - window.start;
        var duration = Math.max(MIN_DURATION, originalEnd - originalStart);
        var start = quantizeStep > 0 ? Math.round(originalStart / quantizeStep) * quantizeStep : originalStart;
        start = Math.max(0, Math.min(start, Math.max(0, window.length - MIN_DURATION)));
        return {
            pitch: noteOn.pitch,
            start_time: start,
            duration: Math.max(MIN_DURATION, Math.min(duration, window.length - start)),
            velocity: noteOn.velocity,
            mute: 0,
            channel: noteOn.channel
        };
    }

    function extractNotes(events, window, quantizeStep) {
        var queues = {};
        var notes = [];
        var sorted = events.slice().sort(function (a, b) { return a.beat - b.beat; });
        var i;
        for (i = 0; i < sorted.length; i += 1) {
            var event = sorted[i];
            var key = event.channel + ":" + event.pitch;
            if (event.type === "on") {
                if (!queues[key]) { queues[key] = []; }
                queues[key].push(event);
            } else if (event.type === "off" && queues[key] && queues[key].length) {
                var noteOn = queues[key].shift();
                if (event.beat > window.start && noteOn.beat < window.end) {
                    notes.push(makeNote(noteOn, event.beat, window, quantizeStep));
                }
            }
        }
        for (var queueKey in queues) {
            if (queues.hasOwnProperty(queueKey)) {
                for (var q = 0; q < queues[queueKey].length; q += 1) {
                    var pending = queues[queueKey][q];
                    if (pending.beat < window.end) {
                        notes.push(makeNote(pending, window.end, window, quantizeStep));
                    }
                }
            }
        }
        return notes.sort(function (a, b) { return a.start_time - b.start_time || a.pitch - b.pitch; });
    }

    function mergeNotes(baseNotes, addedNotes) {
        return baseNotes.concat(addedNotes).sort(function (a, b) {
            return a.start_time - b.start_time || a.pitch - b.pitch;
        });
    }

    return {
        barBeats: barBeats,
        completedWindow: completedWindow,
        gridBeats: gridBeats,
        extractNotes: extractNotes,
        mergeNotes: mergeNotes
    };
}());

var DEVICE_NAME = "MIDIMiscellany";
var LENGTH_FACTORS = [0.25, 0.5, 1, 2, 4, 8];
var LENGTH_LABELS = ["1/4 bar", "1/2 bar", "1 bar", "2 bars", "4 bars", "8 bars"];
var QUANTIZE_LABELS = ["off", "1/32", "1/16", "1/8", "1/4"];
var LAUNCH_QUANTIZATION_NONE = 1;
var MONITOR_IN = 0;
var MONITOR_AUTO = 1;
// Live Clip launch_quantization indexes: 2=8 Bars, 3=4 Bars, 4=2 Bars,
// 5=1 Bar, 6=1/2, 8=1/4. Match launch phase to the selected loop length.
var LAUNCH_QUANTIZATION_BY_LENGTH_INDEX = [8, 6, 5, 4, 3, 2];

var state = "LISTENING";
var lengthIndex = 2;
var quantizeIndex = 0;
var overdubEnabled = 0;
var immediateLaunchEnabled = 1;
var monitoringSupported = -1;
var monitoringWarningLogged = 0;
var events = [];
var song = null;
var hostTrack = null;
var managedSlotIndex = -1;
var managedNotes = [];
var managedOriginalNotes = [];
var managedNoteIds = [];
var managedQuantizeIndex = 0;
var quantizeTask = null;
var pendingQuantize = null;
var quantizeDict = null;
var managedLoopLength = 0;
var initialized = false;
var hostBindTask = null;
var hostBindAttempts = 0;
var stopTask = null;
var stopAttempts = 0;
var launchTask = null;
var phaseTask = null;
var pendingLaunch = null;
var notePayloadDict = null;
var midiBytesSeen = 0;
var midiNotesSeen = 0;
var currentMidiChannel = 1;
var clockTask = null;
var clockPosition = null;
var clockWall = 0;
var clockRunning = false;
var elapsedBeat = 0;
var listeningSince = 0;
var inputReady = false;
var verifiedVelocityText = "";
var harmonyShared = null;
var harmonyHistory = [];
var managedHarmony = [];
var harmonyOwner = "MIDIMiscellany-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
var harmonyOwned = false;

// Plinky MPE is opt-in. Live owns ordinary notes; this sidecar owns MPE notes.
var plinkyMpeEnabled = 0;
var rawHistory = [];
var rawBase = {expression: {}, notes: {}};
var rawSequence = 0;
var managedMpe = null;
var mpeOutput = {expression: {}, notes: {}};
var mpePhase = null;
var mpeElapsed = null;

function emptyMpeState() { return {expression: {}, notes: {}}; }
function copyMpeState(value) { return JSON.parse(JSON.stringify(value)); }
function applyMpeEvent(target, event) {
    var kind = event.status & 0xF0;
    var channel = event.status & 15;
    var key = channel + ":" + event.data[0];
    if (kind === 0x90 && event.data[1] > 0) {
        if (!target.notes[key]) { target.notes[key] = []; }
        target.notes[key].push(event);
    } else if (kind === 0x80 || kind === 0x90) {
        if (target.notes[key]) {
            target.notes[key].shift();
            if (!target.notes[key].length) { delete target.notes[key]; }
        }
    } else {
        target.expression[channel + ":" + kind] = event;
    }
}
function sendMpe(event) {
    outlet(3, event.status);
    for (var i = 0; i < event.data.length; i += 1) { outlet(3, event.data[i]); }
    applyMpeEvent(mpeOutput, event);
}
function releaseMpe() {
    var previous = mpeOutput;
    for (var key in previous.notes) {
        if (!previous.notes.hasOwnProperty(key)) { continue; }
        var notes = previous.notes[key];
        for (var i = 0; i < notes.length; i += 1) {
            var note = notes[i];
            outlet(3, 0x80 | (note.status & 15));
            outlet(3, note.data[0]);
            outlet(3, 0);
        }
    }
    // Reset only expression channels owned by this engine.
    for (var expressionKey in previous.expression) {
        if (!previous.expression.hasOwnProperty(expressionKey)) { continue; }
        var event = previous.expression[expressionKey];
        var kind = event.status & 0xF0;
        outlet(3, event.status);
        if (kind === 0xE0) { outlet(3, 0); outlet(3, 64); }
        else if (kind === 0xB0) { outlet(3, 74); outlet(3, 64); }
        else { outlet(3, 0); }
    }
    mpeOutput = emptyMpeState();
    mpePhase = null;
    mpeElapsed = null;
}
function plinky_mpe_enabled(value) {
    var next = value ? 1 : 0;
    if (next === plinkyMpeEnabled) { return; }
    if (state !== "LISTENING") { stopManagedLoop(); }
    releaseMpe();
    plinkyMpeEnabled = next;
    if (initialized) { resetHistory(); }
    setState(state, next ? "Plinky MPE on; refill history; Quantize Off, Overdub Off" :
        "ordinary MIDI; refill history");
}
// Live may merge overlapping equal pitches because its notes have no member
// channel. Use a union for display; the raw sidecar retains every original voice.
function visualMpeNotes(notes) {
    var sorted = notes.slice().sort(function (a, b) {
        return a.pitch - b.pitch || a.start_time - b.start_time;
    });
    var result = [];
    for (var i = 0; i < sorted.length; i += 1) {
        var note = copyMpeState(sorted[i]);
        var last = result.length ? result[result.length - 1] : null;
        if (last && last.pitch === note.pitch &&
                note.start_time <= last.start_time + last.duration + 1e-9) {
            last.duration = Math.max(last.duration, note.start_time + note.duration - last.start_time);
        } else { note.mute = 1; result.push(note); }
    }
    return result;
}
function captureMpe(window) {
    var initial = copyMpeState(rawBase);
    var timeline = [];
    var channels = {};
    var i;
    for (i = 0; i < rawHistory.length; i += 1) {
        var event = rawHistory[i];
        if (event.beat < window.start) { applyMpeEvent(initial, event); }
        else if (event.beat < window.end) {
            timeline.push({beat: event.beat - window.start, status: event.status,
                data: event.data.slice(), sequence: event.sequence});
            channels[event.status & 15] = true;
        }
    }
    for (var key in initial.notes) {
        if (initial.notes.hasOwnProperty(key)) { channels[initial.notes[key][0].status & 15] = true; }
    }
    // Establish defaults even for expression never transmitted by the source;
    // otherwise a previous loop's bend or pressure could bleed into this take.
    for (var channel in channels) {
        if (!channels.hasOwnProperty(channel)) { continue; }
        var ch = Number(channel);
        var defaults = [{status: 0xD0 | ch, data: [0]},
            {status: 0xB0 | ch, data: [74, 64]}, {status: 0xE0 | ch, data: [0, 64]}];
        for (i = 0; i < defaults.length; i += 1) {
            var d = defaults[i];
            var expressionKey = ch + ":" + (d.status & 0xF0);
            if (!initial.expression[expressionKey]) { initial.expression[expressionKey] = d; }
        }
    }
    return {initial: initial, events: timeline};
}
function chaseMpe(position) {
    var target = copyMpeState(managedMpe.initial);
    for (var i = 0; i < managedMpe.events.length; i += 1) {
        if (managedMpe.events[i].beat > position + 1e-9) { break; }
        applyMpeEvent(target, managedMpe.events[i]);
    }
    // Restore expression before sounding the voices active at the destination.
    for (var key in target.expression) {
        if (target.expression.hasOwnProperty(key)) { sendMpe(target.expression[key]); }
    }
    var held = [];
    for (var noteKey in target.notes) {
        if (target.notes.hasOwnProperty(noteKey)) { held = held.concat(target.notes[noteKey]); }
    }
    held.sort(function (a, b) { return a.sequence - b.sequence; });
    for (var n = 0; n < held.length; n += 1) { sendMpe(held[n]); }
}
function emitMpeRange(start, end) {
    for (var i = 0; i < managedMpe.events.length; i += 1) {
        var event = managedMpe.events[i];
        if (event.beat > start + 1e-9 && event.beat <= end + 1e-9) { sendMpe(event); }
    }
}
function startMpeEdge() {
    var initial = managedMpe.initial;
    for (var key in initial.expression) {
        if (initial.expression.hasOwnProperty(key)) { sendMpe(initial.expression[key]); }
    }
    var held = [];
    for (var noteKey in initial.notes) {
        if (initial.notes.hasOwnProperty(noteKey)) { held = held.concat(initial.notes[noteKey]); }
    }
    held.sort(function (a, b) { return a.sequence - b.sequence; });
    for (var i = 0; i < held.length; i += 1) { sendMpe(held[i]); }
}
function tickMpePlayback() {
    if (!managedMpe) { return; }
    if (!clockRunning || state !== "LOOPING" ||
            numberValue(hostTrack.get("playing_slot_index")) !== managedSlotIndex) {
        releaseMpe(); return;
    }
    var phase = positiveModulo(numberValue(clipApi(managedSlotIndex).get("playing_position")), managedLoopLength);
    var advance = mpePhase === null ? 0 : positiveModulo(phase - mpePhase, managedLoopLength);
    var expected = mpeElapsed === null ? 0 : elapsedBeat - mpeElapsed;
    var firstTick = mpePhase === null;
    if (firstTick || expected < 0 || expected >= managedLoopLength ||
            Math.abs(advance - expected) > 0.05) {
        releaseMpe();
        if (phase < 1e-9 || (firstTick && !immediateLaunchEnabled)) {
            startMpeEdge(); emitMpeRange(-1, phase);
        }
        else { chaseMpe(phase); }
    } else if (phase < mpePhase - 1e-9) {
        emitMpeRange(mpePhase, managedLoopLength);
        releaseMpe();
        startMpeEdge();
        emitMpeRange(-1, phase);
    } else { emitMpeRange(mpePhase, phase); }
    mpePhase = phase;
    mpeElapsed = elapsedBeat;
}
function panic() { stopManagedLoop(); }

function liveHarmony() {
    if (!harmonyShared) { return null; }
    try {
        var cache = JSON.parse(harmonyShared.plinkyReceiverCache || "null");
        var value = cache && cache.states && cache.states[cache.lastChannel];
        if (!value || !(value.root >= 0 && value.root <= 127) ||
                !(value.chord >= 0 && value.chord <= 4095) ||
                !(value.scale > 0 && value.scale <= 4095)) { return null; }
        return {root: value.root, chord: value.chord, scale: value.scale, channel: value.channel};
    } catch (error) { return null; }
}

function harmonyKey(value) {
    return value ? [value.root, value.chord, value.scale, value.channel].join("|") : "";
}

function recordHarmony() {
    var value = liveHarmony();
    if (!value) { return; }
    var previous = harmonyHistory.length ? harmonyHistory[harmonyHistory.length - 1] : null;
    if (!previous || harmonyKey(previous.harmony) !== harmonyKey(value)) {
        harmonyHistory.push({beat: elapsedBeat, harmony: value});
    }
    var cutoff = elapsedBeat - RetrospectiveCore.barBeats(
        numberValue(song.get("signature_numerator")), numberValue(song.get("signature_denominator"))) *
        LENGTH_FACTORS[lengthIndex];
    // Carry the state active at the left edge, even if no new CCs were sent.
    while (harmonyHistory.length > 1 && harmonyHistory[1].beat <= cutoff) { harmonyHistory.shift(); }
}

function captureHarmony(window) {
    recordHarmony();
    var result = [];
    var initial = null;
    for (var i = 0; i < harmonyHistory.length; i += 1) {
        var item = harmonyHistory[i];
        if (item.beat <= window.start + 1e-9) { initial = item.harmony; }
        else if (item.beat < window.end) {
            result.push({beat: item.beat - window.start, harmony: item.harmony});
        }
    }
    if (!initial && result.length) { throw new Error("harmony history incomplete; refill the loop length"); }
    if (initial) { result.unshift({beat: 0, harmony: initial}); }
    if (result.length) {
        var ready = JSON.parse(harmonyShared.plinkyLoopReceiverReady || "null");
        if (!ready || Date.now() - ready.at > 1000 || !ready.enabled || ready.blocked) {
            throw new Error("reload the updated Plinky Harmony Receiver and enable Publish Harmony");
        }
        var owner = JSON.parse(harmonyShared.plinkyLoopPlayback || "null");
        if (owner && owner.expires > Date.now() && owner.owner !== harmonyOwner) {
            throw new Error("another looper owns Plinky harmony");
        }
    }
    return result;
}

function releaseHarmony() {
    if (!harmonyShared || !harmonyOwned) { return; }
    var command;
    try { command = JSON.parse(harmonyShared.plinkyLoopPlayback || "null"); } catch (error) {}
    if (command && command.owner === harmonyOwner) { harmonyShared.plinkyLoopPlayback = ""; }
    harmonyOwned = false;
}

function playHarmony(position) {
    if (!managedHarmony.length || !harmonyShared) { return; }
    var owner = JSON.parse(harmonyShared.plinkyLoopPlayback || "null");
    if (owner && owner.expires > Date.now() && owner.owner !== harmonyOwner) {
        throw new Error("another looper owns Plinky harmony");
    }
    var phase = positiveModulo(position, managedLoopLength);
    var value = managedHarmony[0].harmony;
    for (var i = 1; i < managedHarmony.length; i += 1) {
        if (managedHarmony[i].beat > phase + 1e-9) { break; }
        value = managedHarmony[i].harmony;
    }
    harmonyShared.plinkyLoopPlayback = JSON.stringify({owner: harmonyOwner,
        expires: Date.now() + 1000, harmony: value});
    harmonyOwned = true;
}

function tickHarmonyPlayback() {
    if ((state !== "LOOPING" && state !== "STARTING") || !managedHarmony.length) { return; }
    if (!clockRunning) { releaseHarmony(); return; }
    if (numberValue(hostTrack.get("playing_slot_index")) !== managedSlotIndex) {
        releaseHarmony(); return;
    }
    playHarmony(numberValue(clipApi(managedSlotIndex).get("playing_position")));
}

// One continuous performance timeline. Arrangement loop wraps advance this
// clock; seeks and stop/start discard history instead of mixing different takes.
function sampleClock() {
    var position = numberValue(song.get("current_song_time"));
    var running = numberValue(song.get("is_playing")) === 1;
    var wall = Date.now();
    if (!isFinite(position)) { throw new Error("invalid transport position"); }
    if (clockPosition !== null && running && clockRunning) {
        var delta = position - clockPosition;
        var expected = Math.max(0, wall - clockWall) / 60000 *
            numberValue(song.get("tempo"));
        var loopLength = numberValue(song.get("loop_length"));
        if (numberValue(song.get("loop")) === 1 && loopLength > 0) {
            // Account for one or more wraps, even if a scheduler stall spans a loop.
            delta += Math.max(0, Math.round((expected - delta) / loopLength)) * loopLength;
        }
        if (delta < -0.001 || !isFinite(expected) ||
                Math.abs(delta - expected) > Math.max(0.5, expected * 0.5)) {
            resetHistory();
        } else { elapsedBeat += Math.max(0, delta); }
    } else if (clockPosition !== null && running !== clockRunning) {
        resetHistory();
    }
    clockPosition = position;
    clockRunning = running;
    clockWall = wall;
    return elapsedBeat;
}

function resetHistory() {
    events = [];
    rawHistory = [];
    rawBase = emptyMpeState();
    runningStatus = -1;
    pendingData = [];
    harmonyHistory = [];
    recordHarmony();
    midiNotesSeen = 0;
    listeningSince = elapsedBeat;
}

function clockTick() {
    try {
        sampleClock();
        if (state === "LISTENING" || state === "STOPPING") {
            if (!inputReady && ensureTrackMonitoring(MONITOR_IN, "listening")) {
                inputReady = true;
                resetHistory();
            }
            trimBuffer(elapsedBeat);
            recordHarmony();
        }
        try { tickHarmonyPlayback(); tickMpePlayback(); }
        catch (harmonyError) { launchFailed("harmony playback failed: " + harmonyError); }
    } catch (error) { releaseMpe(); fail("clock update failed", error); }
    clockTask.schedule(10);
}

var runningStatus = -1;
var pendingData = [];
var expectedData = 0;

function init() {
    try {
        // Match the proven Tetrachords startup path: only touch the global
        // song object in the live.thisdevice callback.
        song = new LiveAPI("live_set");
        harmonyShared = new Global("tetrachords_harmony_v1");
        // LiveAPI.valid can still be transiently false in this callback even
        // though the object becomes usable on the next low-priority turn.
        initialized = true;
        sampleClock();
        clockTask = new Task(clockTick, this);
        clockTask.schedule(10);
        setListenToggle(1);
        setState("LISTENING", "v23 ready");
        log("initialized");
        scheduleHostBind(200);
    } catch (error) {
        initialized = false;
        setState("LISTENING", "Live API unavailable");
        fail("initialization failed", error);
    }
}

function scheduleHostBind(delay) {
    if (!hostBindTask) {
        hostBindTask = new Task(bindHostTrack, this);
    }
    hostBindTask.schedule(delay);
}

function bindHostTrack() {
    if (!initialized || hostTrack) {
        return;
    }
    try {
        var ownDevice = new LiveAPI("this_device");
        var match = String(ownDevice.unquotedpath || "").match(/^live_set tracks \d+(?= devices )/);
        if (!match) { throw new Error("waiting for this_device canonical path"); }
        hostTrack = new LiveAPI(match[0]);
        if (hostTrack) {
            discoverManagedSlot();
            synchronizeManagedPlayback();
            if (state === "LISTENING") {
                ensureTrackMonitoring(MONITOR_IN, "listening");
            }
            log("host bound=" + hostTrack.unquotedpath);
            return;
        }
    } catch (error) {
        // Live may still be finishing the Set graph immediately after load.
    }
    hostBindAttempts += 1;
    if (hostBindAttempts < 40) {
        scheduleHostBind(250);
    }
}

function discoverManagedSlot() {
    if (managedSlotIndex >= 0) {
        return;
    }
    var count = hostTrack.getcount("clip_slots");
    for (var i = 0; i < count; i += 1) {
        var slot = slotApi(i);
        if (truthy(slot.get("has_clip"))) {
            var clip = clipApi(i);
            var clipName = String(clip.get("name") || "").replace(/,/g, " ");
            if (clipName.indexOf(DEVICE_NAME + " - ") === 0) {
                managedSlotIndex = i;
                managedLoopLength = numberValue(clip.get("length"));
                var recoveredLengthIndex = lengthIndexFromLabel(clipName);
                clip.set("launch_quantization",
                    launchQuantizationForLengthIndex(recoveredLengthIndex));
                log("reclaimed managed slot=" + (i + 1));
                return;
            }
        }
    }
}

function lengthIndexFromLabel(clipName) {
    for (var i = 0; i < LENGTH_LABELS.length; i += 1) {
        if (clipName.indexOf(LENGTH_LABELS[i]) >= 0) {
            return i;
        }
    }
    return lengthIndex;
}

function synchronizeManagedPlayback() {
    if (managedSlotIndex < 0) {
        return;
    }
    var playingSlot = numberValue(hostTrack.get("playing_slot_index"));
    if (playingSlot === managedSlotIndex) {
        // A saved/reloaded Set can restore the Session clip before this runtime
        // has reconstructed its state. Use the normal Listening transition so
        // monitor switching and buffer ownership follow the same rules.
        stopManagedLoop();
        setState("STOPPING", "input active; synchronizing restored loop");
    }
}

function trackContainsThisDevice(track) {
    var count = track.getcount("devices");
    for (var i = 0; i < count; i += 1) {
        var device = new LiveAPI(track.unquotedpath + " devices " + i);
        var name = String(device.get("name") || "").replace(/,/g, " ");
        if (name.indexOf(DEVICE_NAME) >= 0) {
            return true;
        }
    }
    return false;
}

function length_index(value) {
    lengthIndex = clampIndex(value, LENGTH_FACTORS.length);
    log("loop length=" + LENGTH_LABELS[lengthIndex]);
}

function quantize_index(value) {
    quantizeIndex = clampIndex(value, QUANTIZE_LABELS.length);
    log("quantize=" + QUANTIZE_LABELS[quantizeIndex]);
    if (state === "LOOPING") { scheduleQuantizeUpdate(); }
}

function renderQuantizedNotes(originals, index, length) {
    var step = RetrospectiveCore.gridBeats(QUANTIZE_LABELS[index]);
    return originals.map(function (note, i) {
        var start = step > 0 ? Math.round(note.start_time / step) * step : note.start_time;
        start = Math.max(0, Math.min(length - 1 / 960, start));
        return {pitch: note.pitch, start_time: start,
            duration: Math.max(1 / 960, Math.min(note.duration, length - start)),
            velocity: note.velocity, mute: 0, channel: note.channel, sourceIndex: i};
    });
}

function scheduleQuantizeUpdate() {
    if (!quantizeTask) { quantizeTask = new Task(updatePlayingQuantize, this); }
    quantizeTask.schedule(25);
}

function updatePlayingQuantize() {
    if (managedMpe) { return; }
    if (state !== "LOOPING" || !managedOriginalNotes.length) { return; }
    try {
        var clip = clipApi(managedSlotIndex);
        if (pendingQuantize) {
            if (!verifyClipNotes(clip, pendingQuantize)) {
                pendingQuantize.attempts += 1;
                if (pendingQuantize.attempts >= 40) { throw new Error("note update readback timed out"); }
                scheduleQuantizeUpdate();
                return;
            }
            managedNotes = pendingQuantize.notes;
            managedQuantizeIndex = pendingQuantize.index;
            pendingQuantize = null;
            setState("LOOPING", "Quantize " + QUANTIZE_LABELS[managedQuantizeIndex]);
        }
        if (managedQuantizeIndex === quantizeIndex) { return; }
        if (managedNoteIds.length !== managedOriginalNotes.length ||
                managedNoteIds.some(function (id) { return !(id > 0); })) {
            throw new Error("original note IDs unavailable; recapture this loop");
        }
        var notes = renderQuantizedNotes(managedOriginalNotes, quantizeIndex, managedLoopLength);
        var changes = notes.map(function (note, i) {
            return {note_id: managedNoteIds[i], pitch: note.pitch,
                start_time: note.start_time, duration: note.duration,
                velocity: note.velocity, mute: note.mute};
        });
        if (quantizeDict) { quantizeDict.freepeer(); }
        quantizeDict = new Dict();
        quantizeDict.parse(JSON.stringify({notes: changes}));
        clip.call("apply_note_modifications", quantizeDict);
        pendingQuantize = {notes: notes, length: managedLoopLength, index: quantizeIndex, attempts: 0};
        scheduleQuantizeUpdate();
    } catch (error) {
        pendingQuantize = null;
        setState("LOOPING", "Quantize update failed; see Max console");
        fail("playing quantize failed", error);
    }
}

function overdub_enabled(value) {
    overdubEnabled = value ? 1 : 0;
    log("overdub=" + (overdubEnabled ? "on" : "off"));
}

function immediate_launch_enabled(value) {
    immediateLaunchEnabled = value ? 1 : 0;
    log("immediate launch=" + (immediateLaunchEnabled ? "on" : "off"));
}

function clampIndex(value, count) {
    return Math.max(0, Math.min(count - 1, Math.floor(Number(value) || 0)));
}

function launchQuantizationForLengthIndex(index) {
    return LAUNCH_QUANTIZATION_BY_LENGTH_INDEX[
        clampIndex(index, LAUNCH_QUANTIZATION_BY_LENGTH_INDEX.length)
    ];
}

function positiveModulo(value, modulus) {
    return ((value % modulus) + modulus) % modulus;
}

function cancelLaunchTasks() {
    if (quantizeTask) { quantizeTask.cancel(); }
    pendingQuantize = null;
    pendingLaunch = null;
    if (launchTask) { launchTask.cancel(); }
    if (phaseTask) { phaseTask.cancel(); }
}

function launchFailed(message) {
    log(message);
    stopManagedLoop();
}

function verifyClipNotes(clip, pending) {
    var result = clip.call("get_notes_extended", 0, 128, 0, pending.length);
    var data;
    if (typeof result === "string" && result.charAt(0) === "{") {
        data = JSON.parse(result);
    } else if (result && result.notes) {
        data = result;
    } else {
        var atoms = typeof result === "string" ? result.split(" ") : result;
        if (!atoms || atoms[0] !== "dictionary") { return false; }
        var dictionary = new Dict(atoms[1]);
        data = JSON.parse(dictionary.stringify());
    }
    if (!data || !data.notes || data.notes.length !== pending.notes.length) { return false; }
    function order(a, b) {
        return a.start_time - b.start_time || a.pitch - b.pitch ||
            a.duration - b.duration || a.velocity - b.velocity;
    }
    var actual = data.notes.slice().sort(order);
    var expected = pending.notes.slice().sort(order);
    for (var i = 0; i < expected.length; i += 1) {
        if (actual[i].pitch !== expected[i].pitch ||
                Math.abs(actual[i].start_time - expected[i].start_time) > 0.0001 ||
                Math.abs(actual[i].duration - expected[i].duration) > 0.0001 ||
                Math.abs(actual[i].velocity - expected[i].velocity) > 0.01 ||
                Number(actual[i].mute) !== Number(expected[i].mute || 0)) { return false; }
    }
    for (var n = 0; n < expected.length; n += 1) {
        if (typeof expected[n].sourceIndex === "number" &&
                !(managedNoteIds[expected[n].sourceIndex] > 0)) {
            managedNoteIds[expected[n].sourceIndex] = actual[n].note_id;
        }
    }
    var lowest = 127;
    var highest = 0;
    for (var v = 0; v < actual.length; v += 1) {
        lowest = Math.min(lowest, actual[v].velocity);
        highest = Math.max(highest, actual[v].velocity);
    }
    verifiedVelocityText = actual.length ? "clip vel " + lowest +
        (lowest === highest ? "" : "-" + highest) + " verified" : "";
    return true;
}

function ensureTrackMonitoring(target, reason) {
    if (!hostTrack) {
        return false;
    }
    try {
        var current = numberValue(hostTrack.get("current_monitoring_state"));
        if (current !== 0 && current !== 1 && current !== 2) {
            throw new Error("invalid monitoring response");
        }
        monitoringSupported = 1;
        if (current !== target) {
            hostTrack.set("current_monitoring_state", target);
            log("track monitoring -> " + (target === MONITOR_IN ? "In" : "Auto") +
                " (" + reason + ")");
            return false;
        }
        return true;
    } catch (error) {
        monitoringSupported = 0;
        if (!monitoringWarningLogged) {
            monitoringWarningLogged = 1;
            log("track monitoring unavailable; capture/launch blocked until verified: " + error);
        }
        return false;
    }
}

function listen_enabled(value) {
    if (value) {
        requestListening();
    } else {
        requestLooping();
    }
}

function requestListening() {
    if (state === "LOOPING" || state === "QUEUING" || state === "STARTING") {
        pendingLaunch = null;
        stopManagedLoop();
    } else if (state === "STOPPING") {
        setState("STOPPING", "input active; waiting for Live to stop the Session clip");
    } else {
        ensureTrackMonitoring(MONITOR_IN, "listening");
        setListenToggle(1);
        setState("LISTENING", initialized ? "ready" : "waiting for live.thisdevice");
    }
}

function requestLooping() {
    if (!initialized) {
        setState("LISTENING", "waiting for live.thisdevice");
        setListenToggle(1);
        return;
    }
    if (!hostTrack) {
        bindHostTrack();
        if (!hostTrack) {
            setState("LISTENING", "locating host track; try again");
            setListenToggle(1);
            return;
        }
    }
    if (state === "STOPPING") {
        setState("STOPPING", "input active; waiting for Live to stop the Session clip");
        setListenToggle(1);
    } else if (state === "LISTENING") {
        capturePreviousWindow();
        if (state !== "LOOPING" && state !== "QUEUING") {
            setListenToggle(1);
        }
    } else {
        setListenToggle(0);
    }
}

// Compatibility entry point for old saved mappings or Max messages.
function capture() {
    listen_enabled(state === "LOOPING" ? 1 : 0);
}

function setListenToggle(value) {
    outlet(2, "set", value ? 1 : 0);
}

function stopManagedLoop() {
    try {
        releaseHarmony();
        releaseMpe();
        outlet(4, 1);
        cancelLaunchTasks();
        sampleClock();
        // Begin the next retrospective buffer at the user's Listening gesture,
        // not at Live's later stop confirmation. Waiting to clear here used to
        // erase notes played during STOPPING, producing sparse recaptures after
        // a loop had been running.
        inputReady = ensureTrackMonitoring(MONITOR_IN, "listening");
        resetHistory();
        if (managedSlotIndex < 0) {
            setListenToggle(1);
            setState("LISTENING", "ready; buffer cleared");
            return;
        }
        // Monitor In suppresses Session-clip output and admits live input
        // immediately. Stop at track scope and verify playing_slot_index in the
        // background, while preserving all new notes received during STOPPING.
        hostTrack.call("stop_all_clips");
        stopAttempts = 0;
        setState("STOPPING", "input active; waiting for Live");
        scheduleStopCheck(25);
    } catch (error) {
        fail("could not stop managed clip", error);
    }
}

function scheduleStopCheck(delay) {
    if (!stopTask) {
        stopTask = new Task(finishStopManagedLoop, this);
    }
    stopTask.schedule(delay);
}

function finishStopManagedLoop() {
    if (state !== "STOPPING") { return; }
    try {
        var playingSlot = numberValue(hostTrack.get("playing_slot_index"));
        if (playingSlot < 0) {
            ensureTrackMonitoring(MONITOR_IN, "listening");
            setListenToggle(1);
            setState("LISTENING", midiNotesSeen > 0 ?
                "loop stopped; MIDI buffered; " + midiNotesSeen + " Note On" +
                    (midiNotesSeen === 1 ? "" : "s") :
                "loop stopped; ready");
            log("managed loop stopped; new listening buffer preserved");
            return;
        }
    } catch (error) {
        fail("could not verify managed clip stop", error);
    }
    stopAttempts += 1;
    if (stopAttempts < 80) {
        scheduleStopCheck(50);
    } else {
        setState("STOPPING", "Live still reports a Session clip playing");
    }
}

function capturePreviousWindow() {
    try {
        if (!truthy(song.get("is_playing"))) {
            setState("LISTENING", "start Live transport before capture");
            log("capture ignored: transport is stopped");
            return;
        }

        var now = sampleClock();
        var numerator = numberValue(song.get("signature_numerator"));
        var denominator = numberValue(song.get("signature_denominator"));
        var oneBar = RetrospectiveCore.barBeats(numerator, denominator);
        var length = oneBar * LENGTH_FACTORS[lengthIndex];
        var launchQuantization = immediateLaunchEnabled ? LAUNCH_QUANTIZATION_NONE :
            launchQuantizationForLengthIndex(lengthIndex);
        // Freeze the exact trailing duration, including the current partial bar.
        var window = { start: now - length, end: now, length: length };
        var grid = RetrospectiveCore.gridBeats(QUANTIZE_LABELS[quantizeIndex]);

        if (!inputReady || window.start < listeningSince - 0.001) {
            setState("LISTENING", "need " + LENGTH_LABELS[lengthIndex] + " of new listening history");
            return;
        }

        if (plinkyMpeEnabled && (quantizeIndex !== 0 || overdubEnabled)) {
            setState("LISTENING", "Plinky MPE requires Quantize Off and Overdub Off");
            return;
        }
        var capturedNotes = RetrospectiveCore.extractNotes(events, window, 0);
        if (!capturedNotes.length) {
            setState("LISTENING", "last window contained no notes");
            logWindow(window, capturedNotes.length, -1, grid);
            return;
        }

        var canOverdub = !managedMpe && !plinkyMpeEnabled && overdubEnabled && managedSlotIndex >= 0 &&
            managedNotes.length > 0 && Math.abs(managedLoopLength - length) < 1e-9 &&
            truthy(slotApi(managedSlotIndex).get("has_clip"));
        var originals = canOverdub ?
            RetrospectiveCore.mergeNotes(managedOriginalNotes, capturedNotes) : capturedNotes;
        var notes = renderQuantizedNotes(originals, quantizeIndex, length);
        var capturedHarmony = captureHarmony(window);
        var capturedMpe = plinkyMpeEnabled ? captureMpe(window) : null;
        if (capturedMpe) {
            notes = visualMpeNotes(notes);
        }
        verifiedVelocityText = "";

        var newSlotIndex = chooseTargetSlot();
        if (newSlotIndex < 0) {
            setState("LISTENING", "no empty Session slot available");
            return;
        }

        var target = slotApi(newSlotIndex);
        var reusingManaged = newSlotIndex === managedSlotIndex && truthy(target.get("has_clip"));
        if (reusingManaged) {
            target.call("delete_clip");
        }

        target.call("create_clip", length);
        var clip = clipApi(newSlotIndex);
        writeNotes(clip, notes);
        clip.set("name", DEVICE_NAME + " - " + LENGTH_LABELS[lengthIndex]);
        clip.set("looping", 1);
        clip.set("loop_start", 0);
        clip.set("loop_end", length);
        // Boundary mode begins on a matching musical boundary. Immediate mode
        // bypasses launch quantization, then corrects the
        // running clip playhead to the captured phrase's current phase.
        clip.set("launch_quantization", launchQuantization);
        if (managedSlotIndex >= 0 && managedSlotIndex !== newSlotIndex) {
            var previous = slotApi(managedSlotIndex);
            if (truthy(previous.get("has_clip"))) {
                previous.call("delete_clip");
            }
        }

        managedSlotIndex = newSlotIndex;
        managedNotes = notes.slice();
        managedOriginalNotes = originals;
        managedNoteIds = [];
        managedQuantizeIndex = quantizeIndex;
        managedLoopLength = length;
        // Harmony has one authority: a new take replaces its timeline even in
        // note Overdub mode. Combining conflicting chord states is undefined.
        managedHarmony = capturedHarmony;
        releaseMpe();
        managedMpe = capturedMpe;
        if (managedMpe) {
            // Flush live voices at takeover, before Monitor Auto gates the input.
            mpeOutput = copyMpeState(rawBase);
            for (var r = 0; r < rawHistory.length; r += 1) { applyMpeEvent(mpeOutput, rawHistory[r]); }
            outlet(4, 0);
            releaseMpe();
        }
        setListenToggle(0);
        pendingLaunch = {
            slotIndex: newSlotIndex,
            length: length,
            noteCount: notes.length,
            mode: canOverdub ? "overdub" : "replace",
            launchQuantization: launchQuantization,
            launchLabel: LENGTH_LABELS[lengthIndex],
            immediate: immediateLaunchEnabled ? 1 : 0,
            phaseOrigin: window.end,
            attempts: 0
        };
        pendingLaunch.notes = notes.slice();
        inputReady = false;
        // Request Auto as soon as capture has succeeded. The launch verifier
        // below confirms it before firing, so Session playback is never
        // started while Monitor In is still suppressing the clip.
        ensureTrackMonitoring(MONITOR_AUTO, "loop playback");
        if (immediateLaunchEnabled) {
            setState("QUEUING", notes.length + " notes; preparing immediate phase launch; slot " +
                (newSlotIndex + 1));
        } else {
            setState("QUEUING", notes.length + " notes; next " +
                LENGTH_LABELS[lengthIndex] + " boundary; slot " + (newSlotIndex + 1));
        }
        scheduleLaunchCheck(25);
        logWindow(window, notes.length, newSlotIndex, grid);
    } catch (error) {
        setState("LISTENING", "capture failed: " + error);
        fail("capture failed", error);
    }
}

function scheduleLaunchCheck(delay) {
    if (!launchTask) {
        launchTask = new Task(finishPendingLaunch, this);
    }
    launchTask.schedule(delay);
}

function finishPendingLaunch() {
    if (!pendingLaunch || state !== "QUEUING") {
        return;
    }
    try {
        if (numberValue(song.get("is_playing")) !== 1) {
            launchFailed("transport stopped before launch");
            return;
        }
        var pending = pendingLaunch;
        var slot = slotApi(pending.slotIndex);
        var clip = clipApi(pending.slotIndex);
        var actualLength = numberValue(clip.get("length"));
        var actualLoopStart = numberValue(clip.get("loop_start"));
        var actualLoopEnd = numberValue(clip.get("loop_end"));
        var actualLaunchQuantization = numberValue(clip.get("launch_quantization"));
        var configured = truthy(slot.get("has_clip")) &&
            Math.abs(actualLength - pending.length) < 1e-6 &&
            Math.abs(actualLoopStart) < 1e-6 &&
            Math.abs(actualLoopEnd - pending.length) < 1e-6 &&
            actualLaunchQuantization === pending.launchQuantization;
        var monitoringReady = ensureTrackMonitoring(MONITOR_AUTO, "loop playback");

        if (configured && monitoringReady && verifyClipNotes(clip, pending)) {
            // Boundary launches wait for playing_slot_index in clockTick.
            if (pending.immediate) { playHarmony(0); }
            slot.call("fire");
            if (pending.immediate) {
                pending.attempts = 0;
                setState("STARTING", pending.noteCount +
                    " notes; aligning immediate phase; slot " + (pending.slotIndex + 1));
                scheduleImmediatePhaseCheck(1);
                log("verified clip configuration and fired immediate launch");
            } else {
                setState("LOOPING", pending.noteCount + " notes; " + pending.mode +
                    "; " + pending.launchLabel + " sync; slot " + (pending.slotIndex + 1));
                log("verified clip configuration and queued length-matched launch");
                pendingLaunch = null;
                scheduleQuantizeUpdate();
            }
            return;
        }

        // Reassert properties if Live has not committed the preceding API
        // writes yet. Firing is forbidden until a later read verifies them.
        clip.set("looping", 1);
        clip.set("loop_start", 0);
        clip.set("loop_end", pending.length);
        clip.set("launch_quantization", pending.launchQuantization);
    } catch (error) {
        fail("could not verify clip before launch", error);
    }

    pendingLaunch.attempts += 1;
    if (pendingLaunch.attempts < 80) {
        scheduleLaunchCheck(25);
    } else {
        launchFailed("clip content or monitoring could not be verified");
    }
}

function scheduleImmediatePhaseCheck(delay) {
    if (!phaseTask) {
        phaseTask = new Task(finishImmediatePhaseLaunch, this);
    }
    phaseTask.schedule(delay);
}

function finishImmediatePhaseLaunch() {
    if (!pendingLaunch || !pendingLaunch.immediate || state !== "STARTING") {
        return;
    }
    try {
        if (numberValue(song.get("is_playing")) !== 1) {
            launchFailed("transport stopped during launch");
            return;
        }
        var pending = pendingLaunch;
        var playingSlot = numberValue(hostTrack.get("playing_slot_index"));
        if (playingSlot === pending.slotIndex) {
            var clip = clipApi(pending.slotIndex);
            var currentPosition = positiveModulo(
                numberValue(clip.get("playing_position")), pending.length);
            // Read song time second so the destination includes as much of the
            // API-call latency as possible before issuing the relative jump.
            var now = sampleClock();
            var desiredPosition = positiveModulo(now - pending.phaseOrigin, pending.length);
            var jump = desiredPosition - currentPosition;
            jump = positiveModulo(jump + pending.length / 2, pending.length) - pending.length / 2;
            if (Math.abs(jump) > 0.05) {
                if (pending.phaseCorrections >= 4) { throw new Error("phase did not settle"); }
                clip.call("move_playing_pos", jump);
                pending.phaseCorrections = (pending.phaseCorrections || 0) + 1;
                pending.attempts += 1;
                scheduleImmediatePhaseCheck(20);
                return;
            }
            setState("LOOPING", pending.noteCount + " notes; " + pending.mode +
                "; immediate phase " + desiredPosition.toFixed(3) +
                "; slot " + (pending.slotIndex + 1));
            log("immediate phase aligned: current=" + currentPosition.toFixed(6) +
                " desired=" + desiredPosition.toFixed(6) + " jump=" + jump.toFixed(6));
            pendingLaunch = null;
            scheduleQuantizeUpdate();
            return;
        }
    } catch (error) {
        fail("could not align immediate launch phase", error);
    }

    pendingLaunch.attempts += 1;
    if (pendingLaunch.attempts < 80) {
        scheduleImmediatePhaseCheck(5);
    } else {
        launchFailed("immediate playback phase could not be verified");
    }
}

function chooseTargetSlot() {
    if (managedSlotIndex >= 0) {
        return managedSlotIndex;
    }
    var count = hostTrack.getcount("clip_slots");
    for (var i = 0; i < count; i += 1) {
        if (!truthy(slotApi(i).get("has_clip"))) {
            return i;
        }
    }
    return -1;
}

function slotApi(index) {
    return new LiveAPI(hostTrack.unquotedpath + " clip_slots " + index);
}

function clipApi(index) {
    return new LiveAPI(hostTrack.unquotedpath + " clip_slots " + index + " clip");
}

function writeNotes(clip, notes) {
    var payload = { notes: [] };
    for (var i = 0; i < notes.length; i += 1) {
        payload.notes.push({
            pitch: notes[i].pitch,
            start_time: notes[i].start_time,
            duration: notes[i].duration,
            velocity: notes[i].velocity,
            mute: notes[i].mute || 0
        });
    }

    try {
        // Keep the Dict alive after the call because Live API work is deferred.
        // Release the prior capture's Dict only when the next capture begins.
        if (notePayloadDict) {
            notePayloadDict.freepeer();
        }
        notePayloadDict = new Dict();
        notePayloadDict.parse(JSON.stringify(payload));
        clip.call("add_new_notes", notePayloadDict);
    } catch (modernError) {
        log("add_new_notes dictionary failed; trying legacy set_notes: " + modernError);
        clip.call("set_notes");
        clip.call("notes", notes.length);
        for (var n = 0; n < notes.length; n += 1) {
            clip.call("note", notes[n].pitch, notes[n].start_time,
                notes[n].duration, notes[n].velocity, notes[n].mute || 0);
        }
        clip.call("done");
    }
}

function msg_int(value) {
    midiBytesSeen += 1;
    parseMidiByte(Math.max(0, Math.min(255, value | 0)));
}

// midiin normally emits one integer at a time. Accept lists as well so the
// buffer remains reliable if Live/Max batches bytes at a scheduler boundary.
function list() {
    var values = arrayfromargs(arguments);
    for (var i = 0; i < values.length; i += 1) {
        msg_int(values[i]);
    }
}

// Compatibility entry points for older note-only patches. Production defers the
// entire raw byte FIFO so channels and expression cannot overtake note messages.
function midi_channel(value) {
    currentMidiChannel = Math.max(1, Math.min(16, value | 0));
}

function midi_note(pitch, velocity) {
    var status = velocity > 0 ? 0x90 : 0x80;
    handleChannelMessage(status | (currentMidiChannel - 1), [pitch | 0, velocity | 0]);
}

function parseMidiByte(value) {
    if (value >= 0xF8) {
        return; // Realtime bytes do not disturb running status.
    }
    if (value & 0x80) {
        if (value >= 0xF0) {
            runningStatus = -1;
            pendingData = [];
            expectedData = 0;
            return;
        }
        runningStatus = value;
        pendingData = [];
        var kind = value & 0xF0;
        expectedData = (kind === 0xC0 || kind === 0xD0) ? 1 : 2;
        return;
    }
    if (runningStatus < 0 || expectedData === 0) {
        return;
    }
    pendingData.push(value);
    if (pendingData.length >= expectedData) {
        handleChannelMessage(runningStatus, pendingData);
        pendingData = [];
    }
}

function handleChannelMessage(status, data) {
    var kind = status & 0xF0;
    var isNote = kind === 0x80 || kind === 0x90;
    var isExpression = kind === 0xD0 || kind === 0xE0 || (kind === 0xB0 && data[0] === 74);
    if (!isNote && !(plinkyMpeEnabled && isExpression)) {
        return;
    }
    // Do not gate MIDI on LiveAPI.valid. In Live 12 it can remain false during
    // otherwise-functional callbacks; song.get() is the reliable operation.
    if (!initialized || !song || !inputReady ||
            (state !== "LISTENING" && state !== "STOPPING")) {
        return;
    }
    try {
        var velocity = data[1] || 0;
        var type = (kind === 0x80 || velocity === 0) ? "off" : "on";
        var beat = sampleClock();
        if (!clockRunning) { return; }
        if (plinkyMpeEnabled) {
            rawHistory.push({beat: beat, status: status, data: data.slice(), sequence: rawSequence++});
        }
        if (!isNote) { trimBuffer(beat); return; }
        events.push({
            type: type,
            pitch: data[0],
            velocity: velocity,
            channel: (status & 0x0F) + 1,
            beat: beat
        });
        if (type === "on") {
            midiNotesSeen += 1;
            if (state === "LISTENING") {
                setState("LISTENING", "input vel " + velocity + "; note " + data[0] +
                    "; ch " + ((status & 0x0F) + 1) + "; " + midiNotesSeen + " notes");
            }
        }
        trimBuffer(beat);
    } catch (error) {
        setState("LISTENING", "MIDI arrived; timestamp failed");
        fail("could not timestamp MIDI event", error);
    }
}

function trimBuffer(now) {
    var numerator = numberValue(song.get("signature_numerator"));
    var denominator = numberValue(song.get("signature_denominator"));
    var cutoff = now - (RetrospectiveCore.barBeats(numerator, denominator) * LENGTH_FACTORS[lengthIndex]);
    // Increasing Loop Length cannot resurrect already overwritten history.
    listeningSince = Math.max(listeningSince, cutoff);
    while (rawHistory.length && rawHistory[0].beat < cutoff) {
        applyMpeEvent(rawBase, rawHistory.shift());
    }
    var first = 0;
    var held = {};
    while (first < events.length && events[first].beat < cutoff) {
        var event = events[first];
        var key = event.channel + ":" + event.pitch;
        if (!held[key]) { held[key] = []; }
        if (event.type === "on") { held[key].push(event); }
        else { held[key].shift(); }
        first += 1;
    }
    if (first > 0) {
        events.splice(0, first);
        var carry = [];
        for (var key in held) {
            if (!held.hasOwnProperty(key)) { continue; }
            for (var j = 0; j < held[key].length; j += 1) {
                var note = held[key][j];
                carry.push({type: "on", beat: cutoff, pitch: note.pitch,
                    velocity: note.velocity, channel: note.channel});
            }
        }
        events = carry.concat(events);
    }
}

function numberValue(value) {
    if (Object.prototype.toString.call(value) === "[object Array]") {
        value = value[value.length - 1];
    }
    return Number(value);
}

function truthy(value) {
    return numberValue(value) !== 0;
}

function setState(nextState, detail) {
    state = nextState;
    // The direct byte thru is unchanged in ordinary mode. In MPE mode only
    // Listening/Stopping admit input; the sidecar exclusively owns loop output.
    outlet(4, !plinkyMpeEnabled || state === "LISTENING" || state === "STOPPING" ? 1 : 0);
    var velocityDetail = state === "LOOPING" && verifiedVelocityText ?
        " - " + verifiedVelocityText : "";
    var harmonyDetail = state === "LOOPING" && managedHarmony.length ?
        " - harmony loop " + managedHarmony.length + " states" : "";
    var display = state + (managedMpe && state === "LOOPING" ? " - Plinky MPE" : "") + harmonyDetail + velocityDetail + (detail ? " - " + String(detail) : "");
    outlet(0, "set", display);
}

function logWindow(window, noteCount, slotIndex, grid) {
    log("window=" + window.start.toFixed(6) + ".." + window.end.toFixed(6) +
        " notes=" + noteCount + " slot=" + (slotIndex >= 0 ? slotIndex + 1 : "none") +
        " quantize=" + (grid || "off") + " beat(s)");
}

function log(message) {
    post(DEVICE_NAME + ": " + message + "\n");
    outlet(1, message);
}

function fail(message, error) {
    log(message + ": " + error);
}

function notifydeleted() {
    releaseMpe();
    releaseHarmony();
    if (clockTask) { clockTask.cancel(); }
    if (hostBindTask) { hostBindTask.cancel(); }
    if (stopTask) { stopTask.cancel(); }
    cancelLaunchTasks();
}
