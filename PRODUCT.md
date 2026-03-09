# SpatialAble — Product Brief

## Position

SpatialAble is a **Media as a Service (MAAS)** platform for ecommerce. Every visual asset an ecommerce site needs — product images, video, 3D models, category heroes, site-level banners, industry lifestyle photography — served through piracy-protected loader components and a single API. The consumer never hosts files. SpatialAble provisions the entire visual layer.

The generation pipeline is proprietary and behind the curtain. The library is the product. The moat is the accumulated, curated, UPC-matched catalog at scale. The pipeline commoditizes over time — that reduces cost, not value.

---

## Media Scope

### Product-Level Assets
- Hero images, lifestyle shots, detail crops, swatch images
- Product video, 360 spins, feature demos
- 3D product models (GLB — AI-generated, ultra mesh, 4K texture, PBR)
- Size/fit reference images

### Category / Taxonomy-Level Assets
- Category hero banners (furniture, lighting, outdoor, etc.)
- Subcategory thumbnails
- Collection headers
- Seasonal campaign imagery

### Site-Level Assets
- Homepage hero banners
- About/brand story imagery
- Blog/editorial stock
- Promotional banners, sale graphics
- Trust badges, shipping/return iconography
- Background textures, patterns

### Industry-Vertical Assets
- Lifestyle photography sets (modern living room, rustic kitchen, minimalist bedroom)
- Room scenes for virtual staging (3D environments)
- Model/people photography for fashion verticals
- Food photography sets for grocery/restaurant verticals

### 3D Assets
- **3D Product Models** — AI-generated from source images or video, with ultra mesh geometry, 4K textures, and PBR material maps
- **3D Environments** — navigable spatial scenes generated from video capture via photogrammetry (Gaussian Splatting / NeRFs)

A new retailer selects their vertical and aesthetic. SpatialAble provisions a complete media kit — the site is visually operational from day one. Product media fills in as catalog builds out.

---

## Delivery Model

### Terminology

- **MAAS Platform** — SpatialAble. The media service provider.
- **Consumer Platform** — the client (RetailSpec, a custom storefront, any ecommerce application). The subscription holder.

### Subscriptions

Consumer platforms subscribe based on **volume** (impression count, asset count) and **media types** (images only, images + video, full media including 3D, configurator access). Subscription activates a token. Token goes into snippets. Snippets go into the consumer platform's templates.

### Tokenized Snippets (The Lock)

The delivery mechanism is a single `<sa-media>` web component. The consumer platform receives a subscription token and a set of snippet templates — each snippet is self-contained with authentication and asset binding. Piracy protection is built into every render: signed URL delivery, domain-locked tokens, usage metering. Assets never leave SpatialAble infrastructure. Subscription lapses, snippets go dark.

#### Static Snippets

Fixed asset reference. Place wherever that visual needs to appear — about page hero, category banner, homepage slider, trust badge. The token authenticates, the asset ID resolves, the component renders.

```html
<!-- Lifestyle hero on the about page -->
<sa-media token="sk_live_xxx" asset="lifestyle-modern-living-01" />

<!-- Category banner -->
<sa-media token="sk_live_xxx" asset="category-hero-outdoor-furniture" />
```

The consumer platform is free to place any static snippet at any render point in their site. One tag, one asset, protected delivery.

#### Dynamic Snippets — Product Pages

Binds to the consumer platform's product context. The `product-id` is dynamic — injected by the consumer platform's template engine from their own product data. The `product-type` tells the loader what component to render for that product.

```html
<!-- Product gallery: image carousel + video + 3D model -->
<sa-media token="sk_live_xxx" product-id="{{product.id}}" product-type="gallery" />

<!-- Product configurator: swatch swap, material zones, pricing -->
<sa-media token="sk_live_xxx" product-id="{{product.id}}" product-type="configurator" />

<!-- Simple product hero image -->
<sa-media token="sk_live_xxx" product-id="{{product.id}}" product-type="hero" />
```

The consumer platform decides per-page what experience a product gets. Same `<sa-media>` tag, different `product-type`. The MAAS platform handles the rest — fetching the right assets, rendering the right component, tracking usage.

### Product Types

| product-type | Renders | Subscription Tier |
|---|---|---|
| `hero` | Single product image | Base |
| `gallery` | Mixed media carousel (images, video, 3D) | Standard |
| `configurator` | Swatch selection, material swapping on segmented 3D model. Emits `sa:configure` events with zone/material selections — pricing and commerce logic owned by the consumer platform. | Premium |

### Component Behavior

All snippet types share:
- **Token authentication** — subscription-bound, domain-locked, revocable
- **Signed URL delivery** — assets fetched via time-limited URLs, never permanent
- **Usage metering** — every impression, interaction, and configuration event tracked and billed
- **Responsive rendering** — adapts to container size
- **Lazy loading** — assets load on viewport intersection, not page load
- **Graceful degradation** — 3D falls back to image carousel on unsupported devices

### Export Tier

For consumer platforms with legitimate needs for raw files (print production, AR apps, native mobile, offline rendering): raw file delivery at premium pricing with contractual protection + watermarking/fingerprinting. The exception, not the default.

---

## 3D Pipeline Detail

### Source Funnels
Brand-centric webstore pull, image libraries, web search, AI-generated images, partner/manufacturer submissions, video capture (photogrammetry).

### Pre-Generation Augmentation
Vision AI (Claude) analyzes each source image and generates a structured text prompt (subject + shape + materials + key details + style) that supplements the image during generation. Provides semantic context, improves geometry fidelity, serves as image quality signal. Stored on `source_images.generation_prompt`.

### Post-Generation Pipeline
QC proofing → manual segmentation (material zones) → material swatch assignment → final review. Segmented models support product configurability via the Tier 3 configurator loader.

---

## Market Position

SpatialAble is a **media library company with a protected delivery layer**. Assets are built/curated behind the curtain. Consumers see a catalog of commerce-ready media and pay for licensed access via loader components. The loaders are the primary distribution channel.

### Competitive Landscape

| Player | What they are | SpatialAble difference |
|--------|--------------|----------------------|
| ThreeKit | Full SaaS platform — viewer, CPQ, configurator. Custom per-brand asset creation. Enterprise contracts. | Shared catalog (one asset, many licensees). AI-generated at scale. Full media scope, not 3D-only. Tier 3 loader competes directly with ThreeKit's configurator. |
| Cloudinary / Imgix | Image CDN + transformation. No 3D, no video hosting, no content — just delivery infrastructure. | SpatialAble provides the content AND the delivery. Not infrastructure — a library with a delivery layer. |
| Getty / Shutterstock | Stock media libraries. Generic, not commerce-specific. No 3D. No product-level matching. | Commerce-specific, UPC/SKU-matched, product-centric taxonomy. Full media scope including 3D. Protected delivery vs downloadable files. |
| Meshy / Tripo / CSM | Raw AI mesh generation tools for developers | Retail-grade output, curated library, UPC-matched, protected delivery |
| Matterport | Hardware-dependent on-site environment capture | Video-to-3D from phone, no hardware, no on-site visit |
| Cylindo | Image-sequence visualization, services model | Full media scope, streaming 3D, loader components |

### What SpatialAble is not

- Not a CDN (we provide the content, not just the pipes)
- Not a marketplace (we own and license the assets, we don't host third-party uploads)
- Not a services company (no per-client artist work, no onboarding engagements)
- Not an infrastructure tool (end users don't generate their own media — we curate, generate, and serve)
- Not a commerce engine (no pricing, no cart, no CPQ — the configurator renders visual configuration and emits structured events; the consumer platform owns all commercial logic)

---

## Library Moat

The library's value compounds independently of any single customer:

- **UPC/SKU matching** — instant lookup, no generation needed. Higher hit rate over time means lower marginal cost per new customer.
- **Full media coverage** — one API call returns every visual asset a product or page needs. No gaps, no sourcing.
- **Curation and quality standard** — every asset meets a commerce-grade bar. Consistent quality, format, and taxonomy.
- **Form factor intelligence** — the knowledge that hundreds of SKUs from dozens of manufacturers share the same shape. One base model, many material applications.
- **Vertical media kits** — pre-composed site-level and category-level assets by industry vertical. New site launches are visually complete on day one.
- **Network effect** — every customer's media needs enrich the library for all future customers. Flywheel.
- **Scale economics** — AI generation makes a catalog of tens of thousands of assets economically feasible. The breadth of the catalog is the moat, not any individual asset.

---

## Market Future

### Pipeline Commoditization

The 3D generation pipeline will commoditize. Photorealistic AI texturing, context-aware segmentation, automated retopology, and video-to-3D photogrammetry are all maturing rapidly. This helps SpatialAble — generation cost drops, quality improves, pipeline components are swappable. The pipeline was never the moat. The library is.

### External Asset & Reference Libraries

Potential source funnels and material references identified from industry:

| Site | Focus | SpatialAble Use |
|------|-------|-----------------|
| **Unsplash** | High-quality professional photography, broad commercial license | `library` funnel — free product/object photos for speculative catalog building |
| **Pexels** | Diverse royalty-free photos and video, realistic proportions | `library` funnel — similar to Unsplash, also video source for photogrammetry |
| **Poly Haven** | CC0 PBR textures, HDRIs, and 3D scans | Materials library — tileable PBR swatch sets (albedo, normal, roughness, metallic) for the `materials` table |
| **ArtStation** | Professional concept art, characters, props, environments | Inspiration/reference only — artist-owned content, not for direct sourcing |
| **80 Level** | Curated artist breakdowns, material vocabulary, technique references | Professional terminology for AI prompt generation (patina, weathering, anodized, etc.) |
| **CG Channel** | 3D industry trends, scanned assets, style references | Trend tracking, vocabulary for prompt engineering |

### AI-Augmented Generation Prompting

Vision AI analysis of source images prior to generation — producing structured text prompts that supplement the image input. Depends on Tripo API supporting combined image+text input (confirm with v3.1 API access). Reduces generation failures, improves geometry accuracy, and automates quality gating of source images.

### Product Family Consistency (Flux Kontext)

Flux Kontext (available in Tripo Studio) maintains visual consistency across multiple generations by using a reference image as context. Solves the product family coherence problem — generating a sofa, loveseat, accent chair, and ottoman from the same collection that share design language (arm style, leg profile, cushion tufting). Use cases:

- **Product collections** — generate one hero piece, use as reference anchor for the rest of the line
- **Color/material variants** — generate same product in different finishes with identical geometry
- **Brand consistency** — manufacturer's aesthetic carries across their entire catalog

Currently Studio-only (manual operator workflow). Becomes a pipeline feature if/when Tripo API supports reference image input. The curation layer already supports product grouping via `source_images.product_group` — a reference anchor designation per group would enable this workflow.

### Spatial Commerce

Apple Vision Pro, Meta Quest, and spatial computing shift 3D product assets from nice-to-have to mandatory infrastructure. You cannot render a product in a spatial environment without a 3D model — there is no JPEG fallback. If spatial commerce reaches mainstream adoption, every product in commerce needs a 3D asset. SpatialAble is positioned for this demand curve without depending on it. The library has value today for conventional product visualization. Spatial commerce is exponential upside.
