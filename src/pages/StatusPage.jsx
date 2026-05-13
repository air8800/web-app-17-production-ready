import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getJobStatus, getShopInfo, subscribeToJobUpdates, startJobStatusPolling, formatCurrency, updatePrintJob, updatePaymentStatus } from '../utils/supabase'
import { Mail, Upload, AlertCircle, RefreshCw, X, CheckCircle2, Store, Printer, Package, CreditCard, Clock, ArrowLeft, FileText, Hash, Palette, Copy as CopyIcon, User, Wifi, WifiOff, PartyPopper, HandCoins, Home } from 'lucide-react'
import useUploadStore from '../stores/uploadStore'

import { usePageTitle } from '../hooks/usePageTitle'
import InstallButton from '../components/InstallButton'

const StatusPage = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  // Upload store — live progress while upload is running
  const { activeJobId, progress: uploadProgress, status: uploadStatus, runUpload, setError: setUploadError } = useUploadStore()
  const isThisJobUploading = activeJobId === jobId && uploadStatus === 'uploading'
  const isUploadDone = activeJobId === jobId && uploadStatus === 'done'
  const isUploadError = activeJobId === jobId && uploadStatus === 'error'

  // Last known progress — survives page refresh
  const lastKnownProgress = parseFloat(localStorage.getItem(`printget_upload_progress_${jobId}`) || '0')
  // Interrupted: server still thinks upload is in progress, but no upload is running in this tab
  const isInterrupted = job && job.file_url === '__uploading__' && !isThisJobUploading && !isUploadDone && !isUploadError

  // Email notification state
  const [notifEmail, setNotifEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState('')

  // Resume upload state
  const [isResuming, setIsResuming] = useState(false)
  const [resumeError, setResumeError] = useState(null)

  usePageTitle('Order Status')

  // Auto-fill email from local storage
  useEffect(() => {
    const savedEmail = localStorage.getItem('printget_user_email')
    if (savedEmail && !notifEmail) {
      setNotifEmail(savedEmail)
    }
  }, [])

  // Persist live upload progress to localStorage so a refresh mid-upload keeps the %
  useEffect(() => {
    if (isThisJobUploading && uploadProgress > 0) {
      localStorage.setItem(`printget_upload_progress_${jobId}`, uploadProgress.toString())
    }
  }, [isThisJobUploading, uploadProgress, jobId])

  // Warn user if they try to refresh/close tab while upload is running
  useEffect(() => {
    if (!isThisJobUploading) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isThisJobUploading])

  useEffect(() => {
    loadJobStatus()

    // Set up real-time subscription
    
    const subscription = subscribeToJobUpdates(jobId, (updatedJob) => {
      
      setJob(updatedJob)
      setLastUpdated(new Date())
      setConnectionStatus('connected')
    })

    // Set up polling as backup (every 30 seconds)
    const stopPolling = startJobStatusPolling(jobId, (updatedJob) => {
      
      setJob(prevJob => {
        if (!prevJob || prevJob.updated_at !== updatedJob.updated_at) {
          setLastUpdated(new Date())
          return updatedJob
        }
        return prevJob
      })
    }, 30000)

    return () => {
      
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
    
    loadJobStatus()
  }

  const handleDismissTracking = () => {
    localStorage.removeItem('printget_recent_order')
    navigate('/')
  }

  const normalizeStatus = (status) => String(status || '').trim().toLowerCase()
  const isCancelledStatus = (status) => normalizeStatus(status).includes('cancel')

  // Resume an interrupted upload — user re-selects the same file
  const handleResumeUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate: must be the same file
    if (file.name !== job.filename) {
      setResumeError(`Incorrect file. Please select "${job.filename}" (you selected "${file.name}")`)
      e.target.value = ''
      return
    }

    setResumeError(null)
    setIsResuming(true)

    try {
      const resumeFileName = localStorage.getItem(`printget_upload_name_${jobId}`)

      // Use the store's runUpload so it survives navigation
      // Set pendingJobId so the completion handler updates the DB
      useUploadStore.setState({ pendingJobId: jobId })

      const result = await runUpload(file, job.shop_id, jobId, {
        customFileName: resumeFileName,
      })

      if (!result?.publicUrl) {
        // Error already set by the store
        return
      }

      // Clean up persistence
      localStorage.removeItem(`printget_upload_progress_${jobId}`)
      localStorage.removeItem(`printget_upload_name_${jobId}`)

      // Reload to show success
      loadJobStatus()
    } catch (err) {
      setUploadError(err.message || 'Failed to resume upload')
    } finally {
      setIsResuming(false)
    }
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
      localStorage.setItem('printget_user_email', notifEmail.trim())
    } catch (err) {
      setEmailError('Something went wrong. Please try again.')
    } finally {
      setEmailSaving(false)
    }
  }

  const getStatusColor = (status) => {
    const normalized = normalizeStatus(status)
    if (normalized.includes('cancel')) return 'text-red-600 bg-red-100'
    switch (normalized) {
      case 'uploading': return 'text-orange-600 bg-orange-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'printing': return 'text-blue-600 bg-blue-100'
      case 'completed': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status) => {
    const normalized = normalizeStatus(status)
    if (normalized.includes('cancel')) return <X className="w-6 h-6 text-red-600" />
    switch (normalized) {
      case 'uploading': return <Upload className="w-6 h-6 text-blue-600" />
      case 'pending': return <Clock className="w-6 h-6 text-amber-600" />
      case 'printing': return <Printer className="w-6 h-6 text-indigo-600" />
      case 'completed': return <CheckCircle2 className="w-6 h-6 text-green-600" />
      default: return <FileText className="w-6 h-6 text-gray-600" />
    }
  }

  const getStatusText = (status) => {
    const normalized = normalizeStatus(status)
    if (normalized.includes('cancel')) return 'Cancelled'
    switch (normalized) {
      case 'uploading': return 'Uploading'
      case 'pending': return 'Pending'
      case 'printing': return 'Printing'
      case 'completed': return 'Completed'
      default: return 'Unknown'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-700 font-medium">Loading your order…</p>
          <p className="text-sm text-gray-400 mt-1">Just a moment</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-3xl shadow-xl border border-red-100">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Couldn't load status</h1>
          <p className="text-gray-600 mb-6 text-sm">{error}</p>
          <button
            onClick={loadJobStatus}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-3xl shadow-xl border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-600 text-sm mb-6">We couldn't find the order you're looking for.</p>
          <Link to="/" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-md">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  const statusForDisplay = (isInterrupted || isUploadError) ? 'cancelled' : job.job_status
  const normalizedJobStatus = normalizeStatus(statusForDisplay)
  const isCancelled = isCancelledStatus(statusForDisplay)
  const isCompleted = normalizedJobStatus === 'completed'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/60 via-white to-indigo-50/40">
      <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8">

        {/* Top Actions */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
          <InstallButton fullOnMobile />
        </div>

        {/* Top Summary Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 mb-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                {React.cloneElement(getStatusIcon(statusForDisplay), {
                  className: `w-6 h-6 ${getStatusIcon(statusForDisplay).props.className.split(' ').slice(2).join(' ')}`
                })}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Order Status</p>
                  {shop && <span className="w-1 h-1 rounded-full bg-gray-300" />}
                  {shop && <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 truncate">{shop.name}</p>}
                </div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 leading-none">{getStatusText(statusForDisplay)}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {shop?.address && <span className="truncate max-w-[180px] sm:max-w-xs">{shop.address}</span>}
                </div>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              className="flex-shrink-0 w-10 h-10 rounded-xl border border-gray-100 bg-white text-gray-400 shadow-sm hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4 mx-auto" />
            </button>
          </div>

          <button
            onClick={handleDismissTracking}
            disabled={!isCompleted}
            className={`mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
              isCompleted
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-200'
                : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Got my prints!
          </button>
        </div>

        {/* Upload Warning Banner */}
        {isThisJobUploading && (
          <div className="mb-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/70 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900">Uploading — keep this tab open</p>
                <div className="text-xs text-amber-800 mt-2 space-y-1">
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" /> You can use other browser tabs.</p>
                  <p className="flex items-center gap-1.5"><X className="w-3 h-3 text-red-500 flex-shrink-0" /> Don't refresh or close this tab.</p>
                  <p className="flex items-center gap-1.5"><X className="w-3 h-3 text-red-500 flex-shrink-0" /> Don't close the browser.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resume Upload Section */}
        {isInterrupted && (
          <div className="relative bg-gradient-to-br from-red-50 via-rose-50 to-orange-50 border-2 border-red-200/60 rounded-3xl p-5 sm:p-6 mb-5 shadow-sm overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-red-200/30 rounded-full blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-red-500/30">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-red-900 font-bold text-lg">Upload Incomplete</h3>

                {job.has_edits || job.filename === 'images.pdf' || job.filename?.includes('_images.pdf') ? (
                  <>
                    <p className="text-red-700 text-sm mt-1 leading-relaxed">
                      Because this order contained edits or multiple images, it cannot be resumed after a page refresh. Please create a new order.
                    </p>
                    <button
                      onClick={() => navigate(`/shop/${job.shop_id}`)}
                      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-br from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 active:scale-95 transition-all shadow-md shadow-red-500/25"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Restart Order
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-red-700 text-sm mt-1 leading-relaxed">
                      Your upload was interrupted. You can resume it by selecting the exact same file:
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2 bg-white/70 border border-red-200 px-3 py-1.5 rounded-lg max-w-full">
                      <FileText className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                      <span className="font-semibold text-red-900 text-xs truncate">{job.filename}</span>
                    </div>

                    <div className="mt-4">
                      <input
                        type="file"
                        onChange={handleResumeUpload}
                        className="hidden"
                        id="resume-upload"
                        disabled={isResuming}
                      />
                      <label
                        htmlFor="resume-upload"
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all shadow-md ${
                          isResuming
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-br from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 active:scale-95 shadow-red-500/25'
                        }`}
                      >
                        {isResuming ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Resuming…
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Select Original File
                          </>
                        )}
                      </label>
                    </div>

                    {resumeError && (
                      <div className="mt-3 flex items-center gap-2 p-3 bg-red-100/70 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{resumeError}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Timeline Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-6 mb-5">
          <h2 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-600 rounded-full" />
            Progress Timeline
          </h2>

          <div className="relative">
            {/* Upload step */}
            {(isThisJobUploading || isUploadError || isInterrupted) && (
              <div className="relative flex gap-4 pb-6">
                <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />
                <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white shadow-md ${
                  isUploadError || isInterrupted
                    ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white'
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                }`}>
                  {isUploadError || isInterrupted ? <X className="w-4 h-4" /> : (
                    <>
                      <Upload className="w-4 h-4" />
                      {isThisJobUploading && <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping" />}
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className={`text-sm font-bold ${isUploadError || isInterrupted ? 'text-red-700' : 'text-blue-700'}`}>
                    {isInterrupted ? 'Upload Interrupted' : isUploadError ? 'Upload Failed' : 'Sending your file'}
                  </p>
                  <p className={`text-xs mt-0.5 ${isUploadError || isInterrupted ? 'text-red-500' : 'text-gray-500'}`}>
                    {isUploadError ? 'Upload failed. Please try again.'
                      : isInterrupted ? `Failed at ${Math.round(lastKnownProgress)}%. Please resume below.`
                      : `${Math.round(uploadProgress)}% uploaded`}
                  </p>
                  {(isThisJobUploading || isInterrupted) && (
                    <div className="mt-2.5 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                        style={{ width: `${isThisJobUploading ? uploadProgress : lastKnownProgress}%` }}
                      >
                        {isThisJobUploading && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Order Received */}
            <div className="relative flex gap-4 pb-6">
              <div className={`absolute left-5 top-10 bottom-0 w-0.5 ${(!isThisJobUploading && !isInterrupted && !isUploadError) ? 'bg-green-200' : 'bg-gray-200'}`} />
              <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white shadow-md ${
                (!isThisJobUploading && !isInterrupted && !isUploadError)
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
              }`}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className={`text-sm font-bold ${(!isThisJobUploading && !isInterrupted && !isUploadError) ? 'text-gray-900' : 'text-gray-400'}`}>Order Received</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(isThisJobUploading || isInterrupted || isUploadError) ? 'Waiting for upload to finish' : 'Your order has been received'}
                </p>
                {(!isThisJobUploading && !isInterrupted && !isUploadError) && (
                  <p className="text-[11px] text-gray-400 mt-1">{new Date(job.created_at).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Payment */}
            <div className="relative flex gap-4 pb-6">
              <div className={`absolute left-5 top-10 bottom-0 w-0.5 ${job.payment_status === 'paid' && !isThisJobUploading && !isInterrupted && !isUploadError ? 'bg-green-200' : 'bg-gray-200'}`} />
              <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white shadow-md ${
                job.payment_status === 'paid' && !isThisJobUploading && !isInterrupted && !isUploadError
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
              }`}>
                {job.payment_status === 'paid' && !isThisJobUploading && !isInterrupted && !isUploadError ? <CheckCircle2 className="w-5 h-5" /> : <HandCoins className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className={`text-sm font-bold ${job.payment_status === 'paid' && !isThisJobUploading && !isInterrupted && !isUploadError ? 'text-gray-900' : 'text-gray-400'}`}>Payment Method</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(isThisJobUploading || isInterrupted || isUploadError)
                    ? 'Pending — upload in progress'
                    : (job.payment_status === 'paid' ? 'Pay at Shop (on pickup)' : 'Pending Confirmation')}
                </p>
                {job.payment_status === 'paid' && !isThisJobUploading && !isInterrupted && !isUploadError && (
                  <p className="text-[11px] text-gray-400 mt-1">{new Date(job.updated_at).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Printing */}
            <div className="relative flex gap-4 pb-6">
              <div className={`absolute left-5 top-10 bottom-0 w-0.5 ${isCompleted ? 'bg-green-200' : 'bg-gray-200'}`} />
              <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white shadow-md ${
                isCompleted ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                  : normalizedJobStatus === 'printing' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
              }`}>
                {normalizedJobStatus === 'printing' && <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping" />}
                <Printer className="w-4 h-4 relative" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className={`text-sm font-bold ${normalizedJobStatus === 'printing' ? 'text-blue-700' : isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>Printing</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {normalizedJobStatus === 'printing' ? 'Currently printing…' :
                    isCompleted ? 'Printing completed' : 'Waiting to print'}
                </p>
                {normalizedJobStatus === 'printing' && job.estimated_completion && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Est: {new Date(job.estimated_completion).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Pickup */}
            <div className="relative flex gap-4">
              <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white shadow-md ${
                isCompleted ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
              }`}>
                {isCompleted ? <PartyPopper className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className={`text-sm font-bold ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>Ready for Pickup</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isCompleted ? 'Ready for pickup!' : 'Will be ready soon'}
                </p>
                {isCompleted && (
                  <p className="text-[11px] text-gray-400 mt-1">{new Date(job.updated_at).toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Email Notification Card */}
        {job && !job.customer_email && !isCompleted && !isCancelled && (
          <div className="mb-5">
            {emailSaved ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/70 rounded-3xl p-5 flex items-start gap-4 shadow-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-green-500/25">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-green-900 text-base">You're all set!</p>
                  <p className="text-green-700 text-sm mt-1 leading-relaxed">
                    We'll email your receipt to <span className="font-bold underline text-green-800 break-all">{notifEmail}</span> and alert you the moment your prints are ready.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 border border-blue-200/60 rounded-3xl p-5 sm:p-6 shadow-sm overflow-hidden">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-blue-200/30 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/25 flex-shrink-0">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm mb-1">
                        Recommended
                      </div>
                      <h4 className="font-extrabold text-blue-900 text-base sm:text-lg leading-tight">Get Live Updates & Receipt</h4>
                    </div>
                  </div>

                  <p className="text-blue-700 text-sm leading-relaxed mb-4">
                    Receive your <span className="font-bold text-blue-900">Order Receipt</span>, <span className="font-bold text-blue-900">Order ID</span>, and an <span className="font-bold text-blue-900">Instant Alert</span> when your prints are ready.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="email"
                      value={notifEmail}
                      onChange={(e) => { setNotifEmail(e.target.value); setEmailError('') }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEmail()}
                      placeholder="your@email.com"
                      className="w-full sm:flex-1 text-sm px-4 py-3 border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-blue-300"
                    />
                    <button
                      onClick={handleSaveEmail}
                      disabled={emailSaving}
                      className="w-full sm:w-auto px-5 py-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0 shadow-md shadow-blue-500/25"
                    >
                      {emailSaving ? 'Saving…' : 'Notify Me'}
                    </button>
                  </div>
                  {emailError && (
                    <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {emailError}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Order Details Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-600 rounded-full" />
            Order Details
          </h3>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50">
              <div className="flex items-center gap-2 text-gray-500 text-xs flex-shrink-0">
                <Hash className="w-3.5 h-3.5" />
                Order ID
              </div>
              <span className="font-mono text-xs text-gray-900 bg-gray-50 px-2 py-1 rounded-md truncate">{job.id.slice(0, 8)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50">
              <div className="flex items-center gap-2 text-gray-500 text-xs flex-shrink-0">
                <FileText className="w-3.5 h-3.5" />
                File
              </div>
              <span className="text-sm text-gray-900 font-medium truncate text-right max-w-[220px] sm:max-w-sm" title={job.filename}>{job.filename}</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50">
              <div className="flex items-center gap-2 text-gray-500 text-xs flex-shrink-0">
                <CopyIcon className="w-3.5 h-3.5" />
                Copies
              </div>
              <span className="text-sm text-gray-900 font-semibold">{job.copies}</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50">
              <div className="flex items-center gap-2 text-gray-500 text-xs flex-shrink-0">
                <Palette className="w-3.5 h-3.5" />
                Specifications
              </div>
              <span className="text-sm text-gray-900 text-right truncate max-w-[180px] sm:max-w-none">{job.paper_size} · {job.color_mode} · {job.print_type}</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50">
              <div className="flex items-center gap-2 text-gray-500 text-xs flex-shrink-0">
                <User className="w-3.5 h-3.5" />
                Customer
              </div>
              <span className="text-sm text-gray-900 font-medium truncate max-w-[180px] sm:max-w-none">{job.customer_name}</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50">
              <div className="flex items-center gap-2 text-gray-500 text-xs flex-shrink-0">
                <HandCoins className="w-3.5 h-3.5" />
                Payment
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                job.payment_status === 'paid'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {job.payment_status === 'paid' ? 'Pay at Shop' : 'Pending'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 mt-1">
              <div className="flex items-center gap-2 text-gray-900 text-sm font-bold flex-shrink-0">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Total Cost
              </div>
              <span className="text-xl font-extrabold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {formatCurrency(job.total_cost)}
              </span>
            </div>
          </div>
        </div>

        {/* Back to Shop */}
        <div className="text-center pb-4">
          <Link
            to={`/shop/${job.shop_id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Shop
          </Link>
        </div>

      </div>
    </div>
  )
}

export default StatusPage
