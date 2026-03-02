import https from 'node:https';

/**
 * Meta Conversions API Client
 * Reference: https://developers.facebook.com/docs/marketing-api/conversions-api/
 */

export interface ConversionPayload {
  data: Array<{
    event_name: string;
    event_time: number;
    action_source: 'website';
    event_id: string;
    event_source_url?: string;
    user_data?: {
      em?: string; // email hash
      ph?: string; // phone hash
      fn?: string; // first name hash
      ln?: string; // last name hash
      db?: string; // date of birth hash (YYYYMMDD)
      ct?: string; // city hash
      st?: string; // state hash
      zp?: string; // zip code hash
      country?: string; // country code (2 letter)
      external_id?: string; // external ID hash
    };
    custom_data?: {
      currency?: string;
      value?: number;
    };
    opt_out?: boolean;
  }>;
  access_token: string;
}

export interface CAPIResponse {
  events: Array<{
    event_id: string;
    status: 'sent' | 'failed';
  }>;
  fbl_trace_id: string;
}

export class MetaCAPIClient {
  private baseUrl: string;
  private maxRetries: number = 5;
  private initialBackoffMs: number = 1000;

  constructor(apiVersion: string = 'v19.0') {
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
  }

  /**
   * Send conversion event to Meta Conversions API with exponential backoff retry
   */
  async sendConversions(
    pixelId: string,
    payload: ConversionPayload
  ): Promise<{ success: boolean; data?: CAPIResponse; error?: string; httpStatusCode?: number; retries: number }> {
    let lastError: Error | null = null;
    let lastHttpStatus: number | undefined;
    let retries = 0;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const data = JSON.stringify(payload);
        const url = new URL(`${this.baseUrl}/${pixelId}/events`);

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            'User-Agent': 'Hub-Server-Side-Tracking/1.0',
          },
        };

        const response = await this.makeRequest(url.toString(), options, data);
        lastHttpStatus = response.status;

        if (response.status >= 200 && response.status < 300) {
          console.log(
            `[meta-capi] ✓ Sent ${payload.data.length} conversion(s) to pixel ${pixelId} (attempt ${attempt + 1})`
          );
          return {
            success: true,
            data: response.body as CAPIResponse,
            httpStatusCode: response.status,
            retries: attempt,
          };
        }

        // 4xx errors are permanent failures (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return {
            success: false,
            error: `CAPI returned ${response.status}: ${JSON.stringify(response.body)}`,
            httpStatusCode: response.status,
            retries: attempt,
          };
        }

        // 5xx or 429: retry with backoff
        lastError = new Error(`CAPI returned ${response.status}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      // Calculate backoff (exponential with jitter)
      if (attempt < this.maxRetries - 1) {
        const backoffMs =
          this.initialBackoffMs * Math.pow(2, attempt) + Math.random() * 1000;
        retries = attempt + 1;
        console.log(
          `[meta-capi] ⚠️ Attempt ${attempt + 1} failed, retrying in ${backoffMs.toFixed(0)}ms...`
        );
        await this.delay(backoffMs);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      httpStatusCode: lastHttpStatus,
      retries,
    };
  }

  private makeRequest(
    url: string,
    options: https.RequestOptions,
    data: string
  ): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({
              status: res.statusCode || 500,
              body: parsed,
            });
          } catch {
            resolve({
              status: res.statusCode || 500,
              body: { raw: body },
            });
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
