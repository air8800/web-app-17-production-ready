import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getJobStatus, updatePaymentStatus, getShopInfo } from '../utils/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { initiatePhonePePayment, verifyPhonePePayment } from '../services/paymentService'
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, CreditCard } from 'lucide-react'

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

  usePageTitle('Checkout')

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

      if (jobData.payment_status === 'paid') {
        navigate(`/status/${jobId}`, { replace: true })
        return
      }

      setJob(jobData)

      const { data: shopData } = await getShopInfo(jobData.shop_id)
      if (shopData) setShop(shopData)

    } catch (err) {
      console.error('Error loading job details:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReturnFromPhonePe = async (txnId) => {
    setVerifying(true)
    const POLL_INTERVAL_MS = 3000
    const MAX_ATTEMPTS = 20
    let lastResult = null

    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        lastResult = await verifyPhonePePayment(txnId)
        if (lastResult.state !== 'PENDING') break
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }

      if (lastResult?.success && lastResult.state === 'COMPLETED') {
        await updatePaymentStatus(jobId, 'paid')
        saveToLocalHistory(jobId)
        setPaymentConfirmed(true)
        setTimeout(() => navigate(`/status/${jobId}`), 2500)
      } else {
        setError(
          lastResult?.state === 'PENDING'
            ? 'Payment is still processing. Please check your order status.'
            : 'Payment was not successful. Please try again or choose Pay at Shop.'
        )
        await loadJobDetails()
      }
    } catch (err) {
      console.error('Payment verification error:', err)
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

  const handlePayOnline = async () => {
    setProcessing(true)
    setError(null)
    try {
      const { redirectUrl, merchantOrderId } = await initiatePhonePePayment({ jobId })
      localStorage.setItem(`pp_txn_${jobId}`, merchantOrderId)
      window.location.href = redirectUrl
    } catch (err) {
      console.error('PhonePe initiation error:', err)
      setError(err.message || 'Failed to start payment. Please try again.')
      setProcessing(false)
    }
  }

  const handlePayAtShop = async () => {
    setProcessing(true)
    try {
      await updatePaymentStatus(jobId, 'paid')
      saveToLocalHistory(jobId)
      setPaymentConfirmed(true)
      setTimeout(() => navigate(`/status/${jobId}`), 2000)
    } catch (err) {
      console.error('Error confirming order:', err)
      setError('Failed to confirm order. Please try again.')
      setProcessing(false)
    }
  }

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin w-12 h-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            {verifying ? 'Verifying your payment...' : 'Loading checkout...'}
          </p>
        </div>
      </div>
    )
  }

  if (error && !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl shadow-xl border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-bold">Try Again</button>
        </div>
      </div>
    )
  }

  if (paymentConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md bg-white p-10 rounded-3xl shadow-2xl border border-green-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-black text-green-600 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">Your order has been confirmed and sent to the shop.</p>
          <p className="text-sm text-gray-400">Redirecting to status page...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white">
            <h1 className="text-xl font-black uppercase tracking-tight">Checkout</h1>
            <p className="text-blue-100 text-sm opacity-80">Order #{jobId?.slice(0, 8)}</p>
          </div>

          <div className="p-6">

            {/* Error banner */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-slate-900">Order Summary</h2>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>File</span>
                  <span className="font-medium text-slate-800 truncate ml-4">{job?.filename}</span>
                </div>
                {shop && (
                  <div className="flex justify-between">
                    <span>Pickup At</span>
                    <span className="font-medium text-slate-800 text-right ml-4">{shop.name}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center mt-2">
                  <span className="font-bold text-slate-900">Total Amount</span>
                  <span className="text-2xl font-black text-blue-600">₹{job?.total_cost?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Options */}
            <div className="space-y-3">

              <button
                onClick={handlePayOnline}
                disabled={processing}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base py-4 px-5 rounded-2xl shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-between gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black">Pay Online</div>
                    <div className="text-xs text-blue-200">UPI · Cards · Net Banking</div>
                  </div>
                </div>
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="text-lg font-black">₹{job?.total_cost?.toFixed(2)}</span>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="w-3 h-3" />
                <span>Secured checkout</span>
              </div>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <button
                onClick={handlePayAtShop}
                disabled={processing}
                className="w-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-sm py-3.5 rounded-xl hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                Pay at Shop (Cash / UPI on Pickup)
              </button>
            </div>

            <p className="text-center text-xs text-slate-400 mt-4">
              By proceeding, you agree to PrintGet's{' '}
              <a href="/terms" className="underline text-blue-500">Terms</a> &amp;{' '}
              <a href="/refund-policy" className="underline text-blue-500">Refund Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentPage
