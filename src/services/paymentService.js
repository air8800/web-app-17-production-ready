/**
 * PhonePe Standard Checkout v2 — client service.
 *
 * Flow (matches the official PhonePe guide):
 *   1. Client POSTs jobId to /api/phonepe-initiate.
 *   2. Server reads amount + customer info from Supabase (client cannot tamper),
 *      calls PhonePe /checkout/v2/pay, returns a `redirectUrl`.
 *   3. Client redirects the user to that URL. PhonePe's hosted page then
 *      presents the full responsive payment UI (UPI apps + Card + Net Banking)
 *      across desktop, tablet, and mobile.
 *   4. After the user pays, PhonePe redirects back to
 *      /payment/:jobId?orderId=<merchantOrderId>.
 *   5. Client calls /api/phonepe-status to server-verify the result.
 */

/**
 * Initiate a PhonePe checkout for a job.
 * @param {{ jobId: string }} params
 * @returns {Promise<{ redirectUrl: string, merchantOrderId: string }>}
 */
export const initiatePhonePePayment = async ({ jobId }) => {
  const response = await fetch('/api/phonepe-initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    // Surface server diagnostics in the console so misconfigured envs are immediately visible.
    if (data && (data.serverProjectRef || data.hint || data.details || data.likelyCauses || data.phonepeBody)) {
      console.error('❌ phonepe-initiate failed:', {
        status: response.status,
        buildVersion: data.buildVersion,
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
        phonepeStatus: data.phonepeStatus,
        phonepeBody: data.phonepeBody,
        authURL: data.authURL,
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
 * Server-verify a PhonePe order status after the user returns from checkout.
 * Always call this before marking an order paid — never trust redirect URL params alone.
 *
 * @param {string} merchantOrderId - The orderId returned from initiatePhonePePayment.
 * @returns {Promise<{ success: boolean, state: 'COMPLETED'|'FAILED'|'PENDING', amount: number, paymentMethod: string|null }>}
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
