# Architecture

## Signal and control paths

```text
midiin -> thru gate (open for ordinary MIDI/Listening) -> midiout
   |
   +-> deferlow -> JavaScript MIDI parser -> rolling musical-time event buffer

CAPTURE / parameters -> JavaScript state machine -> Live API -> Session clip
```

Raw MIDI thru uses a Max gate independently of the JavaScript capture path, so the device does not add a
JavaScript hop to the played notes. The analysis branch is deferred because the
Live API can only be used from Max's low-priority thread.

## State machine

`LISTENING + toggle off`:

1. Read `current_song_time` and the Set time signature.
2. Convert the chosen bar fraction to beats.
3. End capture at the toggle's continuous beat time, taking exactly N bars.
4. Extract notes intersecting `[start, end)` and clip them at both boundaries.
5. Optionally quantize Note On positions; preserve duration except at boundaries.
6. In Replace mode, use only the new window. In Overdub mode, merge it with the
   stored managed-loop notes when the loop length is unchanged.
7. Recreate the device-managed Session clip in the same slot, add notes, and set
   its loop markers and launch quantization explicitly.
8. Enter `QUEUING`. On a later low-priority task, read the clip back and verify
   its note content, length, loop markers, and launch quantization. With Immediate
   disabled, launch quantization matches
   Loop Length, so a four-bar loop begins on a four-bar transport boundary rather
   than merely the next bar. Only then fire it and enter `LOOPING`.

`LOOPING + toggle on` calls `stop_all_clips` on the host track and enters
`STOPPING`. At the toggle gesture it immediately changes Monitor to In and clears
the old loop-generated buffer. New played notes are buffered throughout STOPPING.
The device polls the track's `playing_slot_index` and returns to `LISTENING` once
Live confirms Session playback has ended, without clearing those new notes.

## Track monitoring

The device sets its host MIDI track to Monitor **In** while `LISTENING`. After a
capture succeeds it requests **Auto**, verifies that state alongside the clip
configuration, and only then fires the Session clip. It leaves the track on Auto
through `QUEUING`, `STARTING`, and `LOOPING`. The Listening gesture changes the
track to In immediately while clip-stop confirmation continues in the
background. Input admission and clip launch require verified monitoring values;
API errors cannot silently bypass those checks.

## Clip-slot ownership

The device remembers only the slot it created. The initial capture uses an empty
slot; later captures delete and recreate only that device-managed slot. Replace
is the default. Overdub retains the stored note layer and appends the new window.
On Set/device reload, it reclaims a clip whose name begins with
`MIDIMiscellany -` and stops it if the restored UI state is Listening.

## Rolling buffer

Events are retained for the selected duration, with active notes carried over at
the left boundary. Recording accepts notes only in LISTENING/STOPPING with
Monitor In verified. A 10 ms task unwraps song-position loops into continuous
elapsed beats. Detected seeks and stop/start invalidate prior recording history.
The duration must be filled before capture; increasing length requires more history.

The host is derived from this_device's canonical path, never selected_track.
Immediate launch reads back the phase after relative jumps, with bounded retries.
Cancellation removes launch tasks, and callbacks check their expected state.

## Plinky harmony playback

The receiver remains the only harmony publisher. Its live NRPN decoder continues
maintaining `plinkyReceiverCache` while MIDIMiscellany samples complete snapshots
on the same continuous clock as notes. Trimming retains the harmony preceding the
window's left edge. Every take has one harmony timeline, including note overdubs.

`plinkyLoopPlayback` is an owner-tagged, expiring JSON command in the existing
`tetrachords_harmony_v1` Max Global. The looper updates it from actual clip phase;
the receiver publishes complete snapshots through its existing atomic publication
function and harmony bus. Its readouts and optional Live Scale Sync follow that
same state. Live NRPN decoding cannot overwrite the loop's publication. Loop playback never
rewrites the live receiver cache.
A separate 10 ms receiver task restores the latest live state when ownership is
released or its one-second lease expires. Competing loopers are rejected; the
receiver's existing conflict check against unrelated publishers stays active.

The receiver update is staged by `tools/prepare_plinky_receiver.py`, which appends
`integration/plinky_loop_receiver_bridge.js` and adjusts Live Scale Sync to use
the effective harmony. This operation is idempotent and fails on unrecognized
receiver source. Neither notes nor harmony snapshots are sent back to Plinky.

## Opt-in Plinky MPE sidecar (v23)

The default ordinary-note path is unchanged. The Plinky MPE parameter starts off.
All input bytes enter one FIFO deferlow branch, preserving channel/status and
expression ordering before parsing; the independent thru branch passes all bytes.
In MPE mode only, a second rolling raw buffer keeps the supported messages with
beat time and monotonically increasing sequence. Pruning folds older messages
into a boundary state containing expression and per-channel/pitch note queues.
Capture clones that state and folds any remaining pre-window events into it.

MPE clip notes are muted and overlapping equal pitches are unioned for display.
Readback verifies mute as well as content before launch. The sidecar exclusively
emits notes through JS outlet 3 to midiout; outlet 4 closes the direct thru gate
through QUEUING/STARTING/LOOPING in MPE mode. At takeover, currently held live
voices are released. Ordinary MIDI always leaves that gate open.

The 10 ms clock task reads actual clip playing_position after harmony playback.
Normal advances emit every crossed event in capture order; wraps emit the tail,
release output voices, restore initial expression/held voices, then emit the head.
Seeks, initial immediate launch, and stalls exceeding a loop chase the destination
state rather than replaying skipped attacks. Startup waits until Immediate's
phase verification reaches LOOPING. Notes crossing both edges retrigger per wrap.
Boundary launch emits from the left edge on its first playback tick.

Transport/clip stop and all explicit exit paths release owned notes and reset
owned expression. Raw history and parser state reset with each new take; mode
changes stop playback. MPE rejects Quantize/Overdub and cannot be overdubbed into
an ordinary take. Harmony retains its separate existing timeline/receiver lease.
The sidecar is not persisted into a Live Set, and Max scheduling cannot guarantee
sample-accurate output or global ordering against the independent harmony bus.
