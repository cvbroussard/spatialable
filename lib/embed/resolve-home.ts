import sql from '@/lib/db';
import { generateSignedUrl, extractKeyFromUrl } from '@/lib/embed/signed-url';

const SIGNED_URL_TTL = 3600;

async function signUrl(cdnUrl: string | null): Promise<string | null> {
  if (!cdnUrl) return null;
  const key = extractKeyFromUrl(cdnUrl);
  if (!key) return cdnUrl;
  return generateSignedUrl(key, SIGNED_URL_TTL);
}

export interface HomePagePackage {
  heroes: ResolvedAsset[];
  categories: ResolvedCategoryCard[];
  brands: ResolvedBrandCard[];
  featured: ResolvedAsset[];
  editorial: ResolvedAsset[];
}

export interface ResolvedAsset {
  id: string | number;
  url: string;
  content_type: string;
  alt: string;
  role: string;
  position: number;
}

export interface ResolvedCategoryCard {
  id: number;
  form_factor_id: number;
  category_path: string;
  name: string;
  card_url: string | null;
  icon_url: string | null;
}

export interface ResolvedBrandCard {
  id: number;
  name: string;
  slug: string;
  card_url: string | null;
  logo_url: string | null;
}

/**
 * Resolve all assets needed for the home page render package.
 *
 * Queries:
 *   - editorial_assets (home hero banners + lifestyle blocks)
 *   - category_assets (top-level category cards + icons via form_factors root nodes)
 *   - brand_assets (brand cards + logos via active brand_taxonomy entries)
 *   - product_assets (featured collection product cards)
 *
 * @param featuredCollectionRef - Optional product collection ref for featured products
 */
export async function resolveHomePage(
  featuredCollectionRef?: string,
): Promise<HomePagePackage> {
  // Run all queries in parallel
  const [heroRows, categoryRows, brandRows, editorialRows, featuredRows] = await Promise.all([
    // Home hero banners
    sql`
      SELECT id, name, url, content_type, position
      FROM editorial_assets
      WHERE page_scope = 'home'
        AND role = 'hero'
        AND is_active = true
        AND (active_from IS NULL OR active_from <= NOW())
        AND (active_until IS NULL OR active_until > NOW())
        AND status = 'approved'
      ORDER BY position ASC
      LIMIT 5
    `,

    // Top-level categories (root nodes: parent_id IS NULL) with their card + icon assets
    sql`
      SELECT
        ff.id AS form_factor_id,
        ff.category_path,
        ff.name,
        ca_card.url AS card_url,
        ca_card.content_type AS card_content_type,
        ca_icon.url AS icon_url
      FROM form_factors ff
      LEFT JOIN category_assets ca_card
        ON ca_card.form_factor_id = ff.id
        AND ca_card.role = 'card'
        AND ca_card.status = 'approved'
      LEFT JOIN category_assets ca_icon
        ON ca_icon.form_factor_id = ff.id
        AND ca_icon.role = 'icon'
        AND ca_icon.status = 'approved'
      WHERE ff.parent_id IS NULL
      ORDER BY ff.name ASC
    `,

    // Active product brands with card + logo assets
    sql`
      SELECT
        bt.id,
        bt.name,
        bt.slug,
        ba_card.url AS card_url,
        ba_card.content_type AS card_content_type,
        ba_logo.url AS logo_url
      FROM brand_taxonomy bt
      LEFT JOIN brand_assets ba_card
        ON ba_card.brand_id = bt.id
        AND ba_card.role = 'card'
        AND ba_card.status = 'approved'
      LEFT JOIN brand_assets ba_logo
        ON ba_logo.brand_id = bt.id
        AND ba_logo.role = 'logo'
        AND ba_logo.status = 'approved'
      WHERE bt.is_active = true
        AND bt.product_count > 0
      ORDER BY bt.product_count DESC
      LIMIT 24
    `,

    // Editorial lifestyle blocks
    sql`
      SELECT id, name, url, content_type, position
      FROM editorial_assets
      WHERE page_scope = 'home'
        AND role = 'lifestyle'
        AND is_active = true
        AND (active_from IS NULL OR active_from <= NOW())
        AND (active_until IS NULL OR active_until > NOW())
        AND status = 'approved'
      ORDER BY position ASC
      LIMIT 6
    `,

    // Featured product cards (from a curated collection ref)
    featuredCollectionRef
      ? sql`
          SELECT pa.id, pa.asset_id, pa.url, pa.content_type, pa.alt, pa.position
          FROM product_assets pa
          WHERE pa.product_ref = ${featuredCollectionRef}
            AND pa.role = 'hero'
          ORDER BY pa.position ASC
          LIMIT 12
        `
      : Promise.resolve([]),
  ]);

  // Sign all URLs in parallel
  const heroes: ResolvedAsset[] = await Promise.all(
    heroRows.map(async (row: any, i: number) => ({
      id: row.id,
      url: (await signUrl(row.url)) || row.url,
      content_type: row.content_type || 'image/webp',
      alt: row.name,
      role: 'home-hero',
      position: i,
    })),
  );

  const categories: ResolvedCategoryCard[] = await Promise.all(
    categoryRows.map(async (row: any) => ({
      id: row.form_factor_id,
      form_factor_id: row.form_factor_id,
      category_path: row.category_path,
      name: row.name,
      card_url: await signUrl(row.card_url),
      icon_url: await signUrl(row.icon_url),
    })),
  );

  const brands: ResolvedBrandCard[] = await Promise.all(
    brandRows.map(async (row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      card_url: await signUrl(row.card_url),
      logo_url: await signUrl(row.logo_url),
    })),
  );

  const editorial: ResolvedAsset[] = await Promise.all(
    editorialRows.map(async (row: any, i: number) => ({
      id: row.id,
      url: (await signUrl(row.url)) || row.url,
      content_type: row.content_type || 'image/webp',
      alt: row.name,
      role: 'editorial',
      position: i,
    })),
  );

  const featured: ResolvedAsset[] = await Promise.all(
    featuredRows.map(async (row: any) => ({
      id: row.asset_id || row.id,
      url: (await signUrl(row.url)) || row.url,
      content_type: row.content_type || 'image/webp',
      alt: row.alt || 'Featured product',
      role: 'featured',
      position: row.position,
    })),
  );

  return { heroes, categories, brands, featured, editorial };
}
