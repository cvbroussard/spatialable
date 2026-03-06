import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-key';
import { identifyMaterials } from '@/lib/vision/identify-materials';

export const dynamic = 'force-dynamic';

/**
 * POST /api/materials/identify — Standalone material identification.
 *
 * Body: {
 *   image_url: string,
 *   product_context?: string   // e.g. "Mid-century sofa in gray linen"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { image_url, product_context } = body;

    if (!image_url || typeof image_url !== 'string') {
      return NextResponse.json(
        { error: 'image_url is required' },
        { status: 400 },
      );
    }

    const result = await identifyMaterials(image_url, product_context);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[materials/identify] Error:', error);
    return NextResponse.json(
      { error: 'Material identification failed' },
      { status: 500 },
    );
  }
}
