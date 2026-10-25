# Live validation

Source validation is automated with `npm test`. `python3 tools/build_amxd.py`
installs the current build in Ableton's User Library, and `python3
tools/build_amxd.py --verify` verifies it. Application and hardware behavior
must still be checked in Live.

## Primary scenario

1. Start a 4/4 Live Set and create several empty Session scenes.
2. Put the device on a MIDI track before the External Instrument or MIDI output.
3. Set Loop Length to **1 bar**, Quantize to **Off**, Overdub to **Off**, and
   Immediate to **Off** for the boundary-launch test below.
   Confirm the track's Monitor selector changes to **In** while the device says
   LISTENING.
4. Play random notes for several bars.
5. Halfway through a new bar, turn the main toggle off.
6. Confirm the clip is exactly one bar and contains the trailing four beats,
   ending exactly at the toggle (including the current partial bar).
   Trigger midway through a bar and confirm playback waits for the next boundary
   matching Loop Length. For example, a four-bar clip must begin on Live's next
   four-bar boundary, not merely the next bar's beat one.
7. Compare several note starts with the played timing; they should not be snapped.
8. Confirm the clip launches and loops cleanly.
   Confirm the track's Monitor selector changed to **Auto** before playback.
9. Turn the toggle on again; playback should enter STOPPING and then the state
   and control should both read LISTENING.
   Confirm the track's Monitor selector returns to **In immediately**. Begin
   playing the replacement phrase during STOPPING and confirm those early notes
   remain in the next capture. Confirm the track eventually no longer says
   `Playing from session`.
10. Play a different bar and capture again. Confirm the same managed slot now
    contains only the new notes and the state reports `replace`.

## Overdub scenario

Capture and stop a one-bar loop, turn Overdub on, play a second one-bar phrase,
and capture again. Confirm the same slot contains both layers and the state
reports `overdub`. Changing Loop Length should start a replacement rather than
combining incompatible loop lengths.

## Quantized scenario

Repeat with Loop Length **2 bars** and Quantize **1/16**. Confirm a two-bar clip
and starts on 0.25-beat divisions.

## Boundary checks

- At any mid-bar position, capture eight bars: confirm the final partial bar is included.
- Hold a note across the capture start: its retained portion begins at clip zero.
- Start a note inside the window and hold it past the end: it should be trimmed.
- Capture with no notes: no clip should be created and the diagnostic should say
  that the last window contained no notes.
- Fill every Session slot except the device-managed one, then recapture: the device
  should reuse only its own slot.
- Move the device into a Rack: this is not an MVP-supported topology; keep it
  directly on the MIDI track for the first validation.

## Diagnostics

Open Max's console and filter for `MIDIMiscellany`. Each capture logs
the window, note count, slot index, quantize grid, and any Live API exception.

## Plinky progression

1. Reload both MIDIMiscellany v23 and the updated Plinky Harmony Receiver. Leave
   the receiver on its dedicated Plinky input track, Monitor In, Publish Harmony.
2. Choose a short loop, play C then F, and capture. Confirm the looper reports
   `harmony loop 2 states` (or the actual number of decoded changes in the window).
3. Stop playing Plinky. Watch the receiver repeat the captured root/chord/scale
   progression on every clip pass; listen to quantized instruments at transitions.
4. Change live Plinky harmony while looping. The receiver must continue publishing
   the captured progression. Switch to Listening; the latest live harmony returns.
5. Capture a window whose first chord was selected before the recording window.
   Confirm that chord is restored at each wrap, not the preceding pass's last chord.
6. Repeat with Immediate on/off, a transport stop/start, manual clip stop/relaunch,
   another capture, and optional Live Scale Sync. Confirm harmony follows actual
   clip phase and releases when playback stops. Check note/harmony ordering at
   simultaneous chord/note changes; automated tests cannot prove hardware timing.
7. Remove the looper during playback. The receiver must resume live harmony within
   one second even if a deletion callback did not run. Reloading devices requires
   recapturing the harmony timeline.

## Plinky MPE hardware validation (required)

1. First repeat the ordinary MIDI primary, Quantize and Overdub scenarios with
   **Plinky MPE Off**. Confirm an ordinary capture writes unmuted notes.
2. Route Plinky input to the looper and its output to the intended receiver,
   avoiding a MIDI return loop. Use a downstream MIDI monitor; verify Live is
   configured to preserve MPE channels/expression on this route. Start at a low
   listening level and keep the receiver's panic control available.
3. Enable **Plinky MPE On**, Quantize Off, Overdub Off, and refill the history.
   Play simultaneous voices through descending member channels. Include repeated
   equal pitches on separate channels, pressure, slide/CC74, and pitch bend.
4. Capture; inspect the muted visual notes. Stop playing Plinky. Compare monitor
   bytes/channels/order with the input trace and listen to each voice's expression.
   Confirm one Note On per intended voice, including when the host track is armed.
5. Establish expression and hold notes before the capture's left edge. Confirm
   expression/voices reconstruct at launch and every wrap. Hold notes across the
   right edge too; expect one boundary release and retrigger, with no accumulation.
6. Repeat with Immediate on/off; move the playing position forward and backward,
   stop/restart the transport, stop/relaunch the managed clip, press Listening,
   recapture, and remove the device. Inspect Note Offs and confirm no held voices.
   The Max `panic` message also stops the loop and releases owned output voices.
7. While looping, play additional live input on an armed track: it must not double
   the MPE loop. Return to Listening: raw notes and all control bytes pass again.
8. With the harmony receiver active, capture a progression and confirm the
   separate root/chord/scale timeline still loops and restores live on Listening.
9. Turn MPE Off, refill history, then record ordinary notes with Quantize and
   Overdub. Confirm normal playback resumes. Save/reopen an MPE Set: the visual
   clip remains muted and raw performance requires recapture.

Record observed jitter at the actual target tempo/load. The 10 ms low-priority
scheduler and simultaneous harmony publication remain hardware timing limits;
automated tests exercise message semantics, not audible or physical proof.
