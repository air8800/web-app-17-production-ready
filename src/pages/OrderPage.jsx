import React, { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { getShopInfo, getShopPricing, calculateOrderCost, uploadFile, uploadFileChunked, submitPrintJob, submitPrintJobImmediate, formatCurrency, updatePaymentStatus, updatePrintJob, sanitizeFilename } from '../utils/supabase'
import useUploadStore from '../stores/uploadStore'
import { usePdfController, USE_NEW_PDF_CONTROLLER } from '../utils/pdf2/controller/usePdfController'
import usePDFStore from '../stores/pdfStore'
import PDFPageSelector from '../components/PDFPageSelector'
import Dropdown from '../components/Dropdown'
import { PDFDocument } from 'pdf-lib'
import { CreditCard as Edit, FileText, Image as ImageIcon, Info, Clock, CircleDot, Maximize2, Home, ChevronRight, Copy, Layers, BookOpen, Square, Grid2x2, FlipHorizontal2, MoreHorizontal, Columns2, ArrowLeftRight, X, AlertTriangle, Zap, ShieldCheck, Printer, ShoppingCart, Loader, MapPin, Phone, HandCoins } from 'lucide-react'
import { PAGE_SIZES, DEFAULT_PAGE_SIZE, getPageSize } from '../utils/pageSizes'
import { getTodayDayName, getTodayHours, isShopOpen } from '../utils/shop'
import { normalizePdfToA4 } from '../utils/pdf/normalizeToA4'

const ImageEditor = lazy(() => import('../components/ImageEditor'))
import PDFEditorModal from '../components/PDFEditorModal'
import PDFEditorPopup from '../components/PDFEditorPopup'
import PDFEditorSheetPopup from '../components/PDFEditorSheetPopup'
import { useTour } from '../hooks/useTour'
import { usePageTitle } from '../hooks/usePageTitle'

const OrderPage = () => {
  const { shopId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [shop, setShop] = useState(null)

  usePageTitle(shop?.name ? `Order - ${shop.name}` : 'Order')
  const [pricing, setPricing] = useState([])
  const [availablePaperSizes, setAvailablePaperSizes] = useState(['A4'])
  const [previewPageSize, setPreviewPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [orderData, setOrderData] = useState({
    file: null,
    files: [], // For multiple images
    filename: '',
    selectedPages: [],
    selectedImages: [],
    copies: 1,
    paperSize: 'A4',
    colorMode: 'BW',
    printType: 'Single',
    pagesPerSheet: 1,
    customerName: '',
    customerEmail: '',
    customerPhone: ''
  })
  const [costInfo, setCostInfo] = useState({ cost: 0 })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editorType, setEditorType] = useState(null)
  const [initialEditPageIndex, setInitialEditPageIndex] = useState(0) // 'pdf' or 'image'
  const [isDirectPageEdit, setIsDirectPageEdit] = useState(false) // Track if editing specific page from preview

  const [showPdfEditorModal, setShowPdfEditorModal] = useState(false)
  const [pdfEditorModalPageIndex, setPdfEditorModalPageIndex] = useState(0)

  // PDF Editor Popup state (for direct editing from page selector)
  const [showPdfEditPopup, setShowPdfEditPopup] = useState(false)
  const [editPopupPage, setEditPopupPage] = useState(null)
  const [editPopupPageIndex, setEditPopupPageIndex] = useState(-1)
  const [editPopupController, setEditPopupController] = useState(null)
  const [editPopupApplyEdit, setEditPopupApplyEdit] = useState(null)

  // Sheet Edit Popup State (Main Page)
  const [showPdfSheetEditPopup, setShowPdfSheetEditPopup] = useState(false)
  const [editingSheetData, setEditingSheetData] = useState(null)
  const [pdfPagesData, setPdfPagesData] = useState([])

  // Add error boundary state
  const [editorError, setEditorError] = useState(null)

  // Shop info popup state
  const [showInfoPopup, setShowInfoPopup] = useState(false)

  // Image-to-PDF conversion state
  const [isConvertingToPDF, setIsConvertingToPDF] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [conversionMessage, setConversionMessage] = useState('')

  // PDF normalization state
  const [isNormalizingPDF, setIsNormalizingPDF] = useState(false)
  const [normalizationProgress, setNormalizationProgress] = useState(0)
  const [normalizationMessage, setNormalizationMessage] = useState('')

  // State for edited PDF and pre-uploaded URL
  const [editedPages, setEditedPages] = useState({})
  const { controller, resetAll: resetPdfController } = usePdfController()
  const { reset: resetPdfStore } = usePDFStore()
  const { startUpload, setProgress: setUploadStoreProgress, finishUpload, setError: setUploadError, setPendingJobId } = useUploadStore()
  // Read uploadStore state without subscribing (for use in callbacks)
  const getUploadStoreState = useUploadStore.getState

  // Pre-generated PDF blob (ready to upload on submit)
  const [readyPDFBlob, setReadyPDFBlob] = useState(null)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  // Pre-uploaded file URL (uploaded in background for instant submit)
  const [preUploadedFileUrl, setPreUploadedFileUrl] = useState(null)
  const preUploadedFileUrlRef = useRef(null) // Ref for reliable polling
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Alternating text labels for print settings
  const [showAltText, setShowAltText] = useState(false)
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState(0)
  const [currentUploadRef, setCurrentUploadRef] = useState(null)
  const uploadContextRef = useRef({ fileName: null, pendingJobId: null })

  // Submission popup state
  const [showSubmitPopup, setShowSubmitPopup] = useState(false)
  const [submitPopupMessage, setSubmitPopupMessage] = useState('')

  // Page selector collapse state
  const [isPageSelectorExpanded, setIsPageSelectorExpanded] = useState(false)

  // PDF page count state
  const [pdfPageCount, setPdfPageCount] = useState(0)

  // Animation completion state for Edit and Select Pages button
  const [buttonAnimationComplete, setButtonAnimationComplete] = useState(false)

  // Cost breakup collapse state
  const [isCostBreakupExpanded, setIsCostBreakupExpanded] = useState(false)

  // Dev preview state - stores final PDF bytes
  const [finalPDFBytes, setFinalPDFBytes] = useState(null)

  // N-up conversion loading state
  const [isConvertingNup, setIsConvertingNup] = useState(false)



  const [backgroundSubmission, setBackgroundSubmission] = useState(() => {
    const saved = localStorage.getItem('printflow_background_submission')
    return saved !== null ? saved === 'true' : true
  })
  const [showBackgroundInfo, setShowBackgroundInfo] = useState(false)
  const [showAllPaperSizes, setShowAllPaperSizes] = useState(false)
  const [showFullFilename, setShowFullFilename] = useState(false) // Toggle for long filename display
  const [agreedToTerms, setAgreedToTerms] = useState(() => {
    return localStorage.getItem('printget_agreed_terms') === 'true'
  })

  // Limits and Warning states
  const MAX_FILE_SIZE = 300 * 1024 * 1024 // 300MB
  const MAX_IMAGES = 30
  const [sizeWarning, setSizeWarning] = useState({ show: false, type: null }) // type: 'size' or 'count'

  // Persist background submission setting
  useEffect(() => {
    localStorage.setItem('printflow_background_submission', backgroundSubmission)
  }, [backgroundSubmission])

  // SYNC MODAL STATES WITH URL (Enables mobile back button support)
  const modalView = searchParams.get('view')
  useEffect(() => {
    // Sync local states based on URL view param
    setShowInfoPopup(modalView === 'info')
    setShowPdfEditorModal(modalView === 'pdf-editor')
    setShowPdfEditPopup(modalView === 'page-editor')
    setShowPdfSheetEditPopup(modalView === 'sheet-editor')
    setShowEditor(modalView === 'image-editor')

    // Cleanup extra states when modals close via back button
    if (!modalView) {
      setEditingSheetData(null)
      setEditPopupPage(null)
      setEditPopupPageIndex(-1)
      setEditPopupController(null)
      setEditPopupApplyEdit(null)
      setEditorType(null)
      setEditorError(null)
      setIsDirectPageEdit(false)
    }
  }, [modalView])

  // Helpers for URL-based navigation (Enables mobile back button)
  const openModal = useCallback((view) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.set('view', view)
      return newParams
    })
    document.body.style.overflow = 'hidden' // Prevent background scrolling
  }, [setSearchParams])

  const closeModal = useCallback(() => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.delete('view')
      return newParams
    }, { replace: true })
    setPdfEditorModalPageIndex(0)
    setEditingSheetData(null)
    document.body.style.overflow = 'unset' // Restore background scrolling
  }, [setSearchParams])

  // CRITICAL: Reset PDF store on mount to prevent stale edits from previous sessions
  useEffect(() => {
    resetPdfStore()
    if (resetPdfController) resetPdfController()
  }, [])

  // Handle pagesPerSheet change with async conversion
  const handlePagesPerSheetChange = (newValue) => {
    // Update button state immediately
    setOrderData(prev => ({ ...prev, pagesPerSheet: newValue }))
    setIsConvertingNup(true)
    // Complete loading after conversion animation
    setTimeout(() => {
      setIsConvertingNup(false)
    }, 300)
  }

  // Select paper size; if it's not in the front 4, promote it to the top
  // so it's visible on the main UI next time. Persist the user's last
  // choice in localStorage so it's remembered across sessions / shops.
  const handleSelectPaperSize = (size) => {
    setOrderData(prev => ({ ...prev, paperSize: size }))
    try {
      localStorage.setItem('printget_last_paper_size', size)
    } catch (e) {
      // localStorage may be unavailable (private mode, quota); ignore
    }
    setAvailablePaperSizes(prev => {
      if (!prev.includes(size)) return prev
      const front = prev.slice(0, 4)
      if (front.includes(size)) return prev // already visible, keep order
      return [size, ...prev.filter(s => s !== size)]
    })
  }

  // Convert readyPDFBlob to bytes for preview
  useEffect(() => {
    if (readyPDFBlob) {
      const convertToBytes = async () => {
        const arrayBuffer = await readyPDFBlob.arrayBuffer()
        setFinalPDFBytes(new Uint8Array(arrayBuffer))
      }
      convertToBytes()
    } else {
      setFinalPDFBytes(null)
    }
  }, [readyPDFBlob])

  useEffect(() => {
    loadShopData()
  }, [shopId])

  // Listen for PDF editor updates (crop, adjustments, etc.)
  useEffect(() => {
    const handlePDFEditorUpdate = (event) => {
      if (event.detail && event.detail.editedPages) {
        const editedPagesData = event.detail.editedPages

        setEditedPages(prevEdited => ({
          ...prevEdited,
          ...editedPagesData
        }))

        // CRITICAL: Use the finalPDF from PDFEditor (vector-based export, no rasterization!)
        if (event.detail.finalPDF) {
          setReadyPDFBlob(event.detail.finalPDF)
          setIsGeneratingPDF(false)

          // Upload the vector-based PDF immediately
          uploadInBackground(event.detail.finalPDF)
        } else {
          console.warn('⚠️ No finalPDF provided - falling back to regeneration (should not happen!)')
          regeneratePDFInBackground(editedPagesData)
        }
      }
    }

    window.addEventListener('pdfEditorUpdate', handlePDFEditorUpdate)
    return () => {
      window.removeEventListener('pdfEditorUpdate', handlePDFEditorUpdate)
    }
  }, [orderData.files, orderData.selectedImages, previewPageSize, orderData.pagesPerSheet])

  useEffect(() => {
    if (pricing.length > 0) {
      calculateCost()
    }
  }, [orderData.copies, orderData.paperSize, orderData.colorMode, orderData.printType, orderData.selectedPages, pdfPageCount, orderData.file, pricing])

  // Alternate text labels every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setShowAltText(prev => !prev)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Initialize Tour
  // Initialize Tour
  const { startWelcomeTour, startEditButtonTour, startEditorTour, startSheetEditorTour, startPageSelectorTour, startEditPopupTour } = useTour()

  // 1. Start Welcome Tour on Mount (wait for loading to finish)
  useEffect(() => {
    if (!loading && !error && shop) {
      // Small timeout to ensure DOM is fully painted
      setTimeout(() => {
        startWelcomeTour()
      }, 500)
    }
  }, [loading, error, shop])

  // Sync selection to PDF controller
  useEffect(() => {
    if (controller && orderData.selectedPages) {
      controller.setSelectedPages(orderData.selectedPages)
    }
  }, [controller, orderData.selectedPages])

  // Sync print settings to PDF controller
  useEffect(() => {
    if (controller) {
      controller.setOptions({
        paperSize: orderData.paperSize,
        colorMode: orderData.colorMode === 'BW' ? 'bw' : 'color',
        copies: orderData.copies,
        pagesPerSheet: orderData.pagesPerSheet,
        shopId: shopId
      })
    }
  }, [controller, orderData.paperSize, orderData.colorMode, orderData.copies, orderData.pagesPerSheet, shopId])

  // 2. Start Edit Button Tour when file is uploaded
  useEffect(() => {
    if (orderData.file || orderData.files.length > 0) {
      startEditButtonTour()
    }
  }, [orderData.file, orderData.files])

  // 3. Start Editor Tour when Editor Modal opens
  useEffect(() => {
    if (showPdfEditorModal) {
      // Small delay to ensure modal animation finishes
      setTimeout(() => {
        startEditorTour()
      }, 500)
    }
  }, [showPdfEditorModal])

  // 4. Start Sheet Editor Tour when Sheet Edit popup opens
  useEffect(() => {
    if (showPdfSheetEditPopup) {
      setTimeout(() => {
        startSheetEditorTour()
      }, 500)
    }
  }, [showPdfSheetEditPopup])

  // 5. Start Edit Popup Tour when Single Page Edit popup opens
  useEffect(() => {
    if (showPdfEditPopup) {
      setTimeout(() => {
        startEditPopupTour()
      }, 500)
    }
  }, [showPdfEditPopup])

  // 6. Start Page Selector Tour when expanded
  useEffect(() => {
    if (isPageSelectorExpanded) {
      setTimeout(() => {
        startPageSelectorTour()
      }, 500)
    }
  }, [isPageSelectorExpanded])

  // Icon animation cycles every 2 seconds (completes 2 cycles per text display)
  const [iconState, setIconState] = useState(false)
  useEffect(() => {
    const interval = setInterval(() => {
      setIconState(prev => !prev)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Guide toggle state
  const [isGuideEnabled, setIsGuideEnabled] = useState(false)

  // Check initial guide state
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('printflow_tour_welcome')
    // If we have NOT seen the welcome tour, guides are effectively "ON"
    setIsGuideEnabled(!hasSeenWelcome)
  }, [])

  const handleToggleGuide = () => {
    const keys = [
      'printflow_tour_welcome',
      'printflow_tour_post_upload',
      'printflow_tour_editor_modal',
      'printflow_tour_sheet_editor',
      'printflow_tour_page_selector',
      'printflow_tour_edit_popup'
    ]

    if (!isGuideEnabled) {
      // Switching ON: Clear history and start fresh
      keys.forEach(key => localStorage.removeItem(key))
      setIsGuideEnabled(true)

      // Context-aware tour start
      if (orderData.file || orderData.files.length > 0) {
        // If file is already uploaded, show the print settings tour
        startEditButtonTour()
      } else {
        // Otherwise start from the beginning
        startWelcomeTour()
      }
    } else {
      // Switching OFF: Mark all as seen
      keys.forEach(key => localStorage.setItem(key, 'true'))
      setIsGuideEnabled(false)
    }
  }

  const loadShopData = async () => {
    try {
      setLoading(true)

      setError(null)

      // Load shop info and pricing in parallel
      const [shopResult, pricingResult] = await Promise.all([
        getShopInfo(shopId),
        getShopPricing(shopId)
      ])

      if (shopResult.error) {
        throw new Error('Failed to load shop: ' + shopResult.error.message)
      }

      if (!shopResult.data) {
        throw new Error('Shop not found or inactive')
      }

      setShop(shopResult.data)

      if (pricingResult.error) {
        console.warn('⚠️ Warning: Failed to load pricing:', pricingResult.error)
        // Continue anyway, we'll show a message to the user
      }

      if (pricingResult.data && pricingResult.data.length > 0) {
        setPricing(pricingResult.data)

        // Extract available paper sizes from pricing
        const sizes = [...new Set(pricingResult.data.map(config => config.paper_size))]
        if (sizes.length > 0) {
          // Remember the user's last paper size choice across sessions.
          // If it's available at this shop, promote it to the front of the
          // list so it shows up on the main UI without needing "More".
          let savedSize = null
          try {
            savedSize = localStorage.getItem('printget_last_paper_size')
          } catch (e) {
            // ignore
          }

          let orderedSizes = sizes
          let defaultSize = sizes[0]
          if (savedSize && sizes.includes(savedSize)) {
            defaultSize = savedSize
            orderedSizes = [savedSize, ...sizes.filter(s => s !== savedSize)]
          }

          setAvailablePaperSizes(orderedSizes)
          setOrderData(prev => ({
            ...prev,
            paperSize: defaultSize
          }))
        }
      } else {
        console.warn('⚠️ No pricing configurations found for this shop')
      }

    } catch (error) {
      console.error('❌ Error loading shop data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const calculateCost = async () => {
    if (!orderData.paperSize || !orderData.colorMode || !orderData.printType) {
      return
    }

    const selectedCount = orderData.selectedPages.length
    const totalCount = pdfPageCount

    // Default to 0 if no file is uploaded
    const pageCount = orderData.file ? (selectedCount > 0 ? selectedCount : (totalCount || 0)) : 0

    const result = await calculateOrderCost(shopId, {
      paperSize: orderData.paperSize,
      colorMode: orderData.colorMode,
      printType: orderData.printType,
      copies: orderData.copies,
      pages: pageCount
    })

    setCostInfo({ ...result, calculatedForPages: pageCount })
  }

  // Helper to get current effective page count for warning checks
  const currentEffectivePageCount = orderData.file
    ? (orderData.selectedPages.length > 0 ? orderData.selectedPages.length : (pdfPageCount || 0))
    : 0

  // Auto-convert images to PDF with progress tracking
  const convertImagesToPDFWithProgress = async (imageFiles) => {
    try {
      setIsConvertingToPDF(true)
      setConversionProgress(0)

      const totalImages = imageFiles.length

      // Create PDF document
      const pdfDoc = await PDFDocument.create()
      const pageDimensions = getPageSize(orderData.paperSize || 'A4')

      // Process images one by one with progress updates
      for (let i = 0; i < totalImages; i++) {
        const file = imageFiles[i]
        const imageNum = i + 1

        setConversionMessage(`Converting image ${imageNum} of ${totalImages}...`)

        // Load image to canvas for compression
        const img = await new Promise((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = reject
          const reader = new FileReader()
          reader.onload = (e) => { image.src = e.target.result }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        // Create canvas and compress to JPEG at 98% quality
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        // Compress to JPEG at 98% quality for high print quality
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.98)
        const imageBytes = await fetch(compressedDataUrl).then(res => res.arrayBuffer())

        // Create page and embed compressed image
        const page = pdfDoc.addPage([pageDimensions.width, pageDimensions.height])
        const embeddedImage = await pdfDoc.embedJpg(imageBytes)

        const imgDims = embeddedImage.scale(1)
        const scale = Math.min(
          pageDimensions.width / imgDims.width,
          pageDimensions.height / imgDims.height
        ) * 0.95

        const scaledWidth = imgDims.width * scale
        const scaledHeight = imgDims.height * scale

        page.drawImage(embeddedImage, {
          x: (pageDimensions.width - scaledWidth) / 2,
          y: (pageDimensions.height - scaledHeight) / 2,
          width: scaledWidth,
          height: scaledHeight
        })

        // Update progress
        const progress = Math.round(((imageNum) / totalImages) * 100)
        setConversionProgress(progress)

        // Small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Save PDF
      setConversionMessage('Finalizing PDF...')
      const pdfBytes = await pdfDoc.save()
      const pdfFile = new File(
        [pdfBytes],
        totalImages === 1 ? imageFiles[0].name.replace(/\.[^.]+$/, '.pdf') : `${totalImages}_images.pdf`,
        { type: 'application/pdf' }
      )

      setConversionMessage('Conversion complete!')

      // Brief delay to show completion
      await new Promise(resolve => setTimeout(resolve, 300))

      // Return both the file and the page count from pdf-lib
      return { pdfFile, pageCount: pdfDoc.getPageCount() }

    } catch (error) {
      console.error('❌ Error converting images to PDF:', error)
      throw new Error('Failed to convert images to PDF: ' + error.message)
    } finally {
      setIsConvertingToPDF(false)
      setConversionProgress(0)
      setConversionMessage('')
    }
  }

  const handleFileChange = async (filesOrFile) => {
    if (!filesOrFile) return

    // Handle both single file and multiple files
    const fileList = filesOrFile.length ? Array.from(filesOrFile) : [filesOrFile]
    const firstFile = fileList[0]

    // CHECK LIMITS
    const totalSize = fileList.reduce((sum, f) => sum + f.size, 0)
    if (totalSize > MAX_FILE_SIZE) {
      setSizeWarning({ show: true, type: 'size' })
      return
    }
    if (fileList.length > MAX_IMAGES && firstFile.type.startsWith('image/')) {
      setSizeWarning({ show: true, type: 'count' })
      return
    }

    // Abort previous upload if exists before starting new one
    if (currentUploadRef) {
      try { currentUploadRef.abort() } catch (e) {}
      setCurrentUploadRef(null)
    }

    // CRITICAL: Reset edits state but DO NOT reset the entire PDF store/controller
    // here. The controller is a singleton in the Zustand store — wiping it
    // mid-flight orphans the instance that PDFEditorNew is about to call
    // loadDocument() on. The controller's own loadDocument() correctly handles
    // reloading a new file (it destroys the previous pdfDoc internally).
    //
    // We DO need to clear the stale thumbnails/pages from the pdfStore so the
    // selector doesn't show the previous file's pages while the new one loads.
    setEditedPages({})
    if (resetPdfController) resetPdfController()
    usePDFStore.setState({
      pages: new Map(),
      loadedPages: new Set(),
      dirtyPages: new Set(),
      renderQueue: [],
      thumbnails: new Map(),
      fastPageCount: 0,
      totalPages: 0,
    })

    // Clear any pre-generated PDF and pre-uploaded URL from previous upload
    setReadyPDFBlob(null)
    setPreUploadedFileUrl(null)
    preUploadedFileUrlRef.current = null
    setUploadProgress(0)

    // Check if it's PDF or images
    if (firstFile.type === 'application/pdf') {
      // =========================================================================
      // VISUAL NORMALIZATION: No longer modify the PDF file!
      // The raw PDF is sent to the desktop app, which applies transformations.
      // Visual A4 normalization is now applied during canvas rendering in
      // documentLoader.ts for preview purposes only. 
      // Background upload is skipped for large files to assume "Visual Only" mode.
      // =========================================================================

      // Use raw file directly
      const normalizeResult = {
        normalizedFile: firstFile,
        wasNormalized: false,
        pageCount: 0,
        orientations: []
      }

      setIsNormalizingPDF(false)
      setNormalizationProgress(100)
      setNormalizationMessage('Ready')

      // Store page count (will be updated by pdf.js)
      setPdfPageCount(0)

      setOrderData(prev => ({
        ...prev,
        file: firstFile,
        files: [],
        filename: firstFile.name,
        selectedPages: [],
        selectedImages: []
      }))
      setShowEditor(false)

      // Kick off background upload immediately on file select.
      // Big files benefit MORE from background upload, not less — they take
      // longer to upload, so starting early while the user edits is the whole
      // point. The previous 10MB skip defeated the purpose.
      if (!backgroundSubmission) {
        console.warn('⚠️ [FILE-CHANGE] Background submission toggle is OFF. Background upload will be skipped. Toggle it ON in the UI to enable.')
      } else {
        generateInitialPDF(firstFile, [])
      }
    } else if (firstFile.type.startsWith('image/')) {
      // Images - auto-convert to PDF
      try {
        const allImages = fileList.filter(f => f.type.startsWith('image/'))

        // Convert images to PDF with progress tracking
        const { pdfFile, pageCount } = await convertImagesToPDFWithProgress(allImages)

        // Auto-select all pages - no need for page selector delay!
        const allPages = Array.from({ length: pageCount }, (_, i) => i + 1)

        // Store page count for display
        setPdfPageCount(pageCount)

        // Set the converted PDF as the file with ALL pages pre-selected
        setOrderData(prev => ({
          ...prev,
          file: pdfFile,
          files: [],
          filename: pdfFile.name,
          selectedPages: allPages, // Auto-select all pages - no need for page selector!
          selectedImages: []
        }))

        setShowEditor(false)

        // Pre-generate PDF immediately after conversion (for instant submit)
        generateInitialPDF(pdfFile, allPages)

      } catch (error) {
        console.error('❌ Error converting images:', error)
        console.error('Error details:', error?.message, error?.stack)
        const errorMsg = error?.message || 'Unknown error occurred'
        alert('Failed to convert images to PDF: ' + errorMsg)
        // Reset state
        setIsConvertingToPDF(false)
        setConversionProgress(0)
        setConversionMessage('')
      }
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files)
    }
  }

  const handleImagesSelected = (imageNumbers) => {
    setOrderData(prev => ({
      ...prev,
      selectedImages: imageNumbers
    }))
  }

  const handlePagesSelected = (pages) => {
    setOrderData(prev => ({
      ...prev,
      selectedPages: pages
    }))
  }

  // Handle pages loaded from PDFPageSelector
  const handlePagesLoaded = useCallback((pages, totalCount) => {
    setPdfPagesData(pages)
    // Update the page count for the header display
    // Priority: totalCount (actual PDF count) > pages.length (loaded thumbnails)
    const effectiveCount = totalCount || pages.length
    if (effectiveCount > 0) {
      setPdfPageCount(effectiveCount)
    }
  }, [setPdfPagesData, setPdfPageCount])

  const handleEditFile = (pageIndex) => {
    if (!orderData.file) {
      console.warn('OrderPage.handleEditFile: No file available')
      return
    }

    try {
      setEditorError(null)

      // Determine if this is direct page edit (from preview) or full grid edit
      const isDirectEdit = pageIndex !== undefined && pageIndex >= 0
      setIsDirectPageEdit(isDirectEdit)

      // When N-up mode is active (2 pages per sheet), convert page index to sheet index
      let editorPageIndex = pageIndex !== undefined ? pageIndex : 0
      if (orderData.pagesPerSheet === 2) {
        // Page 0,1 -> Sheet 0 (pages 1-2)
        // Page 2,3 -> Sheet 1 (pages 3-4)
        editorPageIndex = Math.floor(editorPageIndex / 2)
      }

      setInitialEditPageIndex(editorPageIndex)

      if (orderData.file.type === 'application/pdf') {
        setPdfEditorModalPageIndex(editorPageIndex)
        openModal('pdf-editor')
      } else if (orderData.file.type.startsWith('image/')) {
        setEditorType('image')
        openModal('image-editor')
      }
    } catch (error) {
      console.error('❌ Error opening editor:', error)
      setEditorError('Failed to open editor: ' + error.message)
    }
  }

  // Handler for direct popup editing from PDFPageSelector single view
  const handleDirectEditPage = useCallback((pageIndex, page, controller, applyEdit) => {
    if (!page) {
      console.warn('No page data provided for direct edit')
      return
    }
    if (page.isSheet && page.containsPages) {
      // 📄 Handle Sheet Edit (N-up Mode)
      const p1Num = page.containsPages[0]
      const p2Num = page.containsPages[1] || null

      const page1 = pdfPagesData.find(p => p.pageNumber === p1Num)
      const page2 = p2Num ? pdfPagesData.find(p => p.pageNumber === p2Num) : null

      const sheetData = {
        sheetNumber: page.pageNumber,
        pages: page.containsPages,
        page1Data: { page: page1, index: p1Num - 1 },
        page2Data: page2 ? { page: page2, index: p2Num - 1 } : null,
        controller: controller,
        applyEdit: applyEdit,
        pagesPerSheet: orderData.pagesPerSheet
      }

      setEditingSheetData(sheetData)
      openModal('sheet-editor')
      return
    }

    // 📄 Handle Single Page Edit
    setEditPopupPage(page)
    setEditPopupPageIndex(pageIndex)
    setEditPopupController(controller)
    setEditPopupApplyEdit(() => applyEdit)
    openModal('page-editor')
  }, [pdfPagesData, orderData.pagesPerSheet])

  // Handler for closing the sheet edit popup
  const handleCloseSheetEditPopup = () => {
    setShowPdfSheetEditPopup(false)
    setEditingSheetData(null)
  }

  // Handler for direct sheet editing from PDFPageSelector (N-up mode)
  // Receives sheetData directly from PDFEditorNew via PDFPageSelector
  const handleDirectEditSheet = (sheetData) => {
    setEditingSheetData(sheetData)
    openModal('sheet-editor')
  }

  const handleCloseEditPopup = () => {
    setShowPdfEditPopup(false)
    setEditPopupPage(null)
    setEditPopupPageIndex(-1)
  }

  const handleEditPopupApply = (pageIndex, edits) => {
    // Dispatch event to sync with PDFEditorNew
    window.dispatchEvent(new CustomEvent('pdfPageEdited', {
      detail: { pageIndex, edits }
    }))
  }

  const handleEditPopupApplyAll = (edits) => {
    // Dispatch event to sync with PDFEditorNew
    window.dispatchEvent(new CustomEvent('pdfAllPagesEdited', {
      detail: { edits }
    }))
  }

  const handleSaveEdits = (editedFileOrFiles) => {
    try {
      // Handle both single file and array of files
      if (Array.isArray(editedFileOrFiles)) {
        // Multiple images edited
        setOrderData(prev => ({
          ...prev,
          files: editedFileOrFiles,
          filename: `${editedFileOrFiles.length} images`,
          selectedImages: Array.from({ length: editedFileOrFiles.length }, (_, i) => i + 1)
        }))
      } else {
        // Single file edited
        setOrderData(prev => ({
          ...prev,
          file: editedFileOrFiles,
          filename: editedFileOrFiles.name,
          selectedPages: []
        }))
      }
      setShowEditor(false)
      setEditorType(null)
      setEditorError(null)
      setIsDirectPageEdit(false) // Reset direct page edit flag
    } catch (error) {
      console.error('❌ Error saving edits:', error)
      setEditorError('Failed to save edits: ' + error.message)
    }
  }

  const handleCancelEdit = () => {
    setShowEditor(false)
    setEditorType(null)
    setEditorError(null)
    setIsDirectPageEdit(false) // Reset direct page edit flag
  }

  // 🧹 Proper cleanup when removing file - destroys controller, cancels uploads, resets store
  const handleRemoveFile = () => {
    // 1. Destroy the PDF controller to release memory (250-600MB for large PDFs)
    if (controller) {
      try {
        controller.destroy()
      } catch (e) {
        console.warn('⚠️ Error destroying controller:', e)
      }
    }

    // 2. Reset the shared PDF store
    usePDFStore.getState().reset()

    // 3. Clear all order state
    setOrderData(prev => ({
      ...prev,
      file: null,
      files: [],
      filename: '',
      selectedPages: [],
      selectedImages: []
    }))

    // 4. Clear all PDF-related state
    setReadyPDFBlob(null)
    setPreUploadedFileUrl(null)
    preUploadedFileUrlRef.current = null
    setEditedPages({})
    setUploadProgress(0)
    setBackgroundUploadProgress(0)
    setIsGeneratingPDF(false)
    setIsUploading(false)
    setPdfPageCount(0)
    setPdfPagesData([])
    setShowFullFilename(false) // Reset filename display state
    setInitialEditPageIndex(0)
    setPdfEditorModalPageIndex(0)
    setPreviewPageSize(DEFAULT_PAGE_SIZE)

    // 5. Dispatch event to notify other components (PDFPageSelector listens for this)
    window.dispatchEvent(new CustomEvent('pdfCleared'))

    // 6. Abort any current background upload if it exists
    if (currentUploadRef) {
      try {
        currentUploadRef.abort()
      } catch (e) {
        console.warn('⚠️ Error aborting upload:', e)
      }
    }
    setCurrentUploadRef(null)
  }

  const processSelectedPages = async (originalFile, selectedPages) => {
    try {
      if (!selectedPages || selectedPages.length === 0) {
        throw new Error('No pages selected')
      }

      // If all pages are selected, return original file
      const arrayBuffer = await originalFile.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const totalPages = pdfDoc.getPageCount()

      if (selectedPages.length === totalPages &&
        selectedPages.every((page, index) => page === index + 1)) {
        return originalFile
      }

      // Remove unselected pages (in reverse order to maintain indices)
      const pagesToRemove = []
      for (let i = 1; i <= totalPages; i++) {
        if (!selectedPages.includes(i)) {
          pagesToRemove.push(i - 1) // Convert to 0-based index
        }
      }

      // Remove pages in reverse order
      pagesToRemove.reverse().forEach(pageIndex => {
        pdfDoc.removePage(pageIndex)
      })

      const modifiedPdfBytes = await pdfDoc.save()
      const modifiedFile = new File([modifiedPdfBytes], originalFile.name, {
        type: 'application/pdf'
      })

      return modifiedFile

    } catch (error) {
      console.error('❌ Error processing PDF pages:', error)
      throw new Error('Failed to process selected pages: ' + error.message)
    }
  }

  // Background PDF regeneration when edits are saved
  // Generate initial PDF right after upload (even without edits) AND upload it
  const generateInitialPDF = async (file, selectedPages = []) => {
    setIsGeneratingPDF(true)

    try {
      // For PDFs, just use the original file
      if (file && file.type === 'application/pdf') {
        setReadyPDFBlob(file)

        // Upload immediately in background (fire-and-forget — let it run)
        uploadInBackground(file).catch((e) => {
          console.error('❌ [INIT-PDF] uploadInBackground threw:', e)
        })
      } else {
        console.warn('⚠️ [INIT-PDF] File is not a PDF, skipping background upload. type=', file?.type)
      }
    } catch (error) {
      console.error('❌ [INIT-PDF] Error preparing PDF:', error)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  // Upload file in background immediately after PDF is ready
  const uploadInBackground = async (file, force = false) => {
    if (!file) {
      console.warn('🛑 [BG-UPLOAD] No file provided, aborting')
      return
    }
    if (!shopId) {
      console.warn('🛑 [BG-UPLOAD] No shopId yet, aborting')
      return
    }
    if (!backgroundSubmission && !force) {
      console.warn('🛑 [BG-UPLOAD] Background submission is OFF in settings. Toggle it ON to enable instant submit.')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setBackgroundUploadProgress(0)
    // Tell uploadStore we are uploading (no jobId yet — submit hasn't happened)
    startUpload(null)

    const originalName = file.name || 'document.pdf'
    const fileName = `${shopId}/${Date.now()}_${sanitizeFilename(originalName)}`
    uploadContextRef.current = { fileName, pendingJobId: null }

    try {
      setSubmitPopupMessage('Uploading in background...')

      // Generate a consistent filename for this upload session to enable TUS resumption
      localStorage.setItem('printget_active_upload_name', fileName)

      let uploadRef = null
      const uploadResult = await uploadFileChunked(
        file,
        shopId,
        (bytesUploaded, bytesTotal, percentage) => {
          const progress = parseFloat(percentage)
          setUploadProgress(progress)
          setBackgroundUploadProgress(progress)
          setSubmitPopupMessage(`Uploading... ${percentage}%`)
          // Feed progress to global store — StatusPage reads from here
          setUploadStoreProgress(progress)
          // Store progress for history page
          localStorage.setItem('printget_active_upload_progress', percentage)
        },
        (upload) => {
          uploadRef = upload
          setCurrentUploadRef(upload)
        },
        fileName // Pass the custom filename for resumption
      )

      if (uploadResult.error) {
        console.error('❌ Background upload failed:', uploadResult.error)
        setPreUploadedFileUrl(null)
        preUploadedFileUrlRef.current = null
        setCurrentUploadRef(null)
        setUploadError(uploadResult.error.message || 'Upload failed')
        // If submit already happened, mark the DB job as error
        const pendingJobId = uploadContextRef.current.pendingJobId || useUploadStore.getState().pendingJobId
        if (pendingJobId) {
          updatePrintJob(pendingJobId, { job_status: 'error' }).catch(() => { })
        }
        return
      }

      const publicUrl = uploadResult.data.publicUrl
      setPreUploadedFileUrl(publicUrl)
      preUploadedFileUrlRef.current = publicUrl
      setUploadProgress(100)
      setBackgroundUploadProgress(100)
      setSubmitPopupMessage('✅ Ready to submit!')
      setCurrentUploadRef(null)

      // If submit already happened, update the DB record with the real URL
      const pendingJobId = uploadContextRef.current.pendingJobId || useUploadStore.getState().pendingJobId
      if (pendingJobId) {
        try {
          await updatePrintJob(pendingJobId, { file_url: publicUrl, job_status: 'pending' })
          await updatePaymentStatus(pendingJobId, 'paid')
        } catch (e) {
          // Silent fail — the shop operator can still see the order
        }
      }

      finishUpload()

      // Clean up persistence
      const currentJobId = pendingJobId
      if (currentJobId) {
        localStorage.removeItem(`printget_upload_name_${currentJobId}`)
        localStorage.removeItem(`printget_upload_progress_${currentJobId}`)
      }
      localStorage.removeItem('printget_active_upload_name')
      localStorage.removeItem('printget_active_upload_progress')

    } catch (error) {
      if (error.message && error.message.includes('aborted')) {
        // Upload was intentionally aborted, no-op
      } else {
        console.error('❌ Background upload error:', error)
        setUploadError(error.message || 'Upload failed')
      }
      setSubmitPopupMessage('')
      setCurrentUploadRef(null)
    } finally {
      if (uploadContextRef.current.fileName === fileName) {
        uploadContextRef.current = { fileName: null, pendingJobId: null }
      }
      setIsUploading(false)
    }
  }

  const regeneratePDFInBackground = async (editedPagesData) => {
    setIsGeneratingPDF(true)

    // Clear stale pre-uploaded URL since we're creating a new PDF
    setPreUploadedFileUrl(null)
    preUploadedFileUrlRef.current = null

    try {
      let pdfBlob = null

      // Handle different file types
      if (orderData.files && orderData.files.length > 0 && orderData.selectedImages.length > 0) {
        // Multiple images case
        pdfBlob = await createPDFFromImages(
          orderData.files,
          orderData.selectedImages,
          previewPageSize,
          orderData.pagesPerSheet,
          editedPagesData
        )
      } else if (orderData.file && orderData.file.type === 'application/pdf') {
        // PDF with edits case - generate final PDF with edits applied
        pdfBlob = await generateEditedPDF(orderData.file, orderData.selectedPages, editedPagesData)
      }

      if (pdfBlob) {
        setReadyPDFBlob(pdfBlob)
        // Upload the new edited PDF immediately
        uploadInBackground(pdfBlob)
      }
    } catch (error) {
      console.error('❌ Error pre-generating PDF:', error)
      // Don't show error to user - we'll regenerate on submit if needed
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  // Generate final PDF with edits applied
  const generateEditedPDF = async (pdfFile, selectedPages, editedPagesData) => {
    try {
      // If no edits, return null (will use original file)
      if (Object.keys(editedPagesData).length === 0) {
        return null
      }

      // Load the PDF
      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)

      // Create new PDF with edited pages
      const newPdfDoc = await PDFDocument.create()
      const totalPages = pdfDoc.getPageCount()

      // If no pages selected, use all pages
      const pagesToInclude = selectedPages.length > 0 ? selectedPages : Array.from({ length: totalPages }, (_, i) => i + 1)

      for (const pageNum of pagesToInclude) {
        const pageIndex = pageNum - 1
        const editedPage = editedPagesData[pageNum]

        if (editedPage && editedPage.canvas) {
          // Use edited canvas - Optimized JPEG quality (85% is excellent for print, much faster than 98%)
          const dataUrl = editedPage.canvas.toDataURL('image/jpeg', 0.85)
          const imageBytes = await fetch(dataUrl).then(res => res.arrayBuffer())
          const embeddedImage = await newPdfDoc.embedJpg(imageBytes)

          const originalPage = pdfDoc.getPage(pageIndex)
          const { width, height } = originalPage.getSize()
          const page = newPdfDoc.addPage([width, height])

          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width,
            height
          })
        } else {
          // Copy original page
          const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex])
          newPdfDoc.addPage(copiedPage)
        }
      }

      const pdfBytes = await newPdfDoc.save()
      const pdfBlob = new File([pdfBytes], pdfFile.name, { type: 'application/pdf' })

      return pdfBlob

    } catch (error) {
      console.error('❌ Error generating edited PDF:', error)
      throw error
    }
  }

  const createPDFFromImages = async (imageFiles, selectedImageIndices, pageSize, pagesPerSheet, editedPagesOverride = null) => {
    try {
      const pdfDoc = await PDFDocument.create()
      const pageDimensions = getPageSize(pageSize)

      // Filter selected images
      const selectedFiles = selectedImageIndices
        .map(index => imageFiles[index - 1])
        .filter(file => file != null)

      // Handle mix of edited and unedited pages
      const pagesToUse = editedPagesOverride || editedPages
      const hasEdits = Object.keys(pagesToUse).length > 0
      let loadedImages = []

      if (hasEdits) {
        // Mix of edited and unedited pages - handle each individually
        const imagePromises = selectedImageIndices.map((pageNum, idx) => {
          const editedPage = pagesToUse[pageNum]
          if (editedPage && editedPage.canvas) {
            // Use edited canvas - Optimized JPEG quality (85% is excellent for print, much faster than 98%)
            return Promise.resolve({
              dataUrl: editedPage.canvas.toDataURL('image/jpeg', 0.85),
              isEdited: true
            })
          } else {
            // Use original file
            const file = selectedFiles[idx]
            if (!file) {
              console.warn(`⚠️ No file found for page ${pageNum}`)
              return Promise.resolve(null)
            }
            return new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = (e) => resolve({ file, dataUrl: e.target.result, isEdited: false })
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
          }
        })
        loadedImages = (await Promise.all(imagePromises)).filter(img => img !== null)
      } else {
        // No edits - load original image files
        const imagePromises = selectedFiles.map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve({ file, dataUrl: e.target.result, isEdited: false })
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        })
        loadedImages = await Promise.all(imagePromises)
      }

      // Embed images based on N-up setting
      if (pagesPerSheet === 2) {
        // 2-up layout: 2 images side by side per page
        for (let i = 0; i < loadedImages.length; i += 2) {
          const page = pdfDoc.addPage([pageDimensions.width, pageDimensions.height])

          const halfWidth = pageDimensions.width / 2
          const positions = [
            { x: 0, width: halfWidth }, // Left
            { x: halfWidth, width: halfWidth } // Right
          ]

          for (let j = 0; j < 2 && (i + j) < loadedImages.length; j++) {
            const { dataUrl } = loadedImages[i + j]
            const imageBytes = await fetch(dataUrl).then(res => res.arrayBuffer())

            // Always use JPEG for smaller file size
            let embeddedImage
            if (dataUrl.startsWith('data:image/jpeg')) {
              embeddedImage = await pdfDoc.embedJpg(imageBytes)
            } else if (dataUrl.startsWith('data:image/png')) {
              embeddedImage = await pdfDoc.embedPng(imageBytes)
            } else {
              embeddedImage = await pdfDoc.embedJpg(imageBytes)
            }

            const imgDims = embeddedImage.scale(1)
            const scale = Math.min(
              positions[j].width / imgDims.width,
              pageDimensions.height / imgDims.height
            ) * 0.95

            const scaledWidth = imgDims.width * scale
            const scaledHeight = imgDims.height * scale

            page.drawImage(embeddedImage, {
              x: positions[j].x + (positions[j].width - scaledWidth) / 2,
              y: (pageDimensions.height - scaledHeight) / 2,
              width: scaledWidth,
              height: scaledHeight
            })
          }
        }
      } else {
        // 1-up layout: 1 image per page
        for (const { dataUrl } of loadedImages) {
          const page = pdfDoc.addPage([pageDimensions.width, pageDimensions.height])

          const imageBytes = await fetch(dataUrl).then(res => res.arrayBuffer())

          let embeddedImage
          if (dataUrl.startsWith('data:image/png')) {
            embeddedImage = await pdfDoc.embedPng(imageBytes)
          } else {
            embeddedImage = await pdfDoc.embedJpg(imageBytes)
          }

          const imgDims = embeddedImage.scale(1)
          const scale = Math.min(
            pageDimensions.width / imgDims.width,
            pageDimensions.height / imgDims.height
          ) * 0.95

          const scaledWidth = imgDims.width * scale
          const scaledHeight = imgDims.height * scale

          page.drawImage(embeddedImage, {
            x: (pageDimensions.width - scaledWidth) / 2,
            y: (pageDimensions.height - scaledHeight) / 2,
            width: scaledWidth,
            height: scaledHeight
          })
        }
      }

      const pdfBytes = await pdfDoc.save()
      const pdfFile = new File([pdfBytes], 'images.pdf', { type: 'application/pdf' })

      return pdfFile

    } catch (error) {
      console.error('❌ Error creating PDF from images:', error)
      throw new Error('Failed to create PDF from images: ' + error.message)
    }
  }

  const handleSubmitOrder = async () => {
    // Validate
    if (!orderData.customerName) {
      alert('Please enter customer name')
      return
    }
    if (orderData.file) {
      if (orderData.file.type === 'application/pdf' && orderData.selectedPages.length === 0) {
        alert('Please select at least one page to print')
        return
      }
    } else if (orderData.files && orderData.files.length > 0) {
      if (orderData.selectedImages.length === 0) {
        alert('Please select at least one image to print')
        return
      }
    } else {
      alert('Please upload a file')
      return
    }

    setIsSubmitting(true)

    try {
      // Export recipe (edit metadata for desktop app — raw file is already uploaded)
      let recipe = null
      let hasEdits = false
      if (USE_NEW_PDF_CONTROLLER && controller) {
        try {
          recipe = controller.exportRecipe()
          if (recipe && recipe.pages && Array.isArray(recipe.pages)) {
            hasEdits = recipe.pages.some(p => p.hasEdits === true)
          }
        } catch (_) { }
      } else {
        hasEdits = Object.keys(editedPages).length > 0
      }

      // ── Case A: Background upload already finished ──
      // The file has been uploading since the user selected it.
      // If it's done by now, we can use the real URL immediately.
      if (preUploadedFileUrl) {
        const jobResult = await submitPrintJobImmediate({
          shop_id: shopId,
          filename: orderData.filename,
          copies: orderData.copies,
          paper_size: orderData.paperSize,
          color_mode: orderData.colorMode,
          print_type: orderData.printType,
          pages_per_sheet: orderData.pagesPerSheet,
          customer_name: orderData.customerName,
          customer_email: orderData.customerEmail || null,
          customer_phone: orderData.customerPhone || null,
          total_cost: costInfo.cost,
          selected_pages: orderData.selectedPages,
          total_pages: pdfPageCount,
          recipe: recipe ? JSON.stringify(recipe) : null,
          has_edits: hasEdits,
        })
        if (jobResult.error) throw new Error(jobResult.error.message)
        const jobId = jobResult.data.id

        // Update the DB record to use the real URL (overwrite placeholder)
        await updatePrintJob(jobId, { file_url: preUploadedFileUrl, job_status: 'pending' })
        await updatePaymentStatus(jobId, 'paid')

        // Save to localStorage
        localStorage.setItem('printget_recent_order', JSON.stringify({ jobId, shopId, timestamp: Date.now() }))
        try {
          const history = JSON.parse(localStorage.getItem('printget_order_history') || '[]')
          if (!history.includes(jobId)) { history.push(jobId); localStorage.setItem('printget_order_history', JSON.stringify(history)) }
        } catch (_) { }

        // Show upload as done instantly
        startUpload(jobId)
        finishUpload()
        navigate(`/status/${jobId}`)
        return
      }

      // ── Fallback Case: Upload never started or failed ──
      if (!isUploading && !preUploadedFileUrl) {
        let fileToUpload = null
        if (orderData.file) {
          fileToUpload = readyPDFBlob || orderData.file
        } else if (orderData.files && orderData.files.length > 0) {
          if (readyPDFBlob) {
            fileToUpload = readyPDFBlob
          } else {
            throw new Error('Please process images to PDF first')
          }
        }

        if (fileToUpload) {
          uploadInBackground(fileToUpload, true) // Force start
        } else {
          throw new Error('No valid file to upload')
        }
      }

      // ── Case B: Upload still in progress (or just started) ──
      // Create the DB record now, tell uploadStore the pendingJobId,
      // and navigate. uploadInBackground will update the DB when it finishes.
      const jobResult = await submitPrintJobImmediate({
        shop_id: shopId,
        filename: orderData.filename,
        copies: orderData.copies,
        paper_size: orderData.paperSize,
        color_mode: orderData.colorMode,
        print_type: orderData.printType,
        pages_per_sheet: orderData.pagesPerSheet,
        customer_name: orderData.customerName,
        customer_email: orderData.customerEmail || null,
        customer_phone: orderData.customerPhone || null,
        total_cost: costInfo.cost,
        selected_pages: orderData.selectedPages,
        total_pages: pdfPageCount,
        recipe: recipe ? JSON.stringify(recipe) : null,
        has_edits: hasEdits,
      })
      if (jobResult.error) throw new Error(jobResult.error.message)
      const jobId = jobResult.data.id

      // Move temporary upload filename to job-specific storage for resumption
      const activeFileName = localStorage.getItem('printget_active_upload_name')
      if (activeFileName) {
        localStorage.setItem(`printget_upload_name_${jobId}`, activeFileName)
        const activeProgress = localStorage.getItem('printget_active_upload_progress')
        if (activeProgress) {
          localStorage.setItem(`printget_upload_progress_${jobId}`, activeProgress)
        }
        // Don't remove 'active' keys yet, as uploadInBackground might still be running 
        // and using them for the current session. They'll be cleaned up in finishUpload.
      }

      // Tell the upload store: "when the current upload finishes, update THIS job"
      uploadContextRef.current.pendingJobId = jobId
      setPendingJobId(jobId)
      // Also mark the store as uploading for this job so StatusPage shows progress
      startUpload(jobId)

      // Save to localStorage
      localStorage.setItem('printget_recent_order', JSON.stringify({ jobId, shopId, timestamp: Date.now() }))
      try {
        const history = JSON.parse(localStorage.getItem('printget_order_history') || '[]')
        if (!history.includes(jobId)) { history.push(jobId); localStorage.setItem('printget_order_history', JSON.stringify(history)) }
      } catch (_) { }

      // Navigate immediately — uploadInBackground handles the rest
      navigate(`/status/${jobId}`)

    } catch (error) {
      alert('Failed to submit order: ' + error.message)
      setIsSubmitting(false)
    }
  }

  const _handleSubmitOrderOLD = async () => {
    if (!orderData.customerName) {
      alert('Please enter customer name')
      return
    }

    // Validate file uploads
    if (orderData.file) {
      // Check if PDF has pages selected
      if (orderData.file.type === 'application/pdf' && orderData.selectedPages.length === 0) {
        alert('Please select at least one page to print')
        return
      }
    } else if (orderData.files && orderData.files.length > 0) {
      // Check if images are selected
      if (orderData.selectedImages.length === 0) {
        alert('Please select at least one image to print')
        return
      }
    } else {
      alert('Please upload a file')
      return
    }

    // Show popup immediately
    setShowSubmitPopup(true)
    setSubmitPopupMessage('Preparing your order...')
    setIsSubmitting(true)
    const popupStartTime = performance.now()

    try {
      let fileUrl = null

      // ⚡ INSTANT SUBMIT: Check if we already uploaded the file in background
      if (preUploadedFileUrl) {
        fileUrl = preUploadedFileUrl
        setSubmitPopupMessage('Finalizing order...')
      } else if (currentUploadRef && isUploading) {
        // Background upload is still running - continue from its progress
        setSubmitPopupMessage(`Uploading... ${Math.round(backgroundUploadProgress)}%`)

        // Wait for background upload to complete using ref for reliable polling
        try {
          const backgroundResult = await new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
              // Check ref instead of state for reliable polling
              if (preUploadedFileUrlRef.current) {
                clearInterval(checkInterval)
                resolve(preUploadedFileUrlRef.current)
              }
            }, 100)

            // Timeout after 120 seconds
            setTimeout(() => {
              clearInterval(checkInterval)
              reject(new Error('Background upload timeout'))
            }, 1800000)
          })

          fileUrl = backgroundResult
          setSubmitPopupMessage('Finalizing order...')
        } catch (error) {
          // Cancel background and start fresh
          if (currentUploadRef) {
            currentUploadRef.abort()
            setCurrentUploadRef(null)
          }
          // Continue to fallback upload below
        }
      }

      if (!fileUrl) {
        // Fallback: Upload now if not pre-uploaded
        // Start visual progress from where background left off
        const startProgress = backgroundUploadProgress > 0 ? backgroundUploadProgress : 0

        let fileToUpload = null
        const hasEdits = Object.keys(editedPages).length > 0

        // Handle different file types
        if (orderData.file) {
          // Check if we have pre-generated PDF with edits
          if (hasEdits && readyPDFBlob) {
            fileToUpload = readyPDFBlob
          } else if (readyPDFBlob) {
            fileToUpload = readyPDFBlob
          } else {
            // Use original file
            fileToUpload = orderData.file
          }
        } else if (orderData.files && orderData.files.length > 0) {
          // Multiple images - use pre-generated PDF if available
          if (readyPDFBlob) {
            fileToUpload = readyPDFBlob
          } else {
            setSubmitPopupMessage('Creating PDF from images...')
            fileToUpload = await createPDFFromImages(orderData.files, orderData.selectedImages, previewPageSize, orderData.pagesPerSheet)
          }
        } else {
          throw new Error('No file to upload')
        }

        // Upload the file with chunked upload - continue from background progress
        setSubmitPopupMessage(`Uploading... ${Math.round(startProgress)}%`)

        const quickFileResult = await uploadFileChunked(fileToUpload, shopId, (bytesUploaded, bytesTotal, percentage) => {
          // Show smooth continuation from background progress
          const actualProgress = parseFloat(percentage)
          const visualProgress = Math.max(actualProgress, startProgress)
          setUploadProgress(visualProgress)
          setSubmitPopupMessage(`Uploading... ${Math.round(visualProgress)}%`)
        })

        if (quickFileResult.error) throw new Error('File upload failed: ' + quickFileResult.error.message)

        fileUrl = quickFileResult.data.publicUrl
      }

      // Create job record with the uploaded file URL
      setSubmitPopupMessage('Finalizing order...')
      const jobData = {
        shop_id: shopId,
        filename: orderData.filename,
        file_url: fileUrl,
        copies: orderData.copies,
        paper_size: orderData.paperSize,
        color_mode: orderData.colorMode,
        print_type: orderData.printType,
        pages_per_sheet: orderData.pagesPerSheet,
        customer_name: orderData.customerName,
        customer_email: orderData.customerEmail || null,
        customer_phone: orderData.customerPhone || null,
        total_cost: costInfo.cost,
        selected_pages: orderData.selectedPages,
        total_pages: pdfPageCount
      }

      // Export recipe if using new controller
      let recipe = null
      let hasEdits = false

      if (USE_NEW_PDF_CONTROLLER && controller) {
        try {
          recipe = controller.exportRecipe()
          // Check if any page has edits in the recipe
          if (recipe && recipe.pages && Array.isArray(recipe.pages)) {
            hasEdits = recipe.pages.some(p => p.hasEdits === true)
          }
        } catch (recipeError) {
          console.error('❌ Failed to export recipe:', recipeError)
        }
      } else {
        // Fallback checks
        hasEdits = Object.keys(editedPages).length > 0
      }

      const jobResult = await submitPrintJob({
        ...jobData,
        recipe: recipe ? JSON.stringify(recipe) : null,
        has_edits: hasEdits
      })
      if (jobResult.error) throw new Error('Failed to submit order: ' + jobResult.error.message)

      const jobId = jobResult.data.id

      // Ensure popup shows for at least 1.5 seconds for visual feedback
      const popupElapsed = performance.now() - popupStartTime
      const minPopupTime = 1500
      if (popupElapsed < minPopupTime) {
        setSubmitPopupMessage('Order submitted! ✓')
        await new Promise(resolve => setTimeout(resolve, minPopupTime - popupElapsed))
      }

      // Save order ID for tracking (in case user navigates away)
      localStorage.setItem('printget_recent_order', JSON.stringify({
        jobId,
        shopId,
        timestamp: Date.now()
      }))

      // Save to full order history
      try {
        const history = JSON.parse(localStorage.getItem('printget_order_history') || '[]')
        if (!history.includes(jobId)) {
          history.push(jobId)
          localStorage.setItem('printget_order_history', JSON.stringify(history))
        }
      } catch (e) {
        console.error('Failed to save to order history', e)
      }
      // Navigate to status page
      navigate(`/status/${jobId}`)

      // BACKGROUND: Process PDF pages if needed (after navigation)
      if (orderData.file?.type === 'application/pdf' && orderData.selectedPages.length > 0 && orderData.selectedPages.length < orderData.file.size) {
        ; (async () => {
            try {
              const processedFile = await processSelectedPages(orderData.file, orderData.selectedPages)
              const processedResult = await uploadFileChunked(processedFile, shopId)

              if (processedResult.error) {
                console.error('❌ Background processing failed:', processedResult.error)
                return
              }

              // Update with processed file
              await updatePrintJob(jobId, { file_url: processedResult.data.publicUrl })
            } catch (bgError) {
              console.error('❌ Background processing error:', bgError)
            }
          })()
      }

      // Mark payment as paid (fast, no blocking)
      await updatePaymentStatus(jobId, 'paid')

    } catch (error) {
      console.error('❌ Error submitting order:', error)
      alert('Failed to submit order: ' + error.message)
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shop information...</p>
          <p className="text-sm text-gray-500 mt-2">Fetching pricing data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Shop</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadShopData}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Shop Not Found</h1>
          <p className="text-gray-600">The shop you're looking for doesn't exist or is not active.</p>
        </div>
      </div>
    )
  }

  // Error boundary for editor
  if (editorError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-20">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Editor Error</h3>
              <p className="text-gray-600 mb-8">{editorError}</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setEditorError(null)}
                  className="btn-primary"
                >
                  Try Again
                </button>
                <button
                  onClick={() => navigate(`/shop/${shopId}`)}
                  className="btn-secondary"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show image editor if requested (PDF uses modal popup instead)
  if (showEditor && editorType === 'image' && orderData.file) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Image Editor...</p>
          </div>
        </div>
      }>
        <ImageEditor
          file={orderData.file}
          onSave={handleSaveEdits}
          onCancel={closeModal}
          pageSize={previewPageSize}
          onPageSizeChange={setPreviewPageSize}
          colorMode={orderData.colorMode}
          pagesPerSheet={orderData.pagesPerSheet}
        />
      </Suspense>
    )
  }

  return (
    <div id="tour-welcome" className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-4 sm:mb-6">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-400">Place Order</span>
          </nav>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold mb-1">{shop.name}</h1>
              <p className="text-sm sm:text-base text-gray-600">{shop.address}</p>
            </div>
            <div className="flex gap-2 items-center">
              {/* Guide Toggle */}
              <button
                onClick={handleToggleGuide}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 border ${isGuideEnabled
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-100 border-gray-200 text-gray-500'
                  }`}
                title={isGuideEnabled ? 'Guides Enabled' : 'Guides Disabled'}
              >
                <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${isGuideEnabled ? 'bg-blue-500' : 'bg-gray-300'
                  }`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${isGuideEnabled ? 'left-4.5' : 'left-0.5'
                    }`} style={{ left: isGuideEnabled ? '18px' : '2px' }} />
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-xs font-semibold">Guide</span>
                </div>
              </button>
              <button
                onClick={() => openModal('info')}
                className="flex-shrink-0 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                title="Shop Information"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Today's Hours and Status */}
          {shop.operating_hours && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700 font-medium">
                  {getTodayHours(shop.operating_hours)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CircleDot className={`w-4 h-4 ${isShopOpen(shop.operating_hours) ? 'text-green-500' : 'text-red-500'}`} />
                <span className={`text-sm font-medium ${isShopOpen(shop.operating_hours) ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {isShopOpen(shop.operating_hours) ? 'Open Now' : 'Closed'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Shop Info Popup */}
        {showInfoPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowInfoPopup(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Shop Information</h2>
                <button
                  onClick={() => setShowInfoPopup(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Contact Info */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Contact</h3>
                  <p className="text-sm text-gray-600 mb-1">{shop.address}</p>
                  <p className="text-sm text-blue-600">{shop.phone}</p>
                  {shop.email && <p className="text-sm text-gray-600">{shop.email}</p>}
                </div>

                {/* Services */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Our Services</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></div>
                      <span className="text-sm">Document Printing (PDF, Word, Images)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></div>
                      <span className="text-sm">Black & White and Color Printing</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></div>
                      <span className="text-sm">Single and Double Sided Printing</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></div>
                      <span className="text-sm">Multiple Paper Sizes (A3, A4, Letter)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></div>
                      <span className="text-sm">Bulk Printing Discounts</span>
                    </div>
                  </div>
                </div>

                {/* Operating Hours */}
                {shop.operating_hours && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Hours</h3>
                    <div className="space-y-1">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                        const hours = shop.operating_hours[day]
                        let display = hours
                        if (!hours) display = 'Not set'
                        else if (typeof hours === 'object' && hours !== null) {
                          display = hours.closed ? 'Closed' : `${hours.open || '?'}-${hours.close || '?'}`
                        }
                        return (
                          <div key={day} className="flex justify-between text-sm">
                            <span className="capitalize font-medium text-gray-700">{day}</span>
                            <span className="text-gray-600">{display}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2">Upload Document</label>
            <div
              id="upload-section"
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isConvertingToPDF || isNormalizingPDF ? (
                <div className="py-8">
                  <div className="max-w-md mx-auto space-y-4">
                    {/* Conversion/Normalization Animation */}
                    <div className="flex items-center justify-center mb-4">
                      <div className="relative">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                          {isConvertingToPDF ? (
                            <ImageIcon className="w-8 h-8 text-blue-600 animate-pulse" />
                          ) : (
                            <FileText className="w-8 h-8 text-blue-600 animate-pulse" />
                          )}
                        </div>
                        <div className="absolute -right-2 -bottom-2 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-bounce">
                          <FileText className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Progress Message */}
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {isConvertingToPDF ? 'Converting to PDF...' : 'Normalizing PDF to A4...'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {isConvertingToPDF ? conversionMessage : normalizationMessage}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-blue-600">Progress</span>
                        <span className="text-xs font-bold text-blue-700">
                          {isConvertingToPDF ? conversionProgress : normalizationProgress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-1"
                          style={{ width: `${isConvertingToPDF ? conversionProgress : normalizationProgress}%` }}
                        >
                          {(isConvertingToPDF ? conversionProgress : normalizationProgress) > 10 && (
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                      {isConvertingToPDF
                        ? 'Please wait while we prepare your images...'
                        : 'Optimizing pages with smart orientation detection...'
                      }
                    </p>
                  </div>
                </div>
              ) : orderData.file || orderData.files.length > 0 ? (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {orderData.file?.type === 'application/pdf' ? (
                        <FileText className="w-6 h-6 text-green-600" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-green-600 font-medium cursor-pointer hover:text-green-700 transition-colors ${showFullFilename ? 'break-all' : 'truncate'
                          }`}
                        onClick={() => setShowFullFilename(!showFullFilename)}
                        title={showFullFilename ? 'Click to collapse' : orderData.filename}
                      >
                        {orderData.filename}
                      </p>
                      {orderData.filename.length > 30 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {showFullFilename ? 'Click to collapse' : 'Click to see full name'}
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        {orderData.file?.type === 'application/pdf' ? 'PDF Document' :
                          orderData.files.length > 1 ? `${orderData.files.length} Images` : 'Image File'} •
                        {orderData.file ? (orderData.file.size / 1024 / 1024).toFixed(2) :
                          (orderData.files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={handleRemoveFile}
                      className="text-red-600 text-xs sm:text-sm hover:underline py-1"
                    >
                      Remove
                    </button>

                    <button
                      onClick={() => setShowBackgroundInfo(true)}
                      className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 hover:text-blue-600 transition-colors bg-gray-50 px-2.5 py-1.5 rounded-full border border-gray-100 shadow-sm"
                    >
                      <Info className="w-3.5 h-3.5" />
                      background submission : {backgroundSubmission ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm sm:text-base text-gray-600 mb-2">Drag and drop or</p>
                    <input
                      type="file"
                      onChange={(e) => {
                        handleFileChange(e.target.files)
                        e.target.value = '' // Clear input so same file can be re-selected
                      }}
                      accept=".pdf,.doc,.docx,.jpg,.png,.jpeg"
                    multiple
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-700"
                  >
                    Choose Files
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Supported: PDF, Images (JPG, PNG) - Multiple images allowed
                  </p>

                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => setShowBackgroundInfo(true)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 shadow-sm"
                    >
                      <Info className="w-3.5 h-3.5" />
                      background submission : {backgroundSubmission ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Background Submission Info Popup */}
          {showBackgroundInfo && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-white">
                    <Info className="w-5 h-5 opacity-80" />
                    <h3 className="font-bold">Background Submission</h3>
                  </div>
                  <button
                    onClick={() => setShowBackgroundInfo(false)}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900">Status</span>
                      <span className={`text-xs font-medium ${backgroundSubmission ? 'text-green-600' : 'text-amber-600'}`}>
                        {backgroundSubmission ? 'Recommended' : 'Manual Upload'}
                      </span>
                    </div>
                    <button
                      onClick={() => setBackgroundSubmission(!backgroundSubmission)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${backgroundSubmission ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${backgroundSubmission ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {!backgroundSubmission && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-800 font-medium">
                        Not recommended; it may cause delays in file upload. For faster submission, keep it ON.
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <p className="text-[12px] leading-relaxed text-blue-900 font-medium">
                      We don't share your document with the Xerox center until the submit button is clicked. Background upload is intended for faster upload while you're editing and selecting page settings. All your settings and edit preferences will be safely transferred to the chosen Xerox shop when you click the submit button.
                    </p>
                  </div>
                </div>

                <div className="px-5 py-4 bg-gray-50 flex justify-end">
                  <button
                    onClick={() => setShowBackgroundInfo(false)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* All Paper Sizes Popup */}
          {showAllPaperSizes && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setShowAllPaperSizes(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-white">
                    <FileText className="w-5 h-5 opacity-80" />
                    <h3 className="font-bold">Choose Paper Size</h3>
                  </div>
                  <button
                    onClick={() => setShowAllPaperSizes(false)}
                    className="text-white/80 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-xs text-gray-600">
                    {availablePaperSizes.length} paper size{availablePaperSizes.length === 1 ? '' : 's'} available at this shop. Tap one to select.
                  </p>

                  <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                    {availablePaperSizes.map(size => {
                      const isSelected = orderData.paperSize === size
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            handleSelectPaperSize(size)
                            setShowAllPaperSizes(false)
                          }}
                          className={`relative px-3 py-3 text-sm font-semibold rounded-lg transition-all border-2 ${isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                            : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                            }`}
                        >
                          {isSelected && (
                            <span className="absolute top-1 right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-blue-600 text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                          {size}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="px-5 py-3 bg-gray-50 flex justify-end">
                  <button
                    onClick={() => setShowAllPaperSizes(false)}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compact Print Settings - Show after file upload */}
          {(orderData.file || orderData.files.length > 0) && (
            <div id="print-settings-container" className="bg-white border-2 border-gray-200 rounded-xl p-3 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Print Settings
              </h3>

              {/* Compact Print Settings Layout */}
              <div className="space-y-4">
                {/* Paper Size - Common sizes in one row */}
                <div id="setting-paper-size">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Paper Size</label>
                  <div className="flex flex-wrap gap-1.5">
                    {availablePaperSizes.slice(0, 4).map(size => (
                      <button
                        key={size}
                        onClick={() => handleSelectPaperSize(size)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${orderData.paperSize === size
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        {size}
                      </button>
                    ))}
                    {availablePaperSizes.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setShowAllPaperSizes(true)}
                        className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                        <span>More</span>
                        <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold">
                          +{availablePaperSizes.length - 4}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Color Mode - Full Width */}
                <div id="setting-color-mode">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Color Mode</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOrderData(prev => ({ ...prev, colorMode: 'BW' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${orderData.colorMode === 'BW'
                        ? 'bg-gray-700 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      <div className="w-2.5 h-2.5 rounded bg-gray-500" />
                      <span>B&W</span>
                    </button>
                    <button
                      onClick={() => setOrderData(prev => ({ ...prev, colorMode: 'Color' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${orderData.colorMode === 'Color'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      <div className="w-2.5 h-2.5 rounded bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500" />
                      <span>Color</span>
                    </button>
                  </div>
                </div>

                {/* Pages/Sheet + Print Type - Same Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Pages Per Sheet */}
                  <div id="setting-pages-sheet">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Pages/Sheet</label>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setOrderData(prev => ({ ...prev, pagesPerSheet: 1 }))}
                        className={`flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium rounded-lg transition-all h-9 ${orderData.pagesPerSheet === 1
                          ? 'bg-blue-600 text-white shadow-md hover:shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>1 Page</span>
                      </button>
                      <button
                        onClick={() => handlePagesPerSheetChange(2)}
                        disabled={isConvertingNup}
                        className={`flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium rounded-lg transition-all h-9 ${orderData.pagesPerSheet === 2
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          } ${isConvertingNup ? 'opacity-75 cursor-wait pointer-events-none' : ''}`}
                      >
                        {/* Animated icon showing pages opening side by side */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {/* Container/sheet background */}
                          <rect x="2" y="4" width="20" height="16" rx="1" strokeWidth="1.5" opacity="0.3" />

                          {/* Left page - starts in center, moves left when open */}
                          <g
                            className="transition-all ease-in-out"
                            style={{
                              transform: iconState ? 'translateX(0)' : 'translateX(5px)',
                              opacity: iconState ? 1 : 0.85,
                              transitionDuration: '2s'
                            }}
                          >
                            <rect x="3" y="5" width="8" height="14" rx="0.5" strokeWidth="1.5" />
                            <line x1="4.5" y1="8" x2="9.5" y2="8" strokeWidth="1" opacity="0.6" />
                            <line x1="4.5" y1="11" x2="9.5" y2="11" strokeWidth="1" opacity="0.6" />
                            <line x1="4.5" y1="14" x2="8" y2="14" strokeWidth="1" opacity="0.6" />
                          </g>

                          {/* Right page - starts in center (overlapping), moves right when open */}
                          <g
                            className="transition-all ease-in-out"
                            style={{
                              transform: iconState ? 'translateX(0)' : 'translateX(-5px)',
                              opacity: iconState ? 1 : 0.4,
                              transitionDuration: '2s'
                            }}
                          >
                            <rect x="13" y="5" width="8" height="14" rx="0.5" strokeWidth="1.5" />
                            <line x1="14.5" y1="8" x2="19.5" y2="8" strokeWidth="1" opacity="0.6" />
                            <line x1="14.5" y1="11" x2="19.5" y2="11" strokeWidth="1" opacity="0.6" />
                            <line x1="16" y1="14" x2="19.5" y2="14" strokeWidth="1" opacity="0.6" />
                          </g>

                          {/* Center divider - appears when split */}
                          <line
                            x1="12" y1="5" x2="12" y2="19"
                            strokeWidth="1.5"
                            className="transition-opacity ease-in-out"
                            style={{
                              opacity: iconState ? 0.8 : 0,
                              transitionDuration: '2s'
                            }}
                          />
                        </svg>
                        {isConvertingNup ? (
                          <>
                            <div className="nup-spinner"></div>
                            <span className="text-xs">Converting...</span>
                          </>
                        ) : (
                          <span className="inline-block overflow-hidden relative" style={{ height: '18px' }}>
                            <span
                              className="block transition-transform duration-500 ease-in-out"
                              style={{ transform: showAltText ? 'translateY(-18px)' : 'translateY(0)' }}
                            >
                              <span className="block h-[18px] leading-[18px]">Side by Side</span>
                              <span className="block h-[18px] leading-[18px]">2 Pages</span>
                            </span>
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Print Type */}
                  <div id="setting-print-type">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Print Type</label>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setOrderData(prev => ({ ...prev, printType: 'Single' }))}
                        className={`flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium rounded-lg transition-all ${orderData.printType === 'Single'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>Single</span>
                      </button>
                      <button
                        onClick={() => setOrderData(prev => ({ ...prev, printType: 'Double' }))}
                        className={`flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium rounded-lg transition-all ${orderData.printType === 'Double'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        {/* Animated icon showing page flip from front to back */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <g
                            className="transition-all ease-in-out"
                            style={{
                              transform: iconState ? 'rotateY(180deg)' : 'rotateY(0deg)',
                              transformOrigin: 'center',
                              transitionDuration: '2s'
                            }}
                          >
                            {/* Page outline */}
                            <rect x="6" y="4" width="12" height="16" rx="1" />
                            {/* Content lines on front */}
                            <line
                              x1="8" y1="7" x2="16" y2="7"
                              strokeWidth="1.5"
                              className="transition-opacity duration-500"
                              style={{ opacity: showAltText ? 0 : 1 }}
                            />
                            <line
                              x1="8" y1="10" x2="14" y2="10"
                              strokeWidth="1.5"
                              className="transition-opacity duration-500"
                              style={{ opacity: showAltText ? 0 : 1 }}
                            />
                            <line
                              x1="8" y1="13" x2="16" y2="13"
                              strokeWidth="1.5"
                              className="transition-opacity duration-500"
                              style={{ opacity: showAltText ? 0 : 1 }}
                            />
                            {/* Content lines on back (reversed) */}
                            <line
                              x1="8" y1="8" x2="14" y2="8"
                              strokeWidth="1.5"
                              className="transition-opacity duration-500"
                              style={{
                                opacity: showAltText ? 1 : 0,
                                transform: 'scaleX(-1)',
                                transformOrigin: 'center'
                              }}
                            />
                            <line
                              x1="8" y1="11" x2="16" y2="11"
                              strokeWidth="1.5"
                              className="transition-opacity duration-500"
                              style={{
                                opacity: showAltText ? 1 : 0,
                                transform: 'scaleX(-1)',
                                transformOrigin: 'center'
                              }}
                            />
                            <line
                              x1="10" y1="14" x2="16" y2="14"
                              strokeWidth="1.5"
                              className="transition-opacity duration-500"
                              style={{
                                opacity: showAltText ? 1 : 0,
                                transform: 'scaleX(-1)',
                                transformOrigin: 'center'
                              }}
                            />
                          </g>
                        </svg>
                        <span className="inline-block overflow-hidden relative" style={{ height: '18px' }}>
                          <span
                            className="block transition-transform duration-500 ease-in-out"
                            style={{ transform: showAltText ? 'translateY(-18px)' : 'translateY(0)' }}
                          >
                            <span className="block h-[18px] leading-[18px]">Front & Back</span>
                            <span className="block h-[18px] leading-[18px]">Double</span>
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Copies - Full Width Layout */}
                <div id="setting-copies">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Copies</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setOrderData(prev => ({ ...prev, copies: Math.max(1, prev.copies - 1) }))}
                      className="w-12 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-bold text-xl transition-all flex-shrink-0"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={orderData.copies}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '' || val === '0') {
                          setOrderData(prev => ({ ...prev, copies: '' }))
                        } else {
                          setOrderData(prev => ({ ...prev, copies: parseInt(val) || 1 }))
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '' || parseInt(e.target.value) < 1) {
                          setOrderData(prev => ({ ...prev, copies: 1 }))
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 text-center p-2.5 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-semibold text-base"
                    />
                    <button
                      onClick={() => setOrderData(prev => ({ ...prev, copies: Math.min(1000, prev.copies + 1) }))}
                      className="w-12 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-bold text-xl transition-all flex-shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible PDF Page Selection */}
          {orderData.file && orderData.file.type === 'application/pdf' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Clickable Header */}
              <button
                onClick={() => setIsPageSelectorExpanded(!isPageSelectorExpanded)}
                id="edit-pages-btn"
                className={`w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all relative overflow-hidden group ${buttonAnimationComplete ? 'button-with-arrow-glow' : ''}`}
              >
                {/* Animated slide effect - runs twice */}
                {!buttonAnimationComplete && (
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-300/60 to-transparent animate-slide-right pointer-events-none"
                    onAnimationEnd={() => setButtonAnimationComplete(true)}
                  />
                )}

                <div className="flex items-center gap-2 relative z-10">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-gray-900">
                      Edit and Select Pages to Print
                    </span>
                    {pdfPageCount > 0 && (
                      <span className="text-xs text-gray-600">
                        {pdfPageCount} {pdfPageCount === 1 ? 'page' : 'pages'} in document
                      </span>
                    )}
                  </div>
                </div>
                <div className={`relative z-10 ${isPageSelectorExpanded ? '' : !buttonAnimationComplete ? 'animate-arrow-slide' : ''}`}>
                  <ChevronRight className={`w-5 h-5 text-gray-600 transition-transform ${isPageSelectorExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {/* Expandable Content - Always render but hide when collapsed to preload */}
              <div className={`bg-white transition-all overflow-hidden ${isPageSelectorExpanded ? 'max-h-[2000px] opacity-100 p-0 sm:p-2' : 'max-h-0 opacity-0 p-0'
                }`}>
                <PDFPageSelector
                  file={orderData.file}
                  selectedPages={orderData.selectedPages}
                  onPagesSelected={handlePagesSelected}
                  pageSize={previewPageSize}
                  colorMode={orderData.colorMode}
                  pagesPerSheet={orderData.pagesPerSheet}
                  onEditPage={handleDirectEditPage}
                  onEditSheet={handleDirectEditSheet}
                  onPagesLoaded={handlePagesLoaded}
                  viewMode="single"
                />
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2">Your Name *</label>
              <input
                type="text"
                value={orderData.customerName}
                onChange={(e) => setOrderData(prev => ({ ...prev, customerName: e.target.value }))}
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2">Phone <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input
                type="tel"
                value={orderData.customerPhone}
                onChange={(e) => setOrderData(prev => ({ ...prev, customerPhone: e.target.value }))}
                className="w-full p-3 border rounded-lg"
              />
            </div>
          </div>

          {/* Cost Display - Collapsible */}
          {costInfo.cost > 0 ? (
            <div className="bg-white border border-blue-100 rounded-xl overflow-hidden shadow-sm">
              {/* Header - Always visible */}
              <button
                onClick={() => setIsCostBreakupExpanded(!isCostBreakupExpanded)}
                className="payment-tap-btn w-full flex items-center gap-3 px-3.5 py-3 text-left"
              >
                {/* Icon */}
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <HandCoins className="text-blue-600" style={{ width: '20px', height: '20px' }} />
                </div>

                {/* Middle: 2 clean rows */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[11px] font-extrabold text-gray-900 uppercase tracking-wider leading-none">
                      Payment
                    </span>
                    <span className="text-[10px] font-semibold text-blue-400 leading-none truncate">
                      {isCostBreakupExpanded ? 'Hide breakdown' : 'Tap to see breakdown'}
                    </span>
                  </div>
                  <span className="text-[14px] font-bold text-blue-700 leading-tight truncate">
                    Pay at Shop
                  </span>
                </div>

                {/* Right: price + chevron */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[17px] font-extrabold text-blue-600 tabular-nums leading-none">
                    {formatCurrency(costInfo.cost)}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-blue-300 transition-transform duration-150 ${isCostBreakupExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {/* Expandable Details - with ID for tour */}
              <div id="pricing-info" className={`payment-grid-container ${isCostBreakupExpanded ? 'is-expanded' : ''}`}>
                <div className="payment-grid-content">
                  <div className="border-t border-blue-100 px-3 pb-3 pt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-700">Payment Method</p>
                    <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-100/50 p-2 rounded-lg border border-blue-100">
                      <HandCoins className="w-4 h-4" />
                      <span>Pay at Shop (on pickup)</span>
                    </div>
                    <p className="text-xs font-semibold text-gray-700">Total payable at shop: {formatCurrency(costInfo.cost)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (orderData.file || orderData.files.length > 0) ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-800 text-sm">
                {pricing.length === 0
                  ? "This shop hasn't set up pricing yet. Please contact them directly."
                  : `No pricing found for ${orderData.paperSize} ${orderData.colorMode} ${orderData.printType}. Try a different combination.`
                }
              </p>
            </div>
          ) : null}

          {/* Background processing indicator */}
          {isGeneratingPDF && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm text-blue-700">⚡ Optimizing PDF for faster submission...</span>
            </div>
          )}

          {readyPDFBlob && !isGeneratingPDF && Object.keys(editedPages).length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm text-green-700">Ready for instant submission!</span>
            </div>
          )}

          {/* Terms and Conditions Checkbox */}
          <div className="flex items-start gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100 mt-2">
            <div className="flex items-center h-5 mt-0.5">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked)
                  localStorage.setItem('printget_agreed_terms', e.target.checked ? 'true' : 'false')
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
              />
            </div>
            <div className="text-sm">
              <label htmlFor="terms" className="font-medium text-gray-700 cursor-pointer">
                I agree to the Terms
              </label>
              <p className="text-gray-500 text-xs mt-0.5">
                By submitting, I agree to PrintGet's{' '}
                <Link to="/terms" target="_blank" className="text-blue-600 hover:underline">Terms & Conditions</Link> and{' '}
                <Link to="/privacy" target="_blank" className="text-blue-600 hover:underline">Privacy Policy</Link>.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmitOrder}
            disabled={
              isSubmitting ||
              !agreedToTerms ||
              (!orderData.file && (!orderData.files || orderData.files.length === 0)) ||
              !orderData.customerName ||
              costInfo.cost <= 0 ||
              (orderData.file?.type === 'application/pdf' && orderData.selectedPages.length === 0) ||
              (orderData.files?.length > 0 && orderData.selectedImages.length === 0)
            }
            className={`w-full group relative overflow-hidden py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl font-bold text-[17px] sm:text-base transition-all duration-300 shadow-lg active:scale-[0.98] ${isSubmitting || !agreedToTerms || costInfo.cost <= 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] hover:bg-right text-white shadow-blue-200'
              }`}
          >
            {isSubmitting ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (orderData.file?.type === 'application/pdf' && pdfPageCount === 0) ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Getting page count...</span>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 relative z-10">
                <span>Submit & Print Now</span>
              </div>
            )}
          </button>

          {(orderData.file || orderData.files.length > 0) && costInfo.cost <= 0 && pricing.length > 0 &&
            (orderData.file?.type !== 'application/pdf' || pdfPageCount > 0) &&
            costInfo.calculatedForPages === currentEffectivePageCount && (
              <p className="text-sm text-red-600 text-center">
                Please select a valid combination of paper size, color mode, and print type
              </p>
            )}

          {orderData.file?.type === 'application/pdf' && orderData.selectedPages.length === 0 && pdfPageCount > 0 && (
            <p className="text-sm text-red-600 text-center">
              Please select at least one page to print from the PDF
            </p>
          )}
        </div>
      </div>

      {/* Submit Popup Animation */}
      {showSubmitPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 animate-scale-in">
            <div className="flex flex-col items-center gap-4">
              {/* Animated Spinner */}
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
              </div>

              {/* Message */}
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-800 mb-2 tabular-nums min-w-[200px] transition-all duration-150">
                  {submitPopupMessage}
                </h3>
                <p className="text-sm text-gray-500">Please wait...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Size / Count Warning Popup */}
      {sizeWarning.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full animate-scale-in border border-gray-100">
            <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>

              <div className="text-center space-y-3">
                <h3 className="text-xl font-bold text-gray-900">
                  {sizeWarning.type === 'size' ? 'File Too Large' : 'Too Many Images'}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {sizeWarning.type === 'size'
                    ? 'Currently, the file size limit is 300MB. Soon the file size limit will be increased. Please select a file size less than 300MB.'
                    : 'You can select up to 30 images at once. Please reduce the number of images to proceed.'}
                </p>
              </div>

              <button
                onClick={() => setSizeWarning({ show: false, type: null })}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98]"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Editor Modal Popup */}
      <PDFEditorModal
        isOpen={showPdfEditorModal}
        onClose={closeModal}
        file={orderData.file}
        initialPageIndex={pdfEditorModalPageIndex}
        onSave={handleSaveEdits}
        pageSize={previewPageSize}
        onPageSizeChange={setPreviewPageSize}
        colorMode={orderData.colorMode}
        pagesPerSheet={orderData.pagesPerSheet}
        selectedPages={orderData.selectedPages}
        onPageSelect={(pages) => setOrderData(prev => ({ ...prev, selectedPages: pages }))}
      />

      {/* Direct PDF Editor Popup (from page selector) */}
      <PDFEditorPopup
        isOpen={showPdfEditPopup}
        onClose={closeModal}
        page={editPopupPage}
        pageNumber={editPopupPage?.pageNumber || 1}
        pageIndex={editPopupPageIndex}
        controller={editPopupController}
        applyEdit={editPopupApplyEdit}
        onApply={handleEditPopupApply}
        onApplyAll={handleEditPopupApplyAll}
        totalPages={pdfPagesData.length || 1}
      />

      {/* Direct Sheet Editor Popup (from N-up page selector) */}
      <PDFEditorSheetPopup
        isOpen={showPdfSheetEditPopup}
        onClose={closeModal}
        sheetData={editingSheetData}
        onApply={closeModal} // Edits applied internally via passed applyEdit
        onApplyAll={handleEditPopupApplyAll}
        pageSize={previewPageSize}
      />
    </div>
  )
}

export default OrderPage
