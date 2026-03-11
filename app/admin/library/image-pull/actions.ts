'use server';

import sql, { query } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import { testSitemapDiscovery } from '@/lib/pull/sitemap-parser';
import type { BrandTargetWithPull, PullRun, PullRunProgress } from '@/lib/pull/types';

// ---------------------------------------------------------------------------
// Brand Targets (with pull config)
// ---------------------------------------------------------------------------

export async function getBrandTargetsForPull(): Promise<BrandTargetWithPull[]> {
  const rows = await sql`
    SELECT bt.*,
      (SELECT status FROM pull_runs WHERE brand_target_id = bt.id ORDER BY started_at DESC LIMIT 1) AS latest_run_status,
      (SELECT id FROM pull_runs WHERE brand_target_id = bt.id ORDER BY started_at DESC LIMIT 1) AS latest_run_id
    FROM brand_targets bt
    ORDER BY bt.created_at DESC
  `;
  return rows as BrandTargetWithPull[];
}

export async function getBrandTarget(id: number): Promise<BrandTargetWithPull | null> {
  const [row] = await sql`
    SELECT bt.*,
      (SELECT status FROM pull_runs WHERE brand_target_id = bt.id ORDER BY started_at DESC LIMIT 1) AS latest_run_status,
      (SELECT id FROM pull_runs WHERE brand_target_id = bt.id ORDER BY started_at DESC LIMIT 1) AS latest_run_id
    FROM brand_targets bt
    WHERE bt.id = ${id}
  `;
  return (row as BrandTargetWithPull) || null;
}

export async function createBrandTarget(data: {
  name: string;
  brand_name: string;
  website_url?: string;
  notes?: string;
  sitemaps?: string[];
  url_pattern_include?: string;
  url_pattern_exclude?: string;
  request_delay_ms?: number;
}): Promise<BrandTargetWithPull> {
  const [row] = await sql`
    INSERT INTO brand_targets (
      name, brand_name, website_url, notes,
      sitemaps, url_pattern_include, url_pattern_exclude, request_delay_ms
    ) VALUES (
      ${data.name},
      ${data.brand_name},
      ${data.website_url ?? null},
      ${data.notes ?? null},
      ${data.sitemaps ?? []},
      ${data.url_pattern_include ?? null},
      ${data.url_pattern_exclude ?? null},
      ${data.request_delay_ms ?? 500}
    )
    RETURNING *
  `;
  return row as BrandTargetWithPull;
}

export async function updatePullConfig(id: number, config: {
  sitemaps?: string[];
  url_pattern_include?: string | null;
  url_pattern_exclude?: string | null;
  request_delay_ms?: number;
}) {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  let idx = 1;

  if (config.sitemaps !== undefined) {
    setClauses.push(`sitemaps = $${idx++}`);
    params.push(config.sitemaps);
  }
  if (config.url_pattern_include !== undefined) {
    setClauses.push(`url_pattern_include = $${idx++}`);
    params.push(config.url_pattern_include);
  }
  if (config.url_pattern_exclude !== undefined) {
    setClauses.push(`url_pattern_exclude = $${idx++}`);
    params.push(config.url_pattern_exclude);
  }
  if (config.request_delay_ms !== undefined) {
    setClauses.push(`request_delay_ms = $${idx++}`);
    params.push(config.request_delay_ms);
  }

  params.push(id);
  const [row] = await query(
    `UPDATE brand_targets SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  );
  return row;
}

// ---------------------------------------------------------------------------
// Sitemap Testing
// ---------------------------------------------------------------------------

export async function testSitemaps(
  sitemapUrls: string[],
  includePattern?: string,
  excludePattern?: string,
) {
  return testSitemapDiscovery(sitemapUrls, includePattern, excludePattern, 10);
}

// ---------------------------------------------------------------------------
// Discovery Preview
// ---------------------------------------------------------------------------

export async function getDiscoveryPreview(brandTargetId: number) {
  const [target] = await sql`
    SELECT sitemaps, url_pattern_include, url_pattern_exclude
    FROM brand_targets WHERE id = ${brandTargetId}
  `;
  if (!target) throw new Error('Brand target not found');

  const { discoverUrlsFromSitemaps } = await import('@/lib/pull/sitemap-parser');
  const urls = await discoverUrlsFromSitemaps(
    target.sitemaps || [],
    target.url_pattern_include || undefined,
    target.url_pattern_exclude || undefined,
  );

  // Check how many are already imported
  const existing = await query(
    `SELECT DISTINCT source_url FROM source_images
     WHERE brand_target_id = $1 AND source_url IS NOT NULL`,
    [brandTargetId],
  );
  const existingSet = new Set(existing.map((r: any) => r.source_url));

  // Can't exactly match sitemap URLs to source_urls (different format),
  // but we can count based on product_handle
  const existingHandles = await query(
    `SELECT DISTINCT product_handle FROM source_images
     WHERE brand_target_id = $1 AND product_handle IS NOT NULL`,
    [brandTargetId],
  );
  const handleSet = new Set(existingHandles.map((r: any) => r.product_handle));

  // Extract handles from discovered URLs
  let newCount = 0;
  let existingCount = 0;
  for (const url of urls) {
    const match = url.match(/\/products\/([^/?#]+)/);
    if (match && handleSet.has(match[1])) {
      existingCount++;
    } else {
      newCount++;
    }
  }

  return {
    totalUrls: urls.length,
    newProducts: newCount,
    alreadyImported: existingCount,
  };
}

// ---------------------------------------------------------------------------
// Pull Runs
// ---------------------------------------------------------------------------

export async function startPull(brandTargetId: number) {
  // Create pull_runs row
  const [run] = await sql`
    INSERT INTO pull_runs (brand_target_id) VALUES (${brandTargetId})
    RETURNING id
  `;

  // Fire Inngest event
  await inngest.send({
    name: 'spatialable/pull.requested',
    data: { brandTargetId, runId: run.id },
  });

  return { runId: run.id };
}

export async function getPullRuns(brandTargetId: number): Promise<PullRun[]> {
  const rows = await sql`
    SELECT * FROM pull_runs
    WHERE brand_target_id = ${brandTargetId}
    ORDER BY started_at DESC
    LIMIT 20
  `;
  return rows as PullRun[];
}

export async function getRunProgress(runId: string): Promise<PullRunProgress | null> {
  const [row] = await sql`
    SELECT status, discovered_urls, processed_count, created_count,
           skipped_count, failed_count, current_url
    FROM pull_runs WHERE id = ${runId}
  `;
  return (row as PullRunProgress) || null;
}
