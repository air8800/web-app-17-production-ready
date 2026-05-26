import { createClient } from '@supabase/supabase-js'
import * as tus from 'tus-js-client'
import { enrichShopWithCoordinates } from './location'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

const projectId = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1]

export const supabaseStorageUrl = `https://${projectId}.storage.supabase.co`

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// ============================================================================
// FILENAME SANITIZATION
// ============================================================================

// Sanitize filename to avoid special characters that Supabase storage rejects
export const sanitizeFilename = (filename) => {
  // Extract extension
  const lastDotIndex = filename.lastIndexOf('.')
  const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename
  const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : ''

  // Replace spaces with dashes, remove special characters, keep only alphanumeric, dash, underscore
  const sanitized = name
    .replace(/\s+/g, '-')  // Replace spaces with dashes
    .replace(/[^a-zA-Z0-9_-]/g, '')  // Remove special characters
    .replace(/_{2,}/g, '_')  // Replace multiple underscores with single
    .replace(/-{2,}/g, '-')  // Replace multiple dashes with single
    .substring(0, 100)  // Limit length

  return sanitized + ext
}

// ============================================================================
// CONNECTION TEST AND DIAGNOSTICS
// ============================================================================

export const testConnection = async () => {
  try {
    
    
    

    // Test 1: Basic connection
    const { data: healthCheck, error: healthError } = await supabase
      .from('shops')
      .select('count')
      .limit(1)

    if (healthError) {
      console.error('❌ Health check failed:', healthError)
      return {
        success: false,
        error: `Health check failed: ${healthError.message}`,
        details: healthError
      }
    }

    

    // Test 2: Check if shops table exists and has data
    const { data: shopsData, error: shopsError } = await supabase
      .from('shops')
      .select('id, name, is_active')
      .limit(5)

    if (shopsError) {
      console.error('❌ Shops query failed:', shopsError)
      return {
        success: false,
        error: `Shops table error: ${shopsError.message}`,
        details: shopsError
      }
    }

    
    

    if (shopsData) {
      shopsData.forEach(shop => {
        
      })
    }

    // Test 3: Check RLS policies
    const { data: activeShops, error: rlsError } = await supabase
      .from('shops')
      .select('*')
      .eq('is_active', true)

    if (rlsError) {
      console.error('❌ RLS policy test failed:', rlsError)
      return {
        success: false,
        error: `RLS policy error: ${rlsError.message}`,
        details: rlsError
      }
    }

    
    

    return {
      success: true,
      shopsCount: activeShops?.length || 0,
      shops: activeShops
    }

  } catch (error) {
    console.error('❌ Connection test failed:', error)
    return {
      success: false,
      error: `Connection failed: ${error.message}`,
      details: error
    }
  }
}

// ============================================================================
// SHOP FUNCTIONS WITH ENHANCED ERROR HANDLING
// ============================================================================

export const getShopInfo = async (shopId) => {
  try {
    if (!shopId) {
      throw new Error('Shop ID is required')
    }

    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('❌ Error fetching shop:', error)
      throw new Error(`Failed to fetch shop: ${error.message}`)
    }

    if (!data) {
      console.warn('⚠️ Shop not found or inactive:', shopId)
      return { data: null, error: { message: 'Shop not found or inactive' } }
    }

    return { data: enrichShopWithCoordinates(data), error: null }

  } catch (error) {
    console.error('❌ Shop fetch error:', error)
    return { data: null, error: { message: error.message } }
  }
}

export const getAllActiveShops = async () => {
  try {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching shops:', error)
      throw new Error(`Failed to fetch shops: ${error.message}`)
    }

    return { data: (data || []).map(enrichShopWithCoordinates), error: null }

  } catch (error) {
    console.error('❌ Shops fetch error:', error)
    return { data: [], error: { message: error.message } }
  }
}

// ============================================================================
// PRICING FUNCTIONS
// ============================================================================

export const getShopPricing = async (shopId) => {
  try {
    if (!shopId) {
      throw new Error('Shop ID is required')
    }

    const { data, error } = await supabase
      .from('cost_configs')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)

    if (error) {
      console.error('❌ Error fetching pricing:', error)
      throw new Error(`Failed to fetch pricing: ${error.message}`)
    }

    return { data: data || [], error: null }

  } catch (error) {
    console.error('❌ Pricing fetch error:', error)
    return { data: [], error: { message: error.message } }
  }
}

export const calculateOrderCost = async (shopId, orderData) => {
  try {
    const { data: configs, error } = await getShopPricing(shopId)

    if (error || !configs || configs.length === 0) {
      console.warn('⚠️ No pricing configs found for shop:', shopId)
      return {
        cost: 0,
        error: 'No pricing available for this shop',
        pricePerPage: 0,
        appliedTier: null,
        savings: 0
      }
    }

    const matchingConfig = configs.find(config =>
      config.paper_size === orderData.paperSize &&
      config.color_mode === orderData.colorMode &&
      config.print_type === orderData.printType
    )

    if (!matchingConfig) {
      console.warn('⚠️ No matching config found for:', orderData)
      return {
        cost: 0,
        error: `No pricing found for ${orderData.paperSize} ${orderData.colorMode} ${orderData.printType}`,
        pricePerPage: 0,
        appliedTier: null,
        savings: 0
      }
    }

    let pricePerPage = matchingConfig.base_price
    let appliedTier = null

    let bulkTiers = matchingConfig.bulk_tiers
    if (typeof bulkTiers === 'string') {
      try { bulkTiers = JSON.parse(bulkTiers) } catch (e) { bulkTiers = [] }
    }

    // Check for bulk pricing
    if (Array.isArray(bulkTiers) && bulkTiers.length > 0) {
      const tier = bulkTiers
        .filter(t => orderData.copies >= t.min_copies)
        .filter(t => !t.max_copies || orderData.copies <= t.max_copies)
        .sort((a, b) => b.min_copies - a.min_copies)[0]

      if (tier) {
        pricePerPage = matchingConfig.base_price * (1 - tier.discount)
        appliedTier = tier
      }
    }

    const pages = orderData.pages || 0;
    const totalCost = pricePerPage * orderData.copies * pages;
    const savings = appliedTier ? (matchingConfig.base_price - pricePerPage) * orderData.copies * pages : 0;

    return {
      cost: totalCost,
      pricePerPage: pricePerPage,
      appliedTier: appliedTier,
      savings: savings,
      basePrice: matchingConfig.base_price,
      error: null
    };
  } catch (error) {
    console.error('❌ Cost calculation error:', error)
    return {
      cost: 0,
      error: 'Error calculating cost',
      pricePerPage: 0,
      appliedTier: null,
      savings: 0
    }
  }
}

// ============================================================================
// FILE UPLOAD FUNCTIONS
// ============================================================================

export const uploadFileChunked = async (file, shopId, onProgress = null, getUploadRef = null, customFileName = null) => {
  return new Promise((resolve, reject) => {
    try {
      
      
      if (!file) return reject(new Error('No file provided'))
      if (!shopId) return reject(new Error('Shop ID is required'))

      // Ensure we have a valid string for sanitization
      const nameToSanitize = file.name || 'document.pdf'
      const sanitizedName = sanitizeFilename(String(nameToSanitize))
      
      // Use the provided name (for resuming) or generate a new one
      const fileName = customFileName || `${shopId}/${Date.now()}_${sanitizedName}`
      const bucketName = 'print-files'

      

      const upload = new tus.Upload(file, {
        endpoint: `${supabaseStorageUrl}/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        fingerprint: (uploadFile, options) => Promise.resolve([
          'printget',
          options.endpoint,
          options.metadata?.bucketName,
          options.metadata?.objectName,
          uploadFile.name || 'blob',
          uploadFile.type || 'application/octet-stream',
          uploadFile.size || 0,
        ].join('-')),
        headers: {
          authorization: `Bearer ${supabaseKey}`,
          'x-upsert': 'false',
        },
        // IMPORTANT for resumption:
        // - uploadDataDuringCreation:false → server returns upload URL first,
        //   tus-js-client saves it to localStorage BEFORE any bytes are sent.
        //   If the user closes the tab mid-upload, the URL is already stored
        //   and findPreviousUploads() can resume from the last completed chunk.
        // - 2 MB chunks → checkpoints every 2 MB. Supabase accepts any size.
        uploadDataDuringCreation: false,
        removeFingerprintOnSuccess: true,
        storeFingerprintForResuming: true,
        metadata: {
          bucketName: bucketName,
          objectName: fileName,
          contentType: file.type || 'application/pdf',
          cacheControl: '3600',
        },
        chunkSize: 2 * 1024 * 1024,
        onError: (error) => {
          console.error('❌ [TUS] Upload failed:', error)
          reject(error)
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(1)
          
          if (onProgress) onProgress(bytesUploaded, bytesTotal, percentage)
        },
        onSuccess: () => {
          
          const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName)

          resolve({ data: { path: fileName, publicUrl }, error: null })
        }
      })

      if (getUploadRef) getUploadRef(upload)

      // Debug: dump every tus:: key + sweep stale entries (>24h old)
      try {
        const STALE_MS = 24 * 60 * 60 * 1000 // 24 hours
        const now = Date.now()
        const tusKeys = []
        const staleKeys = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (!k || !k.startsWith('tus::')) continue
          tusKeys.push(k)
          try {
            const entry = JSON.parse(localStorage.getItem(k))
            const created = entry?.creationTime ? new Date(entry.creationTime).getTime() : 0
            if (created && now - created > STALE_MS) staleKeys.push(k)
          } catch (_) {
            // Malformed entry — treat as stale
            staleKeys.push(k)
          }
        }
        
        staleKeys.forEach((k) => {
          
          localStorage.removeItem(k)
        })
      } catch (_) {}

      upload.findPreviousUploads()
        .then((previousUploads) => {
          
          if (previousUploads.length > 0) {
            
            // Pick the most recent one (last in array)
            upload.resumeFromPreviousUpload(previousUploads[previousUploads.length - 1])
          } else {
            
          }
          upload.start()
        })
        .catch((error) => {
          console.warn('⚠️ [TUS] Could not check previous uploads, starting fresh:', error)
          upload.start()
        })

    } catch (error) {
      console.error('❌ [TUS] Critical setup error:', error)
      reject(error)
    }
  })
}

export const uploadFile = async (file, shopId) => {
  try {
    if (!file) {
      throw new Error('No file provided')
    }

    if (!shopId) {
      throw new Error('Shop ID is required')
    }

    const sanitizedName = sanitizeFilename(file.name)
    const fileName = `${shopId}/${Date.now()}_${sanitizedName}`

    

    const { data, error } = await supabase.storage
      .from('print-files')
      .upload(fileName, file)

    if (error) {
      console.error('❌ File upload error:', error)
      throw new Error(`File upload failed: ${error.message}`)
    }

    const { data: { publicUrl } } = supabase.storage
      .from('print-files')
      .getPublicUrl(fileName)

    
    return { data: { path: data.path, publicUrl }, error: null }

  } catch (error) {
    console.error('❌ Upload error:', error)
    return { data: null, error: { message: error.message } }
  }
}

// ============================================================================
// ORDER FUNCTIONS
// ============================================================================

export const submitPrintJob = async (jobData) => {
  try {
    

    if (!jobData.shop_id) {
      throw new Error('Shop ID is required')
    }

    if (!jobData.filename) {
      throw new Error('Filename is required')
    }

    // Build insert data with recipe metadata
    const insertData = {
      shop_id: jobData.shop_id,
      filename: jobData.filename,
      file_url: jobData.file_url,
      copies: jobData.copies,
      paper_size: jobData.paper_size,
      color_mode: jobData.color_mode,
      print_type: jobData.print_type,
      pages_per_sheet: jobData.pages_per_sheet,
      customer_name: jobData.customer_name || 'Customer',
      customer_email: jobData.customer_email,
      customer_phone: jobData.customer_phone,
      total_cost: jobData.total_cost,
      payment_status: jobData.payment_status || 'pending',
      payment_method: jobData.payment_method || 'Pay at Shop',
      job_status: 'pending',
      // Recipe metadata for desktop app (cpdf)
      recipe: jobData.recipe || null,
      total_pages: jobData.total_pages || null,
      selected_pages: jobData.selected_pages || null,
      order_identification: jobData.order_identification || 'ON_PAGE',
      has_edits: jobData.has_edits || false
    }

    

    const { data, error } = await supabase
      .from('print_jobs')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ Job submission error:', error)
      throw new Error(`Failed to submit job: ${error.message}`)
    }

    
    return { data, error: null }

  } catch (error) {
    console.error('❌ Submit error:', error)
    return { data: null, error: { message: error.message } }
  }
}

// ============================================================================
// INSTANT JOB CREATION (before file upload completes)
// Creates the job record immediately with job_status='uploading' and file_url=null.
// Call updatePrintJob(id, { file_url, job_status: 'pending' }) when upload finishes.
// ============================================================================
export const submitPrintJobImmediate = async (jobData) => {
  try {
    if (!jobData.shop_id) throw new Error('Shop ID is required')
    if (!jobData.filename) throw new Error('Filename is required')

    const insertData = {
      shop_id: jobData.shop_id,
      filename: jobData.filename,
      file_url: '__uploading__',  // Placeholder — replaced with real URL after upload
      copies: jobData.copies,
      paper_size: jobData.paper_size,
      color_mode: jobData.color_mode,
      print_type: jobData.print_type,
      pages_per_sheet: jobData.pages_per_sheet,
      customer_name: jobData.customer_name || 'Customer',
      customer_email: jobData.customer_email || null,
      customer_phone: jobData.customer_phone || null,
      total_cost: jobData.total_cost,
      payment_status: jobData.payment_status || 'pending',
      payment_method: jobData.payment_method || 'Pay at Shop',
      job_status: 'pending',    // Reverted from 'uploading' because of DB constraint. We will filter on the desktop app instead.
      recipe: jobData.recipe || null,
      total_pages: jobData.total_pages || null,
      selected_pages: jobData.selected_pages || null,
      order_identification: jobData.order_identification || 'ON_PAGE',
      has_edits: jobData.has_edits || false
    }

    const { data, error } = await supabase
      .from('print_jobs')
      .insert(insertData)
      .select()
      .single()

    if (error) throw new Error(`Failed to create job: ${error.message}`)

    return { data, error: null }
  } catch (error) {
    console.error('❌ Immediate submit error:', error)
    return { data: null, error: { message: error.message } }
  }
}

export const getJobStatus = async (jobId) => {
  try {
    if (!jobId) {
      throw new Error('Job ID is required')
    }

    const { data, error } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle()

    if (error) {
      console.error('❌ Job status error:', error)
      throw new Error(`Failed to get job status: ${error.message}`)
    }

    return { data, error: null }

  } catch (error) {
    console.error('❌ Job status error:', error)
    return { data: null, error: { message: error.message } }
  }
}

export const getJobsByIds = async (jobIds) => {
  try {
    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('print_jobs')
      .select('*, shops:shop_id(name, address)')
      .in('id', jobIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Jobs history error:', error)
      throw new Error(`Failed to get jobs history: ${error.message}`)
    }

    return { data, error: null }

  } catch (error) {
    console.error('❌ Jobs history error:', error)
    return { data: [], error: { message: error.message } }
  }
}

export const updatePrintJob = async (jobId, updates) => {
  try {
    if (!jobId) {
      throw new Error('Job ID is required')
    }

    const { data, error } = await supabase
      .from('print_jobs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      console.error('❌ Job update error:', error)
      throw new Error(`Failed to update job: ${error.message}`)
    }

    
    return { data, error: null }

  } catch (error) {
    console.error('❌ Job update error:', error)
    return { data: null, error: { message: error.message } }
  }
}

export const updatePaymentStatus = async (jobId, status) => {
  try {
    if (!jobId) {
      throw new Error('Job ID is required')
    }

    const { data, error } = await supabase
      .from('print_jobs')
      .update({
        payment_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      console.error('❌ Payment update error:', error)
      throw new Error(`Failed to update payment: ${error.message}`)
    }

    return { data, error: null }

  } catch (error) {
    console.error('❌ Payment update error:', error)
    return { data: null, error: { message: error.message } }
  }
}

// ============================================================================
// JOB STATUS UPDATE FUNCTIONS (For Desktop App Integration)
// ============================================================================

export const updateJobStatus = async (jobId, status, estimatedCompletion = null) => {
  try {
    

    if (!jobId) {
      throw new Error('Job ID is required')
    }

    const updateData = {
      job_status: status,
      updated_at: new Date().toISOString()
    }

    if (estimatedCompletion) {
      updateData.estimated_completion = estimatedCompletion
    }

    const { data, error } = await supabase
      .from('print_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      console.error('❌ Job status update error:', error)
      throw new Error(`Failed to update job status: ${error.message}`)
    }

    
    return { data, error: null }

  } catch (error) {
    console.error('❌ Status update error:', error)
    return { data: null, error: { message: error.message } }
  }
}

export const markJobAsCompleted = async (jobId) => {
  return await updateJobStatus(jobId, 'completed')
}

export const markJobAsPrinting = async (jobId, estimatedCompletion = null) => {
  return await updateJobStatus(jobId, 'printing', estimatedCompletion)
}

export const markJobAsCancelled = async (jobId) => {
  return await updateJobStatus(jobId, 'cancelled')
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

export const subscribeToJobUpdates = (jobId, callback) => {
  

  return supabase
    .channel(`job_updates_${jobId}`)
    .on('postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'print_jobs',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        
        callback(payload.new)
      }
    )
    .subscribe((status) => {
      
    })
}

export const subscribeToAllJobUpdates = (shopId, callback) => {
  

  return supabase
    .channel(`shop_jobs_${shopId}`)
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'print_jobs',
        filter: `shop_id=eq.${shopId}`
      },
      (payload) => {
        
        callback(payload)
      }
    )
    .subscribe()
}

// ============================================================================
// POLLING FUNCTIONS (Backup for real-time)
// ============================================================================

export const startJobStatusPolling = (jobId, callback, intervalMs = 30000) => {
  

  const pollInterval = setInterval(async () => {
    try {
      const { data, error } = await getJobStatus(jobId)
      if (!error && data) {
        callback(data)
      }
    } catch (error) {
      console.error('❌ Polling error:', error)
    }
  }, intervalMs)

  // Return cleanup function
  return () => {
    
    clearInterval(pollInterval)
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount)
}

export const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase()
}

export const isValidFileType = (filename) => {
  const validTypes = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'txt']
  return validTypes.includes(getFileExtension(filename))
}

// ============================================================================
// DATABASE DIAGNOSTICS
// ============================================================================

export const runDatabaseDiagnostics = async () => {
  

  const results = {
    connection: null,
    shops: null,
    costConfigs: null,
    printJobs: null,
    storage: null
  }

  try {
    // Test 1: Basic connection
    results.connection = await testConnection()

    // Test 2: Shops table
    try {
      const { data: shops, error } = await supabase.from('shops').select('count')
      results.shops = { success: !error, data: shops, error }
    } catch (error) {
      results.shops = { success: false, error: error.message }
    }

    // Test 3: Cost configs table
    try {
      const { data: configs, error } = await supabase.from('cost_configs').select('count')
      results.costConfigs = { success: !error, data: configs, error }
    } catch (error) {
      results.costConfigs = { success: false, error: error.message }
    }

    // Test 4: Print jobs table
    try {
      const { data: jobs, error } = await supabase.from('print_jobs').select('count')
      results.printJobs = { success: !error, data: jobs, error }
    } catch (error) {
      results.printJobs = { success: false, error: error.message }
    }

    // Test 5: Storage bucket
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets()
      results.storage = { success: !error, data: buckets, error }
    } catch (error) {
      results.storage = { success: false, error: error.message }
    }

    
    return results

  } catch (error) {
    console.error('❌ Diagnostics failed:', error)
    return { error: error.message, results }
  }
}
