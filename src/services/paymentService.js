/**
 * PhonePe Payment Gateway Service
 * Replaces the previous UPIGateway integration.
 *
 * All sensitive operations (checksum generation, API calls to PhonePe)
 * are done server-side via Vercel API routes to protect your Salt Key.
 */

/**
 * Initiates a PhonePe payment for a given job.
 * Returns a redirect URL → send the user there to complete payment on PhonePe's hosted page.
 *
 * @param {Object} params
 * @param {string} params.jobId             - Your Supabase print_job ID
 * @param {number} params.amount            - Amount in ₹ (e.g. 49.50)
 * @param {string} params.customerName      - Customer's name
 * @param {string} params.customerEmail     - Customer's email
 * @param {string} [params.customerMobile]  - Customer's mobile (optional, defaults to placeholder)
 * @returns {Promise<{ redirectUrl: string, merchantTransactionId: string }>}
 */
export const initiatePhonePePayment = async ({
  jobId,
  amount,
  customerName,
  customerEmail,
  customerMobile,
}) => {
  const response = await fetch('/api/phonepe-initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, amount, customerName, customerEmail, customerMobile }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    // Surface server diagnostics in the console so misconfigured envs are immediately visible.
    if (data && (data.serverProjectRef || data.hint || data.details)) {
      console.error('❌ phonepe-initiate failed:', {
        status: response.status,
        error: data.error,
        hint: data.hint,
        details: data.details,
        serverProjectRef: data.serverProjectRef,
      });
    }
    const baseMsg = data.message || data.error || 'PhonePe payment initiation failed';
    const hintMsg = data.hint ? ` (${data.hint})` : '';
    throw new Error(baseMsg + hintMsg);
  }

  return {
    redirectUrl: data.redirectUrl,
    merchantOrderId: data.merchantOrderId,
  };
};

/**
 * Verifies the payment status server-side after PhonePe redirects the user back.
 * Always call this before marking an order as paid — never trust the redirect URL params alone.
 *
 * @param {string} merchantOrderId - The orderId returned from initiatePhonePePayment
 * @returns {Promise<{ success: boolean, state: string, amount: number, ... }>}
 */
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
