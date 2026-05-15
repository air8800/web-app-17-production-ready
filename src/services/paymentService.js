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
 * Amount / customer fields are read server-side from Supabase — the client never
 * controls them. Only the chosen UPI app (or VPA) is forwarded as a hint so the
 * server can restrict PhonePe's hosted page to that single flow.
 *
 * @param {Object} params
 * @param {string} params.jobId   - Your Supabase print_job ID
 * @param {'phonepe'|'gpay'|'paytm'} [params.upiApp] - Named UPI app for Intent flow
 * @param {string} [params.upiVpa] - UPI ID (VPA) for Collect flow, e.g. "name@bank"
 * @returns {Promise<{ redirectUrl: string, merchantOrderId: string }>}
 */
export const initiatePhonePePayment = async ({ jobId, upiApp, upiVpa }) => {
  const response = await fetch('/api/phonepe-initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, upiApp, upiVpa }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    // Surface server diagnostics in the console so misconfigured envs are immediately visible.
    if (data && (data.serverProjectRef || data.hint || data.details || data.likelyCauses)) {
      console.error('❌ phonepe-initiate failed:', {
        status: response.status,
        error: data.error,
        hint: data.hint,
        details: data.details,
        code: data.code,
        name: data.name,
        serverProjectRef: data.serverProjectRef,
        keyProjectRef: data.keyProjectRef,
        role: data.role,
        projectsMatch: data.projectsMatch,
        roleIsServiceRole: data.roleIsServiceRole,
        likelyCauses: data.likelyCauses,
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
