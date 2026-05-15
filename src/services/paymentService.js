/**
 * PhonePe Standard Checkout v2 — client service.
 *
 * Mobile: platform=mobile → server enables UPI INTENT (+ COLLECT), opens PayPage
 * via official checkout.js in IFRAME mode.
 * Desktop: full hosted checkout (redirect).
 */

function checkoutScriptUrlForRedirect(redirectUrl) {
  const url = redirectUrl || '';
  if (
    url.includes('mercury-uat') ||
    url.includes('mercury-stg') ||
    url.includes('preprod') ||
    url.includes('pg-sandbox')
  ) {
    return 'https://mercury-stg.phonepe.com/web/bundle/checkout.js';
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
 * Open PhonePe PayPage. On mobile uses IFRAME (recommended); desktop uses redirect.
 * @returns {Promise<'CONCLUDED'|'USER_CANCEL'|null>} null when full-page redirect (desktop)
 */
export async function openPhonePeCheckout({ redirectUrl, useIframe }) {
  if (useIframe) {
    await loadPhonePeCheckoutScript(redirectUrl);
    if (!window.PhonePeCheckout?.transact) {
      throw new Error('PhonePe checkout is not available');
    }

    return new Promise((resolve) => {
      window.PhonePeCheckout.transact({
        tokenUrl: redirectUrl,
        type: 'IFRAME',
        callback: (response) => resolve(response),
      });
    });
  }

  window.location.href = redirectUrl;
  return null;
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
