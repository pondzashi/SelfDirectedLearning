# SelfDirectedLearning

Self-directed learning tools built on Google Apps Script + Google Sheets. One folder per project:

| Project | Folder | What it is |
|---|---|---|
| 1. MathLogic Prathom | [`MathLogic-Prathom/`](MathLogic-Prathom/) | Kumon-style daily math practice for Thai Grade 4 (ป.4). Timed fluency drills + observation + analytical thinking, placement week, monthly benchmark, spaced review, Thai email reports. Tablet-friendly web app, no login. Setup guide (Thai): [`README-TH.md`](MathLogic-Prathom/README-TH.md) |
| 2. PreTest Mathayom | [`PreTest-Mathayom/`](PreTest-Mathayom/) | Timed pre-test system for a Mathayom (secondary school) entrance exam. Spec: [`docs/spec.md`](PreTest-Mathayom/docs/spec.md) |

Each project is a separate Apps Script project with its own Sheet — don't paste files from one into the other (names like `doGet` and `setup` collide).
