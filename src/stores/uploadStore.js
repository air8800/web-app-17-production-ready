import { create } from 'zustand'
import { uploadFileChunked, updatePrintJob, updatePaymentStatus } from '../utils/supabase'

/**
 * Global Upload Store
 * Bridges the upload running in OrderPage to the StatusPage so both can read progress.
 * 
 * CRITICAL: The actual TUS upload runs INSIDE this store (not in any React component)
 * so that it survives route navigation (OrderPage → StatusPage).
 * Zustand stores are global singletons — they persist across component unmounts.
 */
const useUploadStore = create((set, get) => ({
  // The job ID being uploaded right now
  activeJobId: null,
  // A job that was created in the DB but is waiting for the upload to finish
  // so the file_url can be set. Set at submit time.
  pendingJobId: null,
  // Upload progress 0-100
  progress: 0,
  // 'idle' | 'uploading' | 'done' | 'error'
  status: 'idle',
  // Error message if status === 'error'
  errorMessage: null,
  // The live TUS upload instance (so we can abort if needed)
  _tusUpload: null,
  // Promise that resolves when the current upload finishes (for callers that want to await)
  _uploadPromise: null,

  // Called when upload starts
  startUpload: (jobId) => set({
    activeJobId: jobId,
    progress: 0,
    status: 'uploading',
    errorMessage: null,
  }),

  // Called on each chunk progress callback
  setProgress: (progress) => set({ progress }),

  // Called when submit happens — stores the DB job ID so the upload
  // completion handler can update file_url in the DB
  setPendingJobId: (jobId) => set({ pendingJobId: jobId }),

  // Called when upload finishes successfully
  finishUpload: () => set({
    status: 'done',
    progress: 100,
    pendingJobId: null,
    _tusUpload: null,
    _uploadPromise: null,
  }),

  // Called on upload error
  setError: (message) => set({
    status: 'error',
    errorMessage: message,
    _tusUpload: null,
    _uploadPromise: null,
  }),

  // Called to reset (e.g. when user starts a new order)
  reset: () => {
    // Abort any running TUS upload
    const { _tusUpload } = get()
    if (_tusUpload) {
      try { _tusUpload.abort() } catch (_) {}
    }
    set({
      activeJobId: null,
      pendingJobId: null,
      progress: 0,
      status: 'idle',
      errorMessage: null,
      _tusUpload: null,
      _uploadPromise: null,
    })
  },

  // Utility: read current pendingJobId without subscribing
  getPendingJobId: () => get().pendingJobId,

  /**
   * Run a TUS upload inside the store so it survives React component unmounts.
   * 
   * @param {File|Blob} file - The file to upload
   * @param {string} shopId - The shop ID (used for storage path)
   * @param {string} jobId - The DB job ID (set as activeJobId)
   * @param {object} options
   * @param {string} [options.customFileName] - Custom storage path (for resume)
   * @param {function} [options.onLocalProgress] - Extra progress callback for the calling component (optional, may be dead after unmount — that's fine)
   * @param {function} [options.getUploadRef] - Callback to receive the TUS upload instance
   * @returns {Promise<{publicUrl: string}|null>} Resolves with publicUrl when done, or null on error.
   */
  runUpload: (file, shopId, jobId, options = {}) => {
    const { customFileName, onLocalProgress, getUploadRef } = options

    // Abort any previous upload
    const { _tusUpload } = get()
    if (_tusUpload) {
      try { _tusUpload.abort() } catch (_) {}
    }

    set({
      activeJobId: jobId,
      progress: 0,
      status: 'uploading',
      errorMessage: null,
    })

    const promise = new Promise((resolve) => {
      uploadFileChunked(
        file,
        shopId,
        // onProgress — update store + optional local callback
        (_bytes, _total, percentage) => {
          const pct = parseFloat(percentage)
          set({ progress: pct })
          // Persist to localStorage so StatusPage can show last known % after refresh
          if (jobId) {
            localStorage.setItem(`printget_upload_progress_${jobId}`, pct.toString())
          }
          // Best-effort call to the component-level callback (may be dead after unmount)
          try { onLocalProgress?.(_bytes, _total, percentage) } catch (_) {}
        },
        // getUploadRef — store the TUS instance in the store
        (tusUpload) => {
          set({ _tusUpload: tusUpload })
          try { getUploadRef?.(tusUpload) } catch (_) {}
        },
        customFileName
      )
        .then(async (uploadResult) => {
          if (uploadResult.error) {
            set({ status: 'error', errorMessage: uploadResult.error.message || 'Upload failed', _tusUpload: null, _uploadPromise: null })
            resolve(null)
            return
          }

          const publicUrl = uploadResult.data.publicUrl

          // Read pendingJobId BEFORE finishing (finishUpload nulls it)
          const pendingJobId = get().pendingJobId

          set({
            status: 'done',
            progress: 100,
            pendingJobId: null,
            _tusUpload: null,
            _uploadPromise: null,
          })

          // If a DB job was created before upload finished, update it now
          if (pendingJobId) {
            try {
              await updatePrintJob(pendingJobId, { file_url: publicUrl, job_status: 'pending' })
              await updatePaymentStatus(pendingJobId, 'paid')
              console.log('✅ [UploadStore] DB job updated with file_url:', pendingJobId)
            } catch (e) {
              console.error('❌ [UploadStore] Failed to update DB job:', e)
            }
            localStorage.removeItem(`printget_upload_progress_${pendingJobId}`)
            localStorage.removeItem(`printget_upload_name_${pendingJobId}`)
          }

          localStorage.removeItem('printget_active_upload_name')
          localStorage.removeItem('printget_active_upload_progress')

          resolve({ publicUrl })
        })
        .catch((error) => {
          if (error?.message?.includes('aborted')) {
            console.log('ℹ️ [UploadStore] Upload aborted')
            resolve(null)
            return
          }
          console.error('❌ [UploadStore] Upload error:', error)
          set({ status: 'error', errorMessage: error?.message || 'Upload failed', _tusUpload: null, _uploadPromise: null })

          // Mark DB job as error if submit already happened
          const pendingJobId = get().pendingJobId
          if (pendingJobId) {
            updatePrintJob(pendingJobId, { job_status: 'error' }).catch(() => {})
          }
          resolve(null)
        })
    })

    set({ _uploadPromise: promise })
    return promise
  },
}))

export default useUploadStore
