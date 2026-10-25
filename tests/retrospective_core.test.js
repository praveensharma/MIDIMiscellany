"use strict";

const assert = require("assert");
const core = require("../device/retrospective_core.js");

function close(actual, expected, message) {
    assert(Math.abs(actual - expected) < 1e-8,
        `${message}: expected ${expected}, got ${actual}`);
}

assert.strictEqual(core.barBeats(4, 4), 4);
assert.strictEqual(core.barBeats(3, 4), 3);
assert.strictEqual(core.barBeats(6, 8), 3);

let window = core.completedWindow(66, 4);
assert.deepStrictEqual(window, { start: 60, end: 64, length: 4 });
window = core.completedWindow(64, 4);
assert.deepStrictEqual(window, { start: 60, end: 64, length: 4 });
window = core.completedWindow(66, 2);
assert.deepStrictEqual(window, { start: 64, end: 66, length: 2 });
window = core.completedWindow(55, 32, 4);
assert.deepStrictEqual(
    window,
    { start: 20, end: 52, length: 32 },
    "eight-bar capture ends at the latest completed bar instead of an eight-bar block"
);

assert.strictEqual(core.gridBeats("off"), 0);
assert.strictEqual(core.gridBeats("1/16"), 0.25);
assert.strictEqual(
    core.trackPathFromDevicePath("live_set tracks 3 devices 1"),
    "live_set tracks 3"
);
assert.strictEqual(
    core.trackPathFromDevicePath(["live_set", "tracks", "7", "devices", "0", "chains", "0", "devices", "2"]),
    "live_set tracks 7"
);
assert.strictEqual(core.trackPathFromDevicePath("this_device"), "");

const events = [
    { type: "on", pitch: 48, velocity: 90, channel: 1, beat: 59.8 },
    { type: "off", pitch: 48, velocity: 0, channel: 1, beat: 60.4 },
    { type: "on", pitch: 60, velocity: 101, channel: 1, beat: 60.13 },
    { type: "off", pitch: 60, velocity: 0, channel: 1, beat: 60.63 },
    { type: "on", pitch: 64, velocity: 88, channel: 2, beat: 63.8 },
    { type: "off", pitch: 64, velocity: 0, channel: 2, beat: 64.5 }
];

let notes = core.extractNotes(events, { start: 60, end: 64, length: 4 }, 0);
assert.strictEqual(notes.length, 3, "note held across capture start is retained");
assert.strictEqual(notes.shift().start_time, 0);
assert.strictEqual(notes[0].pitch, 60);
close(notes[0].start_time, 0.13, "unquantized start");
close(notes[0].duration, 0.5, "unquantized duration");
assert.strictEqual(notes[0].velocity, 101);
assert.strictEqual(notes[1].channel, 2, "buffer retains source channel");
close(notes[1].duration, 0.2, "note crossing loop end is trimmed");

notes = core.extractNotes(events, { start: 60, end: 64, length: 4 }, 0.25);
notes.shift();
close(notes[0].start_time, 0.25, "1/16 quantized start");
close(notes[0].duration, 0.5, "quantization preserves normal duration");

const hanging = [
    { type: "on", pitch: 72, velocity: 77, channel: 1, beat: 62 }
];
notes = core.extractNotes(hanging, { start: 60, end: 64, length: 4 }, 0);
assert.strictEqual(notes.length, 1);
close(notes[0].duration, 2, "unreleased note is capped at loop end");

const endQuantize = [
    { type: "on", pitch: 75, velocity: 99, channel: 1, beat: 63.99 },
    { type: "off", pitch: 75, velocity: 0, channel: 1, beat: 64.2 }
];
notes = core.extractNotes(endQuantize, { start: 60, end: 64, length: 4 }, 0.25);
assert(notes[0].start_time < 4, "quantized note remains inside clip");
assert(notes[0].duration > 0, "boundary note has positive duration");

const priorLoop = [
    { pitch: 48, start_time: 1, duration: 0.5, velocity: 90, mute: 0, channel: 1 }
];
const newLayer = [
    { pitch: 60, start_time: 0.25, duration: 0.25, velocity: 100, mute: 0, channel: 1 }
];
const overdubbed = core.mergeNotes(priorLoop, newLayer);
assert.strictEqual(overdubbed.length, 2);
assert.strictEqual(overdubbed[0].pitch, 60, "overdub merge is sorted by clip time");
assert.strictEqual(priorLoop.length, 1, "overdub merge does not mutate stored notes");

console.log("retrospective_core: all tests passed");
