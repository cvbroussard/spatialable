import sql, { query } from '@/lib/db';
import { generateSignedUrl, extractKeyFromUrl } from '@/lib/embed/signed-url';

const SIGNED_URL_TTL = 3600;

async function signUrl(cdnUrl: string | null): Promise<string | null> {
  if (!cdnUrl) return null;
  const key = extractKeyFromUrl(cdnUrl);
  if (!key) return cdnUrl;
  return generateSignedUrl(key, SIGNED_URL_TTL);
}

export interface CollectionPagePackage {
  header: CollectionHeader;
  products: CollectionProductCard[];
}

export interface CollectionHeader {
  type: 'category' | 'brand';
  name: string;
  hero_url: string | null;
  icon_url: string | null;
}

export interface CollectionProductCard {
  product_ref: string;
  hero_url: string | null;
  hover_url: string | null;
  alt: string;
}

/**
 * Resolve assets for a collection page.
 *
 * A collection-ref can be:
 *   - A category_path (e.g., "furniture/seating/sofas") → category header + products in category
 *   - A brand slug (e.g., "article") → brand header + products by brand
 *
 * Resolution strategy:
 *   1. Try form_factors match (category_path) → category_assets header
 *   2. If no match, try brand_taxonomy match (slug) → brand_assets header
 *   3. Query product_assets for products in the matched scope
 */
export async function resolveCollectionPage(
  collectionRef: string,
): Promise<CollectionPagePackage> {
  // Try category match first
  const categoryRows = await sql`
    SELECT
      ff.id AS form_factor_id,
      ff.category_path,
      ff.name,
      ca_hero.url AS hero_url,
      ca_icon.url AS icon_url
    FROM form_factors ff
    LEFT JOIN category_assets ca_hero
      ON ca_hero.form_factor_id = ff.id
      AND ca_hero.role = 'hero'
      AND ca_hero.status = 'approved'
    LEFT JOIN category_assets ca_icon
      ON ca_icon.form_factor_id = ff.id
      AND ca_icon.role = 'icon'
      AND ca_icon.status = 'approved'
    WHERE ff.category_path = ${collectionRef}
    LIMIT 1
  `;

  if (categoryRows.length > 0) {
    const cat = categoryRows[0];
    const header: CollectionHeader = {
      type: 'category',
      name: cat.name,
      hero_url: await signUrl(cat.hero_url),
      icon_url: await signUrl(cat.icon_url),
    };

    // Products in this category — match via assets.category_path prefix then join to product_assets
    // Use parameterized query for the LIKE pattern
    const productRows = await query(
      `SELECT DISTINCT ON (pa.product_ref)
        pa.product_ref,
        pa.url AS hero_url,
        pa.alt,
        pa2.url AS hover_url
      FROM product_assets pa
      JOIN assets a ON a.id = pa.asset_id
      LEFT JOIN product_assets pa2
        ON pa2.product_ref = pa.product_ref
        AND pa2.role = 'gallery'
        AND pa2.position = 1
      WHERE a.category_path LIKE $1
        AND pa.role = 'hero'
      ORDER BY pa.product_ref, pa.position ASC
      LIMIT 48`,
      [`${collectionRef}%`],
    );

    const products = await resolveProductCards(productRows);
    return { header, products };
  }

  // Try brand match
  const brandRows = await sql`
    SELECT
      bt.id,
      bt.name,
      bt.slug,
      ba_hero.url AS hero_url,
      ba_logo.url AS icon_url
    FROM brand_taxonomy bt
    LEFT JOIN brand_assets ba_hero
      ON ba_hero.brand_id = bt.id
      AND ba_hero.role = 'hero'
      AND ba_hero.status = 'approved'
    LEFT JOIN brand_assets ba_logo
      ON ba_logo.brand_id = bt.id
      AND ba_logo.role = 'logo'
      AND ba_logo.status = 'approved'
    WHERE bt.slug = ${collectionRef}
      AND bt.is_active = true
    LIMIT 1
  `;

  if (brandRows.length > 0) {
    const brand = brandRows[0];
    const header: CollectionHeader = {
      type: 'brand',
      name: brand.name,
      hero_url: await signUrl(brand.hero_url),
      icon_url: await signUrl(brand.icon_url),
    };

    // Products by this brand — join assets.brand_id to product_assets
    const productRows = await sql`
      SELECT DISTINCT ON (pa.product_ref)
        pa.product_ref,
        pa.url AS hero_url,
        pa.alt,
        pa2.url AS hover_url
      FROM product_assets pa
      JOIN assets a ON a.id = pa.asset_id
      LEFT JOIN product_assets pa2
        ON pa2.product_ref = pa.product_ref
        AND pa2.role = 'gallery'
        AND pa2.position = 1
      WHERE a.brand_id = ${brand.id}
        AND pa.role = 'hero'
      ORDER BY pa.product_ref, pa.position ASC
      LIMIT 48
    `;

    const products = await resolveProductCards(productRows);
    return { header, products };
  }

  // No match — return empty
  return {
    header: { type: 'category', name: collectionRef, hero_url: null, icon_url: null },
    products: [],
  };
}

async function resolveProductCards(rows: any[]): Promise<CollectionProductCard[]> {
  return Promise.all(
    rows.map(async (row: any) => ({
      product_ref: row.product_ref,
      hero_url: await signUrl(row.hero_url),
      hover_url: await signUrl(row.hover_url),
      alt: row.alt || 'Product',
    })),
  );
}
