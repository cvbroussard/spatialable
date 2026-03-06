# ModelVault — Product Brief

## Position

ModelVault is a licensed 3D asset library serving three deliverables — 3D Models, Image Clusters, and Environment Panoramas — consumed via API. The generation pipeline is proprietary and behind the curtain. The library is the product. The moat is the accumulated, curated, UPC-matched catalog. The pipeline commoditizes over time — that reduces cost, not value. Spatial commerce is upside positioning, not a dependency.

---

## Deliverables

### 1. 3D Model

The foundational asset. A textured GLB file — geometry plus PBR materials. Renders interactively in any WebGL viewer. Customer drags to rotate freely in any direction, scrolls to zoom, inspects surface detail. Highest fidelity, highest engagement. Requires WebGL-capable device. Best suited for hero product pages, AR "view in room" experiences, and as the source asset from which Image Clusters are derived. One model per product — reusable across any retailer carrying the same UPC/SKU.

### 2. Image Cluster

A sequenced array of pre-rendered images derived from a 3D Model. Displayed as a turntable — customer drags, frames swap, simulating 3D rotation. SD resolution (32 frames) for smooth catalog browsing, HD resolution (64 frames) for detailed product pages. Single-axis rotation per cluster — Y (turntable), X (tilt), or Z (roll) — chosen based on product type. No WebGL, no GPU load, no compatibility concerns. Pure images on a CDN. Works on every device, every browser, every network condition. Lighter to serve, faster to load than a 5-20MB GLB.

**Branded terminology**: "Image Clustering Technology." The noun is "Image Cluster," the verb is "image clustering." SD Cluster (32 frames) and HD Cluster (64 frames) define resolution tiers.

### 3. Environment Panorama

An immersive interior/exterior view assembled from existing photography. AI sources and selects seed images from available photo collections, normalizes exposure and color across heterogeneous captures, stitches them into a single corrected panoramic image with flat perspective. Displayed via CSS pan — the image slides horizontally inside a fixed viewport as the user drags. No 3D engine, no on-site capture, no specialized hardware. A restaurant in Paris, a hotel lobby in Dubai, a museum gallery in Rome — if it's been photographed, it can be panoramified. Serves travel, hospitality, tourism, real estate, and retail showroom markets.

---

## Market Position

ModelVault is a **library company with an API**. Assets are built behind the curtain — the generation pipeline is proprietary. Consumers see a catalog of retail-grade assets and pay for licensed usage. The API is the primary distribution channel.

### Competitive Landscape

| Player | What they are | ModelVault difference |
|--------|--------------|----------------------|
| Threekit / 3D Source | Services-heavy, artist onboarding, per-client work | Automated, no headcount scaling |
| Meshy / Tripo / CSM | Raw AI mesh generation, developer tools | Retail-grade output, curated library, UPC-matched |
| Matterport | Hardware-dependent on-site environment capture | No hardware, no on-site visit, sources from existing photos |
| TurboSquid / Sketchfab | Artist-uploaded marketplace, inconsistent quality | Curated, standardized, retail-specific taxonomy |
| Cylindo | Image-sequence visualization, services model | Automated pipeline, API-first, multi-deliverable |

### What ModelVault is not

- Not a marketplace (we own and license the assets, we don't host third-party uploads)
- Not a services company (no per-client artist work, no onboarding engagements)
- Not an infrastructure tool (end users don't generate their own models — we generate, curate, and serve)

---

## Library Moat

The library's value compounds independently of any single customer:

- **UPC/SKU matching** — instant lookup, no generation needed. Higher hit rate over time means lower marginal cost per new customer.
- **Curation and quality standard** — every asset meets a retail-grade bar. Consistent quality, format, and taxonomy.
- **Form factor intelligence** — the knowledge that hundreds of SKUs from dozens of manufacturers share the same shape. One base model, many material applications.
- **Network effect** — every customer's generation requests enrich the library for all future customers. Flywheel.

---

## Market Future

### Pipeline Commoditization

The 3D generation pipeline will commoditize. Photorealistic AI texturing will be solved within 12-18 months. This helps ModelVault — generation cost drops, quality improves, pipeline components are swappable. The pipeline was never the moat. The library is.

### Spatial Commerce

Apple Vision Pro, Meta Quest, and spatial computing shift 3D product assets from nice-to-have to mandatory infrastructure. You cannot render a product in a spatial environment without a 3D model — there is no JPEG fallback. If spatial commerce reaches mainstream adoption, every product in commerce needs a 3D asset. ModelVault is positioned for this demand curve without depending on it. The library has value today for conventional product visualization. Spatial commerce is exponential upside.
