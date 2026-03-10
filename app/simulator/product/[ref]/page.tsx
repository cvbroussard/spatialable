import { getActiveSimulatorClient } from '@/lib/simulator/client';
import { getSimulatorProduct } from '@/lib/simulator/products';
import { notFound } from 'next/navigation';

interface PdpPageProps {
  params: Promise<{ ref: string }>;
}

export default async function ProductDetailPage({ params }: PdpPageProps) {
  const { ref } = await params;
  const client = await getActiveSimulatorClient();

  if (!client) {
    return <div className="p-6 text-gray-500">No simulator client configured.</div>;
  }

  const product = await getSimulatorProduct(ref);
  if (!product) {
    notFound();
  }

  const token = client.token_plaintext;

  // Determine product type based on tier
  const productType = client.tier === 'base' ? 'hero' : 'gallery';

  // Build breadcrumbs from category path
  const segments = product.category_path.split('/');
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    path: `/collection/${segments.slice(0, i + 1).join('/')}`,
  }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
        <a href="/" className="hover:text-gray-900">Home</a>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.path} className="flex items-center gap-2">
            <span>/</span>
            <a href={crumb.path} className="hover:text-gray-900">{crumb.label}</a>
          </span>
        ))}
        <span>/</span>
        <span className="text-gray-900 font-medium">{product.name}</span>
      </nav>

      {/* Two-column PDP layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Media gallery */}
        <div>
          {/* @ts-expect-error — sa-media is a custom element */}
          <sa-media
            token={token}
            product-ref={ref}
            product-type={productType}
            style={{ width: '100%', borderRadius: '12px' }}
          />
        </div>

        {/* Right: Product info */}
        <div className="py-2">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{product.name}</h1>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl font-semibold text-gray-900">${product.price}</span>
            {product.compare_at_price && (
              <span className="text-lg text-gray-400 line-through">${product.compare_at_price}</span>
            )}
          </div>

          {product.description && (
            <p className="text-gray-600 leading-relaxed mb-8">{product.description}</p>
          )}

          {/* Fake add-to-cart */}
          <button className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800 transition-colors mb-4">
            Add to Cart
          </button>

          {/* Tier indicator */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
            <p className="font-medium text-gray-700 mb-1">Simulator Info</p>
            <p>Client: {client.display_name}</p>
            <p>Tier: {client.tier} — Rendering: {productType}</p>
            <p>Product Ref: {ref}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
