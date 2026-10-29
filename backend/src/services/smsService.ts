import https from 'https';

export interface SendSmsParams {
  phoneNumber: string;
  message: string;
  templateType?: 'BEFORE_EXPIRY' | 'AT_EXPIRY' | 'GRACE_PERIOD' | 'RENEWAL_SUCCESS';
}

export interface SmsResult {
  sent: boolean;
  provider: 'FAST2SMS' | 'BREVO' | 'TWILIO' | 'NONE';
  reason?: string;
  messageId?: string;
}

/**
 * Normalizes Indian phone numbers to 10 digits without +91 or country code prefix.
 */
function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/**
 * Sends real SMS to student mobile number using configured SMS gateway (Fast2SMS, Brevo, or Twilio).
 * If no SMS API key is configured, safely reports credentials missing without pretending it was sent.
 */
export async function sendSms(params: SendSmsParams): Promise<SmsResult> {
  const cleanPhone = normalizeIndianPhone(params.phoneNumber || '');
  if (!cleanPhone || cleanPhone.length !== 10) {
    return {
      sent: false,
      provider: 'NONE',
      reason: `Invalid 10-digit Indian mobile number: "${params.phoneNumber}"`,
    };
  }

  // 1. FAST2SMS Provider
  const fast2SmsKey = process.env.FAST2SMS_API_KEY?.trim();
  if (fast2SmsKey) {
    try {
      const payload = JSON.stringify({
        route: 'q',
        message: params.message,
        language: 'english',
        flash: 0,
        numbers: cleanPhone,
      });

      const result = await new Promise<any>((resolve, reject) => {
        const req = https.request(
          'https://www.fast2sms.com/dev/bulkV2',
          {
            method: 'POST',
            headers: {
              authorization: fast2SmsKey,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
            timeout: 8000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
              } catch {
                resolve({ statusCode: res.statusCode, body: data });
              }
            });
          }
        );
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Fast2SMS request timeout'));
        });
        req.write(payload);
        req.end();
      });

      if (result.statusCode === 200 && result.body?.return === true) {
        console.log(`[SMS Service] Real SMS sent via Fast2SMS to +91-${cleanPhone}`);
        return {
          sent: true,
          provider: 'FAST2SMS',
          messageId: result.body?.request_id,
        };
      } else {
        console.warn(`[SMS Service] Fast2SMS returned:`, result.body);
        return {
          sent: false,
          provider: 'FAST2SMS',
          reason: JSON.stringify(result.body),
        };
      }
    } catch (err: any) {
      console.error(`[SMS Service] Fast2SMS error:`, err.message);
      return { sent: false, provider: 'FAST2SMS', reason: err.message };
    }
  }

  // 2. BREVO Transactional SMS Provider
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  if (brevoApiKey) {
    try {
      const senderName = (process.env.SMS_SENDER_NAME || 'LAKSHYA').slice(0, 11);
      const payload = JSON.stringify({
        sender: senderName,
        recipient: `91${cleanPhone}`,
        content: params.message,
        type: 'transactional',
      });

      const result = await new Promise<any>((resolve, reject) => {
        const req = https.request(
          'https://api.brevo.com/v3/transactionalSMS/sendTransacSms',
          {
            method: 'POST',
            headers: {
              'api-key': brevoApiKey,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
            timeout: 8000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
              } catch {
                resolve({ statusCode: res.statusCode, body: data });
              }
            });
          }
        );
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Brevo SMS request timeout'));
        });
        req.write(payload);
        req.end();
      });

      if (result.statusCode === 201 || result.statusCode === 200) {
        console.log(`[SMS Service] Real SMS sent via Brevo to +91-${cleanPhone}`);
        return {
          sent: true,
          provider: 'BREVO',
          messageId: result.body?.messageId,
        };
      } else {
        console.warn(`[SMS Service] Brevo SMS returned:`, result.body);
        return {
          sent: false,
          provider: 'BREVO',
          reason: JSON.stringify(result.body),
        };
      }
    } catch (err: any) {
      console.error(`[SMS Service] Brevo SMS error:`, err.message);
      return { sent: false, provider: 'BREVO', reason: err.message };
    }
  }

  // 3. No Provider Configured
  console.log(
    `[SMS Service] SMS provider credentials not configured in environment. To send real SMS to +91-${cleanPhone}, configure FAST2SMS_API_KEY or BREVO_API_KEY in .env. Message content: "${params.message}"`
  );
  return {
    sent: false,
    provider: 'NONE',
    reason: 'SMS_CREDENTIALS_NOT_CONFIGURED',
  };
}
