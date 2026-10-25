# MIDIMiscellany

Current release: **v23** (package version `0.23.0`). See [release notes](CHANGELOG.md).

A small Max for Live MIDI device that turns the last N bars ending at your toggle
into a looping Session View clip. The interaction is intentionally simple:

1. Leave the main toggle active in **LISTENING** and play while Live's transport
   is running.
2. Toggle it inactive after hearing a phrase you want to keep.
3. The exact trailing window becomes a clip and the control reads
   **LOOPING**.
4. Toggle it active again. The device clears the old history, verifies Monitor In,
   and buffers your next performance while confirming the old clip stopped.
5. Play another phrase and capture again: with **Overdub** off (the default),
   the device replaces its previous clip in the same slot. With Overdub on, it
   combines the new window with the stored loop. The recording buffer itself
   always replaces old history; Overdub only affects the captured clip.

The device supports ordinary MIDI notes, opt-in Plinky MPE, Plinky harmony capture, six loop lengths,
and optional note-start quantization. Incoming MIDI passes through unchanged
whenever Live admits it to the device.

The v23 status shows the latest **input vel** while Listening and the captured
**clip vel** range while Looping. "Verified" means the device read those
velocities back from the generated clip and matched them to the captured notes;
it does not measure MIDI after downstream devices or at the hardware receiver.
Use these readings when comparing a quiet loop with direct input. Reload the
rebuilt device in Live to load v23.

## Plinky MPE (opt-in)

Leave **Plinky MPE Off** for all other instruments: ordinary clip playback,
Quantize, Overdub, and unmodified raw thru retain their existing behavior.
For recording Plinky's own MPE performance, turn **Plinky MPE On** while
Listening, select Quantize **Off** and Overdub **Off**, and refill the selected
history duration. Mode changes stop playback and clear the recording history.
MPE capture is rejected if Quantize or Overdub is enabled; changing Quantize
while an MPE loop plays does not alter the raw performance.

MPE mode captures Note On/Off (including release velocity), channel pressure,
CC74, and pitch bend as ordered raw messages with their original channels.
No MPE negotiation or initialization messages are required. The Live clip is a
**muted visual guide** and phase clock; the sidecar scheduler owns MIDI output.
Same-pitch overlaps merge only in that visual guide; all raw voices remain
separate. Keep the visual notes muted and the clip loop markers unchanged.
Live input thru is gated during MPE loop playback, including on an armed track,
and resumes unchanged in Listening. Ordinary MIDI keeps its direct thru path.

Expression active before the left boundary and notes held across it are carried
into each loop. At a wrap, held output notes receive Note Off before the initial
expression and held voices are restored. Phase jumps chase the destination's
expression and active voices, avoiding a burst of skipped notes. Transport stop,
clip stop, Listening, mode changes, panic, and deletion release owned notes and
reset their expression. A note held across both boundaries is retriggered each
wrap. Unobserved expression starts at pressure 0, CC74 64, and centered bend;
expression established before the device began listening cannot be recovered.

The sidecar polls actual clip phase every **10 ms on Max's low-priority thread**.
Messages crossed within a poll retain their recorded order but may be emitted
together; scheduler stalls add jitter. This is channel/expression preservation,
not a sample-accurate MIDI recorder. Immediate launch chases the verified
starting phase; boundary launch starts from the left edge. Harmony NRPN metadata
continues on the separate receiver timeline below.

MPE sidecars are **session-only**: saving/reloading retains the muted visual clip,
not its raw performance. Recapture after reload. Use a downstream MIDI monitor to
verify that Live's routing and receiving device preserve member channels and
expression. Source tests cannot establish that routing or audible fidelity.

## Plinky harmony loops

Use the updated **Plinky Harmony Receiver** on its dedicated Plinky input track,
with Monitor In and Publish Harmony enabled. Keep only one receiver publishing.
The receiver and MIDIMiscellany share harmony inside Max; the receiver does not
need MIDI routed back from the looping clip.

While Listening, MIDIMiscellany records the receiver's complete decoded harmony
states. Capture carries the harmony active at the window's beginning and every
subsequent change. While Looping, the receiver follows that captured timeline
using the Session clip's actual playing position, including wraps and phase jumps.
The status reads **harmony loop N states**. Live Plinky changes update the
receiver's live cache without changing the loop's published harmony. Listening
releases the loop and restores the latest live harmony. Deleting the looper or
losing its one-second heartbeat also releases ownership.

Harmony timing uses 10 ms low-priority polls in each device; it is not sample
accurate, and note/harmony order at the same instant needs hardware validation.
Quantize moves notes only; harmony changes retain their captured times. Overdub
combines notes but replaces the harmony timeline with the new take. Harmony
history is held for this device session; saved/reloaded clips require recapture.

The receiver companion source lives in the Tetrachords Quantizer project.
`tools/prepare_plinky_receiver.py --output /private/tmp/plinky_harmony_receiver.js`
prepares its update without installing it. `node tests/plinky_receiver_integration.test.js`
runs that project's protocol/quantizer tests plus loop takeover/release tests
against the prepared receiver. Set `PLINKY_IMPLEMENTATION_ROOT` if that project
is in a different location. An old or non-publishing receiver blocks a harmony
capture before replacing a clip and reports the problem in the looper status.

## Build

```sh
npm test
npm run build
npm run build:verify
# Install the verified source into Ableton's User Library:
python3 tools/build_amxd.py
```

The Python builder without `--output-dir` installs the device and its JavaScript dependencies directly at:

`~/Music/Ableton/User Library/Max4Live/MIDIMiscellany/`

Rebuild with the same command after every change; use `python3
tools/build_amxd.py --verify` to check that the installed files exactly match
the repository source.

To build without installing, use `python3 tools/build_amxd.py --output-dir
dist/MIDIMiscellany`; add `--verify` with the same directory to verify that build.

## Use in Live 12

1. Put the device on the MIDI track receiving the keyboard or synth.
2. Keep Live's transport running and use a 4/4 Set for the first hardware test.
3. Choose **Loop Length**, **Quantize**, and **Overdub**. Leave Overdub off for
   predictable replace behavior. **Immediate** defaults on for phase-aligned,
   no-queue playback; turn it off for length-matched boundary launch.
4. MIDI-map the **LISTENING / LOOPING** toggle to the footswitch, or click it in
   the device. On means Listening; off means Looping.

MIDIMiscellany automatically manages its host track's Monitor setting: **In**
while Listening, then **Auto** after a successful capture and throughout clip
playback. It waits until Live reports Auto before firing the generated clip and
requests In immediately when Listening is selected. The old loop buffer is
cleared at that gesture, while new notes played during Live's STOPPING interval
are retained. The device's direct MIDI thru remains active, but it cannot
substitute for track monitoring because Live applies the track's monitor gate
before MIDI reaches the device. Recording opens only after In is confirmed.
Play at least the selected duration after entering Listening; an incomplete
history is rejected instead of filling the clip with unrecorded silence.

The device uses the first empty Session slot on its hosting track, remembers
that slot as device-managed, and reuses it for later captures. With Overdub off,
each later capture replaces the managed clip. With Overdub on and an unchanged
loop length, the newly captured notes are combined with the stored notes.

**Immediate** provides a no-queue launch and is on by default. After Live confirms
the new clip is running, the device computes the phrase phase from Live's current
song time and performs an unquantized relative playhead jump. This removes the
intentional boundary wait, but the Live API exposes launch and playhead movement
as separate operations, so external MIDI may briefly emit a note from the
uncorrected position and notes already spanning the destination are not chased.
Turn Immediate off to use the length-matched boundary launch instead.

## MVP policies and limitations

Quantize also works while LOOPING: choose a grid to move note starts in the
existing clip without relaunching it. Off restores the original captured timing,
including when the capture was initially quantized. Changes are read back before
the status reports success. Original timing is retained for this device session;
it is not reconstructed from a previously saved/reloaded clip.

- Notes intersecting the capture window are included.
- Notes extending beyond the end of the window are trimmed to the boundary.
- Notes held across the beginning are clipped to time zero.
- A polled continuous beat clock unwraps Arrangement loops. A detected seek or
  transport stop/start discards old history; refill the selected duration.
- Note content is read back before launch. Immediate playback position is read
  back after any phase jump. Failed verification stops playback and returns to
  listening rather than reporting success.
- Ordinary MIDI clip playback uses Live's note-channel behavior. Original MPE
  channels and expression require the explicit Plinky MPE mode above.
- Other CCs, polyphonic key pressure, sustain, program changes, and SysEx are not
  captured by the MPE sidecar; raw thru while Listening remains unchanged.
- Capture requires Live's transport to be playing. Time-signature changes inside
  the buffered region are not reconstructed.
- Live API calls are main-thread/deferred operations. Source and logic tests do
  not prove application loadability or hardware timing; use the validation steps
  in [`docs/VALIDATION.md`](docs/VALIDATION.md).

The committed [`dist/MIDIMiscellany/`](dist/MIDIMiscellany/) folder contains the
v23 AMXD and both required JavaScript files. Copy the **whole folder** into your
Ableton User Library's Max4Live directory and reload the device; the AMXD depends
on the adjacent scripts. `npm run build` reproduces this package without changing
your installed device. Backups and Python caches stay local and are ignored by Git.

`npm test` is self-contained. `npm run test:receiver` additionally requires the
separate Tetrachords Quantizer implementation; configure `PLINKY_IMPLEMENTATION_ROOT`
as described above. It is not required to build or test the ordinary MIDI/MPE runtime.

## Repository layout

- `device/MIDIMiscellany.maxpat` — editable Max patch
- `device/midimiscellany.js` — MIDI parser, rolling buffer, Live API
- `device/retrospective_core.js` — deterministic window/note transformation
- `tools/build_amxd.py` — reproducible AMXD packager and verifier
- `tests/` — Node tests for the timing and note-edge policies
