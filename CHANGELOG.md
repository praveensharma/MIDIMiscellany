# Release notes

## v23 — 2026-10-24

Package version: `0.23.0`. Runtime: `midimiscellany_runtime_v23.js`.

- Add explicit **Plinky MPE**, off by default. Ordinary MIDI retains its existing
  clip playback, note quantization, overdub, velocity, and raw thru behavior.
- Capture Plinky Note On/Off, release velocity, channel pressure, CC74, and pitch
  bend with original channels and event ordering, including same-pitch voices.
- Use muted visual clip notes and a raw sidecar as the sole MPE loop output owner.
  Carry left-edge expression and held notes, follow loop phase/wrap, chase phase
  jumps, and release voices on stop, Listening, panic, mode changes, and deletion.
- Retain the separate Plinky root/chord/scale harmony replay and receiver bridge.
- Add tests for MPE lifecycle, production patch routing, and ordinary MIDI return.
- Provide a reproducible local distribution build and verification commands.

### Operating limits

Plinky MPE requires Quantize Off and Overdub Off. The raw sidecar uses 10 ms
low-priority polling and is session-only; saved/reloaded sets require recapture.
The visual clip must remain muted. Harmony replay requires the updated receiver
on its dedicated input track. See README and docs/VALIDATION.md for setup.

### Validation

Automated ordinary MIDI/MPE runtime tests, companion receiver integration tests,
and local/installed AMXD and script verification passed on the release machine.
Live loadability, downstream routing, hardware timing, and audible performance
remain to be validated with the documented Live/Plinky scenarios.
