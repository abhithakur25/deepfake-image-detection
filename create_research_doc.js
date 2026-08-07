const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, ImageRun, LevelFormat } = require('docx');
const fs = require('fs');
const path = require('path');

const WORK = path.join('C:', 'Users', 'USER', 'Downloads', 'kaggle_run', 'working');
const OUT = path.join('C:', 'Users', 'USER', 'Downloads', 'Deepfake_Image_Detection_Research_Paper.docx');

function loadPng(name) {
  const p = path.join(WORK, name);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

function imgPara(name, widthPx, caption) {
  const data = loadPng(name);
  if (!data) {
    return [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text: `[Figure missing: ${name}]`, italics: true, size: 20, color: "666666" })]
    })];
  }
  // Assume typical plot ~800x600-ish; preserve ratio using known plot sizes
  // We'll use width and compute height for common matplotlib exports ~ roughly 4:3 or 16:10
  const heightPx = Math.round(widthPx * 0.72);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [new ImageRun({
        type: "png",
        data,
        transformation: { width: widthPx, height: heightPx },
        altText: { name: caption, description: caption, title: caption }
      })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: caption, italics: true, size: 20 })]
    })
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerBorder = { style: BorderStyle.SINGLE, size: 4, color: "1F4E79" };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

function cell(text, w, opts = {}) {
  const isHeader = !!opts.header;
  return new TableCell({
    borders: isHeader ? headerBorders : borders,
    width: { size: w, type: WidthType.DXA },
    shading: isHeader
      ? { fill: "1F4E79", type: ShadingType.CLEAR }
      : (opts.alt ? { fill: "F2F2F2", type: ShadingType.CLEAR } : { fill: "FFFFFF", type: ShadingType.CLEAR }),
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({
      children: [new TextRun({
        text: String(text),
        bold: isHeader || !!opts.bold,
        size: 18,
        font: "Arial",
        color: isHeader ? "FFFFFF" : "000000"
      })]
    })]
  });
}

function makeTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ children: headers.map((h, i) => cell(h, colWidths[i], { header: true })) }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((v, i) => cell(v, colWidths[i], { alt: ri % 2 === 1 }))
      }))
    ]
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 28, font: "Arial", color: "1F4E79" })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Arial", color: "2E75B6" })]
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 276 },
    indent: opts.indent ? { firstLine: 360 } : undefined,
    children: [new TextRun({
      text,
      size: opts.size || 22,
      font: "Times New Roman",
      italics: !!opts.italics,
      bold: !!opts.bold
    })]
  });
}
function pRuns(runs, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 276 },
    children: runs.map(r => new TextRun({
      text: r.text,
      size: r.size || 22,
      font: r.font || "Times New Roman",
      bold: !!r.bold,
      italics: !!r.italics
    }))
  });
}
function bullet(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, size: 22, font: "Times New Roman" })]
  });
}
function spacer(n = 120) {
  return new Paragraph({ spacing: { after: n }, children: [] });
}

const children = [];

// ========== TITLE PAGE ==========
children.push(spacer(600));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({
    text: "Deepfake Image Detection Using Vision Transformer Fine-Tuning on Multi-Source Real and Synthetic Face Datasets",
    bold: true, size: 32, font: "Arial", color: "1F4E79"
  })]
}));
children.push(spacer(200));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "1F4E79", space: 1 } },
  children: [new TextRun({ text: "Research Paper / Technical Report", size: 22, font: "Arial", color: "666666" })]
}));
children.push(spacer(300));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "Based on experimental implementation of the Kaggle notebook", size: 20, font: "Times New Roman", italics: true })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "ayush3102kumar / deepfake-image-detection", size: 20, font: "Times New Roman", italics: true })]
}));
children.push(spacer(200));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 60 },
  children: [new TextRun({ text: "Domain: Computer Vision · Deep Learning · Media Forensics", size: 20, font: "Arial" })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 60 },
  children: [new TextRun({ text: "Date: August 2026", size: 20, font: "Arial" })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 60 },
  children: [new TextRun({ text: "Implementation: Hugging Face Transformers · ViT · PyTorch", size: 20, font: "Arial" })]
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== ABSTRACT ==========
children.push(h1("1. Abstract"));
children.push(p(
  "The rapid proliferation of generative artificial intelligence has made synthetic and manipulated facial imagery increasingly difficult to distinguish from authentic photographs. Deepfake image detection has therefore become a critical research problem for digital media integrity, cybersecurity, and public trust. This paper presents a complete experimental study of deepfake versus real image classification using a Vision Transformer (ViT) backbone fine-tuned with the Hugging Face Transformers training stack."
));
children.push(p(
  "Building on a public Kaggle implementation (deepfake-image-detection), we construct a multi-stage pipeline that loads multi-source face datasets, balances class distributions via random oversampling, applies geometric and photometric augmentations, and fine-tunes a pretrained ViT image classifier. Experiments were executed end-to-end on a local CPU environment with path remapping of Kaggle inputs, using Manjil Karki deepfake/real faces and the Saurabh Bagchi deepfake image detection corpus. Progressive model versions (V1–V5) were trained and evaluated with accuracy, macro F1-score, precision, recall, confusion matrices, ROC-AUC, and average precision."
));
children.push(p(
  "On a balanced Manjil-derived holdout split, the best configuration (V1) achieved 99.39% accuracy and 0.9939 macro F1. Cross-dataset fine-tuning on the smaller Saurabh corpus yielded 78.08% accuracy (V3) and 69.86% accuracy for the final V5 checkpoint under constrained CPU training (one epoch, reduced batch size, subsampled data). The results demonstrate that transfer learning with ViT is highly effective within domain, while domain shift and limited compute significantly reduce generalization. The paper documents methodology, experimental protocol, quantitative results, comparative analysis, limitations, and directions for multi-dataset robust training."
));
children.push(pRuns([
  { text: "Keywords: ", bold: true },
  { text: "Deepfake detection; Vision Transformer; Image classification; Transfer learning; Media forensics; Hugging Face Transformers." }
]));

// ========== INTRODUCTION ==========
children.push(h1("2. Introduction"));
children.push(h2("2.1 Background and Motivation"));
children.push(p(
  "Deepfakes—synthetic media generated or manipulated by deep neural networks—pose escalating risks to journalism, finance, politics, and personal privacy. Modern diffusion models and generative adversarial networks (GANs) can synthesize photorealistic faces that evade casual human inspection. Automated detection systems are therefore essential for platform moderation, forensic analysis, and authentication pipelines."
));
children.push(p(
  "Classical forensic cues such as JPEG artifacts, eye-blink statistics, or handcrafted texture descriptors have become less reliable as generative models improve. Concurrently, transformer-based vision architectures have shown strong performance on fine-grained visual recognition by modeling long-range spatial dependencies through self-attention. This motivates evaluating Vision Transformers as detectors of subtle synthesis artifacts in facial imagery."
));
children.push(h2("2.2 Problem Statement"));
children.push(p(
  "Given an input RGB face image x, the task is binary classification into Real or Fake. The detector must remain accurate under variations in resolution, compression, pose, lighting, and generative source. Practical systems must also handle class imbalance and heterogeneous dataset taxonomies (e.g., folder labels Fake/Real versus fake/real)."
));
children.push(h2("2.3 Objectives"));
children.push(bullet("Implement an end-to-end deepfake image classification pipeline using a pretrained Vision Transformer.", "obj"));
children.push(bullet("Fine-tune the model on publicly available deepfake/real face datasets with balanced sampling and data augmentation.", "obj"));
children.push(bullet("Evaluate successive model versions using accuracy, F1-score, and confusion-matrix diagnostics.", "obj"));
children.push(bullet("Compare performance across datasets and training stages and analyze domain-shift effects.", "obj"));
children.push(bullet("Document a reproducible experimental protocol suitable for academic and engineering reporting.", "obj"));
children.push(h2("2.4 Contributions"));
children.push(p(
  "This work contributes (i) a structured multi-version ViT fine-tuning pipeline for deepfake detection, (ii) empirical evidence of high in-domain accuracy on a large public face deepfake corpus, (iii) quantitative characterization of degradation under cross-dataset transfer and resource-constrained training, and (iv) a full experimental report with artifacts (models, plots, executed notebook logs)."
));

// ========== LITERATURE REVIEW ==========
children.push(h1("3. Literature Review"));
children.push(h2("3.1 Deepfake Generation and Detection Landscape"));
children.push(p(
  "Early deepfake generation relied on autoencoder face-swapping and GAN-based synthesis (e.g., StyleGAN family). Detection research evolved from handcrafted forensics to CNN classifiers such as MesoNet, XceptionNet, and EfficientNet variants trained on large challenge datasets including FaceForensics++ and the Deepfake Detection Challenge (DFDC). Survey literature emphasizes that detectors often overfit to generator-specific artifacts and degrade under compression and unseen synthesis methods."
));
children.push(h2("3.2 Convolutional Detectors"));
children.push(p(
  "Convolutional neural networks remain a strong baseline for deepfake detection because local texture and frequency-domain inconsistencies are often spatially localized. Architectures such as Xception and EfficientNet extract hierarchical spatial features and have been widely adopted in DFDC-related solutions. However, CNNs may under-model global relational cues (e.g., identity consistency across facial regions) that transformers capture more naturally."
));
children.push(h2("3.3 Vision Transformers for Forensics"));
children.push(p(
  "Vision Transformers (ViT) divide images into patches, embed them linearly, and process sequences with multi-head self-attention. ViT and hybrids (e.g., DeiT, Swin) have been applied to deepfake detection with competitive results, particularly when pretrained on large natural-image corpora and fine-tuned on forensic labels. Attention maps can also aid interpretability by highlighting suspicious facial regions."
));
children.push(h2("3.4 Datasets and Benchmarks"));
children.push(p(
  "Public resources used in this domain include FaceForensics++, Celeb-DF, DFDC, and community Kaggle datasets of real and fake faces (e.g., Manjil Karki deepfake-and-real-images). Multi-source training is increasingly recommended to improve robustness, though label definitions and preprocessing pipelines often differ across sources."
));
children.push(h2("3.5 Research Gap"));
children.push(p(
  "Despite strong leaderboard scores, many published detectors lack transparent multi-version ablation under realistic compute constraints, and cross-dataset transfer is frequently under-reported. This paper addresses that gap by reporting a complete ViT fine-tuning workflow with staged models (V1–V5), explicit metrics, and honest analysis of failures caused by missing external datasets and domain shift."
));

// ========== PROPOSED WORK ==========
children.push(h1("4. Proposed Work"));
children.push(h2("4.1 System Overview"));
children.push(p(
  "The proposed system is a supervised binary image classifier based on a Vision Transformer fine-tuned with transfer learning. The pipeline comprises: (1) multi-source image discovery from hierarchical folder structures; (2) dataframe construction with image paths and labels; (3) class balancing via RandomOverSampler; (4) Hugging Face Dataset casting to Image type; (5) train/test split with stratified labels; (6) augmentation and normalization aligned to the ViT image processor; (7) fine-tuning with Hugging Face Trainer; (8) evaluation, visualization, and model export."
));
children.push(h2("4.2 Model Architecture"));
children.push(p(
  "We employ ViTForImageClassification initialized from a public checkpoint specialized for deepfake-versus-real discrimination (dima806/deepfake_vs_real_image_detection and successive author fine-tunes). The backbone contains approximately 85.8 million trainable parameters. Input images are resized to 224×224 RGB, converted to pixel values, and normalized using processor mean/standard deviation. The classification head maps transformer representations to two logits corresponding to Real and Fake."
));
children.push(h2("4.3 Preprocessing and Augmentation"));
children.push(p(
  "Training transforms include resize to model resolution, random rotation (90°), random sharpness adjustment, tensor conversion, and normalization. Validation/test transforms omit stochastic augmentation and apply only resize, tensor conversion, and normalization. Labels are mapped as Real→0 and Fake→1. A custom collate function stacks pixel_values and labels into batches for the Trainer API."
));
children.push(h2("4.4 Multi-Version Training Strategy"));
children.push(p(
  "Rather than a single train run, the proposed workflow iterates model versions to refine performance:"
));
children.push(bullet("V1: Fine-tune base public ViT on Manjil deepfake/real faces with learning rate 1e-6.", "ver"));
children.push(bullet("V2: Continued fine-tuning at a lower learning rate (5e-7) for stability.", "ver"));
children.push(bullet("V3–V4: Fine-tune on additional/alternate corpora (OpenFake/Saurabh/Alessandro in the original design) with higher or adjusted learning rates.", "ver"));
children.push(bullet("V5: Final consolidated fine-tune targeting multi-source robustness, with accuracy-based best-checkpoint selection.", "ver"));
children.push(h2("4.5 Evaluation Protocol"));
children.push(p(
  "Primary metrics are classification accuracy and macro-averaged F1-score. Secondary diagnostics include per-class precision/recall, confusion matrices, ROC curves (AUC), and precision–recall average precision. Models are saved as Hugging Face-compatible directories (config, weights, preprocessor)."
));

// ========== EXPERIMENTAL WORK ==========
children.push(h1("5. Experimental Work"));
children.push(h2("5.1 Datasets"));
children.push(p(
  "Two primary local datasets were successfully integrated for the executed experiments:"
));
children.push(bullet("Manjil Karki – deepfake-and-real-images: large hierarchical Dataset/{Train,Validation,Test}/{Fake,Real} structure (~190,000 images discovered). For local CPU tractability, a balanced subsample of approximately 2,000 images was used for V1/V2 training (train size 1,225; test size 817 after split/balancing).", "data"));
children.push(bullet("Saurabh Bagchi – deepfake-image-detection: 983 images with Fake/Real folders (547 Fake, 436 Real before balancing; 1,094 after RandomOverSampler).", "data"));
children.push(p(
  "The original notebook also references OpenFake (≈20k images) and Alessandro Sala AI-vs-human image data (CSV-indexed). These were unavailable in the local run and are treated as planned multi-source extensions rather than completed local experiments."
));
children.push(h2("5.2 Software and Hardware"));
children.push(p(
  "Implementation used Python 3.14, PyTorch 2.12 (CPU build), Hugging Face Transformers, Datasets, Evaluate, Accelerate, scikit-learn, imbalanced-learn, and Matplotlib. Training ran on CPU without CUDA. Kaggle-style absolute paths (/kaggle/input, /kaggle/working) were remapped to a local workspace. Interactive upload widgets and kernel-restart cells were skipped for non-interactive batch execution."
));
children.push(h2("5.3 Training Hyperparameters"));
children.push(p(
  "The notebook’s intended GPU-oriented settings (batch size 32, multi-epoch schedules) were adapted for CPU as batch size 4 and 1 epoch while preserving the algorithmic structure. Representative configured hyperparameters from the source notebook include:"
));
children.push(makeTable(
  ["Version", "Learning rate", "Epochs (notebook)", "Weight decay", "Warmup", "Output dir"],
  [
    ["V1", "1e-6", "2", "0.02", "50", "deepfake_vs_real_image_detection"],
    ["V2", "5e-7", "2", "0.02", "50", "deepfake_vs_real_v2"],
    ["V3", "1e-5", "5", "0.01", "100", "deepfake_vs_real_v3"],
    ["V5", "2e-6", "5", "0.01", "300", "deepfake_vs_real_v5"]
  ],
  [1400, 1600, 1800, 1400, 1200, 2800]
));
children.push(spacer(120));
children.push(p(
  "Optimization used the Hugging Face Trainer defaults (AdamW family) with evaluation and checkpointing each epoch, loading the best model by validation accuracy where configured. Data augmentation and class balancing were applied before dataset casting."
));
children.push(h2("5.4 Experimental Procedure"));
children.push(bullet("Discover image files via Path.glob on dataset trees; assign labels from parent folder names.", "proc"));
children.push(bullet("Balance classes with RandomOverSampler (random_state=83).", "proc"));
children.push(bullet("Build Hugging Face Dataset; map string labels to ClassLabel ids.", "proc"));
children.push(bullet("Stratified train/test split; attach train/val transforms.", "proc"));
children.push(bullet("Instantiate ViT processor and classifier; fine-tune with Trainer.", "proc"));
children.push(bullet("Compute test metrics, plots, and save model checkpoints/archives.", "proc"));
children.push(h2("5.5 Reproducibility Artifacts"));
children.push(p(
  "Artifacts produced include the executed notebook (deepfake-image-detection-executed.ipynb), cell-level execution logs, run_report.json (57 OK / 7 skip / 9 fail), model directories V1–V5, confusion matrix / ROC / PR / training plots, and ZIP archives of selected checkpoints."
));

// ========== RESULTS ==========
children.push(h1("6. Results"));
children.push(h2("6.1 Quantitative Performance"));
children.push(p(
  "Table 2 summarizes holdout test performance for successive local training stages. V1 and V2 use the Manjil-derived split; V3–V5 use the Saurabh-balanced corpus under CPU constraints."
));
children.push(makeTable(
  ["Model", "Primary data", "Accuracy", "Macro F1", "Test n", "Notes"],
  [
    ["V1", "Manjil subsample", "99.39%", "0.9939", "817", "Best in-domain"],
    ["V2", "Manjil subsample", "98.78%", "0.9878", "817", "Lower LR fine-tune"],
    ["V3", "Saurabh", "78.08%", "0.7788", "219", "Cross-set transfer start"],
    ["V4", "Saurabh", "72.15%", "0.7108", "219", "Continued fine-tune"],
    ["V5", "Saurabh", "69.86%", "0.6940", "219", "Final local checkpoint"]
  ],
  [1200, 1800, 1400, 1400, 1000, 2560]
));
children.push(spacer(160));
children.push(h2("6.2 Per-Class Analysis (V1)"));
children.push(p(
  "On the Manjil holdout, V1 achieved nearly symmetric performance: Real precision 0.9951 / recall 0.9927; Fake precision 0.9927 / recall 0.9951. This indicates strong separation of synthesis artifacts for faces drawn from the same data distribution used in training."
));
children.push(h2("6.3 Per-Class Analysis (V5)"));
children.push(p(
  "On Saurabh holdout, V5 preferred Fake predictions more aggressively (Fake recall 0.8182 vs Real recall 0.5780). Confusion counts: Real correctly classified 63, Real misclassified as Fake 46, Fake misclassified as Real 20, Fake correctly classified 90. ROC-AUC was 0.7804 and average precision 0.7712, confirming ranking quality above chance despite moderate thresholded accuracy."
));
children.push(...imgPara("confusion_matrix.png", 420, "Figure 1. Confusion matrix of the V5 final model on the Saurabh holdout set."));
children.push(...imgPara("roc_curve.png", 420, "Figure 2. ROC curve for the V5 final model (AUC = 0.7804)."));
children.push(...imgPara("precision_recall_curve.png", 420, "Figure 3. Precision–recall curve for the V5 final model."));
children.push(...imgPara("training_progress.png", 450, "Figure 4. Training progress visualization associated with the final model stage."));
children.push(h2("6.4 Qualitative Spot Checks"));
children.push(p(
  "A first-10 image audit on Manjil samples yielded 10/10 correct Real/Fake predictions under the loaded detector, consistent with the high V1 quantitative scores. A broader inference pass produced 1,583 scored predictions for distribution analysis."
));
children.push(h2("6.5 Execution Outcomes"));
children.push(p(
  "Of 73 notebook cells, 57 completed successfully, 7 were intentionally skipped (pip-only installs, interactive widgets, kernel restarts), and 9 failed due to missing OpenFake/Alessandro paths—not due to model training crashes on available data."
));

// ========== COMPARISON ==========
children.push(h1("7. Comparison"));
children.push(h2("7.1 Within-Study Comparison of Model Versions"));
children.push(p(
  "V1 dominates in-domain accuracy, suggesting the pretrained ViT already encodes highly discriminative features for Manjil-like faces and that light fine-tuning suffices. V2 slightly reduced accuracy, possibly from continued optimization on a small split or mild overfitting dynamics under low learning rates. V3–V5 accuracies on Saurabh are substantially lower than V1 on Manjil, highlighting domain shift: different image sources, resolutions, generative processes, and class balance create a harder transfer problem."
));
children.push(h2("7.2 Comparison Against Common Baselines (Literature Context)"));
children.push(p(
  "Published CNN detectors (Xception, EfficientNet) frequently report high accuracy on FaceForensics++ c23/c40 settings but often drop under cross-dataset evaluation. Our V1 in-domain result (≈99.4%) is competitive with strong single-dataset fine-tunes, while V5 cross/small-data accuracy (≈70%) aligns with the well-known generalization gap in deepfake forensics. Transformer detectors in recent literature similarly show that pretraining + multi-source fine-tuning is required for robust real-world performance."
));
children.push(makeTable(
  ["Approach", "Typical strength", "Relation to this work"],
  [
    ["MesoNet / shallow CNNs", "Fast, local artifact focus", "Weaker capacity than ViT; not used here"],
    ["Xception / EfficientNet", "Strong DFDC baselines", "CNN alternative to ViT backbone"],
    ["ViT fine-tune (this work)", "Global attention, transfer learning", "Primary method; high in-domain score"],
    ["Multi-dataset ensembles", "Better robustness", "Proposed V5 intent; partial local data"]
  ],
  [2200, 3200, 3960]
));
children.push(spacer(160));
children.push(h2("7.3 Resource and Protocol Comparison"));
children.push(p(
  "The original Kaggle design assumes GPU acceleration, larger batches (32), multi-epoch schedules, and four datasets. The local reproduction used CPU, batch size 4, one epoch, and two available datasets. Consequently, absolute V3–V5 scores should be interpreted as lower bounds under constrained training rather than as the method’s ceiling. With full multi-source data and GPU multi-epoch training, higher Saurabh/OpenFake generalization is expected."
));
children.push(h2("7.4 Error Analysis"));
children.push(p(
  "Primary error modes on Saurabh were Real images flagged as Fake (false positives for deepfake alarms), which may reflect residual bias from Fake-heavy generative textures or insufficient Real diversity during transfer. Missing OpenFake and Alessandro sources prevented the full multi-corpus curriculum envisioned in the notebook, limiting the fairness of V5 as a “universal” detector."
));

// ========== CONCLUSION ==========
children.push(h1("8. Conclusion"));
children.push(p(
  "This paper presented a complete Vision Transformer-based deepfake image detection pipeline derived from a public Kaggle implementation and validated through end-to-end local experiments. Transfer learning with a pretrained ViT yielded excellent in-domain performance on a Manjil-derived deepfake/real face split (99.39% accuracy, 0.9939 macro F1). Progressive fine-tuning on a smaller external corpus (Saurabh) exposed the practical challenges of domain shift and limited compute, with final V5 accuracy of 69.86%, ROC-AUC 0.7804, and average precision 0.7712."
));
children.push(p(
  "The study confirms that modern transformer classifiers are highly effective when train and test distributions align, but robust deepfake forensics requires broader multi-source curricula, stronger regularization against generator-specific cues, and adequate training resources. Future work should (i) incorporate OpenFake and AI-vs-human datasets at full scale, (ii) train multi-epoch GPU schedules with early stopping on multi-dataset validation, (iii) evaluate frequency-domain hybrids and ensemble CNN–ViT models, (iv) stress-test under compression and adversarial perturbations, and (v) add explainability via attention rollout for forensic reporting."
));
children.push(p(
  "Overall, the proposed ViT fine-tuning workflow is a solid, reproducible foundation for academic research and engineering prototypes in deepfake image detection, with clear pathways to improve cross-domain reliability."
));

// ========== REFERENCES ==========
children.push(h1("9. References"));
const refs = [
  "[1] I. Goodfellow et al., “Generative Adversarial Nets,” in Advances in Neural Information Processing Systems (NeurIPS), 2014.",
  "[2] T. Karras, S. Laine, and T. Aila, “A Style-Based Generator Architecture for Generative Adversarial Networks,” in IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), 2019.",
  "[3] A. Rossler et al., “FaceForensics++: Learning to Detect Manipulated Facial Images,” in IEEE/CVF International Conference on Computer Vision (ICCV), 2019.",
  "[4] B. Dolhansky et al., “The DeepFake Detection Challenge (DFDC) Preview Dataset,” arXiv:1910.08854, 2019.",
  "[5] Y. Li, X. Yang, P. Sun, H. Qi, and S. Lyu, “Celeb-DF: A Large-Scale Challenging Dataset for DeepFake Forensics,” in IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), 2020.",
  "[6] D. Afchar, V. Nozick, J. Yamagishi, and I. Echizen, “MesoNet: A Compact Facial Video Forgery Detection Network,” in IEEE International Workshop on Information Forensics and Security (WIFS), 2018.",
  "[7] F. Chollet, “Xception: Deep Learning with Depthwise Separable Convolutions,” in IEEE Conference on Computer Vision and Pattern Recognition (CVPR), 2017.",
  "[8] M. Tan and Q. V. Le, “EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks,” in International Conference on Machine Learning (ICML), 2019.",
  "[9] A. Dosovitskiy et al., “An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale,” in International Conference on Learning Representations (ICLR), 2021.",
  "[10] H. Touvron et al., “Training Data-Efficient Image Transformers & Distillation Through Attention,” in International Conference on Machine Learning (ICML), 2021.",
  "[11] Z. Liu et al., “Swin Transformer: Hierarchical Vision Transformer Using Shifted Windows,” in IEEE/CVF International Conference on Computer Vision (ICCV), 2021.",
  "[12] Y. Mirsky and W. Lee, “The Creation and Detection of Deepfakes: A Survey,” ACM Computing Surveys, vol. 54, no. 1, 2021.",
  "[13] L. Verdoliva, “Media Forensics and DeepFakes: An Overview,” IEEE Journal of Selected Topics in Signal Processing, vol. 14, no. 5, pp. 910–932, 2020.",
  "[14] T. T. Nguyen et al., “Deep Learning for Deepfakes Creation and Detection: A Survey,” Computer Vision and Image Understanding, vol. 223, 2022.",
  "[15] S. Tariq, S. Lee, H. Kim, Y. Shin, and S. S. Woo, “Detecting Both Machine and Human Created Fake Face Images in the Wild,” in Proceedings of the 2nd International Workshop on Multimedia Privacy and Security, 2018.",
  "[16] H. Zhao et al., “Multi-Attentional Deepfake Detection,” in IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), 2021.",
  "[17] J. Wang et al., “M2TR: Multi-modal Multi-scale Transformers for Deepfake Detection,” in ACM International Conference on Multimedia Retrieval (ICMR), 2022.",
  "[18] T. Wolf et al., “Transformers: State-of-the-Art Natural Language Processing,” in Proceedings of EMNLP: System Demonstrations, 2020.",
  "[19] A. Paszke et al., “PyTorch: An Imperative Style, High-Performance Deep Learning Library,” in Advances in Neural Information Processing Systems (NeurIPS), 2019.",
  "[20] F. Pedregosa et al., “Scikit-learn: Machine Learning in Python,” Journal of Machine Learning Research, vol. 12, pp. 2825–2830, 2011.",
  "[21] G. Lemaître, F. Nogueira, and C. K. Aridas, “Imbalanced-learn: A Python Toolbox to Tackle the Curse of Imbalanced Datasets in Machine Learning,” Journal of Machine Learning Research, vol. 18, no. 17, pp. 1–5, 2017.",
  "[22] Manjil Karki, “Deepfake and Real Images,” Kaggle Dataset. [Online]. Available: https://www.kaggle.com/datasets/manjilkarki/deepfake-and-real-images",
  "[23] Saurabh Bagchi, “Deepfake Image Detection,” Kaggle Dataset. [Online]. Available: https://www.kaggle.com/datasets/saurabhbagchi/deepfake-image-detection",
  "[24] Sanket Ghadge, “OpenFake Data 20k Img,” Kaggle Dataset. [Online]. Available: https://www.kaggle.com/datasets/sanketghadge1/openfake-data-20k-img",
  "[25] Alessandra Sala, “AI vs. Human-Generated Images,” Kaggle Dataset. [Online]. Available: https://www.kaggle.com/datasets/alessandrasala79/ai-vs-human-generated-dataset",
  "[26] Ayush Kumar, “Deepfake Image Detection,” Kaggle Notebook. [Online]. Available: https://www.kaggle.com/code/ayush3102kumar/deepfake-image-detection",
  "[27] dima806, “Deepfake vs Real Image Detection,” Hugging Face Model Card. [Online]. Available: https://huggingface.co/dima806/deepfake_vs_real_image_detection",
  "[28] J. Deng, W. Dong, R. Socher, L.-J. Li, K. Li, and L. Fei-Fei, “ImageNet: A Large-Scale Hierarchical Image Database,” in IEEE Conference on Computer Vision and Pattern Recognition (CVPR), 2009.",
  "[29] K. He, X. Zhang, S. Ren, and J. Sun, “Deep Residual Learning for Image Recognition,” in IEEE Conference on Computer Vision and Pattern Recognition (CVPR), 2016.",
  "[30] N. Carlini and H. Farid, “Evading Deepfake-Image Detectors with White- and Black-Box Attacks,” in IEEE/CVF Conference on Computer Vision and Pattern Recognition Workshops (CVPRW), 2020."
];
refs.forEach(r => {
  children.push(new Paragraph({
    spacing: { after: 100, line: 260 },
    indent: { left: 360, hanging: 360 },
    children: [new TextRun({ text: r, size: 20, font: "Times New Roman" })]
  }));
});

// Appendix note
children.push(h1("Appendix A. Implementation Notes"));
children.push(p(
  "Local workspace root: C:\\Users\\USER\\Downloads\\kaggle_run. Key outputs: deepfake-image-detection-executed.ipynb; working/deepfake_vs_real_v5; working/confusion_matrix.png; working/roc_curve.png; logs/execution_log.txt; logs/run_report.json. Original notebook reference: ayush3102kumar/deepfake-image-detection on Kaggle."
));

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Times New Roman", size: 22 }
      }
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "1F4E79" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 }
      },
      {
        id: "Title", name: "Title", basedOn: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1F4E79" },
        paragraph: { spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER }
      }
    ]
  },
  numbering: {
    config: [
      {
        reference: "obj",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "ver",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "data",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "proc",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F4E79", space: 4 } },
          spacing: { after: 120 },
          children: [new TextRun({
            text: "Deepfake Image Detection Using Vision Transformers",
            size: 16, font: "Arial", color: "666666", italics: true
          })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: "1F4E79", space: 4 } },
          spacing: { before: 80 },
          children: [
            new TextRun({ text: "Page ", size: 16, font: "Arial", color: "666666" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: "666666" }),
            new TextRun({ text: " of ", size: 16, font: "Arial", color: "666666" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: "Arial", color: "666666" })
          ]
        })]
      })
    },
    children
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUT, buffer);
  console.log("Wrote:", OUT);
  console.log("Size KB:", Math.round(buffer.length / 1024));
}).catch(err => {
  console.error(err);
  process.exit(1);
});
