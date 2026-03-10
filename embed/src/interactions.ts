// ---------------------------------------------------------------------------
// Gallery interaction handlers
//
// Attaches click and keyboard navigation to server-rendered gallery markup.
// When a thumbnail is clicked, the main viewport swaps to that asset
// by re-hydrating from the thumbnail's data attributes.
// ---------------------------------------------------------------------------

import { hydrateShadowDom } from './hydrate';

/**
 * Initialize gallery interactions on server-rendered gallery markup.
 * Attaches thumbnail click handlers and keyboard navigation.
 */
export function initGalleryInteractions(container: HTMLElement | ShadowRoot): void {
  const gallery = container.querySelector('.sa-gallery');
  if (!gallery) return;

  const main = gallery.querySelector('.sa-gallery-main');
  const thumbsContainer = gallery.querySelector('.sa-gallery-thumbs');
  if (!main || !thumbsContainer) return;

  const thumbs = thumbsContainer.querySelectorAll('.sa-gallery-thumb');
  if (thumbs.length === 0) return;

  let activeIndex = 0;

  function setActive(index: number) {
    if (index === activeIndex) return;
    activeIndex = index;

    // Update thumb active states
    thumbs.forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });

    // Get asset data from the clicked thumbnail
    const thumb = thumbs[index];
    const src = thumb.getAttribute('data-sa-src');
    const type = thumb.getAttribute('data-sa-type') || 'image/webp';
    const id = thumb.getAttribute('data-sa-id') || '';
    const alt = thumb.querySelector('img')?.alt || 'Product';

    // Build the main viewport element from thumbnail data
    main.innerHTML = '';

    if (type === 'model/gltf-binary' && src) {
      const viewer = document.createElement('div');
      viewer.className = 'sa-viewer';
      viewer.setAttribute('data-sa-src', src);
      viewer.setAttribute('data-sa-type', type);
      viewer.setAttribute('data-sa-id', id);
      viewer.setAttribute('data-sa-alt', alt);
      main.appendChild(viewer);
    } else if (type.startsWith('video/') && src) {
      const video = document.createElement('video');
      video.className = 'sa-video';
      video.setAttribute('data-sa-src', src);
      video.setAttribute('data-sa-type', type);
      video.setAttribute('data-sa-id', id);
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      main.appendChild(video);
    } else {
      // Image — get URL from thumbnail's nested img
      const thumbImg = thumb.querySelector('img');
      const imgSrc = thumbImg?.getAttribute('data-sa-thumb') || src || '';
      const img = document.createElement('img');
      img.className = 'sa-image';
      img.setAttribute('data-sa-src', imgSrc);
      img.setAttribute('data-sa-type', type);
      img.setAttribute('data-sa-id', id);
      img.alt = alt;
      img.draggable = false;
      img.src = '';
      main.appendChild(img);
    }

    // Hydrate the new main viewport element
    hydrateShadowDom(main as HTMLElement);
  }

  // Attach click handlers
  thumbs.forEach((thumb, i) => {
    thumb.addEventListener('click', () => setActive(i));
  });

  // Keyboard navigation
  const galleryEl = gallery as HTMLElement;
  galleryEl.setAttribute('tabindex', '0');
  galleryEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((activeIndex + 1) % thumbs.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((activeIndex - 1 + thumbs.length) % thumbs.length);
    }
  });
}
