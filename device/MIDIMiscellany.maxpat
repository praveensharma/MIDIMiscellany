{
  "patcher": {
    "fileversion": 1,
    "appversion": {
      "major": 9,
      "minor": 0,
      "revision": 10,
      "architecture": "x64",
      "modernui": 1
    },
    "classnamespace": "box",
    "rect": [
      100.0,
      100.0,
      760.0,
      420.0
    ],
    "bglocked": 0,
    "openinpresentation": 1,
    "default_fontsize": 12.0,
    "default_fontface": 0,
    "default_fontname": "Arial",
    "gridonopen": 1,
    "gridsize": [
      15.0,
      15.0
    ],
    "toolbarvisible": 1,
    "boxanimatetime": 200,
    "imprint": 0,
    "enablehscroll": 1,
    "enablevscroll": 1,
    "devicewidth": 790.0,
    "description": "Capture the previous completed musical window as a looping Session MIDI clip.",
    "digest": "A footswitch-friendly retrospective MIDI looper.",
    "tags": "MIDI looper retrospective capture footswitch Session",
    "autosave": 0,
    "boxes": [
      {
        "box": {
          "id": "obj-title",
          "maxclass": "comment",
          "fontface": 1,
          "fontsize": 15.0,
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            20.0,
            15.0,
            300.0,
            22.0
          ],
          "presentation": 1,
          "presentation_rect": [
            15.0,
            10.0,
            300.0,
            22.0
          ],
          "text": "MIDIMiscellany"
        }
      },
      {
        "box": {
          "id": "obj-subtitle",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            20.0,
            42.0,
            500.0,
            20.0
          ],
          "presentation": 1,
          "presentation_rect": [
            15.0,
            35.0,
            500.0,
            20.0
          ],
          "text": "Play first. Stomp after. The last N bars loop."
        }
      },
      {
        "box": {
          "id": "obj-capture",
          "maxclass": "live.text",
          "mode": 1,
          "appearance": 0,
          "activebgcolor": [
            0.19,
            0.19,
            0.19,
            1.0
          ],
          "activebgoncolor": [
            0.95,
            0.55,
            0.1,
            1.0
          ],
          "activetextcolor": [
            0.95,
            0.95,
            0.95,
            1.0
          ],
          "activetextoncolor": [
            0.08,
            0.08,
            0.08,
            1.0
          ],
          "numinlets": 1,
          "numoutlets": 2,
          "outlettype": [
            "",
            ""
          ],
          "parameter_enable": 1,
          "patching_rect": [
            20.0,
            90.0,
            110.0,
            28.0
          ],
          "presentation": 1,
          "presentation_rect": [
            15.0,
            67.0,
            110.0,
            30.0
          ],
          "text": "LOOPING",
          "texton": "LISTENING",
          "varname": "capture",
          "saved_attribute_attributes": {
            "valueof": {
              "parameter_longname": "Capture",
              "parameter_shortname": "Capture",
              "parameter_type": 2,
              "parameter_mmin": 0,
              "parameter_mmax": 1,
              "parameter_mappable": 1,
              "parameter_initial_enable": 1,
              "parameter_initial": [
                1
              ]
            }
          }
        }
      },
      {
        "box": {
          "id": "obj-listen-prepend",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [
            ""
          ],
          "patching_rect": [
            150.0,
            93.0,
            145.0,
            22.0
          ],
          "text": "prepend listen_enabled"
        }
      },
      {
        "box": {
          "id": "obj-length-label",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            20.0,
            145.0,
            80.0,
            20.0
          ],
          "presentation": 1,
          "presentation_rect": [
            145.0,
            68.0,
            78.0,
            20.0
          ],
          "text": "Loop Length"
        }
      },
      {
        "box": {
          "id": "obj-length-menu",
          "maxclass": "umenu",
          "items": [
            "1/4 bar",
            ",",
            "1/2 bar",
            ",",
            "1 bar",
            ",",
            "2 bars",
            ",",
            "4 bars",
            ",",
            "8 bars"
          ],
          "numinlets": 1,
          "numoutlets": 3,
          "outlettype": [
            "int",
            "",
            ""
          ],
          "parameter_enable": 1,
          "patching_rect": [
            105.0,
            143.0,
            100.0,
            22.0
          ],
          "presentation": 1,
          "presentation_rect": [
            225.0,
            67.0,
            95.0,
            22.0
          ],
          "varname": "loop_length",
          "saved_attribute_attributes": {
            "valueof": {
              "parameter_longname": "Loop Length",
              "parameter_shortname": "Length",
              "parameter_type": 2,
              "parameter_mmax": 5,
              "parameter_enum": [
                "1/4 bar",
                "1/2 bar",
                "1 bar",
                "2 bars",
                "4 bars",
                "8 bars"
              ],
              "parameter_mappable": 1,
              "parameter_initial_enable": 1,
              "parameter_initial": [
                2
              ]
            }
          }
        }
      },
      {
        "box": {
          "id": "obj-length-prepend",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [
            ""
          ],
          "patching_rect": [
            220.0,
            143.0,
            125.0,
            22.0
          ],
          "text": "prepend length_index"
        }
      },
      {
        "box": {
          "id": "obj-quantize-label",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            20.0,
            180.0,
            65.0,
            20.0
          ],
          "presentation": 1,
          "presentation_rect": [
            340.0,
            68.0,
            62.0,
            20.0
          ],
          "text": "Quantize"
        }
      },
      {
        "box": {
          "id": "obj-quantize-menu",
          "maxclass": "umenu",
          "items": [
            "Off",
            ",",
            "1/32",
            ",",
            "1/16",
            ",",
            "1/8",
            ",",
            "1/4"
          ],
          "numinlets": 1,
          "numoutlets": 3,
          "outlettype": [
            "int",
            "",
            ""
          ],
          "parameter_enable": 1,
          "patching_rect": [
            90.0,
            178.0,
            80.0,
            22.0
          ],
          "presentation": 1,
          "presentation_rect": [
            402.0,
            67.0,
            75.0,
            22.0
          ],
          "varname": "quantize_grid",
          "saved_attribute_attributes": {
            "valueof": {
              "parameter_longname": "Quantize Grid",
              "parameter_shortname": "Quantize",
              "parameter_type": 2,
              "parameter_mmax": 4,
              "parameter_enum": [
                "Off",
                "1/32",
                "1/16",
                "1/8",
                "1/4"
              ],
              "parameter_mappable": 1,
              "parameter_initial_enable": 1,
              "parameter_initial": [
                0
              ]
            }
          }
        }
      },
      {
        "box": {
          "id": "obj-quantize-prepend",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [
            ""
          ],
          "patching_rect": [
            185.0,
            178.0,
            135.0,
            22.0
          ],
          "text": "prepend quantize_index"
        }
      },
      {
        "box": {
          "id": "obj-overdub-label",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            340.0,
            180.0,
            65.0,
            20.0
          ],
          "presentation": 1,
          "presentation_rect": [
            495.0,
            68.0,
            62.0,
            20.0
          ],
          "text": "Overdub"
        }
      },
      {
        "box": {
          "id": "obj-overdub-toggle",
          "maxclass": "live.toggle",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [
            "int"
          ],
          "parameter_enable": 1,
          "patching_rect": [
            410.0,
            178.0,
            22.0,
            22.0
          ],
          "presentation": 1,
          "presentation_rect": [
            558.0,
            67.0,
            22.0,
            22.0
          ],
          "varname": "overdub",
          "saved_attribute_attributes": {
            "valueof": {
              "parameter_longname": "Overdub",
              "parameter_shortname": "Overdub",
              "parameter_type": 2,
              "parameter_mmin": 0,
              "parameter_mmax": 1,
              "parameter_mappable": 1,
              "parameter_initial_enable": 1,
              "parameter_initial": [
                0
              ]
            }
          }
        }
      },
      {
        "box": {
          "id": "obj-overdub-prepend",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [
            ""
          ],
          "patching_rect": [
            445.0,
            178.0,
            145.0,
            22.0
          ],
          "text": "prepend overdub_enabled"
        }
      },
      {
        "box": {
          "id": "obj-immediate-label",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            340.0,
            210.0,
            105.0,
            20.0
          ],
          "presentation": 1,
          "presentation_rect": [
            670.0,
            68.0,
            65.0,
            20.0
          ],
          "text": "Immediate"
        }
      },
      {
        "box": {
          "id": "obj-immediate-toggle",
          "maxclass": "live.toggle",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [
            "int"
          ],
          "parameter_enable": 1,
          "patching_rect": [
            450.0,
            208.0,
            22.0,
            22.0
          ],
          "presentation": 1,
          "presentation_rect": [
            744.0,
            67.0,
            22.0,
            22.0
          ],
          "varname": "immediate_launch",
          "saved_attribute_attributes": {
            "valueof": {
              "parameter_longname": "Immediate Launch",
              "parameter_shortname": "Immediate",
              "parameter_type": 2,
              "parameter_mmin": 0,
              "parameter_mmax": 1,
              "parameter_mappable": 1,
              "parameter_initial_enable": 1,
              "parameter_initial": [
                1
              ]
            }
          }
        }
      },
      {
        "box": {
          "id": "obj-immediate-prepend",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [
            ""
          ],
          "patching_rect": [
            480.0,
            208.0,
            205.0,
            22.0
          ],
          "text": "prepend immediate_launch_enabled"
        }
      },
      {
        "box": {
          "id": "obj-state-label",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            20.0,
            220.0,
            40.0,
            20.0
          ],
          "presentation": 1,
          "presentation_rect": [
            15.0,
            108.0,
            40.0,
            20.0
          ],
          "text": "State"
        }
      },
      {
        "box": {
          "id": "obj-state",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [
            ""
          ],
          "patching_rect": [
            65.0,
            218.0,
            590.0,
            22.0
          ],
          "presentation": 1,
          "presentation_rect": [
            58.0,
            106.0,
            707.0,
            22.0
          ],
          "text": "LISTENING - loading"
        }
      },
      {
        "box": {
          "id": "obj-midiin",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [
            "int"
          ],
          "patching_rect": [
            20.0,
            280.0,
            48.0,
            22.0
          ],
          "text": "midiin"
        }
      },
      {
        "box": {
          "id": "obj-note-deferlow",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [
            ""
          ],
          "patching_rect": [
            180.0,
            280.0,
            57.0,
            22.0
          ],
          "text": "deferlow"
        }
      },
      {
        "box": {
          "id": "obj-js",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 5,
          "outlettype": [
            "",
            "",
            "",
            "",
            ""
          ],
          "patching_rect": [
            285.0,
            280.0,
            210.0,
            22.0
          ],
          "text": "js midimiscellany_runtime_v23.js"
        }
      },
      {
        "box": {
          "id": "obj-midiout",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            615.0,
            280.0,
            55.0,
            22.0
          ],
          "text": "midiout"
        }
      },
      {
        "box": {
          "id": "obj-thisdevice",
          "maxclass": "newobj",
          "patching_rect": [
            20.0,
            335.0,
            92.0,
            22.0
          ],
          "text": "live.thisdevice"
        }
      },
      {
        "box": {
          "id": "obj-init-deferlow",
          "maxclass": "newobj",
          "patching_rect": [
            130.0,
            335.0,
            60.0,
            22.0
          ],
          "text": "deferlow"
        }
      },
      {
        "box": {
          "id": "obj-init-message",
          "maxclass": "message",
          "patching_rect": [
            210.0,
            335.0,
            40.0,
            22.0
          ],
          "text": "init"
        }
      },
      {
        "box": {
          "id": "obj-print",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            515.0,
            335.0,
            180.0,
            22.0
          ],
          "text": "print midimiscellany"
        }
      },
      {
        "box": {
          "id": "obj-thru-gate",
          "maxclass": "newobj",
          "text": "gate 1 1",
          "numinlets": 2,
          "numoutlets": 1,
          "patching_rect": [
            500.0,
            280.0,
            65.0,
            22.0
          ]
        }
      },
      {
        "box": {
          "id": "obj-mpe-toggle",
          "maxclass": "live.text",
          "mode": 1,
          "text": "Plinky MPE Off",
          "texton": "Plinky MPE On",
          "numinlets": 1,
          "numoutlets": 2,
          "outlettype": [
            "",
            ""
          ],
          "parameter_enable": 1,
          "varname": "plinky_mpe",
          "patching_rect": [
            20.0,
            380.0,
            120.0,
            22.0
          ],
          "presentation": 1,
          "presentation_rect": [
            620.0,
            10.0,
            145.0,
            22.0
          ],
          "saved_attribute_attributes": {
            "valueof": {
              "parameter_longname": "Plinky MPE",
              "parameter_shortname": "Plinky MPE",
              "parameter_type": 2,
              "parameter_mmin": 0,
              "parameter_mmax": 1,
              "parameter_initial_enable": 1,
              "parameter_initial": [
                0
              ],
              "parameter_mappable": 1
            }
          }
        }
      },
      {
        "box": {
          "id": "obj-mpe-prepend",
          "maxclass": "newobj",
          "text": "prepend plinky_mpe_enabled",
          "numinlets": 1,
          "numoutlets": 1,
          "patching_rect": [
            160.0,
            380.0,
            175.0,
            22.0
          ]
        }
      }
    ],
    "lines": [
      {
        "patchline": {
          "source": [
            "obj-capture",
            0
          ],
          "destination": [
            "obj-listen-prepend",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-listen-prepend",
            0
          ],
          "destination": [
            "obj-js",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-length-menu",
            0
          ],
          "destination": [
            "obj-length-prepend",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-length-prepend",
            0
          ],
          "destination": [
            "obj-js",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-quantize-menu",
            0
          ],
          "destination": [
            "obj-quantize-prepend",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-quantize-prepend",
            0
          ],
          "destination": [
            "obj-js",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-overdub-toggle",
            0
          ],
          "destination": [
            "obj-overdub-prepend",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-overdub-prepend",
            0
          ],
          "destination": [
            "obj-js",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-immediate-toggle",
            0
          ],
          "destination": [
            "obj-immediate-prepend",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-immediate-prepend",
            0
          ],
          "destination": [
            "obj-js",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-note-deferlow",
            0
          ],
          "destination": [
            "obj-js",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-js",
            0
          ],
          "destination": [
            "obj-state",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-js",
            1
          ],
          "destination": [
            "obj-print",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-js",
            2
          ],
          "destination": [
            "obj-capture",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-thisdevice",
            0
          ],
          "destination": [
            "obj-init-deferlow",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-init-deferlow",
            0
          ],
          "destination": [
            "obj-init-message",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-init-message",
            0
          ],
          "destination": [
            "obj-js",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-midiin",
            0
          ],
          "destination": [
            "obj-thru-gate",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-thru-gate",
            0
          ],
          "destination": [
            "obj-midiout",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-midiin",
            0
          ],
          "destination": [
            "obj-note-deferlow",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-js",
            3
          ],
          "destination": [
            "obj-midiout",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-js",
            4
          ],
          "destination": [
            "obj-thru-gate",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-mpe-toggle",
            0
          ],
          "destination": [
            "obj-mpe-prepend",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-mpe-prepend",
            0
          ],
          "destination": [
            "obj-js",
            0
          ]
        }
      }
    ],
    "dependency_cache": [
      {
        "name": "midimiscellany_runtime_v23.js",
        "patcherrelativepath": ".",
        "type": "TEXT",
        "implicit": 1
      },
      {
        "name": "retrospective_core.js",
        "patcherrelativepath": ".",
        "type": "TEXT",
        "implicit": 1
      }
    ],
    "oscreceiveudpport": 0
  }
}
