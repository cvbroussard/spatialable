'use client';

import { useState } from 'react';

export default function EmbedDemoPage() {
  const [token, setToken] = useState('');
  const [productId, setProductId] = useState('');
  const [applied, setApplied] = useState(false);

  function apply() {
    if (!token) return;
    setApplied(true);
    // Force re-render by toggling applied state
    setTimeout(() => {
      // Set attributes on sa-media elements after they render
      document.querySelectorAll('sa-media').forEach((el) => {
        el.setAttribute('token', token);
        el.setAttribute('api-base', window.location.origin);
      });
    }, 100);
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 40, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>SpatialAble Embed Demo</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
        Test the &lt;sa-media&gt; web component with your subscription token.
      </p>

      {/* Config */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}>
        <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>
          Subscription Token
        </label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="sk_live_..."
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: 6,
            fontSize: 14,
            fontFamily: 'monospace',
            marginBottom: 12,
          }}
        />
        <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>
          Product ID (UPC/SKU)
        </label>
        <input
          type="text"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="optional — leave blank for static demo"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: 6,
            fontSize: 14,
            fontFamily: 'monospace',
            marginBottom: 12,
          }}
        />
        <button
          onClick={apply}
          style={{
            padding: '8px 16px',
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Load Components
        </button>
        <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
          Generate a token: <code>node scripts/create-subscription.js --client-id YOUR_CLIENT_ID --tier standard --domains localhost</code>
        </p>
      </div>

      {/* Demo components — only render after token is set */}
      {applied && (
        <>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Hero</h2>
          <div style={{
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}>
            {/* @ts-expect-error — sa-media is a custom element */}
            <sa-media
              token={token}
              product-id={productId || undefined}
              product-type="hero"
              api-base={typeof window !== 'undefined' ? window.location.origin : ''}
              style={{ width: '100%', maxWidth: 600, borderRadius: 8 }}
            />
          </div>

          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Gallery</h2>
          <div style={{
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}>
            {/* @ts-expect-error — sa-media is a custom element */}
            <sa-media
              token={token}
              product-id={productId || undefined}
              product-type="gallery"
              api-base={typeof window !== 'undefined' ? window.location.origin : ''}
              style={{ width: '100%', maxWidth: 600, borderRadius: 8 }}
            />
          </div>

          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Shadow DOM Status</h2>
          <p style={{ fontSize: 14, color: '#666' }}>
            The components above use <strong>closed Shadow DOM</strong>. Open DevTools
            and verify that the shadow root is not accessible via <code>element.shadowRoot</code> (returns null).
          </p>
        </>
      )}

      {/* Loader script — loads the web component definition */}
      <script src="/embed/loader.js" async />
    </div>
  );
}
