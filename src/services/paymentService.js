import { updatePaymentStatus } from '../utils/supabase';
import { getCheckoutPlatform } from '../utils/devicePlatform';

export function isOnlinePaymentMethod(job) {
  const method = (job?.payment_method || '').toLowerCase();
  return (
    method.includes('phonepe') ||
    method === 'online' ||
    method.includes('pay online')
  );
}

export const initiatePhonePePayment = async ({ jobId, platform }) => {
  const response = await fetch('/api/phonepe-initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, platform }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    const baseMsg = data.message || data.error || 'PhonePe payment initiation failed';
    const causeMsg = Array.isArray(data.likelyCauses) && data.likelyCauses.length
      ? ` — ${data.likelyCauses.join(' ')}`
      : (data.hint ? ` (${data.hint})` : '');
    throw new Error(baseMsg + causeMsg);
  }

  return {
    redirectUrl: data.redirectUrl,
    merchantOrderId: data.merchantOrderId,
    checkoutMode: data.checkoutMode,
  };
};

export const verifyPhonePePayment = async (merchantOrderId) => {
  const response = await fetch(
    `/api/phonepe-status?orderId=${encodeURIComponent(merchantOrderId)}`,
    { method: 'GET' }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Payment status check failed');
  }

  return data;
};

/** Immediate redirect — fastest path to PhonePe PayPage. */
export function openPhonePeCheckout({ redirectUrl }) {
  window.location.assign(redirectUrl);
}

export async function startPhonePeCheckoutForJob(jobId) {
  const platform = getCheckoutPlatform();
  const { redirectUrl, merchantOrderId } = await initiatePhonePePayment({ jobId, platform });
  localStorage.setItem(`pp_txn_${jobId}`, merchantOrderId);
  openPhonePeCheckout({ redirectUrl });
}

/** After PhonePe redirect: verify and mark paid (StatusPage). */
export async function confirmPhonePeReturn(jobId, merchantOrderId) {
  const POLL_INTERVAL_MS = 1000;
  const MAX_ATTEMPTS = 20;
  let lastResult = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    lastResult = await verifyPhonePePayment(merchantOrderId);
    if (lastResult.state !== 'PENDING') break;
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  if (lastResult?.success && lastResult.state === 'COMPLETED') {
    await updatePaymentStatus(jobId, 'paid');
    return { ok: true };
  }

  return { ok: false, state: lastResult?.state };
}
