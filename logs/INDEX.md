# Deepfake notebook run — saved logs
Saved: 2026-08-08 04:37:22

## Layout
- pipeline/     Notebook execution log + cell status report + Kaggle kernel log
- terminal/     All shell/command logs from this session (downloads, installs, training)
- kaggle/       Kaggle CLI client logs (if present)
- *.jsonl etc.  Session-level history/events (optional)

## Key files
| File | Description |
|------|-------------|
| pipeline/execution_log.txt | Cell-by-cell notebook run (OK/FAIL/SKIP + timings) |
| pipeline/run_report.json | Machine-readable summary: ok=57 skip=7 fail=9 |
| pipeline/deepfake-image-detection.log | Original Kaggle kernel log |
| terminal/call-f9365ed2-...-103.log | Full pipeline runner stdout |
| terminal/call-a67da970-...-45.log | Manjil dataset download progress |
| terminal/call-a67da970-...-44.log | Saurabh dataset download progress |
| terminal/monitor-call-...-49.log | Live download progress monitor |
| terminal/monitor-call-...-104.log | Live notebook cell progress monitor |

## Result summary
- OK: 57 cells
- SKIP: 7 (pip-only, widgets, kernel restarts)
- FAIL: 9 (missing OpenFake / Alessandro datasets)
- Executed notebook: ..\deepfake-image-detection-executed.ipynb
- Working models/plots: ..\working\
