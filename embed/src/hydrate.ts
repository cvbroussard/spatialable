// ---------------------------------------------------------------------------
// Shadow DOM hydration — converts data-sa-src placeholders to blob URLs
//
// The server renders HTML with data-sa-src attributes containing signed URLs.
// This module fetches each asset as a blob, sets the actual src to a blob URL,
// and revokes it after load. The presigned URL never appears in the DOM.
// ---------------------------------------------------------------------------

let modelViewerLoaded = false;
let modelViewerLoading = false;

function loadModelViewer(): Promise<void> {
  if (modelViewerLoaded) return Promise.resolve();
  if (modelViewerLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (modelViewerLoaded) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  modelViewerLoading = true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
    script.onload = () => {
      modelViewerLoaded = true;
      resolve();
    };
    script.onerror = () => {
      modelViewerLoading = false;
      resolve();
    };
    document.head.appendChild(script);
  });
}

async function fetchAsBlob(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Asset fetch failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Hydrate a single element with data-sa-src.
 * Fetches the signed URL as a blob and sets the actual src.
 */
async function hydrateElement(el: Element): Promise<string | null> {
  const signedUrl = el.getAttribute('data-sa-src');
  const type = el.getAttribute('data-sa-type') || '';
  const assetId = el.getAttribute('data-sa-id');

  if (!signedUrl) return null;

  try {
    if (type === 'model/gltf-binary') {
      await loadModelViewer();

      if (modelViewerLoaded) {
        const blobUrl = await fetchAsBlob(signedUrl);
        const mv = document.createElement('model-viewer') as any;
        mv.setAttribute('alt', el.getAttribute('data-sa-alt') || 'Product 3D');
        mv.setAttribute('auto-rotate', '');
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('shadow-intensity', '1');
        mv.setAttribute('tone-mapping', 'neutral');
        mv.setAttribute('style', 'width:100%;height:100%');
        mv.addEventListener('load', () => URL.revokeObjectURL(blobUrl));
        mv.setAttribute('src', blobUrl);
        el.innerHTML = '';
        el.appendChild(mv);
      }
    } else if (type.startsWith('video/')) {
      const blobUrl = await fetchAsBlob(signedUrl);
      const video = el as HTMLVideoElement;
      video.onloadeddata = () => URL.revokeObjectURL(blobUrl);
      video.src = blobUrl;
    } else {
      // Image
      const blobUrl = await fetchAsBlob(signedUrl);
      const img = el as HTMLImageElement;
      img.addEventListener('contextmenu', (e) => e.preventDefault());
      img.onload = () => URL.revokeObjectURL(blobUrl);
      img.src = blobUrl;
    }
  } catch {
    // Leave element in placeholder state
  }

  return assetId;
}

/**
 * Hydrate gallery thumbnail images (data-sa-thumb attributes).
 */
async function hydrateThumbnails(root: ShadowRoot | HTMLElement): Promise<void> {
  const thumbImgs = root.querySelectorAll('[data-sa-thumb]');

  await Promise.all(
    Array.from(thumbImgs).map(async (img) => {
      const url = img.getAttribute('data-sa-thumb');
      if (!url) return;

      try {
        const blobUrl = await fetchAsBlob(url);
        (img as HTMLImageElement).onload = () => URL.revokeObjectURL(blobUrl);
        (img as HTMLImageElement).src = blobUrl;
      } catch {
        // Leave thumbnail blank
      }
    }),
  );
}

/**
 * Hydrate all data-sa-src elements in the Shadow DOM.
 * Returns an array of asset IDs that were successfully hydrated.
 */
export async function hydrateShadowDom(root: ShadowRoot | HTMLElement): Promise<string[]> {
  const elements = root.querySelectorAll('[data-sa-src]');
  const assetIds: string[] = [];

  // Hydrate main elements and thumbnails in parallel
  const [mainResults] = await Promise.all([
    Promise.all(Array.from(elements).map(hydrateElement)),
    hydrateThumbnails(root),
  ]);

  for (const id of mainResults) {
    if (id) assetIds.push(id);
  }

  return assetIds;
}

/**
 * Hydrate a single element by index (used by gallery interaction when switching assets).
 */
export async function hydrateElementBySelector(
  root: ShadowRoot | HTMLElement,
  selector: string,
): Promise<string | null> {
  const el = root.querySelector(selector);
  if (!el) return null;
  return hydrateElement(el);
}
