import crypto from 'crypto';

export interface CreateGatewayOrderParams {
  orderId: string;
  amount: number | string;
  currency?: string;
  returnUrl?: string;
  customer?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface GatewayOrderResult {
  success: boolean;
  paymentId?: string;
  orderId: string;
  amount?: string;
  currency?: string;
  status?: string;
  checkoutUrl?: string;
  isGatewayOnline: boolean;
  message?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
  payload?: any;
}

export class YoupiPaymentService {
  private apiUrl: string;
  private merchantId?: string;
  private webhookSecret?: string;
  private apiKey?: string;

  constructor() {
    let url = process.env.YOUPI_API_URL || process.env.PAYMENT_API_URL || 'http://127.0.0.1:6100';
    while (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    this.apiUrl = url;
    this.merchantId = process.env.YOUPI_MERCHANT_ID || '00000000-0000-0000-0000-000000000001';
    this.webhookSecret = process.env.YOUPI_WEBHOOK_SECRET || 'youpi_dev_webhook_secret_key_change_in_production';
    this.apiKey = process.env.YOUPI_API_KEY || '';
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

  getMerchantId(): string | undefined {
    return this.merchantId;
  }

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.webhookSecret);
  }

  /**
   * Calls YouPI-PG REST API to register a payment order session.
   * Gracefully falls back to local direct UPI workflow if YouPI gateway daemon is offline.
   */
  async createPayment(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    const url = `${this.apiUrl}/api/v1/payments`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.merchantId) {
      headers['X-Merchant-Id'] = this.merchantId;
    }
    if (this.apiKey || this.webhookSecret) {
      headers['X-Merchant-Key'] = this.apiKey || this.webhookSecret!;
    }
    if (params.idempotencyKey) {
      headers['Idempotency-Key'] = params.idempotencyKey;
    }

    const formattedAmount = Number(params.amount).toFixed(2);
    const body = JSON.stringify({
      orderId: params.orderId,
      amount: formattedAmount,
      currency: params.currency || 'INR',
      returnUrl: params.returnUrl,
      customer: params.customer,
      metadata: params.metadata,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[YouPI Gateway] Order creation returned HTTP ${res.status}: ${errorText}`);
        return {
          success: false,
          orderId: params.orderId,
          isGatewayOnline: false,
          message: `Gateway returned status ${res.status}`,
        };
      }

      const data = (await res.json()) as any;
      return {
        success: true,
        paymentId: data.paymentId,
        orderId: data.orderId || params.orderId,
        amount: data.amount || formattedAmount,
        currency: data.currency || 'INR',
        status: data.status || 'INITIATED',
        checkoutUrl: data.checkoutUrl,
        isGatewayOnline: true,
      };
    } catch (err: any) {
      // Gateway offline or local test mode - seamlessly operate via direct PhonePe QR flow
      console.log(`[YouPI Gateway] Daemon at ${this.apiUrl} is currently offline or unreachable (${err.message}). Using direct UPI QR mode.`);
      return {
        success: true,
        paymentId: `LOCAL_UPI_${params.orderId}`,
        orderId: params.orderId,
        amount: formattedAmount,
        currency: params.currency || 'INR',
        status: 'PENDING',
        isGatewayOnline: false,
        message: 'Direct UPI QR mode active',
      };
    }
  }

  /**
   * Queries payment status from YouPI-PG Gateway.
   */
  async getPaymentStatus(paymentId: string): Promise<any | null> {
    if (!paymentId || paymentId.startsWith('LOCAL_UPI_')) {
      return null;
    }

    const url = `${this.apiUrl}/api/v1/payments/${paymentId}`;
    const headers: Record<string, string> = {};
    if (this.apiKey || this.webhookSecret) {
      headers['X-Merchant-Key'] = this.apiKey || this.webhookSecret!;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.warn(`[YouPI Gateway] Status query failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Timing-safe HMAC-SHA256 signature verification matching YouPI-PG specification.
   */
  verifyWebhook(
    rawBody: string | Buffer,
    signatureHeader?: string,
    timestampHeader?: string | number,
    deliveryIdHeader?: string
  ): WebhookVerificationResult {
    const secret = process.env.YOUPI_WEBHOOK_SECRET || this.webhookSecret;
    if (!secret) {
      return { isValid: false, error: 'YOUPI_WEBHOOK_SECRET is not configured' };
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return { isValid: false, error: 'Invalid or missing X-Gateway-Signature header. Expected sha256=<hex>' };
    }

    const actualSig = signatureHeader.replace('sha256=', '').trim();
    const rawString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    // Check timestamp freshness if provided (tolerance of 2 hours, covering YouPI retry backoff)
    if (timestampHeader) {
      const tsNum = Number(timestampHeader);
      const toleranceMs = 2 * 60 * 60 * 1000;
      if (Number.isFinite(tsNum) && Math.abs(Date.now() - tsNum) > toleranceMs) {
        return { isValid: false, error: 'Webhook timestamp outside accepted tolerance window' };
      }
    }

    // YouPI-PG signs either rawPayload or `${timestamp}.${rawPayload}`
    const expectedSigRaw = crypto.createHmac('sha256', secret).update(rawString, 'utf8').digest('hex');
    let matches = false;

    if (actualSig.length === expectedSigRaw.length) {
      matches = crypto.timingSafeEqual(Buffer.from(actualSig, 'hex'), Buffer.from(expectedSigRaw, 'hex'));
    }

    if (!matches && timestampHeader) {
      const expectedSigTimestamped = crypto
        .createHmac('sha256', secret)
        .update(`${timestampHeader}.${rawString}`, 'utf8')
        .digest('hex');

      if (actualSig.length === expectedSigTimestamped.length) {
        matches = crypto.timingSafeEqual(Buffer.from(actualSig, 'hex'), Buffer.from(expectedSigTimestamped, 'hex'));
      }
    }

    if (!matches) {
      return { isValid: false, error: 'Cryptographic HMAC-SHA256 signature mismatch' };
    }

    try {
      const payload = JSON.parse(rawString);
      if (deliveryIdHeader && payload.deliveryId && deliveryIdHeader !== payload.deliveryId) {
        return { isValid: false, error: 'Delivery ID header mismatch' };
      }
      return { isValid: true, payload };
    } catch {
      return { isValid: false, error: 'Malformed JSON payload' };
    }
  }
}

export const youpiPaymentService = new YoupiPaymentService();
