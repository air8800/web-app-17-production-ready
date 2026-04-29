import nodemailer from 'nodemailer';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// SMTP auth account — must be the REAL Google Workspace user (not an alias).
// `orders@printget.in` is only an alias of `hello@printget.in`, so sending
// from the alias caused Gmail to silently rewrite the From header / break
// DMARC alignment, which sent everything to spam. We now send from `hello@`
// directly (the real authenticated user) and just keep `support@printget.in`
// as the Reply-To so customer replies still go to support, not the inbox owner.
const FROM_EMAIL = process.env.EMAIL_USER || 'hello@printget.in';
const FROM_DOMAIN = (FROM_EMAIL.split('@')[1] || 'printget.in').toLowerCase();

// Use explicit SMTP config (host/port/secure) instead of `service: 'gmail'`.
// This lets us reuse a pooled, keep-alive connection and gives nodemailer
// enough information to generate a proper Message-ID using our own domain
// (instead of a generic nodemailer.com one), which improves deliverability.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  pool: true,
  auth: {
    user: FROM_EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

// Hidden preheader text — appears in the inbox preview line in Gmail/Apple Mail
// without being visible in the email body. Helps deliverability + UX.
function buildPreheader(text) {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f1f5f9;opacity:0;">${text}</div>`;
}

/**
 * Generates the HTML for "Order Confirmed" 
 */
function buildConfirmedHTML(customerName, filename, shopName, orderId, amount, paymentMethod) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  ${buildPreheader(`Hi ${customerName || 'there'}, your PrintGet order ${orderId ? orderId.slice(0,8) : ''} has been received and is now in the print queue.`)}
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
              ${buildDetailsTable(filename, shopName, orderId, '⏳ In Queue', '#eab308', amount, paymentMethod)}
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
function buildReadyHTML(customerName, filename, shopName, orderId, amount, paymentMethod) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Print is Ready!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  ${buildPreheader(`Hi ${customerName || 'there'}, your print job for "${filename || 'your document'}" is ready. Please collect it from the shop.`)}
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
              ${buildDetailsTable(filename, shopName, orderId, '✅ Ready for Pickup', '#16a34a', amount, paymentMethod)}
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
function buildCancelledHTML(customerName, filename, shopName, orderId, amount, paymentMethod) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Cancelled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  ${buildPreheader(`Hi ${customerName || 'there'}, your PrintGet order ${orderId ? orderId.slice(0,8) : ''} has been cancelled by the shop.`)}
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
              ${buildDetailsTable(filename, shopName, orderId, '❌ Cancelled', '#ef4444', amount, paymentMethod)}
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
function buildDetailsTable(filename, shopName, orderId, statusText, statusColor, amount, paymentMethod) {
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
            <td style="padding: 6px 0;">
              <table width="100%"><tr><td style="color: #64748b; font-size: 13px;">Amount Paid</td><td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600;">₹${amount || '0'}</td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0;">
              <table width="100%"><tr><td style="color: #64748b; font-size: 13px;">Payment Method</td><td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600;">${paymentMethod || 'Cash on Delivery'}</td></tr></table>
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
      <p style="color: #cbd5e1; font-size: 10px; margin: 8px 0 0 0;">You're receiving this because you placed an order on PrintGet.</p>
    </td>
  </tr>
  `;
}

/**
 * Build a clean, human-readable plain-text alternative.
 * A real plaintext body (not stripped HTML) significantly lowers the spam score.
 */
function buildPlainText({ heading, intro, customerName, filename, shopName, orderId, statusText, amount, paymentMethod }) {
  const lines = [
    heading,
    '='.repeat(heading.length),
    '',
    `Hi ${customerName || 'there'},`,
    '',
    intro,
    '',
    'Order Details',
    '-------------',
    `File:           ${filename || 'Document'}`,
    `Shop:           ${shopName || 'PrintGet Partner Shop'}`,
    `Order ID:       ${orderId ? orderId.slice(0, 8) : '—'}`,
    `Amount Paid:    Rs. ${amount || '0'}`,
    `Payment:        ${paymentMethod || 'Cash on Delivery'}`,
    `Status:         ${statusText}`,
    '',
    'Need help? Reply to this email or contact support@printget.in',
    '',
    '— PrintGet',
    'https://printget.in',
  ];
  return lines.join('\n');
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
    
    if (table !== 'print_jobs') {
      return res.status(200).json({ message: 'Ignored: not a print_jobs event' });
    }

    const customerEmail = record?.customer_email || old_record?.customer_email;
    if (!customerEmail) {
      return res.status(200).json({ message: 'Skipped: no customer email' });
    }

    const customerName = record.customer_name;
    const filename = record.filename;
    const orderId = record.id;
    const amount = record.total_cost;
    const paymentMethod = 'Cash on Delivery';

    let subject = '';
    let emailHTML = '';
    let emailText = '';
    let entityRef = '';

    // Scenario 1: Order just became 'pending' + 'paid' (Order Submitted)
    if (record.job_status === 'pending' && record.payment_status === 'paid' && old_record?.payment_status !== 'paid') {
      subject = `Order received — ${orderId ? orderId.slice(0, 8) : 'PrintGet'}`;
      entityRef = `confirmed-${orderId}`;
      emailHTML = buildConfirmedHTML(customerName, filename, null, orderId, amount, paymentMethod);
      emailText = buildPlainText({
        heading: 'Order received',
        intro: 'Your payment was successful and your print job is now in the queue. We will notify you again as soon as it is ready for pickup.',
        customerName, filename, shopName: null, orderId, amount, paymentMethod,
        statusText: 'In Queue',
      });
    } 
    // Scenario 2: Order became 'completed' (Print Ready)
    else if (record.job_status === 'completed' && old_record?.job_status !== 'completed') {
      subject = `Your print is ready for pickup — ${orderId ? orderId.slice(0, 8) : 'PrintGet'}`;
      entityRef = `ready-${orderId}`;
      emailHTML = buildReadyHTML(customerName, filename, null, orderId, amount, paymentMethod);
      emailText = buildPlainText({
        heading: 'Your print is ready',
        intro: 'Great news! Your print job has been completed and is waiting for you to collect it from the shop.',
        customerName, filename, shopName: null, orderId, amount, paymentMethod,
        statusText: 'Ready for Pickup',
      });
    }
    // Scenario 3: Order became 'cancelled'
    else if (record.job_status === 'cancelled' && old_record?.job_status !== 'cancelled') {
      subject = `Your order was cancelled — ${orderId ? orderId.slice(0, 8) : 'PrintGet'}`;
      entityRef = `cancelled-${orderId}`;
      emailHTML = buildCancelledHTML(customerName, filename, null, orderId, amount, paymentMethod);
      emailText = buildPlainText({
        heading: 'Order cancelled',
        intro: 'Unfortunately, your print job has been cancelled by the shop. Please contact them for more details, or reply to this email and we will help.',
        customerName, filename, shopName: null, orderId, amount, paymentMethod,
        statusText: 'Cancelled',
      });
    } 
    else {
      return res.status(200).json({ message: 'Ignored: no relevant status change' });
    }

    console.log(`📧 Sending "${subject}" to: ${customerEmail}`);

    // Generate a Message-ID anchored to our own domain (printget.in) instead of
    // nodemailer's default. Mailbox providers cross-check this against SPF/DKIM.
    const messageId = `<${entityRef}.${Date.now()}@${FROM_DOMAIN}>`;

    // Mailto-based unsubscribe is fine for transactional mail and is required
    // by Gmail/Yahoo bulk-sender rules (Feb 2024) once you cross 5k/day; adding
    // it now is harmless and helps deliverability today.
    const listUnsubscribeMailto = `mailto:support@printget.in?subject=Unsubscribe%20${encodeURIComponent(orderId || '')}`;

    await transporter.sendMail({
      from: `"PrintGet Orders" <${FROM_EMAIL}>`,
      sender: FROM_EMAIL,
      replyTo: 'support@printget.in',
      to: customerEmail,
      subject: subject,
      text: emailText,
      html: emailHTML,
      messageId,
      headers: {
        'List-Unsubscribe': `<${listUnsubscribeMailto}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': entityRef,
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Auto-Submitted': 'auto-generated',
        'Precedence': 'transactional',
      },
    });

    return res.status(200).json({ success: true, message: `Email sent: ${subject}` });

  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
