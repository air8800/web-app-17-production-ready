import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getJobStatus, updatePaymentStatus, getShopInfo, formatCurrency } from '../utils/supabase'
import { createOrder, checkStatus } from '../services/paymentService'
import { usePageTitle } from '../hooks/usePageTitle'
import { Smartphone, QrCode, CreditCard, ChevronRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

const PaymentPage = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [shop, setShop] = useState(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Payment State
  const [paymentLink, setPaymentLink] = useState(null)
  const [qrCodeUrl, setQrCodeUrl] = useState(null)
  const [intentLinks, setIntentLinks] = useState({})

  usePageTitle('Payment')

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

      await initiateUPIGateway(jobData)

    } catch (error) {
      console.error('❌ Error loading job details:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const initiateUPIGateway = async (jobData) => {
    try {
      const txnId = `TXN_${Date.now()}`
      const response = await createOrder({
        amount: jobData.total_cost.toFixed(2),
        client_txn_id: txnId,
        customer_name: 'Customer',
        customer_email: 'test@example.com',
        customer_mobile: '9999999999',
        redirect_url: 'https://google.com',
        p_info: `Print Job: ${jobData.filename}`
      })

      console.log('UPIGateway Resp:', response)

      if (response.status === true || response.status === 'success') {
        const data = response.data || {}

        // 1. Find the MASTER 'upi://' deep link
        let masterLink = null;

        if (data.upi_intent) {
          if (typeof data.upi_intent === 'string' && data.upi_intent.startsWith('upi://')) {
            masterLink = data.upi_intent;
          } else if (typeof data.upi_intent === 'object') {
            masterLink = data.upi_intent.bhim_link ||
              data.upi_intent.upi_link ||
              Object.values(data.upi_intent).find(v => typeof v === 'string' && v.startsWith('upi://'));
          }
        }

        if (!masterLink && data.payee_vpa) {
          const params = new URLSearchParams({
            pa: data.payee_vpa,
            pn: data.payee_name || 'Merchant',
            am: jobData.total_cost.toFixed(2),
            tr: txnId,
            tn: `Print Job ${jobData.filename}`,
            cu: 'INR'
          })
          masterLink = `upi://pay?${params.toString()}`
        }

        // 2. Derive App-Specific Links from Master Link using NATIVE INTENT URIS
        let newIntentLinks = {};
        if (masterLink) {
          const payload = masterLink.replace('upi://', '');

          newIntentLinks = {
            gpay_link: `intent://${payload}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`,
            phonepe_link: `intent://${payload}#Intent;scheme=upi;package=com.phonepe.app;end`,
            paytm_link: `intent://${payload}#Intent;scheme=upi;package=net.one97.paytm;end`,
            bhim_link: `intent://${payload}#Intent;scheme=upi;end`
          };

          console.log('Derived App Links:', newIntentLinks);
          setIntentLinks(newIntentLinks);
          setPaymentLink(masterLink);
        } else {
          const webLink = data.upi_url || data.payment_url;
          console.log('Falling back to Web Link (No UPI deep link found):', webLink);
          setPaymentLink(webLink);
        }

        // 3. QR Code Generation
        const qrTarget = masterLink || data.payment_url || data.upi_url;
        let qr = data.qr_code;

        if (!qr && qrTarget) {
          console.log('Generating QR for:', qrTarget);
          qr = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrTarget)}`;
        }
        setQrCodeUrl(qr);

        startStatusPolling(txnId)
      } else {
        throw new Error(response.msg || 'FAILED_TO_INIT_UPI')
      }
    } catch (err) {
      console.error('UPI Init Error:', err)
      setError(`Payment Init Failed: ${err.message}`)
    }
  }

  const startStatusPolling = (txnId) => {
    const today = new Date().toISOString().split('T')[0]
    const interval = setInterval(async () => {
      const statusRes = await checkStatus(txnId, today)
      if (statusRes.status && statusRes.data.status === 'success') {
        clearInterval(interval)
        // Check dynamic state to prevent capturing old closure
        setJob((currentJob) => {
          if (currentJob) {
            updatePaymentStatus(currentJob.id, 'paid')
          }
          return currentJob
        })
        setPaymentConfirmed(true)
        setTimeout(() => {
          navigate(`/status/${jobId}`)
        }, 3000)
      }
    }, 5000)

    return () => clearInterval(interval)
  }

  const handlePaymentSuccess = async () => {
    await updatePaymentStatus(jobId, 'paid')
    setPaymentConfirmed(true)
    setTimeout(() => {
      navigate(`/status/${jobId}`)
    }, 3000)
  }



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Initializing Secure Payment...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl shadow-xl border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-900 mb-2">Payment Setup Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full">Try Again</button>
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
          <p className="text-gray-600 mb-6">Thank you. Your order is being processed.</p>
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
            <p className="text-blue-100 text-sm opacity-80">Order #{jobId}</p>
          </div>

          <div className="p-6">
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-slate-900">Order Summary</h2>
                <span className="text-xs font-black bg-blue-100 text-blue-600 px-2 py-1 rounded-md">UPI</span>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Item</span>
                  <span className="font-medium text-slate-800 truncate ml-4">{job?.filename}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-900">Total Amount</span>
                  <span className="text-xl font-black text-blue-600">₹{job?.total_cost?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Mobile View: Manual QR Code Fallback */}
              <div className="sm:hidden">
                <div className="bg-white border-2 border-blue-100 rounded-3xl p-6 text-center shadow-lg mb-6">
                  <p className="text-sm font-bold text-slate-900 mb-4">Pay via UPI App</p>

                  {/* QR Display for Mobile Fallback */}
                  <div className="bg-slate-50 p-4 rounded-2xl flex justify-center border border-slate-200 mb-6">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48 mix-blend-multiply" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-slate-300">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-300"></div>
                      </div>
                    )}
                  </div>

                  {/* Instructions - The Manual Fallback */}
                  <div className="text-left bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      Fallback Method
                    </p>
                    <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside marker:font-bold marker:text-blue-600">
                      <li>Take a <span className="font-bold">Screenshot</span> of the QR above.</li>
                      <li>Open <span className="font-bold">PhonePe / GPay / Paytm</span>.</li>
                      <li>Select the <span className="font-bold">"Scan Gallery"</span> icon.</li>
                      <li>Select the screenshot to pay.</li>
                    </ol>
                  </div>
                </div>

                {/* Fallback: Copy VPA */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
                  <p className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Copy VPA
                  </p>

                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="overflow-hidden text-left">
                      <p className="text-[10px] text-slate-400 uppercase font-black">Transfer to UPI ID</p>
                      <p className="font-mono text-sm font-bold text-slate-700 truncate">{
                        (paymentLink && new URL(paymentLink).searchParams.get('pa')) ||
                        (job && job.payee_vpa) ||
                        'Unavailable'
                      }</p>
                    </div>
                    <button
                      onClick={() => {
                        const vpa = (paymentLink && new URL(paymentLink).searchParams.get('pa'));
                        if (vpa) navigator.clipboard.writeText(vpa);
                      }}
                      className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-blue-600 active:bg-blue-50"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop QR Code Option (Hidden on Mobile now as it's moved up) */}
              <div className="hidden sm:block bg-white border-2 border-slate-100 rounded-2xl p-6 text-center">
                <QrCode className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-900 mb-4">Scan QR Code</p>

                <div className="bg-slate-50 p-4 rounded-2xl inline-block border border-slate-200 shadow-inner mb-4">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48 mix-blend-multiply" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-300">
                      <Clock className="w-10 h-10 animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Waiting for payment...
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-4">Secured by UPIGateway</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default PaymentPage