// ---------------------------------------------------------------------------
// Hero renderer — single image or 3D model
//
// Assets are fetched via JavaScript and rendered as blob URLs.
// The presigned R2 URL never appears in the DOM — only a blob: URL
// that is tied to the current page context and cannot be opened elsewhere.
// ---------------------------------------------------------------------------

import type { ResolvedAsset } from '../types';

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

/**
 * Fetch an asset URL via JavaScript and return a blob URL.
 * The blob URL only exists in the current page context.
 */
async function fetchAsBlob(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Asset fetch failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function renderHero(container: HTMLElement, asset: ResolvedAsset): Promise<void> {
  if (asset.content_type === 'model/gltf-binary') {
    // 3D models — fetch as blob, pass blob URL to model-viewer
    await loadModelViewer();

    if (modelViewerLoaded) {
      try {
        const blobUrl = await fetchAsBlob(asset.url);
        const viewer = document.createElement('div');
        viewer.className = 'sa-viewer';
        const mv = document.createElement('model-viewer');
        mv.setAttribute('alt', asset.alt);
        mv.setAttribute('auto-rotate', '');
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('shadow-intensity', '1');
        mv.setAttribute('tone-mapping', 'neutral');
        mv.setAttribute('style', 'width:100%;height:100%');
        mv.addEventListener('load', () => URL.revokeObjectURL(blobUrl));
        mv.setAttribute('src', blobUrl);
        viewer.appendChild(mv);
        container.innerHTML = '';
        container.appendChild(viewer);
        return;
      } catch {
        // Fall through to image fallback
      }
    }
  }

  if (asset.content_type.startsWith('video/')) {
    try {
      const blobUrl = await fetchAsBlob(asset.url);
      const video = document.createElement('video');
      video.className = 'sa-image';
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.onloadeddata = () => URL.revokeObjectURL(blobUrl);
      video.src = blobUrl;
      container.innerHTML = '';
      container.appendChild(video);
      return;
    } catch {
      // Fall through to error
    }
  }

  // Default: image — fetch as blob so presigned URL never appears in DOM.
  // Revoke blob URL after load so it can't be opened in another tab.
  try {
    const blobUrl = await fetchAsBlob(asset.url);
    const img = document.createElement('img');
    img.className = 'sa-image';
    img.alt = asset.alt;
    img.draggable = false;
    img.addEventListener('contextmenu', (e) => e.preventDefault());
    img.onload = () => URL.revokeObjectURL(blobUrl);
    img.src = blobUrl;
    container.innerHTML = '';
    container.appendChild(img);
  } catch {
    container.innerHTML = '<div class="sa-error">Failed to load media</div>';
  }
}
