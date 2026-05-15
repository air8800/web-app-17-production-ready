import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getJobStatus, updatePaymentStatus, getShopInfo } from '../utils/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { initiatePhonePePayment, verifyPhonePePayment } from '../services/paymentService'
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CreditCard,
  Building2,
  ArrowRight,
  Lock,
  FileText,
  Store,
} from 'lucide-react'

// Payment methods that PhonePe's hosted page will show. We list them here as a
// preview so the user knows what to expect after redirect (matches the layout
// of PhonePe's own checkout: UPI Payment + Other Methods).
const UPI_APPS = [
  { id: 'phonepe', label: 'PhonePe',    icon: '/upi/phonepe.svg' },
  { id: 'gpay',    label: 'Google Pay', icon: '/upi/gpay.svg' },
  { id: 'paytm',   label: 'Paytm',      icon: '/upi/paytm.svg' },
  { id: 'upi',     label: 'Apps & QR',  icon: '/upi/upi.svg' },
]

const PaymentPage = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [job, setJob] = useState(null)
  const [shop, setShop] = useState(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  // 'online' = PhonePe redirect, 'shop' = Pay at Shop, null = idle
  const [activeAction, setActiveAction] = useState(null)

  usePageTitle('Checkout')

  // ── On mount: check if we're returning from a PhonePe redirect ──────────
  useEffect(() => {
    const orderId = searchParams.get('orderId')
    if (orderId) {
      handleReturnFromPhonePe(orderId)
    } else {
      loadJobDetails()
    }
  }, [jobId])

  const loadJobDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: jobData, error: jobError } = await getJobStatus(jobId)
      if (jobError) throw new Error('Failed to load order: ' + jobError.message)
      if (!jobData) throw new Error('Order not found')

      // Already paid — skip straight to status
      if (jobData.payment_status === 'paid') {
        navigate(`/status/${jobId}`, { replace: true })
        return
      }

      setJob(jobData)

      const { data: shopData } = await getShopInfo(jobData.shop_id)
      if (shopData) setShop(shopData)

    } catch (err) {
      console.error('❌ Error loading job details:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Called after PhonePe redirects user back to /payment/:jobId?orderId=... ─
  // Polls the server while PhonePe reports PENDING (typical for UPI Collect,
  // where the user approves the request on their UPI app a few seconds after
  // the redirect).
  const handleReturnFromPhonePe = async (txnId) => {
    setVerifying(true)
    const POLL_INTERVAL_MS = 3000
    const MAX_ATTEMPTS = 20 // ~60s total
    let lastResult = null

    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        lastResult = await verifyPhonePePayment(txnId)
        if (lastResult.state !== 'PENDING') break
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }

      if (lastResult?.success && lastResult.state === 'COMPLETED') {
        // Webhook already updated Supabase; double-mark here as a safety net.
        await updatePaymentStatus(jobId, 'paid')
        saveToLocalHistory(jobId)
        setPaymentConfirmed(true)
        setTimeout(() => navigate(`/status/${jobId}`), 2500)
      } else {
        setError(
          lastResult?.state === 'PENDING'
            ? 'Payment is still processing. Open your UPI app to approve, then check your order status.'
            : 'Payment was not successful. Please try again or choose Pay at Shop.'
        )
        await loadJobDetails()
      }
    } catch (err) {
      console.error('❌ Payment verification error:', err)
      setError('Could not verify payment. Please check your order status.')
      await loadJobDetails()
    } finally {
      setVerifying(false)
    }
  }

  const saveToLocalHistory = (id) => {
    try {
      localStorage.setItem('printget_recent_order', JSON.stringify({
        jobId: id,
        timestamp: Date.now()
      }))
      const history = JSON.parse(localStorage.getItem('printget_order_history') || '[]')
      if (!history.includes(id)) {
        history.push(id)
        localStorage.setItem('printget_order_history', JSON.stringify(history))
      }
    } catch (e) {
      console.error('Failed to save order history', e)
    }
  }

  // ── Pay Online: hand off to PhonePe's hosted checkout ────────────────────
  // PhonePe's page handles the full UI (UPI apps + Card + Net Banking) and is
  // responsive across desktop, tablet, and mobile — we don't pre-select a flow.
  const handlePayOnline = async () => {
    setProcessing(true)
    setActiveAction('online')
    setError(null)
    try {
      const { redirectUrl, merchantOrderId } = await initiatePhonePePayment({ jobId })
      localStorage.setItem(`pp_txn_${jobId}`, merchantOrderId)
      window.location.href = redirectUrl
    } catch (err) {
      console.error('❌ PhonePe initiation error:', err)
      setError(err.message || 'Failed to start payment. Please try again.')
      setProcessing(false)
      setActiveAction(null)
    }
  }

  // ── Pay at Shop (cash/UPI on pickup) ─────────────────────────────────────
  const handlePayAtShop = async () => {
    setProcessing(true)
    setActiveAction('shop')
    try {
      await updatePaymentStatus(jobId, 'paid')
      saveToLocalHistory(jobId)
      setPaymentConfirmed(true)
      setTimeout(() => navigate(`/status/${jobId}`), 2000)
    } catch (err) {
      console.error('Error confirming order:', err)
      setError('Failed to confirm order. Please try again.')
      setProcessing(false)
      setActiveAction(null)
    }
  }

  // ── Loading / verifying ──────────────────────────────────────────────────
  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <Loader2 className="animate-spin w-12 h-12 text-[#5f259f] mx-auto mb-4" />
          <p className="text-slate-600 font-medium">
            {verifying ? 'Verifying your payment…' : 'Loading checkout…'}
          </p>
          {verifying && (
            <p className="text-slate-400 text-xs mt-1">This can take up to a minute for UPI Collect.</p>
          )}
        </div>
      </div>
    )
  }

  // ── Hard error (no job) ──────────────────────────────────────────────────
  if (error && !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl shadow-xl border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-3 bg-[#5f259f] text-white rounded-xl font-bold hover:bg-[#4a1d7d] transition"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (paymentConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md bg-white p-10 rounded-3xl shadow-2xl border border-green-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-black text-green-600 mb-2">Payment Successful!</h1>
          <p className="text-slate-600 mb-6">Your order has been confirmed and sent to the shop.</p>
          <p className="text-sm text-slate-400">Redirecting to status page…</p>
        </div>
      </div>
    )
  }

  const totalAmount = job?.total_cost?.toFixed(2) ?? '0.00'

  // ── Checkout ─────────────────────────────────────────────────────────────
  // Responsive layout:
  //   - Mobile: stacked, full-width card (max-w-md).
  //   - Desktop (lg+): two columns — order summary on the left, payment action
  //     on the right (max-w-4xl), matching modern checkout patterns.
  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:py-10">
      <div className="max-w-4xl mx-auto">

        {/* Page header (desktop only) */}
        <div className="hidden lg:flex items-center justify-between mb-6 px-1">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Checkout</h1>
            <p className="text-slate-500 text-sm">Order #{jobId?.slice(0, 8)}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5" />
            <span>Secure payment</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 items-start">

          {/* ── Order Summary (left on desktop, top on mobile) ──────────── */}
          <aside className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden order-1">
            {/* Mobile-only header (desktop has its own above) */}
            <div className="lg:hidden bg-gradient-to-br from-[#5f259f] to-[#4a1d7d] p-5 text-white">
              <h1 className="text-lg font-black uppercase tracking-tight">Checkout</h1>
              <p className="text-purple-100 text-xs opacity-80">Order #{jobId?.slice(0, 8)}</p>
            </div>

            <div className="p-5">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Order Summary
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-400 text-[11px] uppercase tracking-wide font-semibold">File</p>
                    <p className="text-slate-800 font-medium truncate">{job?.filename}</p>
                  </div>
                </div>

                {shop && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-400 text-[11px] uppercase tracking-wide font-semibold">Pickup at</p>
                      <p className="text-slate-800 font-medium truncate">{shop.name}</p>
                    </div>
                  </div>
                )}

                <div className="pt-3 mt-1 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="text-slate-500 text-sm font-semibold">Total</span>
                  <span className="text-3xl font-black text-slate-900 tabular-nums">
                    ₹{totalAmount}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Payment Action (right on desktop, bottom on mobile) ───── */}
          <section className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden order-2">
            <div className="p-5 sm:p-6">

              {/* Error banner */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* PhonePe handoff card */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-br from-[#5f259f] to-[#4a1d7d] px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/upi/phonepe.svg" alt="PhonePe" className="w-6 h-6 bg-white rounded-md p-0.5" />
                    <span className="text-white font-bold text-sm">Pay with PhonePe</span>
                  </div>
                  <span className="text-purple-100 text-[10px] uppercase tracking-wide font-semibold">
                    Secure
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    You'll be taken to PhonePe's secure checkout to complete payment using your
                    preferred method.
                  </p>

                  {/* UPI tile preview — purely visual, matches PhonePe's hosted page */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      UPI Payment
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {UPI_APPS.map((app) => (
                        <div
                          key={app.id}
                          className="aspect-square bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 p-1.5"
                        >
                          <img src={app.icon} alt={app.label} className="w-6 h-6 sm:w-7 sm:h-7" loading="lazy" />
                          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-600 leading-tight text-center">
                            {app.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Other methods preview */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Other Methods
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <CreditCard className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">Debit / Credit Card</span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">Net Banking</span>
                      </div>
                    </div>
                  </div>

                  {/* Continue to PhonePe button */}
                  <button
                    onClick={handlePayOnline}
                    disabled={processing}
                    className="w-full bg-[#5f259f] hover:bg-[#4a1d7d] active:scale-[0.99] text-white font-bold text-sm py-3.5 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-purple-500/20"
                  >
                    {processing && activeAction === 'online' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting to PhonePe…
                      </>
                    ) : (
                      <>
                        Continue to Pay ₹{totalAmount}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Powered by <strong className="text-[#5f259f]">PhonePe</strong></span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Pay at Shop */}
              <button
                onClick={handlePayAtShop}
                disabled={processing}
                className="w-full bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 border border-slate-200 font-semibold text-sm py-3.5 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing && activeAction === 'shop' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming…
                  </>
                ) : (
                  'Pay at Shop (Cash / UPI on Pickup)'
                )}
              </button>

              <p className="text-center text-[11px] text-slate-400 mt-4 leading-relaxed">
                By proceeding, you agree to PrintGet's{' '}
                <a href="/terms" className="underline text-[#5f259f] hover:text-[#4a1d7d]">Terms</a>
                {' '}&amp;{' '}
                <a href="/refund-policy" className="underline text-[#5f259f] hover:text-[#4a1d7d]">Refund Policy</a>.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

export default PaymentPage
