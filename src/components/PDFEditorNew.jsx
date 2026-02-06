import React, { useState, useEffect, useRef, useCallback, forwardRef, useMemo } from 'react'
import { X, Save, RotateCw, RotateCcw, Crop, RefreshCw, ZoomIn, ZoomOut, Grid2x2 as Grid, Check, FileText, Maximize2, AlertCircle, Square, CheckSquare } from 'lucide-react'
import { ShimmerLoader } from './ThumbnailLoadingStates'
import LoadingExperience from './LoadingExperience'
import TransformThumbnail from './TransformThumbnail'
import { getPageSize, DEFAULT_PAGE_SIZE, PAGE_SIZES } from '../utils/pageSizes'
import Dropdown from './Dropdown'
import UnsavedChangesPopup from './UnsavedChangesPopup'
import usePDFStore from '../stores/pdfStore'

import {
  usePdfController,
  CropHandler,
  RotationHandler,
  UIStateManager,
  CropDragController,
  CoordinateHandler,
  ZoomPanHandler
} from '../utils/pdf2'
import { applyPageTransformsToCanvas } from '../utils/pdf2/ui/pageTransforms'
import { logDetailedMemory, trackMemoryOverTime } from '../utils/memoryProfiler'

const PDFEditorNew = forwardRef(({
  file,
  initialPageIndex = 0,
  onSave,
  onCancel,
  directPageEdit = false,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageSizeChange,
  colorMode = 'BW',
  pagesPerSheet = 1,
  selectedPages = [],
  onPageSelect = null,
  onEditPage = null,
  onEditSheet = null,  // New: for N-up sheet editing
  onSheetsGenerating = null,  // Callback when sheets are being generated
  onPagesLoaded = null
}, ref) => {
  useEffect(() => {
    console.log('📄 PDFEditorNew MOUNTED (actual component mount)')
    return () => console.log('📄 PDFEditorNew UNMOUNTED')
  }, [])

  const { setThumbnail, reset: resetPdfStore } = usePDFStore()

  const {
    controller,
    isReady,
    isLoading: controllerLoading,
    error: controllerError,
    loadDocument,
    applyEdit,
    exportRecipe,
    resetPage,
    resetAll
  } = usePdfController()

  const [pages, setPages] = useState([])
  const [sheets, setSheets] = useState([])  // Sheets for N-up mode
  const [isGeneratingSheets, setIsGeneratingSheets] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(null)
  const [error, setError] = useState(null)
  const [currentPageSize, setCurrentPageSize] = useState(pageSize)

  const [showEditPopup, setShowEditPopup] = useState(false)
  const [editingPageIndex, setEditingPageIndex] = useState(initialPageIndex)
  const [editingPageNumber, setEditingPageNumber] = useState(initialPageIndex + 1)

  const [settings, setSettings] = useState({
    rotation: 0,
    scale: 100,
    offsetX: 0,
    offsetY: 0
  })
  const [userScale, setUserScale] = useState(100)

  const [cropMode, setCropMode] = useState(false)
  const [cropArea, setCropArea] = useState(null)
  const [pendingCropPreview, setPendingCropPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragHandle, setDragHandle] = useState(null)
  const [imageRect, setImageRect] = useState(null)
  const [showGrid, setShowGrid] = useState(false)
  const [zoom, setZoom] = useState(1)

  const [activeTab, setActiveTab] = useState('pagesize')
  const [tempPageSize, setTempPageSize] = useState(pageSize)
  const [isApplying, setIsApplying] = useState(false)
  const [applyProgress, setApplyProgress] = useState(0)
  const [isApplyingAll, setIsApplyingAll] = useState(false)
  const [applyAllProgress, setApplyAllProgress] = useState(0)
  const [showScaleSlider, setShowScaleSlider] = useState(true)
  const [showUnsavedChangesPopup, setShowUnsavedChangesPopup] = useState(false)
  const [isLargePdf, setIsLargePdf] = useState(false)  // Track if PDF >= 10MB

  // Track which thumbnails have been loaded (for large PDF on-demand loading)
  const loadedThumbnailsRef = useRef(new Set())
  const loadedSheetsRef = useRef(new Set()) // Track loaded sheet thumbnails
  const visiblePagesRef = useRef(new Set())  // Track currently visible pages
  const visibleSheetsRef = useRef(new Set()) // Track currently visible sheets
  const loadingPagesRef = useRef(new Set())  // Track pages currently being loaded
  const loadingSheetsRef = useRef(new Set()) // Track sheets currently being loaded
  const debounceRef = useRef(null)           // Timeout for debounced loading

  const canvasRef = useRef(null)
  const imageContainerRef = useRef(null)

  const cropHandlerRef = useRef(null)
  const rotationHandlerRef = useRef(null)
  const uiStateManagerRef = useRef(null)
  const coordinateHandlerRef = useRef(null)
  const zoomPanHandlerRef = useRef(null)
  const thumbnailGridRef = useRef(null)  // Ref for Intersection Observer



  // Ref to track latest pages state for event listeners
  const pagesRef = useRef(pages)
  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  useMemo(() => {
    if (!cropHandlerRef.current) cropHandlerRef.current = new CropHandler()
    if (!rotationHandlerRef.current) rotationHandlerRef.current = new RotationHandler()
    if (!uiStateManagerRef.current) uiStateManagerRef.current = new UIStateManager()
    if (!coordinateHandlerRef.current) coordinateHandlerRef.current = new CoordinateHandler()
    if (!zoomPanHandlerRef.current) zoomPanHandlerRef.current = new ZoomPanHandler()
  }, [])

  const cropHandler = cropHandlerRef.current
  const rotationHandler = rotationHandlerRef.current
  const uiStateManager = uiStateManagerRef.current
  const coordinateHandler = coordinateHandlerRef.current
  const zoomPanHandler = zoomPanHandlerRef.current

  useEffect(() => {
    if (pageSize !== currentPageSize) {
      setCurrentPageSize(pageSize)
    }
  }, [pageSize])

  const handlePageSizeChange = (newSize) => {
    setCurrentPageSize(newSize)
    if (onPageSizeChange) {
      onPageSizeChange(newSize)
    }
  }

  useEffect(() => {
    if (!file) return

    const loadPDF = async () => {
      try {
        setLoading(true)
        setLoadingStage('parsing')
        setError(null)

        console.log('📄 [PDFEditorNew] Loading PDF via controller...')
        await loadDocument(file)

        const pageCount = controller?.getPageCount() || 0
        console.log(`📄 [PDFEditorNew] Loaded ${pageCount} pages`)

        // Check if this is a large PDF (>= 10MB) for optimized loading BEFORE creating pages
        const fileSizeMB = file.size / (1024 * 1024)
        const largePdf = fileSizeMB >= 10
        setIsLargePdf(largePdf)
        if (largePdf) {
          console.log(`📄 [PDFEditorNew] Large PDF detected (${fileSizeMB.toFixed(1)}MB) - using on-demand thumbnail loading`)
          loadedThumbnailsRef.current.clear()
          loadingPagesRef.current.clear()
        }

        const loadedPages = []
        for (let i = 1; i <= pageCount; i++) {
          const metadata = controller?.getPageMetadata(i)
          const thumbnail = controller?.getThumbnail(i)
          const transforms = metadata?.transforms || { rotation: 0, scale: 100, offsetX: 0, offsetY: 0, crop: null }
          const dimensions = metadata?.originalDimensions || { width: 595, height: 842 }

          const rotation = transforms.rotation || 0
          const isRotated90or270 = ((rotation % 360) + 360) % 360 === 90 || ((rotation % 360) + 360) % 360 === 270
          const visualWidth = isRotated90or270 ? dimensions.height : dimensions.width
          const visualHeight = isRotated90or270 ? dimensions.width : dimensions.height

          loadedPages.push({
            pageNumber: i,
            originalWidth: metadata?.originalDimensions.width || 595,
            originalHeight: metadata?.originalDimensions.height || 842,
            width: visualWidth,
            height: visualHeight,
            thumbnail: thumbnail,
            canvas: null,
            originalCanvas: null,
            editHistory: transforms,
            edited: metadata?.edited || false,
            isLoading: largePdf ? false : !thumbnail
          })
        }

        setPages(loadedPages)

        setLoadingStage('ready')
        setLoading(false)

        // Log detailed memory after initial load
        logDetailedMemory('After PDF Load', {
          pdfArrayBuffer: file?.size || 0,
          pageProxies: pageCount,
          statePages: loadedPages.length
        })

        if (onPagesLoaded) {
          onPagesLoaded(loadedPages)
        }

        if (directPageEdit && initialPageIndex >= 0 && initialPageIndex < pageCount && onEditPage) {
          setTimeout(() => {
            const page = loadedPages[initialPageIndex]
            if (page) {
              onEditPage(initialPageIndex, page, controller, applyEdit)
            }
          }, 100)
        }

      } catch (err) {
        console.error('❌ [PDFEditorNew] Load failed:', err)
        setError(err.message || 'Failed to load PDF')
        setLoading(false)
      }
    }

    loadPDF()
  }, [file])

  // Combine two page canvases into a single landscape thumbnail (Blob URL version)
  const combinePagesThumbnail = useCallback(async (page1Data, page2Data) => {
    const baseWidth = page1Data?.canvas?.width || 0
    const baseHeight = page1Data?.canvas?.height || 0
    if (!baseWidth) return ''

    const sheetWidth = Math.max(baseWidth, baseHeight)
    const sheetHeight = Math.min(baseWidth, baseHeight)

    const canvas = document.createElement('canvas')
    canvas.width = sheetWidth
    canvas.height = sheetHeight
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, sheetWidth, sheetHeight)

    const margin = sheetWidth * 0.02
    const gap = sheetWidth * 0.02
    const slotWidth = (sheetWidth - (2 * margin) - gap) / 2
    const slotHeight = sheetHeight - (2 * margin)
    const slotDims = { width: slotWidth, height: slotHeight }

    const renderSlot = (data, slotX, slotY) => {
      if (!data?.canvas) {
        ctx.fillStyle = '#f9fafb'
        ctx.fillRect(slotX, slotY, slotWidth, slotHeight)
        return
      }
      const transformedCanvas = applyPageTransformsToCanvas(data.canvas, data.editHistory || {}, slotDims)
      if (transformedCanvas) {
        const x = slotX + (slotWidth - transformedCanvas.width) / 2
        const y = slotY + (slotHeight - transformedCanvas.height) / 2
        ctx.drawImage(transformedCanvas, x, y)
      }
    }

    renderSlot(page1Data, margin, margin)
    renderSlot(page2Data, margin + slotWidth + gap, margin)

    // Convert to Blob URL (YouTube-style: saves ~400MB RAM for sheets)
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob))
          } else {
            // Fallback to data URL if toBlob fails
            resolve(canvas.toDataURL('image/jpeg', 0.85))
          }
        },
        'image/jpeg',
        0.85
      )
    })
  }, [])

  // Track abort controllers for running tasks
  const sheetControllersRef = useRef(new Map())  // Map<sheetNum, AbortController>
  const lowResLoadedRef = useRef(new Set())  // Track sheets with low-res already loaded

  // Helper: Convert data URL or blob URL to canvas (works with both)
  const dataUrlToCanvas = useCallback((dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        // DEBUG: Check if canvas has content
        const p = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data
        if (p[3] === 0) console.warn('⚠️ dataUrlToCanvas: Center pixel is transparent', { src: dataUrl?.slice(0, 50) })
        resolve(canvas)
      }
      img.onerror = (e) => {
        console.error('❌ dataUrlToCanvas failed', e)
        resolve(null)
      }
      img.src = dataUrl
    })
  }, [])

  // Memory logging helper - uses trackMemoryOverTime for quick snapshots
  const logMemory = useCallback((label) => {
    trackMemoryOverTime(label)
    if (performance.memory) {
      const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1)
      console.log(`📊 [Memory ${label}] Used: ${mb(performance.memory.usedJSHeapSize)}MB / Total: ${mb(performance.memory.totalJSHeapSize)}MB / Limit: ${mb(performance.memory.jsHeapSizeLimit)}MB`)
    }
  }, [])

  // On-demand loader for N-up sheets with SMART REUSE
  // - Reuses existing page thumbnails if available
  // - Falls back to progressive loading if not
  const loadSheetThumbnailOnDemand = useCallback(async (sheetNum, force = false) => {
    // If already fully loaded, skip
    if (loadedSheetsRef.current.has(sheetNum)) return

    // If already loading, skip
    if (loadingSheetsRef.current.has(sheetNum)) {
      return
    }

    // Double-check visibility unless forced
    if (isLargePdf && !force && !visibleSheetsRef.current.has(sheetNum)) {
      return
    }

    // Create AbortController
    const abortController = new AbortController()
    sheetControllersRef.current.set(sheetNum, abortController)
    const signal = abortController.signal

    try {
      loadingSheetsRef.current.add(sheetNum)
      setSheets(prev => prev.map(s => s.sheetNumber === sheetNum ? { ...s, isLoading: true } : s))

      const startIdx = (sheetNum - 1) * pagesPerSheet
      const pageNum1 = startIdx + 1
      const pageNum2 = startIdx + 2 <= pages.length ? startIdx + 2 : null

      if (signal.aborted) return

      const p1 = pages.find(p => p.pageNumber === pageNum1)
      const p2 = pages.find(p => p.pageNumber === pageNum2)

      // ========== CHECK FOR EXISTING PAGE THUMBNAILS ==========
      const p1HasThumbnail = p1?.thumbnail || p1?.baseImage
      const p2HasThumbnail = pageNum2 ? (p2?.thumbnail || p2?.baseImage) : true // second page optional

      if (p1HasThumbnail && p2HasThumbnail) {
        // FAST PATH: Reuse existing thumbnails!
        console.log(`♻️ [Sheet ${sheetNum}] Reusing existing page thumbnails`)
        logMemory(`before sheet ${sheetNum}`)

        const [canvas1, canvas2] = await Promise.all([
          dataUrlToCanvas(p1.thumbnail || p1.baseImage),
          pageNum2 && p2 ? dataUrlToCanvas(p2.thumbnail || p2.baseImage) : Promise.resolve(null)
        ])

        if (signal.aborted) return

        if (canvas1) {
          const thumbnail = await combinePagesThumbnail(
            { canvas: canvas1, editHistory: p1?.editHistory },
            { canvas: canvas2, editHistory: p2?.editHistory }
          )

          if (thumbnail) {
            loadedSheetsRef.current.add(sheetNum)
            setSheets(prev => prev.map(s => s.sheetNumber === sheetNum ? { ...s, thumbnail, isLoading: false } : s))
            logMemory(`after sheet ${sheetNum}`)
            return  // Done! No need for pdf.js render
          }
        }
      }

      // ========== FALLBACK: Progressive Loading from pdf.js ==========
      console.log(`🖼️ [Sheet ${sheetNum}] No cached thumbnails, rendering from pdf.js`)
      logMemory(`before pdf.js sheet ${sheetNum}`)

      // STAGE 1: Ultra-Low-Res (0.03x) for instant display
      if (!lowResLoadedRef.current.has(sheetNum)) {
        const ULTRA_LOW_SCALE = 0.03
        // N-UP MODE: Pass isNupMode=true to disable A4 normalization
        const [lowCanvas1, lowCanvas2] = await Promise.all([
          controller.getRawPreview?.(pageNum1, ULTRA_LOW_SCALE, signal, true),
          pageNum2 ? controller.getRawPreview?.(pageNum2, ULTRA_LOW_SCALE, signal, true) : Promise.resolve(null)
        ])

        if (signal.aborted) return

        if (lowCanvas1) {
          const lowThumbnail = await combinePagesThumbnail(
            { canvas: lowCanvas1, editHistory: p1?.editHistory },
            { canvas: lowCanvas2, editHistory: p2?.editHistory }
          )
          setSheets(prev => prev.map(s => s.sheetNumber === sheetNum ? { ...s, thumbnail: lowThumbnail, isLoading: true } : s))
          lowResLoadedRef.current.add(sheetNum)
        }
      }

      if (signal.aborted) return

      // STAGE 2: Good Quality (0.15x)
      const GOOD_SCALE = 0.15
      // N-UP MODE: Pass isNupMode=true to disable A4 normalization
      const [canvas1, canvas2] = await Promise.all([
        controller.getRawPreview?.(pageNum1, GOOD_SCALE, signal, true),
        pageNum2 ? controller.getRawPreview?.(pageNum2, GOOD_SCALE, signal, true) : Promise.resolve(null)
      ])

      if (signal.aborted) return

      let thumbnail = null
      if (canvas1) {
        thumbnail = await combinePagesThumbnail(
          { canvas: canvas1, editHistory: p1?.editHistory },
          { canvas: canvas2, editHistory: p2?.editHistory }
        )
      }

      if (signal.aborted) return

      if (thumbnail) {
        loadedSheetsRef.current.add(sheetNum)
        setSheets(prev => prev.map(s => s.sheetNumber === sheetNum ? { ...s, thumbnail, isLoading: false } : s))
        logMemory(`after pdf.js sheet ${sheetNum}`)

        // Periodic detailed memory logging every 5 sheets
        if (loadedSheetsRef.current.size % 5 === 0) {
          logDetailedMemory(`After ${loadedSheetsRef.current.size} sheets loaded`)
        }
      } else {
        setSheets(prev => prev.map(s => s.sheetNumber === sheetNum ? { ...s, isLoading: false } : s))
      }
    } catch (err) {
      if (err.message === 'Aborted' || err.name === 'AbortError') {
        setSheets(prev => prev.map(s => s.sheetNumber === sheetNum ? { ...s, isLoading: false } : s))
      } else {
        console.error(`❌ [Sheet ${sheetNum}] Error:`, err)
      }
    } finally {
      loadingSheetsRef.current.delete(sheetNum)
      sheetControllersRef.current.delete(sheetNum)

      // Trigger next sheet load (queue pattern)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const pending = Array.from(visibleSheetsRef.current).filter(
          s => !loadedSheetsRef.current.has(s) && !loadingSheetsRef.current.has(s)
        )
        if (pending.length > 0) {
          loadSheetThumbnailOnDemand(pending[0])
        }
      }, 50)
    }
  }, [controller, pages, pagesPerSheet, isLargePdf, combinePagesThumbnail, dataUrlToCanvas, logMemory])

  // On-demand loader for single pages
  const loadThumbnailOnDemand = useCallback(async (pageNum, force = false) => {
    if (!controller || loadedThumbnailsRef.current.has(pageNum) || loadingPagesRef.current.has(pageNum)) return

    if (isLargePdf && !force && !visiblePagesRef.current.has(pageNum)) {
      return
    }

    try {
      loadingPagesRef.current.add(pageNum)
      setPages(prev => prev.map(p => p.pageNumber === pageNum ? { ...p, isLoading: true } : p))

      const thumbnail = await controller.getRawThumbnailAsync?.(pageNum) || controller.getThumbnail(pageNum)

      if (isLargePdf && !force && !visiblePagesRef.current.has(pageNum)) {
        loadingPagesRef.current.delete(pageNum)
        setPages(prev => prev.map(p => p.pageNumber === pageNum ? { ...p, isLoading: false } : p))
        return
      }

      if (thumbnail) {
        // Calculate visual dimensions after rotation
        const metadata = controller?.getPageMetadata(pageNum)
        const rotation = metadata?.transforms?.rotation || 0
        const isRotated90or270 = ((rotation % 360) + 360) % 360 === 90 || ((rotation % 360) + 360) % 360 === 270
        const dimensions = metadata?.originalDimensions || { width: 595, height: 842 }

        const visualWidth = isRotated90or270 ? dimensions.height : dimensions.width
        const visualHeight = isRotated90or270 ? dimensions.width : dimensions.height

        setPages(prev => prev.map(p => p.pageNumber === pageNum ? {
          ...p,
          baseImage: thumbnail,
          thumbnail,
          isLoading: false,
          width: visualWidth,
          height: visualHeight
        } : p))
        loadedThumbnailsRef.current.add(pageNum)
        setThumbnail(pageNum, {
          dataUrl: thumbnail,
          width: visualWidth,
          height: visualHeight
        })

        // Periodic memory logging every 10 thumbnails
        if (loadedThumbnailsRef.current.size % 10 === 0) {
          logDetailedMemory(`After ${loadedThumbnailsRef.current.size} thumbnails loaded`)
        }
      }
    } catch (err) {
      console.warn(`⚠️ Thumbnail ${pageNum} failed:`, err)
    } finally {
      loadingPagesRef.current.delete(pageNum)

      // Pipelined Queue: Trigger next page immediately to keep concurrency full
      setTimeout(() => {
        const MAX_CONCURRENT = 4
        if (loadingPagesRef.current.size < MAX_CONCURRENT) {
          const pending = Array.from(visiblePagesRef.current).filter(
            p => !loadedThumbnailsRef.current.has(p) && !loadingPagesRef.current.has(p)
          )

          if (pending.length > 0) {
            // Pick the next one (prioritize sequential scan)
            const nextPage = pending[0]
            console.log(`🔄 [Queue] Pipelining page: ${nextPage} (active: ${loadingPagesRef.current.size})`)
            loadThumbnailOnDemand(nextPage)
          }
        }
      }, 10)
    }
  }, [isLargePdf, controller, setThumbnail])

  // Initial Load Effect: Load first few items instantly
  useEffect(() => {
    if (!controller || !isReady || pages.length === 0) return

    const loadInitialItems = async () => {
      if (pagesPerSheet === 1) {
        // Individual pages
        if (isLargePdf) {
          const count = Math.min(6, pages.length)
          console.log(`📄 [PDFEditorNew] Large PDF: Fast-loading first ${count} pages`)
          for (let i = 1; i <= count; i++) {
            loadThumbnailOnDemand(i, true)
          }
        } else {
          // Small PDF: Background load all in batches
          for (let i = 1; i <= pages.length; i++) {
            loadThumbnailOnDemand(i)
          }
        }
      } else if (sheets.length > 0) {
        // N-up sheets (already has its own generator but we ensure loading starts)
        if (isLargePdf) {
          const count = Math.min(4, sheets.length)
          console.log(`📄 [PDFEditorNew] Large PDF: Fast-loading first ${count} sheets`)
          for (let i = 1; i <= count; i++) {
            loadSheetThumbnailOnDemand(i, true)
          }
        } else {
          for (let i = 1; i <= sheets.length; i++) {
            loadSheetThumbnailOnDemand(i)
          }
        }
      }
    }

    loadInitialItems()
  }, [controller, isReady, pages.length, sheets.length, pagesPerSheet, isLargePdf, loadThumbnailOnDemand, loadSheetThumbnailOnDemand])

  // Refactored: LoadVisibleItems accessible to all handlers
  const loadVisibleItems = useCallback(() => {
    // 1. Load Visible Pages (1-up mode)
    if (pagesPerSheet === 1) {
      const MAX_CONCURRENT_PAGES = 4
      const currentlyLoading = loadingPagesRef.current.size
      const slotsAvailable = Math.max(0, MAX_CONCURRENT_PAGES - currentlyLoading)

      if (slotsAvailable === 0) return

      const pagesToLoad = Array.from(visiblePagesRef.current)
        .filter(pageNum => !loadedThumbnailsRef.current.has(pageNum) && !loadingPagesRef.current.has(pageNum))
        .slice(0, slotsAvailable)

      if (pagesToLoad.length > 0) {
        console.log(`📷 [Debounce Fired] Loading ${pagesToLoad.length} pages`)
        pagesToLoad.forEach(pageNum => loadThumbnailOnDemand(pageNum))
      }
    }

    // 2. Load Visible Sheets (N-up mode) - Pipelined
    else if (pagesPerSheet > 1 && sheets.length > 0) {
      const MAX_CONCURRENT_SHEETS = 4 // Increased from 2 to 4 per user request
      const currentlyLoading = loadingSheetsRef.current.size
      const slotsAvailable = Math.max(0, MAX_CONCURRENT_SHEETS - currentlyLoading)

      if (slotsAvailable === 0) return

      const sheetsToLoad = Array.from(visibleSheetsRef.current)
        .filter(sheetNum => !loadedSheetsRef.current.has(sheetNum) && !loadingSheetsRef.current.has(sheetNum))
        .slice(0, slotsAvailable)

      if (sheetsToLoad.length > 0) {
        console.log(`📷 [Sheet Loader] Starting ${sheetsToLoad.length} sheets`)
        sheetsToLoad.forEach(sheetNum => loadSheetThumbnailOnDemand(sheetNum))
      }
    }
  }, [pagesPerSheet, sheets.length, isLargePdf, loadThumbnailOnDemand, loadSheetThumbnailOnDemand])
  // Intersection Observer for on-demand thumbnail loading (large PDFs only)
  useEffect(() => {
    if (!isLargePdf) return

    let observer = null
    let debounceId = null
    let scrollCleanup = null

    // Function Logic Moved to useCallback above


    // Small delay to ensure DOM elements are rendered
    const timeoutId = setTimeout(() => {
      if (!thumbnailGridRef.current) return

      // Find the scrollable parent container
      const scrollContainer = thumbnailGridRef.current.closest('.overflow-auto') ||
        thumbnailGridRef.current.closest('[style*="overflow"]') ||
        document.querySelector('.overflow-auto') || // Fallback to common class
        null

      console.log('📷 [Observer] Scroll container:', scrollContainer ? 'found' : 'not found (using viewport)')

      // Scroll Handler - Reset debounce on scroll
      const handleScroll = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(loadVisibleItems, 400) // Snapier 400ms
      }

      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
        scrollCleanup = () => scrollContainer.removeEventListener('scroll', handleScroll)
      } else {
        window.addEventListener('scroll', handleScroll, { passive: true })
        scrollCleanup = () => window.removeEventListener('scroll', handleScroll)
      }

      observer = new IntersectionObserver(
        (entries) => {
          // Update visible set for PAGES
          entries.forEach(entry => {
            const pageNum = parseInt(entry.target.dataset.pageNum, 10)
            if (pageNum) {
              if (entry.isIntersecting) {
                visiblePagesRef.current.add(pageNum)
              } else {
                visiblePagesRef.current.delete(pageNum)
              }
            }

            // Update visible set for SHEETS
            const sheetNum = parseInt(entry.target.dataset.sheetNum, 10)
            if (sheetNum) {
              if (entry.isIntersecting) {
                visibleSheetsRef.current.add(sheetNum)
              } else {
                visibleSheetsRef.current.delete(sheetNum)
                // Cancel if currently loading and scrolled away
                if (loadingSheetsRef.current.has(sheetNum) && sheetControllersRef.current.has(sheetNum)) {
                  console.log(`🛑 Cancelling sheet ${sheetNum} (scrolled away)`)
                  sheetControllersRef.current.get(sheetNum).abort()
                  sheetControllersRef.current.delete(sheetNum)
                }
              }
            }
          })

          // Also trigger debounce from Observer changes (for initial load or jump)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(loadVisibleItems, 500)
        },
        {
          root: scrollContainer,
          rootMargin: '100px',
          threshold: 0
        }
      )

      // Observe all thumbnail containers (both pages and sheets)
      const thumbnailElements = thumbnailGridRef.current.querySelectorAll('[data-page-num], [data-sheet-num]')
      console.log(`📷 [Observer] Observing ${thumbnailElements.length} elements (pages/sheets)`)
      thumbnailElements.forEach(el => observer.observe(el))
    }, 200)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (observer) observer.disconnect()
      if (scrollCleanup) scrollCleanup()
    }
  }, [isLargePdf, loadThumbnailOnDemand, loadSheetThumbnailOnDemand, pages.length, sheets.length])





  // Sync pagesPerSheet with controller for N-up layout
  useEffect(() => {
    if (controller && isReady && pagesPerSheet) {
      console.log(`📄 [PDFEditorNew] Setting pagesPerSheet to ${pagesPerSheet}`)
      controller.setPagesPerSheet?.(pagesPerSheet)

      // When pagesPerSheet changes, recalculate sheets
      if (pagesPerSheet > 1 && pages.length > 0) {
        // Log detailed memory before N-up sheet generation
        logDetailedMemory(`Before N-up Mode (${pagesPerSheet}-up)`, {
          pdfArrayBuffer: file?.size || 0,
          statePages: pages.length,
          dataUrlsInState: pages.reduce((sum, p) => sum + (p.thumbnail?.length || 0) * 2, 0)
        })
        generateSheetThumbnails()
      } else {
        setSheets([])  // Clear sheets in 1-up mode
      }
    }
  }, [controller, isReady, pagesPerSheet, pages.length])

  // Generate COMBINED sheet thumbnails for N-up mode
  // Renders PDF pages to canvas and combines them into single image
  // Generate COMBINED sheet thumbnails for N-up mode
  // Optimized for on-demand loading
  const generateSheetThumbnails = useCallback(async () => {
    if (!controller || pagesPerSheet <= 1 || pages.length === 0) {
      setSheets([])
      setIsGeneratingSheets(false)
      loadedSheetsRef.current.clear()
      onSheetsGenerating?.(false)
      return
    }

    setIsGeneratingSheets(true)
    onSheetsGenerating?.(true)

    // Clear previous sheet cache when layout changes
    loadedSheetsRef.current.clear()

    const sheetCount = Math.ceil(pages.length / pagesPerSheet)
    const newSheets = []

    // 1. Create Placeholders First (Instant)
    for (let sheetNum = 1; sheetNum <= sheetCount; sheetNum++) {
      const startIdx = (sheetNum - 1) * pagesPerSheet
      const pageNum1 = startIdx + 1
      const pageNum2 = startIdx + 2 <= pages.length ? startIdx + 2 : null

      newSheets.push({
        sheetNumber: sheetNum,
        pages: pageNum2 ? [pageNum1, pageNum2] : [pageNum1],
        thumbnail: null,
        isLoading: isLargePdf ? false : true // Only show spinner default if auto-loading
      })
    }
    setSheets(newSheets)
    setIsGeneratingSheets(false) // Ready to show placeholders
    onSheetsGenerating?.(false)

    // 2. If Large PDF: Stop here, let Effect/Observer handle loading
    if (isLargePdf) {
      console.log(`📄 [PDFEditorNew] Large PDF N-up: Created ${sheetCount} placeholders. Waiting for effect/scroll.`)
      return
    }

    // 3. If Small PDF: Load all in background (legacy/fast behavior)
    console.log(`📄 [PDFEditorNew] Small PDF N-up: Loading all ${sheetCount} sheets in background...`)

    // Use the same on-demand function but loop through all
    // (We could batch this but reusing the logic is cleaner)
    for (let i = 1; i <= sheetCount; i++) {
      loadSheetThumbnailOnDemand(i)
    }

  }, [controller, pagesPerSheet, pages, onSheetsGenerating, isLargePdf, loadSheetThumbnailOnDemand])

  // Combine two page canvases into a single landscape thumbnail (matching PDFEditorSheetPopup logic)
  // Combine two page canvases into a single landscape thumbnail (matching PDFEditorSheetPopup logic)
  // Accepts: { canvas, editHistory } objects
  // No changes needed here, just deleting the old definition at the bottom

  // --- Event Handlers (Top Level) ---

  const handlePageEdited = useCallback(async (e) => {
    const { pageIndex, edits } = e.detail
    const pages = pagesRef.current

    const rotation = edits.rotation || 0
    const isRotated90or270 = ((rotation % 360) + 360) % 360 === 90 || ((rotation % 360) + 360) % 360 === 270

    setPages(prev => prev.map((p, idx) =>
      idx === pageIndex ? {
        ...p,
        width: isRotated90or270 ? (p.originalHeight || p.height) : (p.originalWidth || p.width),
        height: isRotated90or270 ? (p.originalWidth || p.width) : (p.originalHeight || p.height),
        editHistory: {
          rotation: edits.rotation || 0,
          scale: edits.scale || 100,
          offsetX: edits.offsetX || 0,
          offsetY: edits.offsetY || 0,
          crop: edits.crop || null
        },
        edited: true
      } : p
    ))

    // Handle N-up sheet regeneration if needed
    if (pagesPerSheet > 1 && controller) {
      const sheetIndex = Math.floor(pageIndex / pagesPerSheet)
      const sheetNumber = sheetIndex + 1

      try {
        const startIdx = sheetIndex * pagesPerSheet
        const pageNum1 = startIdx + 1
        const pageNum2 = startIdx + 2 <= pages.length ? startIdx + 2 : null

        // N-UP MODE: Pass isNupMode=true to disable A4 normalization
        const canvas1 = await controller.getRawPreview?.(pageNum1, 0.5, undefined, true)
        const canvas2 = pageNum2 ? await controller.getRawPreview?.(pageNum2, 0.5, undefined, true) : null

        if (canvas1) {
          const p1 = pages.find(p => p.pageNumber === pageNum1)
          const p2 = pages.find(p => p.pageNumber === pageNum2)

          const pIdx = Number(pageIndex)
          let t1 = p1?.editHistory || {}
          if (p1 && Number(p1.pageNumber) === pIdx + 1) {
            t1 = { ...edits, crop: edits.crop || null }
          }

          let t2 = p2?.editHistory || {}
          if (p2 && Number(p2.pageNumber) === pIdx + 1) {
            t2 = { ...edits, crop: edits.crop || null }
          }

          const newThumbnail = await combinePagesThumbnail(
            { canvas: canvas1, editHistory: t1 },
            { canvas: canvas2, editHistory: t2 }
          )

          setSheets(prev => prev.map(s =>
            s.sheetNumber === sheetNumber ? { ...s, thumbnail: newThumbnail } : s
          ))
        }
      } catch (err) {
        console.warn(`Failed to regenerate sheet ${sheetNumber} thumbnail:`, err)
      }
    }

    if (onPagesLoaded) {
      setPages(prev => {
        onPagesLoaded(prev, prev.length)
        return prev
      })
    }

    setTimeout(() => {
      const recipe = exportRecipe()
      if (recipe) {
        window.dispatchEvent(new CustomEvent('pdfEditorUpdate', {
          detail: {
            editedPagesData: { [pageIndex + 1]: { editHistory: edits, edited: true } },
            recipe,
            totalPages: pages.length
          }
        }))
      }
    }, 100)
  }, [controller, pagesPerSheet, onPagesLoaded, exportRecipe])

  const handleAllPagesEdited = useCallback((e) => {
    const { edits } = e.detail

    setPages(prev => {
      const updated = prev.map(p => ({
        ...p,
        editHistory: {
          rotation: edits.rotation || 0,
          scale: edits.scale || 100,
          offsetX: edits.offsetX || 0,
          offsetY: edits.offsetY || 0,
          crop: edits.crop || null
        },
        edited: true
      }))
      if (onPagesLoaded) {
        onPagesLoaded(updated, updated.length)
      }
      return updated
    })

    setTimeout(() => {
      const recipe = exportRecipe()
      if (recipe) {
        window.dispatchEvent(new CustomEvent('pdfEditorUpdate', {
          detail: {
            editedPagesData: {},
            recipe,
            totalPages: pagesRef.current.length
          }
        }))
      }
    }, 100)

    // REGENERATE SHEETS for N-up mode
    if (pagesPerSheet > 1) {
      loadedSheetsRef.current.clear()
      setSheets(prev => prev.map(s => ({ ...s, thumbnail: null, isLoading: false })))
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(loadVisibleItems, 100)
    }
  }, [onPagesLoaded, exportRecipe, pagesPerSheet, loadVisibleItems])

  const handleAllSheetsEdited = useCallback((e) => {
    const { editsPage1, editsPage2 } = e.detail
    console.log('🔵 handleAllSheetsEdited: Bulk Applying Edits', { editsPage1, editsPage2 })

    setPages(prev => prev.map((p, idx) => {
      if (pagesPerSheet < 2) return p
      const slot = idx % pagesPerSheet
      let edits = null
      if (slot === 0 && editsPage1) edits = editsPage1
      else if (slot === 1 && editsPage2) edits = editsPage2
      if (!edits) return p
      return {
        ...p,
        editHistory: {
          ...p.editHistory,
          ...edits,
          crop: edits.crop || null
        },
        edited: true
      }
    }))

    loadedSheetsRef.current.clear()
    setSheets(prev => prev.map(s => ({ ...s, thumbnail: null, isLoading: false })))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(loadVisibleItems, 100)

    setTimeout(() => {
      const recipe = exportRecipe()
      if (recipe) {
        window.dispatchEvent(new CustomEvent('pdfEditorUpdate', {
          detail: { recipe, totalPages: pagesRef.current.length }
        }))
      }
    }, 200)
  }, [pagesPerSheet, loadVisibleItems, exportRecipe])

  const handleSheetEdited = useCallback(async (e) => {
    const { sheetNumber, page1, page2 } = e.detail
    const pages = pagesRef.current

    setPages(prev => prev.map((p, idx) => {
      if (page1 && idx === page1.index) {
        return {
          ...p,
          editHistory: {
            rotation: page1.edits.rotation || 0,
            scale: page1.edits.scale || 100,
            offsetX: page1.edits.offsetX || 0,
            offsetY: page1.edits.offsetY || 0,
            crop: page1.edits.crop || null
          },
          edited: true
        }
      }
      if (page2 && idx === page2.index) {
        return {
          ...p,
          editHistory: {
            rotation: page2.edits.rotation || 0,
            scale: page2.edits.scale || 100,
            offsetX: page2.edits.offsetX || 0,
            offsetY: page2.edits.offsetY || 0,
            crop: page2.edits.crop || null
          },
          edited: true
        }
      }
      return p
    }))

    if (onPagesLoaded) {
      setPages(prev => {
        onPagesLoaded(prev, prev.length)
        return prev
      })
    }

    try {
      if (controller) {
        const p1 = pages[page1.index]
        const p2 = page2 ? pages[page2.index] : null
        const canvas1 = await controller.getRawPreview?.(p1.pageNumber, 0.5, undefined, true)
        const canvas2 = p2 ? await controller.getRawPreview?.(p2.pageNumber, 0.5, undefined, true) : null

        if (canvas1) {
          const newThumb = await combinePagesThumbnail(
            { canvas: canvas1, editHistory: page1.edits },
            { canvas: canvas2, editHistory: page2 ? page2.edits : {} }
          )
          setSheets(prev => prev.map(s =>
            s.sheetNumber === sheetNumber ? { ...s, thumbnail: newThumb } : s
          ))
        }
      }
    } catch (err) {
      console.warn('Failed to update sheet thumbnail:', err)
    }

    setTimeout(() => {
      const recipe = exportRecipe()
      if (recipe) {
        window.dispatchEvent(new CustomEvent('pdfEditorUpdate', {
          detail: { editedPagesData: {}, recipe, totalPages: pagesRef.current.length }
        }))
      }
    }, 100)
  }, [controller, exportRecipe])

  // --- Event Listener Registration ---

  useEffect(() => {
    window.addEventListener('pdfPageEdited', handlePageEdited)
    window.addEventListener('pdfAllPagesEdited', handleAllPagesEdited)
    window.addEventListener('pdfSheetEdited', handleSheetEdited)
    window.addEventListener('pdfAllSheetsEdited', handleAllSheetsEdited)

    return () => {
      window.removeEventListener('pdfPageEdited', handlePageEdited)
      window.removeEventListener('pdfAllPagesEdited', handleAllPagesEdited)
      window.removeEventListener('pdfSheetEdited', handleSheetEdited)
      window.removeEventListener('pdfAllSheetsEdited', handleAllSheetsEdited)
    }
  }, [handlePageEdited, handleAllPagesEdited, handleSheetEdited, handleAllSheetsEdited])

  const openEditPopup = useCallback(async (pageIndex) => {
    const page = pages[pageIndex]
    if (!page) return

    setEditingPageIndex(pageIndex)
    setEditingPageNumber(page.pageNumber)

    rotationHandler.initialize(page.editHistory?.rotation || 0)

    setSettings({
      rotation: page.editHistory?.rotation || 0,
      scale: page.editHistory?.scale || 100,
      offsetX: page.editHistory?.offsetX || 0,
      offsetY: page.editHistory?.offsetY || 0
    })
    setUserScale(page.editHistory?.scale || 100)
    setCropArea(page.editHistory?.crop || null)
    setCropMode(false)
    setZoom(1)

    if (controller && page.pageNumber) {
      try {
        const canvas = await controller.ensurePreview?.(page.pageNumber) || controller.getPagePreview(page.pageNumber)
        if (canvas) {
          setPages(prev => prev.map((p, idx) =>
            idx === pageIndex ? { ...p, canvas, originalCanvas: canvas } : p
          ))
        }
      } catch (err) {
        console.warn('Failed to load page canvas:', err)
      }
    }

    setShowEditPopup(true)
  }, [pages, controller, rotationHandler])

  const closeEditPopup = useCallback(() => {
    const page = pages[editingPageIndex]
    if (!page) {
      setShowEditPopup(false)
      return
    }

    const hasChanges = settings.rotation !== (page.editHistory?.rotation || 0) ||
      settings.scale !== (page.editHistory?.scale || 100) ||
      cropArea !== page.editHistory?.crop

    if (hasChanges) {
      setShowUnsavedChangesPopup(true)
    } else {
      setShowEditPopup(false)
      setCropMode(false)
      setCropArea(null)
    }
  }, [pages, editingPageIndex, settings, cropArea])

  const handleRotation = useCallback((direction) => {
    const delta = direction === 'cw' ? 90 : -90
    const newRotation = ((settings.rotation + delta) % 360 + 360) % 360

    setSettings(prev => ({ ...prev, rotation: newRotation }))
    rotationHandler.setRotation(newRotation)

    if (controller && editingPageNumber > 0) {
      applyEdit(editingPageNumber, { type: 'rotate', value: delta })
    }
  }, [settings.rotation, controller, editingPageNumber, applyEdit, rotationHandler])

  const startCrop = useCallback(() => {
    const page = pages[editingPageIndex]
    if (!page) return

    const defaultCrop = cropHandler.createCenteredCrop(0.1)
    setCropArea(defaultCrop)
    setPendingCropPreview(defaultCrop)
    setCropMode(true)
  }, [pages, editingPageIndex, cropHandler])

  const applyCrop = useCallback(() => {
    if (!cropArea) return

    const validatedCrop = cropHandler.validateCropBox(cropArea)

    if (controller && editingPageNumber > 0) {
      applyEdit(editingPageNumber, { type: 'crop', value: validatedCrop })
    }

    setPages(prev => prev.map((p, idx) =>
      idx === editingPageIndex ? {
        ...p,
        editHistory: { ...p.editHistory, crop: validatedCrop },
        edited: true
      } : p
    ))

    setCropMode(false)
    setPendingCropPreview(null)
  }, [cropArea, controller, editingPageNumber, editingPageIndex, applyEdit, cropHandler])

  const cancelCrop = useCallback(() => {
    setCropMode(false)
    setCropArea(pages[editingPageIndex]?.editHistory?.crop || null)
    setPendingCropPreview(null)
  }, [pages, editingPageIndex])

  const resetSettings = useCallback(() => {
    setSettings({ rotation: 0, scale: 100, offsetX: 0, offsetY: 0 })
    setUserScale(100)
    setCropArea(null)
    setCropMode(false)

    rotationHandler.reset()

    if (controller && editingPageNumber > 0) {
      resetPage(editingPageNumber)
    }

    setPages(prev => prev.map((p, idx) =>
      idx === editingPageIndex ? {
        ...p,
        editHistory: { rotation: 0, scale: 100, offsetX: 0, offsetY: 0, crop: null },
        edited: false
      } : p
    ))
  }, [controller, editingPageNumber, editingPageIndex, resetPage, rotationHandler])

  const applyToAllPages = useCallback(async () => {
    if (isApplyingAll) return

    setIsApplyingAll(true)
    setApplyAllProgress(0)

    const pageCount = pages.length

    for (let i = 0; i < pageCount; i++) {
      if (controller) {
        if (settings.rotation !== 0) {
          applyEdit(i + 1, { type: 'rotate', value: settings.rotation })
        }
        if (settings.scale !== 100) {
          applyEdit(i + 1, { type: 'scale', value: settings.scale })
        }
        if (cropArea) {
          applyEdit(i + 1, { type: 'crop', value: cropArea })
        }
      }

      setPages(prev => prev.map((p, idx) =>
        idx === i ? {
          ...p,
          editHistory: { ...settings, crop: cropArea },
          edited: true
        } : p
      ))

      setApplyAllProgress((i + 1) / pageCount)
      await new Promise(r => setTimeout(r, 10))
    }

    setIsApplyingAll(false)
    setApplyAllProgress(0)
  }, [pages.length, settings, cropArea, controller, applyEdit, isApplyingAll])

  const handleSave = useCallback(async () => {
    if (isApplying) return

    setIsApplying(true)
    setApplyProgress(0)

    try {
      setPages(prev => prev.map((p, idx) =>
        idx === editingPageIndex ? {
          ...p,
          editHistory: { ...settings, crop: cropArea },
          edited: true
        } : p
      ))

      setApplyProgress(0.5)

      const recipe = exportRecipe()

      const editedPagesData = {}
      pages.forEach((page, idx) => {
        if (page.edited || idx === editingPageIndex) {
          editedPagesData[page.pageNumber] = {
            ...page,
            editHistory: idx === editingPageIndex ? { ...settings, crop: cropArea } : page.editHistory
          }
        }
      })

      window.dispatchEvent(new CustomEvent('pdfEditorUpdate', {
        detail: {
          editedPagesData,
          recipe,
          totalPages: pages.length
        }
      }))

      setApplyProgress(1)

      setShowEditPopup(false)
      setCropMode(false)

      if (onSave) {
        onSave({
          pages: pages.map((p, idx) =>
            idx === editingPageIndex ? { ...p, editHistory: { ...settings, crop: cropArea }, edited: true } : p
          ),
          recipe
        })
      }

    } catch (err) {
      console.error('❌ Save failed:', err)
      setError(err.message)
    } finally {
      setIsApplying(false)
      setApplyProgress(0)
    }
  }, [pages, editingPageIndex, settings, cropArea, exportRecipe, onSave, isApplying])

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedChangesPopup(false)
    setShowEditPopup(false)
    setCropMode(false)
    setCropArea(null)
  }, [])

  const handleSaveAndClose = useCallback(() => {
    setShowUnsavedChangesPopup(false)
    handleSave()
  }, [handleSave])

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel()
    }
  }, [onCancel])

  const currentPage = pages[editingPageIndex]
  const targetPageSize = getPageSize(currentPageSize)

  // Show full-screen loader if:
  // 1. Controller is parsing/loading the document
  // 2. Sheets are being generated (in N-up mode)
  // 3. Pages haven't been populated yet (initial load gap)
  const isInitializing = loading && loadingStage === 'parsing'
  const isPreparingGrid = pagesPerSheet > 1 ? isGeneratingSheets : pages.length === 0

  if (isInitializing || isPreparingGrid) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingExperience
          loadingStage={loadingStage || 'parsing'}
          loadedCount={pages.length}
          totalPages={pages.length || 0}
          isLargePdf={isLargePdf}
        />
      </div>
    )
  }

  if (error || controllerError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load PDF</h3>
        <p className="text-gray-600 text-center mb-4">{error || controllerError}</p>
        <button
          onClick={handleCancel}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      <div className="flex-1">
        <div className="bg-white p-0 sm:p-2">
          {/* Render sheets in N-up mode, otherwise individual pages */}
          {pagesPerSheet > 1 && sheets.length > 0 ? (
            /* N-up Mode: Show composite sheet thumbnails */
            <div ref={thumbnailGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sheets.map((sheet) => {
                // Check if all pages in sheet are selected
                const isSelected = sheet.pages.every(pn => selectedPages.includes(pn))

                // Check if any page in sheet is edited
                const isEdited = sheet.pages.some(pn => {
                  const p = pages.find(pg => pg.pageNumber === pn)
                  return p?.edited
                })

                return (
                  <div
                    key={`sheet-${sheet.sheetNumber}`}
                    data-sheet-num={sheet.sheetNumber}  // Critical for Intersection Observer
                    className={`relative rounded-lg border transition-all ${isSelected
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : isEdited
                        ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    {/* Selection Checkbox for sheet */}
                    {onPageSelect && (
                      <div className="absolute top-1 left-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Toggle all pages in sheet
                            sheet.pages.forEach(pn => onPageSelect(pn))
                          }}
                          className="bg-white rounded shadow-sm p-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Sheet Thumbnail - COMBINED image of 2 pages */}
                    <div
                      className="aspect-[1.414] bg-gray-100 rounded-t-lg overflow-hidden cursor-pointer"
                      onClick={() => {
                        if (onEditSheet) {
                          // N-up mode: Open sheet editor
                          const page1Index = pages.findIndex(p => p.pageNumber === sheet.pages[0])
                          const page2Index = sheet.pages[1] ? pages.findIndex(p => p.pageNumber === sheet.pages[1]) : -1
                          const page1 = pages[page1Index]
                          const page2 = page2Index >= 0 ? pages[page2Index] : null

                          onEditSheet({
                            sheetNumber: sheet.sheetNumber,
                            pages: sheet.pages,
                            page1Data: { index: page1Index, page: page1 },
                            page2Data: page2 ? { index: page2Index, page: page2 } : null,
                            controller,
                            applyEdit,
                            pagesPerSheet
                          })
                        } else if (onPageSelect) {
                          onPageSelect(sheet.pages[0])
                        }
                      }}
                    >
                      {sheet.thumbnail ? (
                        <img
                          src={sheet.thumbnail}
                          alt={`Sheet ${sheet.sheetNumber}`}
                          className="w-full h-full object-contain"
                        />
                      ) : sheet.isLoading ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                          <ShimmerLoader className="w-full h-full" width="100%" height="100%" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                          <Grid className="w-8 h-8 mb-1" />
                          <span className="text-xs">Sheet {sheet.pages.join('-')}</span>
                        </div>
                      )}
                    </div>

                    {/* Sheet Label */}
                    <div className="p-2 text-center">
                      <span className="text-xs text-gray-600">
                        Pages {sheet.pages.join('-')}
                      </span>
                      {isEdited && (
                        <span className="ml-1 text-xs text-purple-600">(edited)</span>
                      )}
                    </div>

                    {/* Single Edit Button for Sheet */}
                    <div className="px-1 pb-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Get both page data for sheet editing
                          const page1Index = pages.findIndex(p => p.pageNumber === sheet.pages[0])
                          const page2Index = sheet.pages[1] ? pages.findIndex(p => p.pageNumber === sheet.pages[1]) : -1
                          const page1 = pages[page1Index]
                          const page2 = page2Index >= 0 ? pages[page2Index] : null

                          if (onEditSheet) {
                            // N-up mode: pass sheet data
                            onEditSheet({
                              sheetNumber: sheet.sheetNumber,
                              pages: sheet.pages,
                              page1Data: { index: page1Index, page: page1 },
                              page2Data: page2 ? { index: page2Index, page: page2 } : null,
                              controller,
                              applyEdit,
                              pagesPerSheet
                            })
                          } else if (onEditPage && page1) {
                            // Fallback: edit first page
                            onEditPage(page1Index, page1, controller, applyEdit)
                          }
                        }}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all shadow-sm active:scale-95"
                      >
                        Edit Sheet
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Normal Mode: Show individual page thumbnails */
            <div ref={thumbnailGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {pages.map((page, index) => {
                const isSelected = selectedPages.includes(page.pageNumber)
                return (
                  <div
                    key={page.pageNumber}
                    data-page-num={page.pageNumber}
                    className={`relative rounded-lg border transition-all ${isSelected
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : page.edited
                        ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    {/* Selection Checkbox */}
                    {onPageSelect && (
                      <div className="absolute top-1 left-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onPageSelect(page.pageNumber)
                          }}
                          className="bg-white rounded shadow-sm p-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Thumbnail - click to toggle selection */}
                    <div
                      className="aspect-[3/4] bg-gray-100 rounded-t-lg overflow-hidden cursor-pointer"
                      onClick={() => onPageSelect ? onPageSelect(page.pageNumber) : openEditPopup(index)}
                    >
                      {/* Use TransformThumbnail for instant transform updates */}
                      {(page.baseImage || page.thumbnail) ? (
                        <TransformThumbnail
                          baseImage={page.baseImage || page.thumbnail}
                          transforms={page.editHistory}
                          size={150}
                          className="w-full h-full"
                        />
                      ) : page.isLoading ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                          <ShimmerLoader className="w-full h-full" width="100%" height="100%" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                          <FileText className="w-8 h-8 mb-1" />
                          <span className="text-xs">Page {page.pageNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Page Number */}
                    <div className="p-2 text-center">
                      <span className="text-xs text-gray-600">Page {page.pageNumber}</span>
                      {page.edited && (
                        <span className="ml-1 text-xs text-purple-600">(edited)</span>
                      )}
                    </div>

                    {/* Edit Button - Bottom of card */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('Edit clicked:', { index, page, controller, applyEdit, onEditPage: !!onEditPage })
                        if (onEditPage) {
                          onEditPage(index, page, controller, applyEdit)
                        } else {
                          console.warn('onEditPage prop not provided')
                        }
                      }}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-b-lg transition-all shadow-sm active:scale-95"
                    >
                      Edit Page
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>


      <UnsavedChangesPopup
        isOpen={showUnsavedChangesPopup}
        onDiscard={handleDiscardChanges}
        onSaveAndClose={handleSaveAndClose}
        message="You have unsaved edits to this PDF. Would you like to save your changes before closing?"
      />
    </div>
  )
})

PDFEditorNew.displayName = 'PDFEditorNew'

export default PDFEditorNew
