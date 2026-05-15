import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/phonepe-webhook
 *
 * Receives real-time payment status updates from PhonePe Standard Checkout v2.
 *
 * PhonePe sends:
 *   Authorization: Basic base64(webhookUsername:webhookPassword)
 *   Body: { type, payload: { ... } }
 *
 * Verification is done entirely against the configured Basic-auth credentials —
 * no PhonePe OAuth token is needed inside the webhook itself (the webhook is
 * push-only; we don't call back into PhonePe from here).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ── 1. Basic Auth check ─────────────────────────────────────────────────
    const authHeader = req.headers['authorization'] || '';
    const expectedUser = process.env.PHONEPE_WEBHOOK_USERNAME;
    const expectedPass = process.env.PHONEPE_WEBHOOK_PASSWORD;

    if (expectedUser && expectedPass) {
      const expected = `Basic ${Buffer.from(`${expectedUser}:${expectedPass}`).toString('base64')}`;
      if (authHeader !== expected) {
        console.warn('⚠️ PhonePe webhook: unauthorized — bad credentials');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const body = req.body;
    console.log('📲 PhonePe webhook received:', JSON.stringify(body));

    // ── 2. Extract order details from payload ───────────────────────────────
    // PhonePe v2 webhook payload structure
    const eventType = body?.type;                          // e.g. "checkout.order.completed"
    const orderPayload = body?.payload || body?.data;

    const merchantOrderId = orderPayload?.merchantOrderId || orderPayload?.merchantTransactionId;
    const phonePeOrderId  = orderPayload?.orderId || orderPayload?.transactionId;
    const orderState      = orderPayload?.state || '';

    // Map all success event types
    const SUCCESS_EVENTS = [
      'checkout.order.completed',
      'payment.page.order.completed',
      'pg.order.completed',
    ];
    // Map all failure event types
    const FAILED_EVENTS = [
      'checkout.order.failed',
      'payment.page.order.failed',
      'pg.order.failed',
    ];
    // Refund events (for future use)
    const REFUND_SUCCESS_EVENTS = ['pg.refund.completed'];
    const REFUND_FAILED_EVENTS  = ['pg.refund.failed'];

    const isSuccess       = SUCCESS_EVENTS.includes(eventType) || orderState === 'COMPLETED';
    const isFailed        = FAILED_EVENTS.includes(eventType)  || orderState === 'FAILED';
    const isRefundSuccess = REFUND_SUCCESS_EVENTS.includes(eventType);
    const isRefundFailed  = REFUND_FAILED_EVENTS.includes(eventType);

    // Handle refund events separately (log only for now)
    if (isRefundSuccess || isRefundFailed) {
      console.log(`💸 PhonePe Refund event: ${eventType} | Order: ${merchantOrderId}`);
      return res.status(200).json({ message: 'OK - refund event logged' });
    }

    if (!merchantOrderId) {
      console.warn('⚠️ PhonePe webhook: no merchantOrderId in payload');
      return res.status(200).json({ message: 'OK - ignored (no order ID)' });
    }

    // ── 3. Update Supabase ──────────────────────────────────────────────────
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error: updateError } = await supabase
      .from('print_jobs')
      .update({
        payment_status: isSuccess ? 'paid' : isFailed ? 'failed' : 'pending',
        payment_method: 'PhonePe',
        phonepe_txn_id: phonePeOrderId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('phonepe_merchant_txn_id', merchantOrderId);

    if (updateError) {
      console.error('❌ Supabase update error:', updateError.message);
    } else {
      console.log(`✅ Order ${merchantOrderId} → ${isSuccess ? 'PAID' : isFailed ? 'FAILED' : 'PENDING'}`);
    }

    // Always return 200 so PhonePe stops retrying
    return res.status(200).json({ message: 'OK' });

  } catch (error) {
    console.error('❌ PhonePe webhook error:', error);
    return res.status(200).json({ message: 'OK' }); // 200 always to stop retries
  }
}
