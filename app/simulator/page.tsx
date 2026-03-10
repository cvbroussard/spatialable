import { getActiveSimulatorClient } from '@/lib/simulator/client';
import { getSimulatorCategories, getSimulatorBrands, getFeaturedProducts } from '@/lib/simulator/products';
import { ProductCard } from './_components/ProductCard';

export default async function SimulatorHomePage() {
  const client = await getActiveSimulatorClient();

  if (!client) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">No Simulator Client Configured</h1>
        <p className="text-gray-500">
          Run <code className="bg-gray-100 px-2 py-1 rounded text-sm">node scripts/seed-simulator.js</code> to create demo clients.
        </p>
      </div>
    );
  }

  const token = client.token_plaintext;
  const [categories, brands, featured] = await Promise.all([
    getSimulatorCategories(),
    getSimulatorBrands(),
    getFeaturedProducts(8),
  ]);

  return (
    <div>
      {/* Hero section — editorial content via embed */}
      <section className="bg-gray-50">
        <div className="max-w-7xl mx-auto">
          {/* @ts-expect-error — sa-media is a custom element */}
          <sa-media
            token={token}
            page-type="home"
            style={{ width: '100%', minHeight: '400px' }}
          />
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-8">Shop by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/collection/${cat.category_path}`}
                className="group block"
              >
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <span className="text-lg font-medium text-gray-700">{cat.name}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-16 border-t border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-8">Featured Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featured.map((product) => (
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
        </section>
      )}

      {/* Brands */}
      {brands.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-16 border-t border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-8">Our Brands</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {brands.map((brand) => (
              <a
                key={brand.id}
                href={`/collection/${brand.slug}`}
                className="group block"
              >
                <div className="aspect-[3/2] bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <span className="text-lg font-medium text-gray-700">{brand.name}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
