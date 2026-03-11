/**
 * Sitemap Parser
 *
 * Discovers product URLs from XML sitemaps.
 * Supports sitemap indexes (sitemaps that reference other sitemaps).
 * Adapted from RetailSpec's sitemap-parser.ts, scoped to SpatialAble's needs.
 */

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority?: number;
}

interface ParsedSitemap {
  urls: SitemapUrl[];
  isSitemapIndex: boolean;
  childSitemaps: string[];
}

/** Fetch raw XML from a sitemap URL */
async function fetchSitemap(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SpatialAble Asset Importer (compatible; +https://spatialable.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

/** Regex-based XML parsing — no external XML dependency */
function parseSitemapXml(xml: string): ParsedSitemap {
  const urls: SitemapUrl[] = [];
  const childSitemaps: string[] = [];
  const isSitemapIndex = xml.includes('<sitemapindex') || xml.includes(':sitemapindex');

  if (isSitemapIndex) {
    const sitemapRegex = /<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/g;
    let match;
    while ((match = sitemapRegex.exec(xml)) !== null) {
      const loc = match[1].trim();
      if (loc) childSitemaps.push(loc);
    }
  } else {
    const urlRegex = /<url>[\s\S]*?<loc>(.*?)<\/loc>(?:[\s\S]*?<lastmod>(.*?)<\/lastmod>)?(?:[\s\S]*?<priority>(.*?)<\/priority>)?[\s\S]*?<\/url>/g;
    let match;
    while ((match = urlRegex.exec(xml)) !== null) {
      const loc = match[1].trim();
      if (loc) {
        urls.push({
          loc,
          lastmod: match[2]?.trim(),
          priority: match[3] ? parseFloat(match[3].trim()) : undefined,
        });
      }
    }
  }

  return { urls, isSitemapIndex, childSitemaps };
}

/** Recursively fetch sitemaps, following sitemap index references */
async function fetchAllSitemaps(
  sitemapUrl: string,
  visited: Set<string> = new Set(),
): Promise<SitemapUrl[]> {
  if (visited.has(sitemapUrl)) return [];
  visited.add(sitemapUrl);

  const xml = await fetchSitemap(sitemapUrl);
  const parsed = parseSitemapXml(xml);

  if (parsed.isSitemapIndex) {
    const allUrls: SitemapUrl[] = [];
    for (const childUrl of parsed.childSitemaps) {
      const childUrls = await fetchAllSitemaps(childUrl, visited);
      allUrls.push(...childUrls);
    }
    return allUrls;
  }

  return parsed.urls;
}

/** Filter URLs by include/exclude regex patterns */
function filterUrls(
  urls: SitemapUrl[],
  includePattern?: string,
  excludePattern?: string,
): SitemapUrl[] {
  let filtered = urls;

  if (includePattern) {
    const re = new RegExp(includePattern, 'i');
    filtered = filtered.filter((u) => re.test(u.loc));
  }

  if (excludePattern) {
    const re = new RegExp(excludePattern, 'i');
    filtered = filtered.filter((u) => !re.test(u.loc));
  }

  return filtered;
}

// Default: match Shopify product URLs
const DEFAULT_PRODUCT_PATTERN = '/products/[^/]+$';

/**
 * Discover product URLs from one or more sitemaps.
 * Deduplicates results. Defaults to matching Shopify product URL pattern.
 */
export async function discoverUrlsFromSitemaps(
  sitemapUrls: string[],
  includePattern?: string,
  excludePattern?: string,
): Promise<string[]> {
  const effectiveInclude = includePattern || DEFAULT_PRODUCT_PATTERN;
  const allUrls: SitemapUrl[] = [];

  const results = await Promise.allSettled(
    sitemapUrls.map((url) => fetchAllSitemaps(url)),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allUrls.push(...result.value);
    } else {
      console.error(`Failed to fetch sitemap: ${result.reason}`);
    }
  }

  const filtered = filterUrls(allUrls, effectiveInclude, excludePattern);
  return Array.from(new Set(filtered.map((u) => u.loc)));
}

/**
 * Test sitemap parsing — preview URL count and sample URLs.
 * Used by the admin UI "Test Sitemaps" button.
 */
export async function testSitemapDiscovery(
  sitemapUrls: string[],
  includePattern?: string,
  excludePattern?: string,
  limit: number = 10,
): Promise<{
  success: boolean;
  urls: string[];
  totalFound: number;
  error?: string;
}> {
  try {
    const urls = await discoverUrlsFromSitemaps(sitemapUrls, includePattern, excludePattern);
    return { success: true, urls: urls.slice(0, limit), totalFound: urls.length };
  } catch (error) {
    return {
      success: false,
      urls: [],
      totalFound: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
