"""
Execute the deepfake notebook end-to-end on this machine (CPU).

Adaptations for local Windows + CPU:
  - Kaggle paths remapped under kaggle_run/
  - Author models from kernel output (v5 checkpoint)
  - Subsampled data + 1 epoch for CPU tractability
  - Skip kernel restarts and interactive upload widgets
  - Missing optional datasets skipped with clear logs
"""
from __future__ import annotations

import contextlib
import gc
import json
import os
import random
import shutil
import sys
import time
import traceback
from io import StringIO
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

ROOT = Path(r"C:\Users\USER\Downloads\kaggle_run")
INPUT = ROOT / "input"
WORKING = ROOT / "working"
DATASETS = INPUT / "datasets"
MODELS = INPUT / "models"
KERNEL_OUT = Path(r"C:\Users\USER\Downloads\kaggle_kernel_output")
SRC_NB = Path(r"C:\Users\USER\Downloads\deepfake-image-detection.ipynb")
OUT_NB = ROOT / "deepfake-image-detection-executed.ipynb"
LOG = ROOT / "execution_log.txt"
REPORT = ROOT / "run_report.json"

os.environ["MPLBACKEND"] = "Agg"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.chdir(WORKING)


def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def ensure_layout() -> None:
    for p in [INPUT, WORKING, DATASETS, MODELS]:
        p.mkdir(parents=True, exist_ok=True)

    ckpt = KERNEL_OUT / "deepfake_vs_real_v5" / "checkpoint-2940"
    for name in ("deepfake-detector", "deepfake-detector-v3"):
        dst = MODELS / "ayush3102kumar" / name / "transformers" / "default" / "1"
        dst.mkdir(parents=True, exist_ok=True)
        if ckpt.exists():
            for f in ckpt.iterdir():
                if f.is_file() and f.name in {
                    "config.json", "model.safetensors", "preprocessor_config.json", "training_args.bin"
                }:
                    shutil.copy2(f, dst / f.name)
            log(f"Model ready: {dst}")

    final = WORKING / "deepfake_vs_real_v5"
    final.mkdir(parents=True, exist_ok=True)
    if ckpt.exists():
        for f in ["config.json", "model.safetensors", "preprocessor_config.json", "training_args.bin"]:
            src = ckpt / f
            if src.exists() and src.stat().st_size > 0:
                shutil.copy2(src, final / f)


def path_map(src: str) -> str:
    src = src.replace("/kaggle/input", str(INPUT).replace("\\", "/"))
    src = src.replace("/kaggle/working", str(WORKING).replace("\\", "/"))
    src = src.replace("label = str(file).split('/')[-2]", "label = Path(file).parent.name")
    src = src.replace('label = str(file).split("/")[-2]', "label = Path(file).parent.name")
    src = src.replace("path={all_images[i].split('/')[-1]}", "path={Path(all_images[i]).name}")
    src = src.replace("File={row['file_name'].split('/')[-1]}", "File={Path(row['file_name']).name}")
    # CPU-friendly training
    src = src.replace("per_device_train_batch_size=32", "per_device_train_batch_size=4")
    src = src.replace("per_device_eval_batch_size=8", "per_device_eval_batch_size=4")
    src = src.replace("num_train_epochs=5", "num_train_epochs=1")
    src = src.replace("num_train_epochs=2", "num_train_epochs=1")
    src = src.replace("device=0", "device=-1")
    # Subsample large hard-coded draws
    src = src.replace("random.sample(mk_fake, 10000)", "random.sample(mk_fake, min(600, len(mk_fake)))")
    src = src.replace("random.sample(mk_real, 10000)", "random.sample(mk_real, min(600, len(mk_real)))")
    src = src.replace("random.sample(mk_fake, 2500)", "random.sample(mk_fake, min(300, len(mk_fake)))")
    src = src.replace("random.sample(mk_real, 2500)", "random.sample(mk_real, min(300, len(mk_real)))")
    src = src.replace(
        "df_sampled = df_csv.groupby('label').sample(3000, random_state=42)",
        "df_sampled = df_csv.groupby('label', group_keys=False).apply(lambda g: g.sample(min(300, len(g)), random_state=42)).reset_index(drop=True)",
    )
    src = src.replace(
        "df_sampled = df_csv.groupby('label').sample(2500, random_state=42)",
        "df_sampled = df_csv.groupby('label', group_keys=False).apply(lambda g: g.sample(min(300, len(g)), random_state=42)).reset_index(drop=True)",
    )
    # Cap list building for openfake-style full globs after print Total images
    marker = 'print(f"Total images: {len(file_names)}")'
    inject = (
        'print(f"Total images before subsample: {len(file_names)}")\n'
        "if len(file_names) > 2000:\n"
        "    import random as _r\n"
        "    _r.seed(42)\n"
        "    _pairs = list(zip(file_names, labels))\n"
        "    _r.shuffle(_pairs)\n"
        "    _pairs = _pairs[:2000]\n"
        "    file_names[:] = [p[0] for p in _pairs]\n"
        "    labels[:] = [p[1] for p in _pairs]\n"
        'print(f"Total images: {len(file_names)}")'
    )
    if marker in src and "before subsample" not in src:
        src = src.replace(marker, inject, 1)

    # Cap Manjil-style full glob loads (print len then DataFrame) for CPU
    if "print(len(file_names), len(labels))" in src and "CPU subsample" not in src:
        src = src.replace(
            "print(len(file_names), len(labels))\n"
            "df = pd.DataFrame.from_dict({\"image\": file_names, \"label\": labels})",
            "print(len(file_names), len(labels))\n"
            "if len(file_names) > 2000:\n"
            "    import random as _r\n"
            "    _r.seed(42)\n"
            "    _pairs = list(zip(file_names, labels))\n"
            "    _r.shuffle(_pairs)\n"
            "    _pairs = _pairs[:2000]\n"
            "    file_names = [p[0] for p in _pairs]\n"
            "    labels = [p[1] for p in _pairs]\n"
            "    print('CPU subsample to', len(file_names), 'images')\n"
            "df = pd.DataFrame.from_dict({\"image\": file_names, \"label\": labels})",
        )
    # plt.show -> savefig
    if "plt.show()" in src:
        src = src.replace(
            "plt.show()",
            "import matplotlib.pyplot as _plt; _plt.savefig('plot_tmp.png', bbox_inches='tight'); _plt.close()",
        )
    return src


def strip_magics(src: str) -> str:
    return "\n".join(
        ln for ln in src.splitlines()
        if not ln.lstrip().startswith("!") and not ln.lstrip().startswith("%")
    )


def should_skip(src: str) -> str | None:
    s = src.strip()
    if not s:
        return "empty"
    if "do_shutdown" in s:
        return "kernel restart"
    if s.startswith("!") and "pip install" in s and "import " not in s:
        lines = [ln for ln in s.splitlines() if ln.strip() and not ln.strip().startswith("!")]
        if not lines:
            return "pip-only"
    if "widgets.FileUpload" in s:
        return "interactive upload widget"
    return None


def dataset_available(key: str) -> bool:
    mapping = {
        "manjil": DATASETS / "manjilkarki" / "deepfake-and-real-images",
        "openfake": DATASETS / "sanketghadge1" / "openfake-data-20k-img",
        "saurabh": DATASETS / "saurabhbagchi" / "deepfake-image-detection",
        "alessandro": DATASETS / "alessandrasala79" / "ai-vs-human-generated-dataset",
    }
    p = mapping.get(key)
    if not p or not p.exists():
        return False
    # any image-like file?
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.webp"):
        if any(p.rglob(ext)):
            return True
    if key == "alessandro" and (p / "train.csv").exists():
        return True
    return False


def run_cells() -> dict:
    ensure_layout()
    open(LOG, "w", encoding="utf-8").write("")
    log("=== Deepfake notebook local execution ===")
    log(f"manjil={dataset_available('manjil')} openfake={dataset_available('openfake')} "
        f"saurabh={dataset_available('saurabh')} alessandro={dataset_available('alessandro')}")

    nb = json.loads(SRC_NB.read_text(encoding="utf-8"))
    g: dict = {"__name__": "__main__", "__builtins__": __builtins__}
    exec("from pathlib import Path\nimport os\n", g)

    # Prefetch HF fallback model availability check
    model_local = MODELS / "ayush3102kumar" / "deepfake-detector" / "transformers" / "default" / "1"
    if not (model_local / "model.safetensors").exists():
        log("Local author model missing; cells will use dima806 HF model where rewritten")

    summary = {"ok": 0, "skip": 0, "fail": 0, "cells": []}

    for i, cell in enumerate(nb["cells"]):
        if cell.get("cell_type") != "code":
            continue
        raw = "".join(cell.get("source", []))
        reason = should_skip(raw)
        if reason:
            log(f"Cell {i}: SKIP ({reason})")
            cell["outputs"] = [{"output_type": "stream", "name": "stdout", "text": [f"[SKIPPED: {reason}]\n"]}]
            summary["skip"] += 1
            summary["cells"].append({"i": i, "status": "skip", "detail": reason})
            continue

        # Skip openfake/alessandro-heavy cells if data missing (still try so failures are logged)
        src = strip_magics(raw)
        src = path_map(src)
        # Always ensure Path import present for rewritten label lines
        src = "from pathlib import Path\n" + src
        src = (
            "try:\n    from IPython.display import display\n"
            "except Exception:\n    def display(*a, **k): pass\n" + src
        )

        # Unique plot names per cell
        src = src.replace(
            "_plt.savefig('plot_tmp.png', bbox_inches='tight'); _plt.close()",
            f"_plt.savefig(r'{WORKING}\\cell_{i}_plot.png', bbox_inches='tight'); _plt.close()",
        )

        log(f"Cell {i}: RUN...")
        t0 = time.time()
        buf = StringIO()
        try:
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                exec(compile(src, f"cell_{i}", "exec"), g)
            out = buf.getvalue()
            dt = time.time() - t0
            log(f"Cell {i}: OK ({dt:.1f}s)")
            if out.strip():
                log("  " + out.strip().splitlines()[0][:200])
            cell["outputs"] = [{"output_type": "stream", "name": "stdout", "text": out.splitlines(True) or [""]}]
            cell["execution_count"] = i + 1
            summary["ok"] += 1
            summary["cells"].append({"i": i, "status": "ok", "detail": f"{dt:.1f}s"})
        except Exception as e:
            dt = time.time() - t0
            err = traceback.format_exc()
            out = buf.getvalue()
            log(f"Cell {i}: FAIL ({dt:.1f}s) {type(e).__name__}: {e}")
            cell["outputs"] = [{
                "output_type": "error",
                "ename": type(e).__name__,
                "evalue": str(e),
                "traceback": (out + "\n" + err).splitlines(),
            }]
            summary["fail"] += 1
            summary["cells"].append({"i": i, "status": "fail", "detail": f"{type(e).__name__}: {e}"})
            # Continue executing remaining cells

        # Free some memory between heavy cells
        if i in {7, 8, 18, 28, 39, 50, 68}:
            gc.collect()

    OUT_NB.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
    REPORT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    log(f"Saved: {OUT_NB}")
    log(f"Summary ok={summary['ok']} skip={summary['skip']} fail={summary['fail']}")
    return summary


if __name__ == "__main__":
    s = run_cells()
    sys.exit(0 if s["fail"] == 0 else 1)
