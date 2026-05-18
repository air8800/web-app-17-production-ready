import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getJobStatus, updatePaymentStatus, getShopInfo } from '../utils/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  startPhonePeCheckoutForJob,
  isOnlinePaymentMethod,
} from '../services/paymentService'
import { AlertCircle, Loader2, ShieldCheck, CreditCard } from 'lucide-react'

const PaymentPage = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const autoPayAttempted = useRef(false)

  const [job, setJob] = useState(null)
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [redirectingToPhonePe, setRedirectingToPhonePe] = useState(false)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  usePageTitle('Checkout')

  const saveToLocalHistory = (id) => {
    try {
      localStorage.setItem('printget_recent_order', JSON.stringify({
        jobId: id,
        timestamp: Date.now(),
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

  const orderIdParam = searchParams.get('orderId')

  // Legacy return URL on /payment — send to status page (handles verify there).
  useEffect(() => {
    if (orderIdParam) {
      navigate(`/status/${jobId}?orderId=${encodeURIComponent(orderIdParam)}`, { replace: true })
    }
  }, [orderIdParam, jobId, navigate])

  const loadJobDetails = useCallback(async () => {
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

      if (isOnlinePaymentMethod(jobData) && !autoPayAttempted.current) {
        autoPayAttempted.current = true
        setLoading(false)
        setRedirectingToPhonePe(true)
        try {
          await startPhonePeCheckoutForJob(jobId)
        } catch (err) {
          console.error('PhonePe initiation error:', err)
          setError(err.message || 'Failed to start payment. Please try again.')
          setRedirectingToPhonePe(false)
        }
        return
      }
    } catch (err) {
      console.error('Error loading job details:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [jobId, navigate])

  useEffect(() => {
    if (!orderIdParam) {
      loadJobDetails()
    }
  }, [jobId, orderIdParam, loadJobDetails])

  const handlePayOnline = async () => {
    setProcessing(true)
    setError(null)
    setRedirectingToPhonePe(true)
    try {
      await startPhonePeCheckoutForJob(jobId)
    } catch (err) {
      setError(err.message || 'Failed to start payment. Please try again.')
      setRedirectingToPhonePe(false)
      setProcessing(false)
    }
  }

  const handlePayAtShop = async () => {
    setProcessing(true)
    try {
      await updatePaymentStatus(jobId, 'paid')
      saveToLocalHistory(jobId)
      navigate(`/status/${jobId}`, { replace: true })
    } catch (err) {
      console.error('Error confirming order:', err)
      setError('Failed to confirm order. Please try again.')
      setProcessing(false)
    }
  }

  if (orderIdParam || loading || redirectingToPhonePe) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin w-12 h-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            {redirectingToPhonePe ? 'Opening secure payment...' : 'Loading...'}
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
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-bold"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white">
            <h1 className="text-xl font-black uppercase tracking-tight">Checkout</h1>
            <p className="text-blue-100 text-sm opacity-80">Order #{jobId?.slice(0, 8)}</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
              <h2 className="font-bold text-slate-900 mb-3">Order Summary</h2>
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
                  <span className="font-bold text-slate-900">Total</span>
                  <span className="text-2xl font-black text-blue-600">₹{job?.total_cost?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handlePayOnline}
                disabled={processing}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base py-4 px-5 rounded-2xl shadow-lg flex items-center justify-between gap-2 disabled:opacity-70"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5" />
                  <span className="text-sm font-black">Pay Online</span>
                </div>
                <span className="text-lg font-black">₹{job?.total_cost?.toFixed(2)}</span>
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="w-3 h-3" />
                <span>Secured checkout</span>
              </div>

              <button
                onClick={handlePayAtShop}
                disabled={processing}
                className="w-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-sm py-3.5 rounded-xl disabled:opacity-70"
              >
                Pay at Shop (Cash / UPI on Pickup)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentPage