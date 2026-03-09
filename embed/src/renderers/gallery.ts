// ---------------------------------------------------------------------------
// Gallery renderer — mixed-media carousel with thumbnail strip
// ---------------------------------------------------------------------------

import type { ResolvedAsset } from '../types';
import { renderHero } from './hero';

const GALLERY_STYLES = `
  .sa-gallery {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .sa-gallery-main {
    width: 100%;
    aspect-ratio: 4/3;
    position: relative;
    overflow: hidden;
    border-radius: var(--sa-radius, 0);
    background: #f8f8f8;
  }

  .sa-gallery-thumbs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px;
    scrollbar-width: thin;
  }

  .sa-gallery-thumb {
    width: 60px;
    height: 60px;
    flex-shrink: 0;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    opacity: 0.6;
    transition: opacity 0.2s, border-color 0.2s;
    background: #f0f0f0;
  }

  .sa-gallery-thumb:hover {
    opacity: 0.9;
  }

  .sa-gallery-thumb.active {
    border-color: var(--sa-primary, #333);
    opacity: 1;
  }

  .sa-gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }

  .sa-gallery-thumb-3d {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: #666;
    background: #e8e8e8;
  }
`;

export async function renderGallery(container: HTMLElement, assets: ResolvedAsset[]): Promise<void> {
  if (assets.length === 0) {
    container.innerHTML = '<div class="sa-error">No media available</div>';
    return;
  }

  if (assets.length === 1) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sa-container';
    container.innerHTML = '';
    container.appendChild(wrapper);
    await renderHero(wrapper, assets[0]);
    return;
  }

  // Inject gallery-specific styles
  const style = document.createElement('style');
  style.textContent = GALLERY_STYLES;
  container.appendChild(style);

  const gallery = document.createElement('div');
  gallery.className = 'sa-gallery';

  // Main viewport
  const main = document.createElement('div');
  main.className = 'sa-gallery-main';
  gallery.appendChild(main);

  // Thumbnail strip
  const thumbs = document.createElement('div');
  thumbs.className = 'sa-gallery-thumbs';
  gallery.appendChild(thumbs);

  let activeIndex = 0;

  function setActive(index: number) {
    activeIndex = index;
    // Update thumb states
    const thumbEls = thumbs.querySelectorAll('.sa-gallery-thumb');
    thumbEls.forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });
    // Render main
    main.innerHTML = '';
    renderHero(main, assets[index]);
  }

  // Build thumbnails
  assets.forEach((asset, i) => {
    const thumb = document.createElement('div');
    thumb.className = `sa-gallery-thumb ${i === 0 ? 'active' : ''}`;

    if (asset.content_type === 'model/gltf-binary') {
      thumb.classList.add('sa-gallery-thumb-3d');
      thumb.textContent = '3D';
    } else {
      const img = document.createElement('img');
      img.src = asset.url;
      img.alt = asset.alt;
      img.draggable = false;
      thumb.appendChild(img);
    }

    thumb.addEventListener('click', () => setActive(i));
    thumbs.appendChild(thumb);
  });

  container.innerHTML = '';
  container.appendChild(gallery);

  // Render first asset
  await renderHero(main, assets[0]);

  // Keyboard navigation
  container.setAttribute('tabindex', '0');
  container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((activeIndex + 1) % assets.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((activeIndex - 1 + assets.length) % assets.length);
    }
  });
}
