interface ProductCardProps {
  productRef: string;
  name: string;
  price: string;
  compareAtPrice?: string | null;
  token: string;
}

export function ProductCard({ productRef, name, price, compareAtPrice, token }: ProductCardProps) {
  return (
    <a href={`/product/${productRef}`} className="group block">
      <div className="aspect-[4/3] bg-gray-50 rounded-lg overflow-hidden mb-3">
        {/* @ts-expect-error — sa-media is a custom element */}
        <sa-media
          token={token}
          product-ref={productRef}
          product-type="hero"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <h3 className="text-sm font-medium text-gray-900 group-hover:text-gray-600 transition-colors">
        {name}
      </h3>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-sm font-semibold text-gray-900">${price}</span>
        {compareAtPrice && (
          <span className="text-sm text-gray-400 line-through">${compareAtPrice}</span>
        )}
      </div>
    </a>
  );
}
