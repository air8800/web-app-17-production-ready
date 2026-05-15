export function isOnlinePaymentMethod(job) {
  const method = (job?.payment_method || '').toLowerCase();
  return (
    method.includes('phonepe') ||
    method === 'online' ||
    method.includes('pay online')
  );
}

/**
 * PhonePe Standard Checkout v2 — client service.
 *
 * Mobile: full-page redirect to PhonePe (their page detects device + shows app UI).
 * IFRAME is avoided on mobile — it often renders the desktop layout in a small frame.
 */

function checkoutScriptUrlForRedirect(redirectUrl) {
  try {
    const { hostname } = new URL(redirectUrl);
    if (hostname === 'mercury.phonepe.com') {
      return 'https://mercury.phonepe.com/web/bundle/checkout.js';
    }
    if (hostname === 'mercury-stg.phonepe.com' || hostname === 'mercury-uat.phonepe.com') {
      return 'https://mercury-stg.phonepe.com/web/bundle/checkout.js';
    }
  } catch {
    /* use production default */
  }
  return 'https://mercury.phonepe.com/web/bundle/checkout.js';
}

function loadPhonePeCheckoutScript(redirectUrl) {
  const src = checkoutScriptUrlForRedirect(redirectUrl);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('PhonePe checkout is only available in the browser'));
      return;
    }

    if (window.PhonePeCheckout?.transact) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[data-phonepe-checkout]');
    if (existing) {
      const onLoad = () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onError);
        resolve();
      };
      const onError = () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onError);
        reject(new Error('Failed to load PhonePe checkout'));
      };
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onError);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.phonepeCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load PhonePe checkout'));
    document.head.appendChild(script);
  });
}

/**
 * Open PhonePe PayPage with a full-page redirect (recommended for mobile).
 * Uses PhonePe's transact() when the script loads; falls back to location.href.
 */
export async function openPhonePeCheckout({ redirectUrl }) {
  try {
    await loadPhonePeCheckoutScript(redirectUrl);
    if (window.PhonePeCheckout?.transact) {
      window.PhonePeCheckout.transact({ tokenUrl: redirectUrl });
      return;
    }
  } catch (err) {
    console.warn('PhonePe checkout.js unavailable, using direct redirect:', err);
  }

  window.location.href = redirectUrl;
}

/**
 * @param {{ jobId: string, platform?: 'mobile'|'desktop' }} params
 */
export const initiatePhonePePayment = async ({ jobId, platform }) => {
  const response = await fetch('/api/phonepe-initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, platform }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    if (data && (data.serverProjectRef || data.hint || data.details || data.likelyCauses || data.phonepeBody)) {
      console.error('phonepe-initiate failed:', {
        status: response.status,
        buildVersion: data.buildVersion,
        error: data.error,
        hint: data.hint,
        details: data.details,
        phonepeStatus: data.phonepeStatus,
        phonepeBody: data.phonepeBody,
      });
    }
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
