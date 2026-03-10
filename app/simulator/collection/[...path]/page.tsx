import sql from '@/lib/db';
import { getActiveSimulatorClient } from '@/lib/simulator/client';
import { getSimulatorProducts } from '@/lib/simulator/products';
import { ProductCard } from '../../_components/ProductCard';

interface CollectionPageProps {
  params: Promise<{ path: string[] }>;
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { path } = await params;
  const categoryPath = path.join('/');
  const client = await getActiveSimulatorClient();

  if (!client) {
    return <div className="p-6 text-gray-500">No simulator client configured.</div>;
  }

  const token = client.token_plaintext;

  // Get category info
  const categoryRows = await sql`
    SELECT id, category_path, name FROM form_factors
    WHERE category_path = ${categoryPath}
    LIMIT 1
  `;
  const category = categoryRows[0];

  // Get products in this category
  const products = await getSimulatorProducts(categoryPath);

  // Build breadcrumbs
  const segments = categoryPath.split('/');
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    path: `/collection/${segments.slice(0, i + 1).join('/')}`,
  }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
        <a href="/" className="hover:text-gray-900">Home</a>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-2">
            <span>/</span>
            {i === breadcrumbs.length - 1 ? (
              <span className="text-gray-900 font-medium">{crumb.label}</span>
            ) : (
              <a href={crumb.path} className="hover:text-gray-900">{crumb.label}</a>
            )}
          </span>
        ))}
      </nav>

      {/* Collection header */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900">
          {category?.name || segments[segments.length - 1].charAt(0).toUpperCase() + segments[segments.length - 1].slice(1)}
        </h1>
        <p className="text-gray-500 mt-2">{products.length} products</p>
      </div>

      {/* Product grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.product_ref}
              productRef={product.product_ref}
              name={product.name}
              price={product.price}
              compareAtPrice={product.compare_at_price}
              token={token}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          No products in this collection yet.
        </div>
      )}
    </div>
  );
}
