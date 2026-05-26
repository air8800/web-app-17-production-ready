const getExplicitOrderNumber = (order) => {
  const explicitNumber =
    order?.shop_order_number ??
    order?.shopOrderNumber ??
    order?.orderNumber ??
    order?.pickupOrderId

  if (explicitNumber !== null && explicitNumber !== undefined && String(explicitNumber).trim()) {
    return String(explicitNumber).trim()
  }

  return null
}

export const getOrderDisplayNumber = (order) => {
  const explicitNumber = getExplicitOrderNumber(order)
  if (explicitNumber) return explicitNumber

  const fallbackId = order?.id ?? order?.jobId
  return fallbackId ? String(fallbackId).slice(0, 8) : 'Unknown'
}

export const createRecentOrderPayload = (job, extras = {}) => ({
  jobId: job?.id ?? job?.jobId,
  shopId: extras.shopId ?? job?.shop_id ?? job?.shopId,
  shopOrderNumber: job?.shop_order_number ?? job?.shopOrderNumber ?? null,
  orderNumber: getExplicitOrderNumber(job),
  timestamp: Date.now(),
})
