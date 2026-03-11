# Image Generation Model Strategy

## Premise

Standardized multi-angle product photography is a solved problem at the model layer. Purpose-built fine-tuned models already exist that take a single reference image and output a consistent set of e-commerce-standard angles. The barrier to entry is not infrastructure (fal, Replicate, Modal commoditized GPU deployment) — it's training data quality.

SpatialAble's advantage: the curation pipeline produces validated, spec-compliant product imagery as a byproduct of normal operations. That dataset compounds over time and becomes the basis for a proprietary fine-tuned model.

## Hard Constraint — Source Image Required

**All generated product images MUST be derived from one or more source photographs of the actual manufactured product.** Text-only generation is excluded from the production pipeline.

Rationale: SpatialAble's packshot images are product representations used in commerce. They must accurately depict the real product — exact geometry, materials, proportions, and details. Text-to-image generation, regardless of prompt sophistication (including VGL structured prompts), produces *interpretations* of a description, not reproductions of a specific product. This creates misrepresentation liability.

The AI's role is strictly:
- **Camera angle manipulation** — re-render the real product from standardized angles
- **Background standardization** — clean white studio background
- **Lighting normalization** — consistent, even studio lighting

The AI does NOT design, interpret, or improvise the product. The source images are ground truth.

### Multi-Image Input (Strongly Preferred)

A single source image is under-constrained — the model must hallucinate unseen geometry (the back, underside, hidden details). Multiple source images from different angles provide actual geometric coverage, enabling faithful reconstruction rather than informed guessing.

**Ideal input:** 2–5 source photographs of the actual product from different angles. They don't need to be standardized — casual manufacturer photos, lifestyle crops, and detail shots all contribute geometric information.

### Background Removal Pre-Step (Mandatory)

Source images arrive with arbitrary backgrounds — manufacturer studios, lifestyle scenes, cluttered surfaces. These backgrounds are noise that degrades view synthesis accuracy. All source images must be background-removed before entering the generation pipeline.

This produces clean, isolated product cutouts on transparent/white backgrounds, giving the view synthesis model an unambiguous product silhouette and eliminating environmental distractions from the geometry signal.

Background removal is a solved, cheap operation — Bria RMBG, rembg (open-source), or equivalent. Runs as the first step in the pipeline before any generation calls.

**Provider evaluation filter:**
- Single-image input: usable but limited fidelity
- Multi-image input with coherent 3D understanding: strongly preferred
- This is effectively **sparse-view reconstruction → standardized re-rendering** — closer to 3D reconstruction (Tripo) than text-to-image generation (Bria/Imagen)

This constraint drives provider selection toward **image-conditioned view synthesis** models — not general-purpose text-to-image generators.

---

## Phase 1 — Ingest Source Images from Manufacturer Brands

**Status:** Active (Image Pull pipeline built)

Pull product images from manufacturer/brand websites via their public Shopify JSON APIs. Studio shots from manufacturers are production-quality source material — they can be standardized (background removal, lighting normalization) without AI view synthesis.

**Pipeline:** Discover product URLs from sitemaps → fetch product data via Shopify `.json` API → download images → optimize with Sharp (2000px max, WebP) → upload to R2 → insert `source_images` rows with `funnel='brand_pull'`, status `pending`.

GTIN/UPC/SKU captured from Shopify variant data and stored on each `source_images` row for downstream asset matching.

**Multi-angle AI generation** (FLUX.2, Bria, Google Imagen) is shelved pending model maturity. Current state-of-the-art produces geometric drift and hallucination that fails commerce-grade accuracy requirements (see Hard Constraint above). Revisit in ~6 months.

**Deliverable:** Working image pull pipeline. Configure brand target sitemaps → pull images → curate in `/curate`.

---

## Phase 2 — Curate (The Human Gate)

**Status:** Infrastructure exists

Every generated image passes through human review in `/curate`. Reviewers approve or reject based on:

- Product identity accuracy (does it match the description/reference?)
- Camera angle correctness (is the hero_front actually front-facing?)
- Lighting and composition standards (white background, centered, even studio lighting)
- Material/texture fidelity

Rejected images are training signal too — they define the boundary of "not good enough."

**Deliverable:** Growing corpus of validated, labeled product photography.

---

## Phase 3 — Training Data Accumulates Passively

**Status:** Begins automatically once Phase 1 + 2 are operational

Each approved image is a labeled training example with structured metadata:

- GTIN (product identity)
- Angle key (`hero_front`, `three_quarter_front`, `top_down`, etc.)
- Asset role (`hero`, `gallery`)
- Position (0–9)
- Product description (source prompt)
- Image URL (1024×1024 WebP, consistent format)

This is not a purpose-built dataset collection effort. It's a byproduct of the core business — building a product asset library. The dataset embodies SpatialAble's specific standards, not generic e-commerce scrapes.

**Threshold for fine-tuning viability:** ~500–1,000 approved products (5,000–10,000 labeled images across angles).

---

## Phase 4 — Fine-Tune a Proprietary Model

**Status:** Future
**Prerequisites:** Phase 3 threshold reached

Take an open-source base model (Flux, SDXL, or successor) and fine-tune using LoRA or DreamBooth on the curated dataset. The model learns SpatialAble's specific:

- Framing and composition per angle
- Lighting specification
- Background standard
- Camera/lens characteristics per angle type

Fine-tuning runs on a single H100 session — hours, not days. LoRA adapters are small (tens of MB) and version-controllable.

**Deliverable:** Fine-tuned model weights that encode SpatialAble's photography standard.

---

## Phase 5 — Deploy, Replace API Calls

**Status:** Future
**Cost:** ~$0.003/image (raw GPU compute)

Deploy the fine-tuned model on fal.ai Serverless (or equivalent):

```python
class SpatialablePackshot(fal.App):
    machine_type = "GPU-H100"

    def setup(self):
        # Load fine-tuned weights from persistent storage
        self.pipeline = load_model("/data/models/spatialable-packshot-v1")

    @fal.endpoint("/")
    def run(self, prompt: str, angles: list[str]) -> list[dict]:
        # Generate all requested angles
        return [self.pipeline(prompt, angle) for angle in angles]
```

Swap the third-party API call in the Inngest pipeline for the fal endpoint. No other changes needed — the pipeline is already provider-agnostic.

**Economics at scale:**

| Approach | Per Image | Per Product (10 angles) | 1,000 Products |
|----------|-----------|------------------------|-----------------|
| Bria Fibo | $0.04 | $0.40 | $400 |
| Google Imagen | $0.02 | $0.20 | $200 |
| Own model (fal H100) | ~$0.003 | ~$0.03 | $30 |

---

## Continuous Improvement Loop

Once Phase 5 is live, the loop tightens:

1. Own model generates images → cheaper, faster
2. Curation pipeline approves/rejects → quality signal
3. Approved images feed back into the training set
4. Periodic re-fine-tune improves the model
5. Rejected images inform what to correct in the next training round

Each cycle produces better output at lower cost. The curation rejection rate becomes the primary quality metric.

---

## Key Principles

- **The library is the product, not the model.** The model is a cost optimization.
- **SpatialAble is the curator, not the toolsmith.** Consume the best available tool at each phase.
- **Training data is a byproduct, not a project.** Normal operations produce it.
- **The pipeline is provider-agnostic.** Phase 1 provider can be swapped without architectural changes.
- **Human curation is the quality gate at every phase.** Even with a proprietary model, images still pass through review.
