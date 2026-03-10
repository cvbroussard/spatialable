import sql from '@/lib/db';

export interface SimulatorProduct {
  id: number;
  product_ref: string;
  name: string;
  price: string;
  compare_at_price: string | null;
  description: string | null;
  category_path: string;
  brand_slug: string | null;
}

export interface SimulatorCategory {
  id: number;
  category_path: string;
  name: string;
}

export interface SimulatorBrand {
  id: number;
  name: string;
  slug: string;
}

/**
 * Get simulator products, optionally filtered by category path prefix.
 */
export async function getSimulatorProducts(categoryPath?: string): Promise<SimulatorProduct[]> {
  if (categoryPath) {
    const prefix = categoryPath + '%';
    return sql`
      SELECT * FROM simulator_products
      WHERE category_path LIKE ${prefix}
      ORDER BY name ASC
    ` as Promise<SimulatorProduct[]>;
  }
  return sql`
    SELECT * FROM simulator_products
    ORDER BY name ASC
  ` as Promise<SimulatorProduct[]>;
}

/**
 * Get a single simulator product by product_ref.
 */
export async function getSimulatorProduct(ref: string): Promise<SimulatorProduct | null> {
  const rows = await sql`
    SELECT * FROM simulator_products
    WHERE product_ref = ${ref}
    LIMIT 1
  `;
  return (rows[0] as SimulatorProduct) || null;
}

/**
 * Get root-level categories that have simulator products.
 */
export async function getSimulatorCategories(): Promise<SimulatorCategory[]> {
  return sql`
    SELECT DISTINCT ON (f.id) f.id, f.category_path, f.name
    FROM form_factors f
    WHERE f.parent_id IS NULL
      AND EXISTS (
        SELECT 1 FROM simulator_products sp
        WHERE sp.category_path LIKE f.category_path || '%'
      )
    ORDER BY f.id, f.name ASC
  ` as Promise<SimulatorCategory[]>;
}

/**
 * Get brands that have simulator products.
 */
export async function getSimulatorBrands(): Promise<SimulatorBrand[]> {
  return sql`
    SELECT bt.id, bt.name, bt.slug
    FROM brand_taxonomy bt
    WHERE bt.is_active = true
      AND EXISTS (
        SELECT 1 FROM simulator_products sp
        WHERE sp.brand_slug = bt.slug
      )
    ORDER BY bt.name ASC
  ` as Promise<SimulatorBrand[]>;
}

/**
 * Get featured products (limited set for home page).
 */
export async function getFeaturedProducts(limit = 8): Promise<SimulatorProduct[]> {
  return sql`
    SELECT * FROM simulator_products
    ORDER BY id ASC
    LIMIT ${limit}
  ` as Promise<SimulatorProduct[]>;
}
