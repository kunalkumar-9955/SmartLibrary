import https from 'https';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentEmailData {
  name: string;
  email: string;
  studentIdNumber: string;
  course?: string;
}

export interface EmailResult {
  sent: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// HTML Email Template - Lakshya Smart Library
// ---------------------------------------------------------------------------

function buildWelcomeEmailHtml(student: StudentEmailData): string {
  const frontendUrl = (process.env.FRONTEND_URL || 'https://your-library.vercel.app')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

  const loginUrl = `${frontendUrl}/login`;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Lakshya Smart Library — Your Account is Ready</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <!-- Preheader -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your Smart Library student account has been created successfully.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Brand Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4338ca 0%,#6366f1 100%);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">LAKSHYA SMART LIBRARY</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.90);">Personal Library Management &amp; Attendance System</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:40px 40px 20px;">
              <h2 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#1e293b;">Welcome, ${student.name}</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                Your student account for <strong>Lakshya Smart Library</strong> has been created successfully.
              </p>

              <!-- Account Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Account Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;display:block;">Student ID</span>
                          <span style="font-size:15px;font-weight:800;color:#1e293b;font-family:monospace;letter-spacing:0.5px;">${student.studentIdNumber}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;display:block;">Login Email</span>
                          <span style="font-size:15px;font-weight:700;color:#4338ca;">${student.email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0 0;">
                          <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;display:block;">Initial Password</span>
                          <span style="font-size:14px;font-weight:700;color:#0f172a;">Your registered mobile number</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Notice Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:1px;">SECURITY NOTICE</p>
                    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#92400e;line-height:1.5;">
                      Your initial password is your registered mobile number.
                    </p>
                    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
                      After logging in, please change your password to protect your account.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Login Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#4338ca 0%,#6366f1 100%);color:#ffffff;font-size:14px;font-weight:800;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(99,102,241,0.35);">LOGIN TO YOUR ACCOUNT</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">
                Regards,<br />
                <strong style="color:#1e293b;">Lakshya Smart Library Administration</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#334155;">LAKSHYA SMART LIBRARY</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">Personal Library Management &amp; Attendance System</p>
              <p style="margin:12px 0 0;font-size:11px;color:#cbd5e1;">&copy; ${year} Lakshya Smart Library. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Brevo Email Sender
// ---------------------------------------------------------------------------

/**
 * Sends a professional welcome email to a newly created student via Brevo.
 * Never throws. Returns EmailResult so email failure never rolls back student creation.
 * Never logs passwords, API keys, or secrets.
 */
export async function sendStudentWelcomeEmail(student: StudentEmailData): Promise<EmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || 'Lakshya Smart Library';

  if (!apiKey || apiKey.trim() === '') {
    console.warn('[EmailService] BREVO_API_KEY is not configured. Skipping welcome email.');
    return { sent: false, message: 'Email service is not configured (BREVO_API_KEY missing)' };
  }
  if (!fromEmail || fromEmail.trim() === '') {
    console.warn('[EmailService] EMAIL_FROM is not configured. Skipping welcome email.');
    return { sent: false, message: 'Email service is not configured (EMAIL_FROM missing)' };
  }

  const htmlContent = buildWelcomeEmailHtml(student);

  const payload = JSON.stringify({
    sender: { name: fromName.trim(), email: fromEmail.trim() },
    to: [{ email: student.email, name: student.name }],
    subject: 'Welcome to Lakshya Smart Library \u2014 Your Account is Ready',
    htmlContent,
  });

  return new Promise<EmailResult>((resolve) => {
    const options: https.RequestOptions = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'api-key': apiKey.trim(),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[EmailService] Welcome email sent to ${student.email} (HTTP ${res.statusCode})`);
          resolve({ sent: true, message: 'Welcome email sent successfully' });
        } else {
          console.error(`[EmailService] Brevo returned HTTP ${res.statusCode} for ${student.email}`);
          resolve({ sent: false, message: 'Welcome email could not be sent (provider error)' });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[EmailService] Network error: ${err.message}`);
      resolve({ sent: false, message: 'Welcome email could not be sent (network error)' });
    });

    req.setTimeout(12000, () => {
      req.destroy();
      console.error('[EmailService] Brevo request timed out');
      resolve({ sent: false, message: 'Welcome email could not be sent (timeout)' });
    });

    req.write(payload);
    req.end();
  });
}
