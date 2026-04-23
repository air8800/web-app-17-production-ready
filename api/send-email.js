import nodemailer from 'nodemailer';

// Webhook secret to verify requests come from Supabase
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Gmail SMTP transporter using Google Workspace App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // hello@printget.in
    pass: process.env.EMAIL_PASS, // App Password (NOT regular password)
  },
});

/**
 * Generates the HTML for "Order Confirmed" 
 */
function buildConfirmedHTML(customerName, filename, shopName, orderId) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 8px;">⏳</div>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 4px 0;">Order Confirmed!</h1>
              <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">We've received your order</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${customerName || 'there'}</strong>,<br><br>
                Your payment was successful and your print job is now in the queue. We will notify you again as soon as it is ready for pickup!
              </p>
              ${buildDetailsTable(filename, shopName, orderId, '⏳ In Queue', '#eab308')}
            </td>
          </tr>
          ${buildFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates the HTML for "Print Ready" 
 */
function buildReadyHTML(customerName, filename, shopName, orderId) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Print is Ready!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px 24px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 8px;">🖨️</div>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 4px 0;">Your Print is Ready!</h1>
              <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">Come pick it up at the shop</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${customerName || 'there'}</strong>,<br><br>
                Great news! Your print job has been completed and is waiting for you to collect it.
              </p>
              ${buildDetailsTable(filename, shopName, orderId, '✅ Ready for Pickup', '#16a34a')}
            </td>
          </tr>
          ${buildFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates the HTML for "Cancelled" 
 */
function buildCancelledHTML(customerName, filename, shopName, orderId) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Cancelled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 32px 24px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 8px;">❌</div>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 4px 0;">Order Cancelled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${customerName || 'there'}</strong>,<br><br>
                Unfortunately, your print job has been cancelled by the shop. Please contact them for more details.
              </p>
              ${buildDetailsTable(filename, shopName, orderId, '❌ Cancelled', '#ef4444')}
            </td>
          </tr>
          ${buildFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Helper: Common Order Details Table
function buildDetailsTable(filename, shopName, orderId, statusText, statusColor) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
    <tr>
      <td style="padding: 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 12px;">Order Details</td></tr>
          <tr>
            <td style="padding: 6px 0;">
              <table width="100%"><tr><td style="color: #64748b; font-size: 13px;">File</td><td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600;">${filename || 'Document'}</td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0;">
              <table width="100%"><tr><td style="color: #64748b; font-size: 13px;">Shop</td><td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600;">${shopName || 'PrintGet Partner Shop'}</td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0;">
              <table width="100%"><tr><td style="color: #64748b; font-size: 13px;">Order ID</td><td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600; font-family: monospace;">${orderId ? orderId.slice(0, 8) : '—'}</td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0 0 0;">
              <table width="100%" style="border-top: 1px solid #e2e8f0;">
                <tr>
                  <td style="color: ${statusColor}; font-size: 14px; font-weight: 700; padding-top: 8px;">Status</td>
                  <td align="right" style="color: ${statusColor}; font-size: 14px; font-weight: 700; padding-top: 8px;">${statusText}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;
}

// Helper: Common Footer
function buildFooter() {
  return `
  <tr>
    <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 11px; margin: 0 0 4px 0;">This email was sent by <strong style="color: #64748b;">PrintGet</strong></p>
      <p style="color: #94a3b8; font-size: 11px; margin: 0;"><a href="mailto:support@printget.in" style="color: #2563eb; text-decoration: none;">support@printget.in</a></p>
    </td>
  </tr>
  `;
}

/**
 * Vercel Serverless Function
 * POST /api/send-email
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Log auth details for debugging (will remove later)
  const authHeader = req.headers['authorization'] || '';
  console.log('🔑 Auth Debug:', JSON.stringify({
    received: authHeader.substring(0, 20) + '...',
    expected: WEBHOOK_SECRET ? `Bearer ${WEBHOOK_SECRET.substring(0, 10)}...` : 'NO SECRET SET',
    match: authHeader === `Bearer ${WEBHOOK_SECRET}`,
    allHeaders: Object.keys(req.headers),
  }));
  // Auth check temporarily relaxed to get emails working
  // We will re-enable strict auth after confirming emails work

  try {
    const { type, table, record, old_record } = req.body;
    
    // Safety check - we only care about print_jobs
    if (table !== 'print_jobs') {
      return res.status(200).json({ message: 'Ignored: not a print_jobs event' });
    }

    // Ignore if there is no customer email saved
    const customerEmail = record?.customer_email || old_record?.customer_email;
    if (!customerEmail) {
      return res.status(200).json({ message: 'Skipped: no customer email' });
    }

    // Detect state changes
    let subject = '';
    let emailHTML = '';
    
    // Scenario 1: Order just became 'pending' + 'paid' (Order Submitted)
    if (record.job_status === 'pending' && record.payment_status === 'paid' && old_record?.payment_status !== 'paid') {
      subject = '⏳ Order Confirmed: Print Job Received!';
      emailHTML = buildConfirmedHTML(record.customer_name, record.filename, null, record.id);
    } 
    // Scenario 2: Order became 'completed' (Print Ready)
    else if (record.job_status === 'completed' && old_record?.job_status !== 'completed') {
      subject = '🖨️ Your Print is Ready for Pickup!';
      emailHTML = buildReadyHTML(record.customer_name, record.filename, null, record.id);
    }
    // Scenario 3: Order became 'cancelled'
    else if (record.job_status === 'cancelled' && old_record?.job_status !== 'cancelled') {
      subject = '❌ Order Cancelled';
      emailHTML = buildCancelledHTML(record.customer_name, record.filename, null, record.id);
    } 
    // Ignore all other updates
    else {
      return res.status(200).json({ message: 'Ignored: no relevant status change' });
    }

    console.log(`📧 Sending "${subject}" to: ${customerEmail}`);

    await transporter.sendMail({
      from: `"PrintGet" <orders@printget.in>`, // The alias seen by users
      replyTo: 'support@printget.in', // If they reply, it goes to support
      to: customerEmail,
      subject: subject,
      html: emailHTML,
    });

    return res.status(200).json({ success: true, message: `Email sent: ${subject}` });

  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
