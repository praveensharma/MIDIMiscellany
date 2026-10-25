#!/usr/bin/env python3
"""Prepare the receiver companion update for review; does not install it."""
import argparse
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = Path.home() / 'Documents/ChatGPT/Tetrachords Quantizer/implementation/Plinky_Harmony_Receiver/plinky_harmony_receiver.js'
MARKER = '// MIDIMiscellany loop bridge v1'

def prepare(source):
    text = source.read_text().split(MARKER)[0].rstrip() + '\n'
    # Live Scale Sync must follow the same harmony as custom quantizers.
    old = "var match=matcher.match({rootPitchClass:latest.root%12,validPitchClasses:pitches(latest.root,latest.scale),source:'plinky'});"
    new = "var harmony=loop_effective_harmony();\n        var match=matcher.match({rootPitchClass:harmony.root%12,validPitchClasses:pitches(harmony.root,harmony.scale),source:'plinky'});"
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise ValueError('Unrecognized receiver Live Scale implementation; inspect before updating')
    for name in ['publish', 'render_harmony', 'init', 'active', 'notifydeleted']:
        if f'function {name}(' not in text:
            raise ValueError('Missing receiver hook: ' + name)
    return text + '\n' + MARKER + '\n' + (ROOT / 'integration/plinky_loop_receiver_bridge.js').read_text()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(prepare(args.source))
    print(args.output)
