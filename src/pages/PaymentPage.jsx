import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getJobStatus, updatePaymentStatus, getShopInfo } from '../utils/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { CheckCircle2, AlertCircle, HandCoins } from 'lucide-react'

const PaymentPage = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [shop, setShop] = useState(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  usePageTitle('Checkout')

  useEffect(() => {
    loadJobDetails()
  }, [jobId])

  const loadJobDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: jobData, error: jobError } = await getJobStatus(jobId)

      if (jobError) throw new Error('Failed to load order: ' + jobError.message)
      if (!jobData) throw new Error('Order not found')

      setJob(jobData)

      const { data: shopData } = await getShopInfo(jobData.shop_id)
      if (shopData) setShop(shopData)

    } catch (error) {
      console.error('❌ Error loading job details:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmOrder = async () => {
    setProcessing(true)
    try {
      // We set status to 'paid' to trigger the existing webhook and queue flows,
      // even though it's technically Cash on Delivery.
      await updatePaymentStatus(jobId, 'paid')
      setPaymentConfirmed(true)
      setTimeout(() => {
        navigate(`/status/${jobId}`)
      }, 2000)
    } catch (err) {
      console.error('Error confirming order:', err)
      setError('Failed to confirm order. Please try again.')
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading checkout...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl shadow-xl border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-900 mb-2">Error Setup</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Try Again</button>
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
          <h1 className="text-3xl font-black text-green-600 mb-2">Order Confirmed!</h1>
          <p className="text-gray-600 mb-6">Your order has been sent to the shop.</p>
          <p className="text-sm text-gray-400">Redirecting to status page...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-blue-600 p-6 text-white">
            <h1 className="text-xl font-black uppercase tracking-tight">Checkout</h1>
            <p className="text-blue-100 text-sm opacity-80">Order #{jobId.slice(0,8)}</p>
          </div>

          <div className="p-6">
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-slate-900">Order Summary</h2>
                <span className="text-xs font-black bg-blue-100 text-blue-600 px-2 py-1 rounded-md">COD</span>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Item</span>
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
                  <span className="text-xl font-black text-blue-600">₹{job?.total_cost?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-blue-100 rounded-2xl p-6 text-center shadow-sm mb-6">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <HandCoins className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Cash on Delivery</h3>
              <p className="text-sm text-slate-600">
                Please pay the total amount of <span className="font-bold text-slate-900">₹{job?.total_cost?.toFixed(2)}</span> directly at the shop when you pick up your print.
              </p>
            </div>

            <button
              onClick={handleConfirmOrder}
              disabled={processing}
              className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Confirming...
                </>
              ) : (
                'Confirm Order (Pay at Shop)'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentPage