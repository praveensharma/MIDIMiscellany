/* Deterministic musical-time logic shared by Max and Node tests. ES5 syntax is
 * intentional: Max's classic js object uses an older JavaScript engine. */
(function (root) {
    "use strict";

    var EPSILON = 1e-9;
    var MIN_DURATION = 1 / 960;

    function barBeats(numerator, denominator) {
        if (!(numerator > 0) || !(denominator > 0)) {
            throw new Error("time signature values must be positive");
        }
        return numerator * (4 / denominator);
    }

    function completedWindow(songBeat, windowBeats, alignmentBeats) {
        if (!(windowBeats > 0)) {
            throw new Error("window length must be positive");
        }
        var alignment = alignmentBeats > 0 ? alignmentBeats : windowBeats;
        var end = Math.floor((songBeat + EPSILON) / alignment) * alignment;
        return { start: end - windowBeats, end: end, length: windowBeats };
    }

    function gridBeats(gridName) {
        var grids = {
            "off": 0,
            "1/32": 0.125,
            "1/16": 0.25,
            "1/8": 0.5,
            "1/4": 1
        };
        if (typeof grids[gridName] === "undefined") {
            throw new Error("unknown quantize grid: " + gridName);
        }
        return grids[gridName];
    }

    function trackPathFromDevicePath(devicePath) {
        var path = devicePath instanceof Array ? devicePath.join(" ") : String(devicePath || "");
        var tokens = path.replace(/\"/g, "").split(/\s+/);
        for (var i = 0; i < tokens.length - 1; i += 1) {
            if (tokens[i] === "tracks" && /^\d+$/.test(tokens[i + 1])) {
                return tokens.slice(0, i + 2).join(" ");
            }
        }
        return "";
    }

    function quantize(value, step) {
        if (!(step > 0)) {
            return value;
        }
        return Math.round(value / step) * step;
    }

    function eventKey(event) {
        return event.channel + ":" + event.pitch;
    }

    function extractNotes(events, window, quantizeStep) {
        var queues = {};
        var notes = [];
        var sorted = events.slice().sort(function (a, b) {
            return a.beat - b.beat;
        });
        var i;

        for (i = 0; i < sorted.length; i += 1) {
            var event = sorted[i];
            var key = eventKey(event);
            if (event.type === "on") {
                if (!queues[key]) {
                    queues[key] = [];
                }
                queues[key].push(event);
            } else if (event.type === "off" && queues[key] && queues[key].length) {
                var noteOn = queues[key].shift();
                if (event.beat > window.start && noteOn.beat < window.end) {
                    notes.push(makeNote(noteOn, event.beat, window, quantizeStep));
                }
            }
        }

        Object.keys(queues).forEach(function (key) {
            var pending = queues[key];
            for (var q = 0; q < pending.length; q += 1) {
                var noteOn = pending[q];
                if (noteOn.beat < window.end) {
                    notes.push(makeNote(noteOn, window.end, window, quantizeStep));
                }
            }
        });

        return notes.sort(function (a, b) {
            return a.start_time - b.start_time || a.pitch - b.pitch;
        });
    }

    function makeNote(noteOn, noteOffBeat, window, quantizeStep) {
        var originalStart = Math.max(0, noteOn.beat - window.start);
        var originalEnd = Math.min(Math.max(noteOffBeat, noteOn.beat), window.end) - window.start;
        var duration = Math.max(MIN_DURATION, originalEnd - originalStart);
        var start = quantize(originalStart, quantizeStep);
        var latestStart = Math.max(0, window.length - MIN_DURATION);
        start = Math.max(0, Math.min(start, latestStart));
        duration = Math.max(MIN_DURATION, Math.min(duration, window.length - start));
        return {
            pitch: noteOn.pitch,
            start_time: start,
            duration: duration,
            velocity: noteOn.velocity,
            mute: 0,
            channel: noteOn.channel
        };
    }

    function mergeNotes(baseNotes, addedNotes) {
        return baseNotes.concat(addedNotes).sort(function (a, b) {
            return a.start_time - b.start_time || a.pitch - b.pitch;
        });
    }

    var api = {
        EPSILON: EPSILON,
        MIN_DURATION: MIN_DURATION,
        barBeats: barBeats,
        completedWindow: completedWindow,
        gridBeats: gridBeats,
        trackPathFromDevicePath: trackPathFromDevicePath,
        extractNotes: extractNotes,
        mergeNotes: mergeNotes
    };

    root.RetrospectiveCore = api;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
}(this));
