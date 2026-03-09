import type { ShopifyProductResponse } from './types';

// ---------------------------------------------------------------------------
// Shopify Admin API REST client
//
// Handles cursor-based pagination (Link headers) and rate limiting
// (X-Shopify-Shop-Api-Call-Limit). API version: 2024-10.
// ---------------------------------------------------------------------------

const API_VERSION = '2024-10';

export class ShopifyClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(shopDomain: string, accessToken: string) {
    this.baseUrl = `https://${shopDomain}/admin/api/${API_VERSION}`;
    this.headers = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch all products via paginated Shopify Admin API.
   * Yields pages of products as they arrive.
   */
  async *fetchAllProducts(limit: number = 250): AsyncGenerator<ShopifyProductResponse[]> {
    let url: string | null = `${this.baseUrl}/products.json?limit=${limit}&status=active`;

    while (url) {
      await this.respectRateLimit();

      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) {
        throw new Error(`Shopify API ${res.status}: ${await res.text()}`);
      }

      this.trackRateLimit(res);

      const data = await res.json();
      const products: ShopifyProductResponse[] = data.products || [];

      if (products.length > 0) {
        yield products;
      }

      // Cursor-based pagination via Link header
      url = this.parseNextLink(res.headers.get('link'));
    }
  }

  /**
   * Fetch a single product by Shopify product ID.
   */
  async fetchProduct(productId: number): Promise<ShopifyProductResponse> {
    await this.respectRateLimit();

    const res = await fetch(`${this.baseUrl}/products/${productId}.json`, {
      headers: this.headers,
    });

    if (!res.ok) {
      throw new Error(`Shopify API ${res.status}: ${await res.text()}`);
    }

    this.trackRateLimit(res);
    const data = await res.json();
    return data.product;
  }

  /**
   * Write a metafield on a product.
   */
  async writeProductMetafield(
    productId: number,
    namespace: string,
    key: string,
    value: string,
    type: string,
  ): Promise<void> {
    await this.respectRateLimit();

    const res = await fetch(`${this.baseUrl}/products/${productId}/metafields.json`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        metafield: { namespace, key, value, type },
      }),
    });

    if (!res.ok) {
      throw new Error(`Shopify metafield write ${res.status}: ${await res.text()}`);
    }

    this.trackRateLimit(res);
  }

  /**
   * Register webhook subscriptions.
   */
  async registerWebhooks(
    callbackUrl: string,
    topics: string[] = ['products/create', 'products/update', 'products/delete', 'app/uninstalled'],
  ): Promise<void> {
    for (const topic of topics) {
      await this.respectRateLimit();

      const res = await fetch(`${this.baseUrl}/webhooks.json`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          webhook: {
            topic,
            address: callbackUrl,
            format: 'json',
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        // 422 = already registered — skip
        if (res.status !== 422) {
          throw new Error(`Webhook registration ${res.status} for ${topic}: ${body}`);
        }
      }

      this.trackRateLimit(res);
    }
  }

  // ── Rate limiting ────────────────────────────────────────────────────────

  private currentCalls = 0;
  private maxCalls = 40;

  private trackRateLimit(res: Response) {
    const limit = res.headers.get('x-shopify-shop-api-call-limit');
    if (limit) {
      const [current, max] = limit.split('/').map(Number);
      this.currentCalls = current;
      this.maxCalls = max;
    }
  }

  private async respectRateLimit() {
    // Back off when approaching the limit (> 35/40)
    if (this.currentCalls > this.maxCalls - 5) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // ── Pagination ───────────────────────────────────────────────────────────

  private parseNextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null;

    // Link: <https://...>; rel="next", <https://...>; rel="previous"
    const parts = linkHeader.split(',');
    for (const part of parts) {
      const match = part.match(/<([^>]+)>;\s*rel="next"/);
      if (match) return match[1];
    }
    return null;
  }
}
