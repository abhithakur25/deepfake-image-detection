"""
Prepare local Kaggle-like layout and execute deepfake-image-detection.ipynb.
CPU-aware: smaller batches, skip kernel restarts/interactive widgets, path remaps.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import traceback
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(r"C:\Users\USER\Downloads\kaggle_run")
INPUT = ROOT / "input"
WORKING = ROOT / "working"
DATASETS = INPUT / "datasets"
MODELS = INPUT / "models"
KERNEL_OUT = Path(r"C:\Users\USER\Downloads\kaggle_kernel_output")
SRC_NB = Path(r"C:\Users\USER\Downloads\deepfake-image-detection.ipynb")
OUT_NB = ROOT / "deepfake-image-detection-executed.ipynb"
LOG = ROOT / "execution_log.txt"

# Force non-interactive matplotlib
os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

# CPU-friendly training overrides applied via string rewrite
CPU_OVERRIDES = {
    "per_device_train_batch_size=32": "per_device_train_batch_size=4",
    "per_device_eval_batch_size=8": "per_device_eval_batch_size=4",
    "num_train_epochs=5": "num_train_epochs=1",
    "num_train_epochs=2": "num_train_epochs=1",
    "device=0": "device=-1",  # CPU for pipelines
}


def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def ensure_dirs() -> None:
    for p in [INPUT, WORKING, DATASETS, MODELS, KERNEL_OUT]:
        p.mkdir(parents=True, exist_ok=True)


def map_kaggle_paths(src: str) -> str:
    """Rewrite /kaggle/... absolute paths to local Windows paths."""
    # Normalize kaggle input/working roots
    replacements = [
        ("/kaggle/input", str(INPUT).replace("\\", "/")),
        ("/kaggle/working", str(WORKING).replace("\\", "/")),
        (r"C:\\kaggle\\input", str(INPUT)),
        (r"C:\\kaggle\\working", str(WORKING)),
    ]
    out = src
    for a, b in replacements:
        out = out.replace(a, b)

    # Fix label extraction that uses split('/') — use Path parts instead when present
    # Common pattern: label = str(file).split('/')[-2]
    out = out.replace(
        "label = str(file).split('/')[-2]",
        "label = Path(file).parent.name",
    )
    out = out.replace(
        'label = str(file).split("/")[-2]',
        "label = Path(file).parent.name",
    )

    # Fix path displays that split on /
    out = out.replace(
        "path={all_images[i].split('/')[-1]}",
        "path={Path(all_images[i]).name}",
    )
    out = out.replace(
        "File={row['file_name'].split('/')[-1]}",
        "File={Path(row['file_name']).name}",
    )

    for old, new in CPU_OVERRIDES.items():
        out = out.replace(old, new)

    return out


def should_skip_cell(src: str, idx: int) -> str | None:
    """Return skip reason or None."""
    s = src.strip()
    if not s:
        return "empty"
    # Kernel restarts would kill the run
    if "do_shutdown" in s or "kernel.do_shutdown" in s:
        return "kernel restart"
    # Pure pip installs — handled up front
    if s.startswith("!") and "pip install" in s and "import " not in s:
        # still allow cells that only pip — skip
        lines = [ln for ln in s.splitlines() if ln.strip() and not ln.strip().startswith("!")]
        if not lines:
            return "pip-only cell"
    # Interactive widgets without data — skip upload UI
    if "widgets.FileUpload" in s and "uploader.observe" in s:
        return "interactive upload widget"
    return None


def strip_shell_magics(src: str) -> str:
    """Remove ! and % lines that break plain exec (keep rest)."""
    kept = []
    for line in src.splitlines():
        st = line.lstrip()
        if st.startswith("!") or st.startswith("%"):
            # skip magics
            continue
        kept.append(line)
    return "\n".join(kept)


def subsample_large_loads(src: str) -> str:
    """
    For CPU practicality, cap very large samples while keeping code structure.
    Only rewrite the largest hard-coded sample sizes in final training cells.
    """
    # 10k per class -> 800 per class for CPU
    src = src.replace("random.sample(mk_fake, 10000)", "random.sample(mk_fake, min(800, len(mk_fake)))")
    src = src.replace("random.sample(mk_real, 10000)", "random.sample(mk_real, min(800, len(mk_real)))")
    src = src.replace("random.sample(mk_fake, 2500)", "random.sample(mk_fake, min(400, len(mk_fake)))")
    src = src.replace("random.sample(mk_real, 2500)", "random.sample(mk_real, min(400, len(mk_real)))")
    if "groupby('label').sample(3000" in src:
        src = src.replace(
            "df_sampled = df_csv.groupby('label').sample(3000, random_state=42)",
            "df_sampled = df_csv.groupby('label', group_keys=False).apply(lambda g: g.sample(min(400, len(g)), random_state=42)).reset_index(drop=True)",
        )
    if "groupby('label').sample(2500" in src:
        src = src.replace(
            "df_sampled = df_csv.groupby('label').sample(2500, random_state=42)",
            "df_sampled = df_csv.groupby('label', group_keys=False).apply(lambda g: g.sample(min(400, len(g)), random_state=42)).reset_index(drop=True)",
        )
    # Cap OpenFake full scan via optional head after building lists — inject after value_counts if needed
    # Limit image walks for openfake when building full list in train cells by sampling later
    return src


def prepare_model_links() -> None:
    """
    Place author models under expected local paths if kernel output / HF available.
    Expected:
      input/models/ayush3102kumar/deepfake-detector/transformers/default/1
      input/models/ayush3102kumar/deepfake-detector-v3/transformers/default/1
    """
    import shutil

    v1 = MODELS / "ayush3102kumar" / "deepfake-detector" / "transformers" / "default" / "1"
    v3 = MODELS / "ayush3102kumar" / "deepfake-detector-v3" / "transformers" / "default" / "1"
    v1.mkdir(parents=True, exist_ok=True)
    v3.mkdir(parents=True, exist_ok=True)

    # Kernel output may contain model files at top level or nested
    candidates = []
    if KERNEL_OUT.exists():
        for p in KERNEL_OUT.rglob("model.safetensors"):
            candidates.append(p.parent)
        for p in KERNEL_OUT.rglob("pytorch_model.bin"):
            candidates.append(p.parent)
        for p in KERNEL_OUT.rglob("config.json"):
            if (p.parent / "model.safetensors").exists() or (p.parent / "pytorch_model.bin").exists():
                candidates.append(p.parent)

    # Unzip deepfake_v5_complete if present
    for z in list(KERNEL_OUT.glob("*.zip")) + list(WORKING.glob("*.zip")):
        try:
            shutil.unpack_archive(str(z), str(KERNEL_OUT / z.stem))
            log(f"Unpacked {z}")
        except Exception as e:
            log(f"Could not unpack {z}: {e}")

    # Refresh candidates
    if KERNEL_OUT.exists():
        for p in KERNEL_OUT.rglob("config.json"):
            if (p.parent / "model.safetensors").exists() or (p.parent / "pytorch_model.bin").exists():
                candidates.append(p.parent)

    # Dedup
    seen = set()
    uniq = []
    for c in candidates:
        key = str(c.resolve())
        if key not in seen:
            seen.add(key)
            uniq.append(c)

    log(f"Found {len(uniq)} local model dirs: {[str(u) for u in uniq[:5]]}")

    def copy_model(src: Path, dst: Path) -> None:
        for f in src.iterdir():
            if f.is_file():
                shutil.copy2(f, dst / f.name)
        log(f"Copied model files from {src} -> {dst}")

    if uniq:
        copy_model(uniq[0], v1)
        copy_model(uniq[-1] if len(uniq) > 1 else uniq[0], v3)
    else:
        # Fall back to HuggingFace public model for both
        log("No kernel models found; will rely on HuggingFace dima806 model at runtime")
        # Leave dirs empty; runtime will rewrite model_str if missing


def patch_model_paths_if_missing(src: str) -> str:
    """If local author model missing, fall back to public HF model."""
    v1 = MODELS / "ayush3102kumar" / "deepfake-detector" / "transformers" / "default" / "1"
    v3 = MODELS / "ayush3102kumar" / "deepfake-detector-v3" / "transformers" / "default" / "1"
    hf = "dima806/deepfake_vs_real_image_detection"
    if not (v1 / "config.json").exists():
        src = src.replace(
            str(v1).replace("\\", "/"),
            hf,
        )
        src = src.replace(
            "/kaggle/input/models/ayush3102kumar/deepfake-detector/transformers/default/1",
            hf,
        )
        # also after path mapping
        mapped_v1 = str(v1).replace("\\", "/")
        src = src.replace(mapped_v1, hf)
    if not (v3 / "config.json").exists():
        mapped_v3 = str(v3).replace("\\", "/")
        src = src.replace(mapped_v3, hf)
        src = src.replace(
            "/kaggle/input/models/ayush3102kumar/deepfake-detector-v3/transformers/default/1",
            hf,
        )
    return src


def limit_openfake_in_source(src: str) -> str:
    """After collecting openfake paths, optionally subsample for CPU."""
    marker = 'print(f"Total images: {len(file_names)}")'
    inject = (
        'print(f"Total images before subsample: {len(file_names)}")\n'
        "if len(file_names) > 3000:\n"
        "    import random as _r\n"
        "    _r.seed(42)\n"
        "    _pairs = list(zip(file_names, labels))\n"
        "    _r.shuffle(_pairs)\n"
        "    _pairs = _pairs[:3000]\n"
        "    file_names, labels = [p[0] for p in _pairs], [p[1] for p in _pairs]\n"
        'print(f"Total images: {len(file_names)}")'
    )
    if marker in src and "before subsample" not in src:
        src = src.replace(marker, inject, 1)
    return src


def execute_notebook() -> int:
    ensure_dirs()
    open(LOG, "w", encoding="utf-8").write("")
    log("Starting notebook execution")
    prepare_model_links()

    nb = json.loads(SRC_NB.read_text(encoding="utf-8"))
    # Execution namespace shared across cells (like Jupyter)
    g = {
        "__name__": "__main__",
        "__builtins__": __builtins__,
    }
    # Pre-import common things and Path
    exec("from pathlib import Path\nimport os\nos.chdir(r'%s')" % str(WORKING).replace("\\", "\\\\"), g)

    results = []
    n_ok = n_skip = n_fail = 0

    for i, cell in enumerate(nb["cells"]):
        if cell.get("cell_type") != "code":
            continue
        raw = "".join(cell.get("source", []))
        reason = should_skip_cell(raw, i)
        if reason:
            log(f"Cell {i}: SKIP ({reason})")
            cell.setdefault("outputs", [])
            cell["outputs"] = [{
                "output_type": "stream",
                "name": "stdout",
                "text": [f"[SKIPPED: {reason}]\n"],
            }]
            n_skip += 1
            results.append((i, "skip", reason))
            continue

        src = strip_shell_magics(raw)
        src = map_kaggle_paths(src)
        src = patch_model_paths_if_missing(src)
        src = subsample_large_loads(src)
        src = limit_openfake_in_source(src)

        # plt.show -> plt.savefig for non-interactive
        if "plt.show()" in src:
            src = src.replace(
                "plt.show()",
                f"plt.savefig(r'{WORKING}\\cell_{i}_plot.png', bbox_inches='tight'); plt.close()",
            )

        # display() no-ops if not available
        src = "try:\n    from IPython.display import display\nexcept Exception:\n    def display(*a, **k): pass\n" + src

        log(f"Cell {i}: RUN ({len(src)} chars)...")
        t0 = time.time()
        try:
            # Capture stdout
            from io import StringIO
            import contextlib

            buf = StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                exec(compile(src, f"cell_{i}", "exec"), g)
            out = buf.getvalue()
            dt = time.time() - t0
            log(f"Cell {i}: OK in {dt:.1f}s")
            if out.strip():
                # truncate huge logs
                preview = out if len(out) < 4000 else out[:4000] + "\n...[truncated]..."
                log(f"  stdout: {preview[:500]}")
            cell["outputs"] = [{
                "output_type": "stream",
                "name": "stdout",
                "text": out.splitlines(keepends=True) or [""],
            }]
            cell["execution_count"] = i + 1
            n_ok += 1
            results.append((i, "ok", f"{dt:.1f}s"))
        except Exception as e:
            dt = time.time() - t0
            err = traceback.format_exc()
            log(f"Cell {i}: FAIL in {dt:.1f}s — {e}")
            log(err[-1500:])
            cell["outputs"] = [{
                "output_type": "error",
                "ename": type(e).__name__,
                "evalue": str(e),
                "traceback": err.splitlines(),
            }]
            n_fail += 1
            results.append((i, "fail", str(e)))
            # Continue to next cells; some failures are expected if data missing
            # But if critical early imports fail, still continue

    OUT_NB.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
    log(f"Saved executed notebook -> {OUT_NB}")
    log(f"Summary: ok={n_ok} skip={n_skip} fail={n_fail}")
    for r in results:
        log(f"  cell {r[0]}: {r[1]} — {r[2]}")
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(execute_notebook())
