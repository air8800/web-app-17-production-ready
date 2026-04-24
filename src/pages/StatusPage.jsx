import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getJobStatus, getShopInfo, subscribeToJobUpdates, startJobStatusPolling, formatCurrency, updatePrintJob } from '../utils/supabase'
import { Mail } from 'lucide-react'

import { usePageTitle } from '../hooks/usePageTitle'

const StatusPage = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  // Email notification state
  const [notifEmail, setNotifEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState('')

  usePageTitle('Order Status')

  useEffect(() => {
    loadJobStatus()

    // Set up real-time subscription
    console.log('🔄 Setting up real-time updates for job:', jobId)
    const subscription = subscribeToJobUpdates(jobId, (updatedJob) => {
      console.log('🔄 Real-time job update received:', updatedJob)
      setJob(updatedJob)
      setLastUpdated(new Date())
      setConnectionStatus('connected')
    })

    // Set up polling as backup (every 30 seconds)
    const stopPolling = startJobStatusPolling(jobId, (updatedJob) => {
      console.log('🔄 Polling update received:', updatedJob)
      setJob(prevJob => {
        // Only update if the job actually changed
        if (!prevJob || prevJob.updated_at !== updatedJob.updated_at) {
          setLastUpdated(new Date())
          return updatedJob
        }
        return prevJob
      })
    }, 30000)

    return () => {
      console.log('🔄 Cleaning up subscriptions and polling')
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe()
      }
      stopPolling()
    }
  }, [jobId])

  const loadJobStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: jobData, error: jobError } = await getJobStatus(jobId)

      if (jobError) {
        throw new Error('Failed to load order status: ' + jobError.message)
      }

      if (!jobData) {
        throw new Error('Order not found')
      }

      setJob(jobData)
      setLastUpdated(new Date())

      // Load shop info
      const { data: shopData } = await getShopInfo(jobData.shop_id)
      if (shopData) {
        setShop(shopData)
      }

    } catch (error) {
      console.error('❌ Error loading job status:', error)
      setError(error.message)
      setConnectionStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    console.log('🔄 Manual refresh requested')
    loadJobStatus()
  }

  const handleDismissTracking = () => {
    localStorage.removeItem('printget_recent_order')
    navigate('/')
  }

  const handleSaveEmail = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!notifEmail.trim()) {
      setEmailError('Please enter your email address.')
      return
    }
    if (!emailRegex.test(notifEmail.trim())) {
      setEmailError('Please enter a valid email address.')
      return
    }
    setEmailError('')
    setEmailSaving(true)
    try {
      await updatePrintJob(job.id, { customer_email: notifEmail.trim() })
      setEmailSaved(true)
    } catch (err) {
      setEmailError('Something went wrong. Please try again.')
    } finally {
      setEmailSaving(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'printing': return 'text-blue-600 bg-blue-100'
      case 'completed': return 'text-green-600 bg-green-100'
      case 'cancelled': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'printing': return '🖨️'
      case 'completed': return '✅'
      case 'cancelled': return '❌'
      default: return '📄'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'printing': return 'Printing'
      case 'completed': return 'Completed'
      case 'cancelled': return 'Cancelled'
      default: return 'Unknown'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Status</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadJobStatus}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Order Not Found</h1>
          <p className="text-gray-600">The order you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8">
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          {/* Header with refresh button */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h1 className="text-xl sm:text-2xl font-bold">Order Status</h1>
              <button
                onClick={handleRefresh}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                Refresh
              </button>
            </div>
            
            <div className="flex justify-start">
              <button
                onClick={handleDismissTracking}
                disabled={job.job_status !== 'completed'}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors border ${
                  job.job_status === 'completed' 
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-sm' 
                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-75'
                }`}
              >
                Got my prints!
              </button>
            </div>
          </div>

          {/* Last updated info */}
          <div className="text-xs text-gray-500 mb-6">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>

          {/* Shop Info */}
          {shop && (
            <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b">
              <h2 className="text-sm sm:text-base font-semibold mb-2">Shop Information</h2>
              <p className="font-medium">{shop.name}</p>
              <p className="text-sm text-gray-600">{shop.address}</p>
              <p className="text-sm text-gray-600">{shop.phone}</p>
            </div>
          )}

          {/* Status Timeline */}
          <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            <div className="flex items-center">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3 sm:mr-4 text-sm sm:text-base">
                ✓
              </div>
              <div>
                <p className="text-sm sm:text-base font-medium">Order Received</p>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Your order has been received</p>
                <p className="text-xs text-gray-400">{new Date(job.created_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${job.payment_status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}>
                {job.payment_status === 'paid' ? '✓' : '💳'}
              </div>
              <div>
                <p className="font-medium">Payment Method</p>
                <p className="text-sm text-gray-500">
                  {job.payment_status === 'paid' ? 'Cash on Delivery (Pay at Shop)' : 'Pending Confirmation'}
                </p>
                {job.payment_status === 'paid' && (
                  <p className="text-xs text-gray-400">{new Date(job.updated_at).toLocaleString()}</p>
                )}
              </div>
            </div>

            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${job.job_status === 'printing' || job.job_status === 'completed'
                  ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                }`}>
                {job.job_status === 'printing' || job.job_status === 'completed' ? '🖨️' : '⏳'}
              </div>
              <div>
                <p className="font-medium">Printing</p>
                <p className="text-sm text-gray-500">
                  {job.job_status === 'printing' ? 'Currently printing...' :
                    job.job_status === 'completed' ? 'Printing completed' : 'Waiting to print'}
                </p>
                {job.job_status === 'printing' && job.estimated_completion && (
                  <p className="text-xs text-gray-400">
                    Est. completion: {new Date(job.estimated_completion).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${job.job_status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}>
                {job.job_status === 'completed' ? '✅' : '📦'}
              </div>
              <div>
                <p className="font-medium">Ready for Pickup</p>
                <p className="text-sm text-gray-500">
                  {job.job_status === 'completed' ? 'Ready for pickup!' : 'Will be ready soon'}
                </p>
                {job.job_status === 'completed' && (
                  <p className="text-xs text-gray-400">{new Date(job.updated_at).toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>

          {/* Current Status */}
          <div className="border-t pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2">
              <span className="text-base sm:text-lg font-medium">Status:</span>
              <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(job.job_status)}`}>
                {getStatusIcon(job.job_status)} {getStatusText(job.job_status)}
              </span>
            </div>

            {job.job_status === 'completed' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 text-center animate-pulse-glow">
                <p className="text-green-800 font-medium text-base sm:text-lg">🎉 Ready for pickup!</p>
                <p className="text-green-600 text-xs sm:text-sm mt-1">Visit the shop to collect</p>
                {shop && (
                  <div className="mt-3 text-sm">
                    <p className="font-medium">{shop.name}</p>
                    <p>{shop.address}</p>
                    <p>{shop.phone}</p>
                  </div>
                )}
              </div>
            )}

            {job.job_status === 'printing' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-blue-800 font-medium">🖨️ Your order is being printed!</p>
                <p className="text-blue-600 text-sm mt-1">We'll update you when it's ready for pickup</p>
                {job.estimated_completion && (
                  <p className="text-blue-600 text-sm mt-2">
                    Estimated completion: {new Date(job.estimated_completion).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {job.job_status === 'pending' && job.payment_status === 'paid' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800 font-medium">⏳ Your order is in queue</p>
                <p className="text-yellow-600 text-sm mt-1">We'll start printing it soon</p>
              </div>
            )}

            {job.job_status === 'cancelled' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-800 font-medium">❌ Your order has been cancelled</p>
                <p className="text-red-600 text-sm mt-1">Please contact the shop for more information</p>
              </div>
            )}
          </div>

          {/* Email Notification Card - only show if no email saved yet and job is not completed */}
          {job && !job.customer_email && job.job_status !== 'completed' && job.job_status !== 'cancelled' && (
            <div className="border-t pt-4 sm:pt-6 mt-4 sm:mt-6">
              {emailSaved ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm animate-fadeIn">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Mail className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-extrabold text-green-800 text-base">You're all set! 🎉</p>
                    <p className="text-green-700 text-sm mt-1 leading-relaxed">
                      We'll email your <span className="font-bold">Receipt</span> and <span className="font-bold">Order ID</span> to <span className="font-bold underline text-green-800">{notifEmail}</span>, and alert you the second your prints are ready.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-blue-100 flex-shrink-0">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-extrabold text-blue-900 text-lg leading-tight">Get Live Updates & Receipt</h4>
                  </div>
                  
                  <div className="space-y-4 ml-0 sm:ml-[52px]">
                    <div>
                      <span className="inline-block bg-blue-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm mb-2.5">Recommended</span>
                      <p className="text-blue-700 text-sm leading-relaxed">
                        Receive your <span className="font-bold text-blue-900">Order Receipt</span>, <span className="font-bold text-blue-900">Order ID</span>, and an <span className="font-bold text-blue-900">Instant Alert</span> when your prints are ready.
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="email"
                        value={notifEmail}
                        onChange={(e) => { setNotifEmail(e.target.value); setEmailError('') }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEmail()}
                        placeholder="your@email.com"
                        className="w-full sm:flex-1 text-sm px-3 py-2 border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                      <button
                        onClick={handleSaveEmail}
                        disabled={emailSaving}
                        className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {emailSaving ? 'Saving...' : 'Notify Me'}
                      </button>
                    </div>
                    {emailError && (
                      <p className="text-red-500 text-xs mt-1">{emailError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Order Details */}
          <div className="border-t pt-4 sm:pt-6 mt-4 sm:mt-6">
            <h3 className="text-sm sm:text-base font-medium mb-3">Order Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 flex-shrink-0">Order ID:</span>
                <span className="font-mono text-gray-900 truncate">{job.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 flex-shrink-0">File:</span>
                <span className="text-gray-900 truncate text-right max-w-[200px] sm:max-w-none" title={job.filename}>{job.filename}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 flex-shrink-0">Copies:</span>
                <span className="text-gray-900">{job.copies}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 flex-shrink-0">Specifications:</span>
                <span className="text-gray-900 truncate text-right max-w-[150px] sm:max-w-none">{job.paper_size} {job.color_mode} {job.print_type}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 flex-shrink-0">Customer:</span>
                <span className="text-gray-900 truncate text-right max-w-[150px] sm:max-w-none">{job.customer_name}</span>
              </div>
              <div className="flex justify-between gap-4 font-medium pt-1">
                <span className="text-gray-900 flex-shrink-0">Total Cost:</span>
                <span className="text-gray-900">{formatCurrency(job.total_cost)}</span>
              </div>
              <div className="flex justify-between gap-4 pt-1">
                <span className="text-gray-500 flex-shrink-0">Payment Method:</span>
                <span className={`text-right ${job.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {job.payment_status === 'paid' ? 'Cash on Delivery' : 'Pending Confirmation'}
                </span>
              </div>
            </div>
          </div>

          {/* Back to Shop */}
          <div className="border-t pt-4 sm:pt-6 mt-4 sm:mt-6 text-center">
            <Link
              to={`/shop/${job.shop_id}`}
              className="text-blue-600 hover:underline"
            >
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatusPage