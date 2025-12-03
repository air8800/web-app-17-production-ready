import React, { useState, useEffect, lazy, Suspense } from 'react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url'
import { PDFDocument } from 'pdf-lib'
import { SquareCheck as CheckSquare, Square, FileText, Loader, Search, X } from 'lucide-react'
import { getPageSize, DEFAULT_PAGE_SIZE } from '../utils/pageSizes'
import usePDFStore, { CONTROLLER_BLOCKING } from '../stores/pdfStore'
import { USE_NEW_PDF_CONTROLLER } from '../utils/pdf2'

const PDFEditor = lazy(() => import('./PDFEditorNew'))

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const PAGES_PER_BATCH = 2 // Load 2 pages at a time for faster first paint

const QUALITY_TIERS = {
  ULTRA_LOW: 'ULTRA_LOW',
  APPROPRIATE: 'APPROPRIATE',
  BEST: 'BEST'
}

const QUALITY_CONFIG = {
  [QUALITY_TIERS.ULTRA_LOW]: {
    scale: 0.2,
    jpegQuality: 0.4
  },
  [QUALITY_TIERS.APPROPRIATE]: {
    scale: 0.65,
    jpegQuality: 0.6
  },
  [QUALITY_TIERS.BEST]: {
    scale: 2.0,
    jpegQuality: 0.85
  }
}

const CACHE_LIMITS = {
  [QUALITY_TIERS.ULTRA_LOW]: 120,
  [QUALITY_TIERS.APPROPRIATE]: 80,
  [QUALITY_TIERS.BEST]: 12
}

const PDFPageSelector = ({ file, selectedPages, onPagesSelected, pageSize = DEFAULT_PAGE_SIZE, colorMode = 'BW', pagesPerSheet = 1, onEditPage, onPagesLoaded, viewMode = 'grid' }) => {
  const { controllerRequested, controllerActive, thumbnails, totalPages: storeTotalPages } = usePDFStore()
  
  const shouldSkipLoading = CONTROLLER_BLOCKING || controllerRequested || controllerActive
  
  const [pages, setPages] = useState([])
  const [originalPages, setOriginalPages] = useState([]) // Store original un-combined pages
  const [totalPages, setTotalPages] = useState(0)
  const [loadedPages, setLoadedPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [initialBatchLoaded, setInitialBatchLoaded] = useState(false) // Track first batch completion
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllSelected, setShowAllSelected] = useState(false)
  const [pdf, setPdf] = useState(null)
  const [fitToPageEnabled, setFitToPageEnabled] = useState(true)
  const [currentPageSize, setCurrentPageSize] = useState(pageSize)
  const [currentColorMode, setCurrentColorMode] = useState(colorMode)
  const [currentPagesPerSheet, setCurrentPagesPerSheet] = useState(pagesPerSheet)
  const [qualityCache, setQualityCache] = useState(new Map()) // Cache for different quality renders
  const [upgradingPages, setUpgradingPages] = useState(new Set()) // Track pages being upgraded
  const [reloadVersion, setReloadVersion] = useState(0) // Counter to force rebuild after edit
  const [currentPageIndex, setCurrentPageIndex] = useState(0) // For single-page view navigation
  const [cropActive, setCropActive] = useState(false) // Crop mode toggle for single view
  const [gridExpanded, setGridExpanded] = useState(false) // Toggle between compact and full grid view
  const observerRef = React.useRef(null)
  const editorRef = React.useRef(null) // Ref to PDFEditor for calling exportPDF
  const scrollObserverRef = React.useRef(null)
  const loadMoreTriggerRef = React.useRef(null)
  const nupCacheRef = React.useRef(new Map())
  const abortControllerRef = React.useRef(null) // Abort ongoing loads when file changes
  const justClearedRef = React.useRef(false) // Track if we just cleared edits
  
  // Refs to track current state for cleanup (prevent memory leaks)
  const originalPagesRef = React.useRef(originalPages)
  const pagesRef = React.useRef(pages)
  const qualityCacheRef = React.useRef(qualityCache)
  
  // Update refs when state changes
  useEffect(() => {
    originalPagesRef.current = originalPages
  }, [originalPages])
  
  useEffect(() => {
    pagesRef.current = pages
  }, [pages])
  
  useEffect(() => {
    qualityCacheRef.current = qualityCache
  }, [qualityCache])

  // Cleanup on unmount - revoke all blob URLs
  useEffect(() => {
    return () => {
      const revokedURLs = new Set() // Deduplicate to avoid revoking same URL twice
      
      originalPagesRef.current.forEach(page => {
        if (page._blobURL && !revokedURLs.has(page._blobURL)) {
          URL.revokeObjectURL(page._blobURL)
          revokedURLs.add(page._blobURL)
        }
      })
      
      pagesRef.current.forEach(page => {
        if (page._blobURL && !revokedURLs.has(page._blobURL)) {
          URL.revokeObjectURL(page._blobURL)
          revokedURLs.add(page._blobURL)
        }
      })
      
      qualityCacheRef.current.forEach(entry => {
        if (entry.page._blobURL && !revokedURLs.has(entry.page._blobURL)) {
          URL.revokeObjectURL(entry.page._blobURL)
          revokedURLs.add(entry.page._blobURL)
        }
      })
      
      nupCacheRef.current.forEach(sheet => {
        if (sheet._blobURL && !revokedURLs.has(sheet._blobURL)) {
          URL.revokeObjectURL(sheet._blobURL)
          revokedURLs.add(sheet._blobURL)
        }
      })
      
      nupCacheRef.current.clear()
      console.log(`🧹 Cleanup: Revoked ${revokedURLs.size} blob URLs on unmount`)
    }
  }, [])

  // Listen for PDF cleared event to force complete reset
  useEffect(() => {
    const handlePdfCleared = async (event) => {
      console.log('🧹 PDF cleared event received, setting flag for fresh reload')
      // Just set the flag - the file change useEffect will handle the reset
      justClearedRef.current = true
    }
    
    window.addEventListener('pdfCleared', handlePdfCleared)
    return () => window.removeEventListener('pdfCleared', handlePdfCleared)
  }, [])

  useEffect(() => {
    // Abort any ongoing loads when file changes
    if (abortControllerRef.current) {
      console.log('🛑 Aborting previous PDF load')
      abortControllerRef.current.abort()
    }
    
    if (file && file.type === 'application/pdf') {
      // If we just cleared, reset all state first
      if (justClearedRef.current) {
        console.log('🧹 Cleared flag detected - resetting all state before reload')
        setPdf(null)
        setTotalPages(0)
        setPages([])
        setOriginalPages([])
        setLoadedPages(0)
        setLoadingMore(false)
        setInitialBatchLoaded(false)
        setQualityCache(new Map())
        nupCacheRef.current.clear()
        justClearedRef.current = false
      }
      
      // Check if this is a new file
      const isNewFile = totalPages === 0 || !pdf
      
      console.log('📂 File changed:', file.name, '| isNewFile:', isNewFile, '| totalPages:', totalPages, '| pdf:', !!pdf)
      
      if (isNewFile) {
        // New file - load from scratch
        console.log('🆕 Loading new file from scratch...')
        loadInitialPDFPages()
      } else {
        // Edited file - reload the loaded pages without resetting placeholders
        console.log('📝 File updated (edited), reloading existing pages without reset')
        reloadExistingPages()
      }
    }
  }, [file])

  useEffect(() => {
    if (controllerActive && thumbnails.size > 0) {
      console.log(`🔄 [PDFPageSelector] Syncing ${thumbnails.size} thumbnails from shared store`)
      
      const syncedPages = []
      thumbnails.forEach((dataUrl, pageNumber) => {
        syncedPages.push({
          pageNumber,
          thumbnail: dataUrl,
          originalThumbnail: dataUrl,
          width: 595,
          height: 842,
          isFittedToPage: true,
          pageSize: pageSize,
          quality: 'APPROPRIATE'
        })
      })
      
      syncedPages.sort((a, b) => a.pageNumber - b.pageNumber)
      
      setPages(syncedPages)
      setOriginalPages(syncedPages)
      setTotalPages(syncedPages.length)
      setLoadedPages(syncedPages.length)
      setLoading(false)
      setInitialBatchLoaded(true)
      
      if (syncedPages.length > 0 && selectedPages.length === 0) {
        const allPageNumbers = syncedPages.map(p => p.pageNumber)
        onPagesSelected(allPageNumbers)
      }
    }
  }, [controllerActive, thumbnails.size])

  useEffect(() => {
    if (pageSize !== currentPageSize && pdf) {
      console.log('📐 Page size changed:', currentPageSize, '->', pageSize)
      setCurrentPageSize(pageSize)
      reloadPagesWithNewSize()
    }
  }, [pageSize])

  useEffect(() => {
    const settingsChanged = colorMode !== currentColorMode || pagesPerSheet !== currentPagesPerSheet
    if (settingsChanged) {
      console.log('🎨 Print settings changed - Color:', colorMode, 'Pages per sheet:', pagesPerSheet)
      setCurrentColorMode(colorMode)
      setCurrentPagesPerSheet(pagesPerSheet)
    }
  }, [colorMode, pagesPerSheet])

  useEffect(() => {
    // Apply settings whenever totalPages is set (even if no pages loaded yet)
    // reloadVersion ensures rebuild after edits even when other deps unchanged
    if (totalPages > 0) {
      console.log('📚 Applying settings to pages...', currentPagesPerSheet)
      applyPrintSettingsToPages()
    }
  }, [currentColorMode, currentPagesPerSheet, totalPages, reloadVersion])

  const reloadExistingPages = async () => {
    if (shouldSkipLoading) {
      console.log('🔒 [PDFPageSelector] Controller requested/active, skipping reloadExistingPages')
      return
    }
    
    try {
      setLoading(true)
      console.log('🔄 Reloading existing pages after edit...')
      
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const newTotalPages = pdfDoc.numPages
      
      console.log(`📊 Page count: old=${totalPages}, new=${newTotalPages}`)
      
      setPdf(pdfDoc)
      setTotalPages(newTotalPages)
      
      // Get the page numbers that were previously loaded, but only keep valid ones
      const loadedPageNumbers = originalPages
        .map(p => p.pageNumber)
        .filter(pageNum => pageNum <= newTotalPages)
      
      console.log(`🔄 Reloading ${loadedPageNumbers.length} previously loaded pages (valid in new PDF):`, loadedPageNumbers)
      
      // Re-render only the pages that were already loaded AND still exist
      const pagePromises = loadedPageNumbers.map(pageNum => 
        renderPageThumbnail(pdfDoc, pageNum, fitToPageEnabled)
      )
      
      const renderedPages = await Promise.all(pagePromises)
      const validPages = renderedPages.filter(p => p !== null)
      
      // Replace the originalPages with the newly rendered versions
      const sortedPages = validPages.sort((a, b) => a.pageNumber - b.pageNumber)
      setOriginalPages(sortedPages)
      setPages(sortedPages) // CRITICAL: Also update pages for UI
      
      // Update loadedPages to reflect the highest loaded page
      const maxLoadedPage = validPages.length > 0 
        ? Math.max(...validPages.map(p => p.pageNumber))
        : 0
      setLoadedPages(maxLoadedPage)
      
      // Update selected pages - remove any that are beyond the new page count
      const validSelectedPages = selectedPages.filter(pageNum => pageNum <= newTotalPages)
      if (validSelectedPages.length !== selectedPages.length) {
        console.log(`🔧 Adjusted selection: ${selectedPages.length} → ${validSelectedPages.length} pages`)
        onPagesSelected(validSelectedPages)
      }
      
      console.log(`✅ Reloaded ${validPages.length} pages after edit (new total: ${newTotalPages})`)
      
      // Increment reload version to trigger useEffect rebuild
      // This ensures UI reflects edits even when other dependencies unchanged
      setReloadVersion(prev => prev + 1)
      console.log('🔄 Triggered page rebuild via reloadVersion increment')
      
    } catch (error) {
      console.error('❌ Error reloading pages:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInitialPDFPages = async () => {
    if (shouldSkipLoading) {
      console.log('🔒 [PDFPageSelector] Controller requested/active, skipping independent PDF loading (waiting for shared store)')
      return
    }
    
    try {
      // Create new abort controller for this load
      abortControllerRef.current = new AbortController()
      
      setLoading(true)
      setError(null)
      setInitialBatchLoaded(false) // Reset flag for new file
      
      const uploadStartTime = performance.now()
      console.log('⏱️ [UPLOAD START] PDF upload started')
      
      console.log('📄 Starting fast PDF loading...')
      
      // Convert to array buffer
      console.log('📄 Loading file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB', 'Type:', file.type)
      const arrayBuffer = await file.arrayBuffer()
      console.log('📄 File converted to array buffer, size:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB')
      
      // Load PDF document
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const total = pdfDoc.numPages
      
      console.log(`📄 PDF ready: ${total} pages detected`)
      
      // Verify first page dimensions to confirm normalization
      const firstPage = await pdfDoc.getPage(1)
      const firstPageViewport = firstPage.getViewport({ scale: 1.0 })
      console.log(`📏 First page dimensions: ${firstPageViewport.width.toFixed(1)} x ${firstPageViewport.height.toFixed(1)} (rotation: ${firstPageViewport.rotation}°)`)
      console.log(`📄 Expected A4: 595.3 x 841.9 (portrait) or 841.9 x 595.3 (landscape)`)
      
      // Check if normalization worked
      const isA4Portrait = Math.abs(firstPageViewport.width - 595.3) < 5 && Math.abs(firstPageViewport.height - 841.9) < 5
      const isA4Landscape = Math.abs(firstPageViewport.width - 841.9) < 5 && Math.abs(firstPageViewport.height - 595.3) < 5
      if (isA4Portrait || isA4Landscape) {
        console.log('✅ PDF is A4 size - normalization successful!')
      } else {
        console.warn('⚠️ PDF is NOT A4 size - normalization may have failed!')
        console.warn(`   Current: ${firstPageViewport.width.toFixed(1)} x ${firstPageViewport.height.toFixed(1)}`)
        console.warn(`   Expected: 595.3 x 841.9 (portrait) OR 841.9 x 595.3 (landscape)`)
      }
      
      // Set PDF info immediately to show UI faster
      setPdf(pdfDoc)
      setTotalPages(total)
      
      // Select all pages by default (even if not loaded yet)
      const allPageNumbers = Array.from({ length: total }, (_, i) => i + 1)
      onPagesSelected(allPageNumbers)
      
      // Show grid immediately - fast!
      setLoading(false)
      setInitialBatchLoaded(true)
      
      // Load first batch of pages in background
      console.log(`📄 Loading first ${PAGES_PER_BATCH} pages in background...`)
      loadPageBatch(pdfDoc, 1, Math.min(PAGES_PER_BATCH, total))
        .then(() => {
          const firstPageTime = performance.now()
          const firstPageDelay = ((firstPageTime - uploadStartTime) / 1000).toFixed(2)
          console.log(`⏱️ [FIRST PAGE] First pages loaded at ${firstPageDelay}s after upload`)
        })
        .catch(err => {
          console.error('❌ Error loading initial pages:', err)
        })
      
    } catch (error) {
      console.error('❌ Error loading PDF:', error)
      setError('Failed to load PDF: ' + error.message)
      setLoading(false)
    }
  }

  const loadPageBatch = async (pdfDoc, startPage, endPage) => {
    try {
      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        console.log('🛑 Load aborted, skipping batch')
        return
      }
      
      console.log(`📄 Loading pages ${startPage} to ${endPage}`)
      
      const pagePromises = []
      for (let i = startPage; i <= endPage; i++) {
        pagePromises.push(renderPageThumbnail(pdfDoc, i, fitToPageEnabled))
      }
      
      const renderedPages = await Promise.all(pagePromises)
      
      // Check again after async operation
      if (abortControllerRef.current?.signal.aborted) {
        console.log('🛑 Load aborted after render, discarding pages')
        return
      }
      
      let validPages = renderedPages.filter(p => p !== null)

      setOriginalPages(prev => {
        const existingPageNumbers = new Set(prev.map(p => p.pageNumber))
        const newPages = validPages.filter(p => !existingPageNumbers.has(p.pageNumber))
        return [...prev, ...newPages]
      })
      
      // CRITICAL: Also update pages state so UI shows the loaded thumbnails
      setPages(prev => {
        const existingPageNumbers = new Set(prev.map(p => p.pageNumber))
        const newPages = validPages.filter(p => !existingPageNumbers.has(p.pageNumber))
        return [...prev, ...newPages]
      })

      setLoadedPages(endPage)
      
      console.log(`📄 Loaded ${validPages.length} pages successfully`)
      
    } catch (error) {
      console.error('❌ Error loading page batch:', error)
      throw error
    }
  }

  const loadMorePages = async () => {
    if (shouldSkipLoading) {
      console.log('🔒 [PDFPageSelector] Controller requested/active, skipping loadMorePages')
      return
    }
    if (!pdf || loadedPages >= totalPages || loadingMore) return
    
    try {
      setLoadingMore(true)
      
      const nextStart = loadedPages + 1
      const nextEnd = Math.min(loadedPages + PAGES_PER_BATCH, totalPages)
      
      await loadPageBatch(pdf, nextStart, nextEnd)
      
    } catch (error) {
      console.error('❌ Error loading more pages:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const jumpToPage = async (pageNumber) => {
    if (shouldSkipLoading) {
      console.log('🔒 [PDFPageSelector] Controller requested/active, skipping jumpToPage loading')
      const pageElement = document.getElementById(`page-${pageNumber}`)
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    if (!pdf || pageNumber < 1 || pageNumber > totalPages) return
    
    // Check if page is already loaded
    const pageExists = pages.find(p => p.pageNumber === pageNumber)
    if (pageExists) {
      // Scroll to page
      const pageElement = document.getElementById(`page-${pageNumber}`)
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    
    // Load pages up to the requested page
    try {
      setLoadingMore(true)
      
      const batchStart = Math.max(1, pageNumber - 5) // Load a few pages before
      const batchEnd = Math.min(totalPages, pageNumber + 5) // And a few after
      
      // Only load pages we haven't loaded yet
      const pagesToLoad = []
      for (let i = batchStart; i <= batchEnd; i++) {
        if (!pages.find(p => p.pageNumber === i)) {
          pagesToLoad.push(i)
        }
      }
      
      if (pagesToLoad.length > 0) {
        const pagePromises = pagesToLoad.map(pageNum => renderPageThumbnail(pdf, pageNum))
        const renderedPages = await Promise.all(pagePromises)
        const validPages = renderedPages.filter(p => p !== null)
        
        setOriginalPages(prev => {
          const existingPageNumbers = new Set(prev.map(p => p.pageNumber))
          const newPages = validPages.filter(p => !existingPageNumbers.has(p.pageNumber))
          
          if (newPages.length === 0) return prev
          
          const result = [...prev]
          newPages.forEach(page => {
            const insertIndex = result.findIndex(p => p.pageNumber > page.pageNumber)
            if (insertIndex === -1) {
              result.push(page)
            } else {
              result.splice(insertIndex, 0, page)
            }
          })
          return result
        })
        
        // CRITICAL: Also update pages state for UI rendering
        setPages(prev => {
          const existingPageNumbers = new Set(prev.map(p => p.pageNumber))
          const newPages = validPages.filter(p => !existingPageNumbers.has(p.pageNumber))
          
          if (newPages.length === 0) return prev
          
          const result = [...prev]
          newPages.forEach(page => {
            const insertIndex = result.findIndex(p => p.pageNumber > page.pageNumber)
            if (insertIndex === -1) {
              result.push(page)
            } else {
              result.splice(insertIndex, 0, page)
            }
          })
          return result
        })
        
        setLoadedPages(Math.max(loadedPages, batchEnd))
      }
      
      // Scroll to page after loading
      setTimeout(() => {
        const pageElement = document.getElementById(`page-${pageNumber}`)
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      
    } catch (error) {
      console.error('❌ Error jumping to page:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const renderPageThumbnail = async (pdf, pageNumber, fitToPage = true, quality = QUALITY_TIERS.ULTRA_LOW) => {
    try {
      const page = await pdf.getPage(pageNumber)

      // Get quality config for the requested tier
      const qualityConfig = QUALITY_CONFIG[quality] || QUALITY_CONFIG[QUALITY_TIERS.ULTRA_LOW]
      let baseScale = qualityConfig.scale
      const targetPageSize = getPageSize(currentPageSize)

      if (fitToPage) {
        // Calculate scale to fit selected page dimensions
        const originalViewport = page.getViewport({ scale: 1.0 })
        const scaleX = targetPageSize.width / originalViewport.width
        const scaleY = targetPageSize.height / originalViewport.height

        // Use the smaller scale to ensure content fits within bounds (10% margin to prevent overflow)
        const fitScale = Math.min(scaleX, scaleY)
        baseScale = fitScale * baseScale * 0.90
      }

      const viewport = page.getViewport({ scale: baseScale })

      const canvas = document.createElement('canvas')
      // Use optimized context for better performance
      const context = canvas.getContext('2d', { alpha: false, willReadFrequently: false })
      canvas.height = viewport.height
      canvas.width = viewport.width

      // Fill with white background
      context.fillStyle = 'white'
      context.fillRect(0, 0, canvas.width, canvas.height)

      // Enable high-quality image smoothing for better text rendering
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise

      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', qualityConfig.jpegQuality)
      })
      const blobURL = URL.createObjectURL(blob)

      return {
        pageNumber,
        thumbnail: blobURL,
        originalThumbnail: blobURL,
        width: viewport.width,
        height: viewport.height,
        isFittedToPage: fitToPage,
        pageSize: currentPageSize,
        quality: quality,
        _blobURL: blobURL
      }
    } catch (error) {
      console.error(`❌ Error rendering page ${pageNumber}:`, error)
      return null
    }
  }

  const evictCacheIfNeeded = (newQuality) => {
    setQualityCache(prevCache => {
      const newCache = new Map(prevCache)
      
      // Count pages by quality
      const counts = {
        [QUALITY_TIERS.ULTRA_LOW]: 0,
        [QUALITY_TIERS.APPROPRIATE]: 0,
        [QUALITY_TIERS.BEST]: 0
      }
      
      const pagesByQuality = {
        [QUALITY_TIERS.ULTRA_LOW]: [],
        [QUALITY_TIERS.APPROPRIATE]: [],
        [QUALITY_TIERS.BEST]: []
      }
      
      newCache.forEach((entry, pageNum) => {
        counts[entry.quality]++
        pagesByQuality[entry.quality].push({ pageNum, entry })
      })
      
      // Evict oldest pages if over limit for each tier
      Object.keys(counts).forEach(qualityTier => {
        const limit = CACHE_LIMITS[qualityTier]
        if (counts[qualityTier] >= limit) {
          // Remove oldest entry (LRU - first entry is oldest)
          const toEvict = pagesByQuality[qualityTier][0]
          if (toEvict && toEvict.entry.page._blobURL) {
            URL.revokeObjectURL(toEvict.entry.page._blobURL)
          }
          newCache.delete(toEvict.pageNum)
          console.log(`🗑️ Evicted ${qualityTier} quality page ${toEvict.pageNum} from cache`)
        }
      })
      
      return newCache
    })
  }

  const upgradePageQuality = async (pageNumber, targetQuality) => {
    if (!pdf) return
    
    // Check if we already have this quality or better
    const cached = qualityCache.get(pageNumber)
    const qualityOrder = [QUALITY_TIERS.ULTRA_LOW, QUALITY_TIERS.APPROPRIATE, QUALITY_TIERS.BEST]
    
    if (cached) {
      const cachedIndex = qualityOrder.indexOf(cached.quality)
      const targetIndex = qualityOrder.indexOf(targetQuality)
      if (cachedIndex >= targetIndex) {
        console.log(`✓ Page ${pageNumber} already at ${cached.quality} quality`)
        return cached.page
      }
    }
    
    // Check if already upgrading
    if (upgradingPages.has(pageNumber)) {
      console.log(`⏳ Page ${pageNumber} already upgrading`)
      return null
    }
    
    try {
      setUpgradingPages(prev => new Set(prev).add(pageNumber))
      console.log(`⬆️ Upgrading page ${pageNumber} to ${targetQuality} quality`)
      
      // Render at target quality
      const upgradedPage = await renderPageThumbnail(pdf, pageNumber, fitToPageEnabled, targetQuality)
      
      if (upgradedPage) {
        // Evict if needed before adding
        evictCacheIfNeeded(targetQuality)
        
        // Store in cache
        setQualityCache(prev => {
          const newCache = new Map(prev)
          
          // Revoke old blob URL if exists
          const oldEntry = newCache.get(pageNumber)
          if (oldEntry && oldEntry.page._blobURL) {
            URL.revokeObjectURL(oldEntry.page._blobURL)
          }
          
          newCache.set(pageNumber, { quality: targetQuality, page: upgradedPage })
          return newCache
        })
        
        // Update the page in originalPages
        setOriginalPages(prev => {
          const newPages = prev.map(p => 
            p.pageNumber === pageNumber ? upgradedPage : p
          )
          
          // If page doesn't exist, add it
          if (!prev.find(p => p.pageNumber === pageNumber)) {
            newPages.push(upgradedPage)
            newPages.sort((a, b) => a.pageNumber - b.pageNumber)
          }
          
          return newPages
        })
        
        // Update pages state for UI
        setPages(prev => {
          const newPages = prev.map(p => 
            p.pageNumber === pageNumber ? upgradedPage : p
          )
          
          // If page doesn't exist, add it
          if (!prev.find(p => p.pageNumber === pageNumber)) {
            newPages.push(upgradedPage)
            newPages.sort((a, b) => a.pageNumber - b.pageNumber)
          }
          
          return newPages
        })
        
        console.log(`✅ Upgraded page ${pageNumber} to ${targetQuality} quality`)
        return upgradedPage
      }
    } catch (error) {
      console.error(`❌ Error upgrading page ${pageNumber}:`, error)
    } finally {
      setUpgradingPages(prev => {
        const newSet = new Set(prev)
        newSet.delete(pageNumber)
        return newSet
      })
    }
    
    return null
  }

  const applyColorFilter = (sourceCanvas, colorMode) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = sourceCanvas.width
    canvas.height = sourceCanvas.height

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (colorMode === 'BW') {
      ctx.filter = 'grayscale(100%)'
    }
    ctx.drawImage(sourceCanvas, 0, 0)
    ctx.filter = 'none'

    return canvas
  }

  const combineConsecutivePages = (page1Canvas, page2Canvas) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    // Create WIDE canvas - EXACT same as PDFEditor
    const gap = 8
    canvas.width = page1Canvas.width * 2 + gap
    canvas.height = page1Canvas.height

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const halfWidth = canvas.width / 2
    const margin = 2

    // Draw thin page boundaries - EXACT same as PDFEditor
    ctx.strokeStyle = '#3B82F6'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(margin, margin, halfWidth - gap / 2 - margin, canvas.height - margin * 2)
    ctx.strokeRect(halfWidth + gap / 2, margin, halfWidth - gap / 2 - margin, canvas.height - margin * 2)
    ctx.setLineDash([])

    // Pages FILL the width - EXACT same as PDFEditor (not fitted/centered)
    const pageWidth = halfWidth - gap / 2 - margin * 3
    const pageHeight = canvas.height - margin * 4

    // Draw first page (left) - FILL width - EXACT same as editor
    ctx.drawImage(page1Canvas, margin * 2, margin * 2, pageWidth, pageHeight)

    // Draw SECOND page (right) - FILL width - EXACT same as editor
    ctx.drawImage(page2Canvas, halfWidth + gap / 2 + margin, margin * 2, pageWidth, pageHeight)

    return canvas
  }

  const applyPrintSettingsToPage = (page) => {
    return new Promise((resolve) => {
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')

      const img = new Image()
      img.src = page.originalThumbnail

      img.onload = () => {
        tempCanvas.width = page.width
        tempCanvas.height = page.height
        tempCtx.drawImage(img, 0, 0)

        // Only apply color filter (N-up is handled at a higher level)
        let processedCanvas = tempCanvas
        processedCanvas = applyColorFilter(processedCanvas, currentColorMode)

        resolve({
          ...page,
          thumbnail: processedCanvas.toDataURL()
        })
      }

      img.onerror = () => {
        resolve(page) // Return original page if processing fails
      }
    })
  }

  const applyPrintSettingsToPages = async () => {
    if (totalPages === 0) return

    if (currentPagesPerSheet === 2) {
      // FIX: Loop through ALL pages (1 to totalPages), not just loaded originalPages
      // This ensures we maintain all 200 sheets for a 200-page PDF
      const sheets = []

      for (let i = 1; i <= totalPages; i += 2) {
        const pageNumber1 = i
        const pageNumber2 = i + 1 <= totalPages ? i + 1 : null

        // Check if these pages are loaded
        const page1 = originalPages.find(p => p.pageNumber === pageNumber1)
        const page2 = pageNumber2 ? originalPages.find(p => p.pageNumber === pageNumber2) : null

        if (pageNumber2) {
          // Two-page sheet (pages i and i+1)
          if (page1 && page2) {
            const cacheKey = `${pageNumber1}|${pageNumber2}|${currentPageSize}|${currentColorMode}`
            let cachedSheet = nupCacheRef.current.get(cacheKey)
            
            if (!cachedSheet) {
              const canvas1 = await renderPageAtScale(pageNumber1, 2.0)
              const canvas2 = await renderPageAtScale(pageNumber2, 2.0)

              if (canvas1 && canvas2) {
                const combinedCanvas = combineConsecutivePages(canvas1, canvas2)
                const blob = await new Promise(resolve => {
                  combinedCanvas.toBlob(resolve, 'image/jpeg', 0.95)
                })
                const blobURL = URL.createObjectURL(blob)

                cachedSheet = {
                  pageNumber: `${pageNumber1}-${pageNumber2}`,
                  thumbnail: blobURL,
                  originalThumbnail: blobURL,
                  width: combinedCanvas.width,
                  height: combinedCanvas.height,
                  isSheet: true,
                  containsPages: [pageNumber1, pageNumber2],
                  isLoaded: true,
                  _blobURL: blobURL
                }
                
                nupCacheRef.current.set(cacheKey, cachedSheet)
              }
            }
            
            if (cachedSheet) {
              sheets.push(cachedSheet)
            }
          } else {
            // At least one page not loaded - create placeholder sheet
            // This preserves both page numbers even if only one is loaded
            sheets.push({
              pageNumber: `${pageNumber1}-${pageNumber2}`,
              thumbnail: null,
              originalThumbnail: null,
              width: 595,
              height: 842,
              isSheet: true,
              containsPages: [pageNumber1, pageNumber2],
              isLoaded: false
            })
          }
        } else {
          // Last page (odd page count) - single page sheet
          if (page1) {
            const cacheKey = `${pageNumber1}|${currentPageSize}|${currentColorMode}`
            let cachedSheet = nupCacheRef.current.get(cacheKey)
            
            if (!cachedSheet) {
              const canvas1 = await renderPageAtScale(pageNumber1, 2.0)
              if (canvas1) {
                const blob = await new Promise(resolve => {
                  canvas1.toBlob(resolve, 'image/jpeg', 0.95)
                })
                const blobURL = URL.createObjectURL(blob)
                
                cachedSheet = {
                  pageNumber: pageNumber1,
                  thumbnail: blobURL,
                  originalThumbnail: blobURL,
                  width: canvas1.width,
                  height: canvas1.height,
                  isSheet: true,
                  containsPages: [pageNumber1],
                  isLoaded: true,
                  _blobURL: blobURL
                }
                
                nupCacheRef.current.set(cacheKey, cachedSheet)
              }
            }
            
            if (cachedSheet) {
              sheets.push(cachedSheet)
            }
          } else {
            // Page not loaded - create placeholder
            sheets.push({
              pageNumber: pageNumber1,
              thumbnail: null,
              originalThumbnail: null,
              width: 595,
              height: 842,
              isSheet: true,
              containsPages: [pageNumber1],
              isLoaded: false
            })
          }
        }
      }

      // CRITICAL: Only update state once with ALL sheets ready
      // This prevents flickering from showing intermediate single-page states
      setPages(sheets)
    } else {
      // Normal 1-page mode - FIX: Create placeholders for ALL pages
      const allPagesList = []
      
      for (let i = 1; i <= totalPages; i++) {
        const loadedPage = originalPages.find(p => p.pageNumber === i)
        
        if (loadedPage) {
          // Page is loaded - process it
          const processed = await applyPrintSettingsToPage(loadedPage)
          allPagesList.push({ ...processed, isLoaded: true })
        } else {
          // Page not loaded - create placeholder
          allPagesList.push({
            pageNumber: i,
            thumbnail: null,
            originalThumbnail: null,
            width: 595,
            height: 842,
            isLoaded: false
          })
        }
      }
      
      setPages(allPagesList)
    }
  }

  const loadPageCanvas = (page) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = page.width
        canvas.height = page.height
        ctx.drawImage(img, 0, 0)
        resolve(canvas)
      }
      img.onerror = () => resolve(null)
      img.src = page.originalThumbnail
    })
  }

  const reloadPagesWithNewSize = async () => {
    if (!pdf || loadedPages === 0) return

    try {
      setLoading(true)
      console.log(`\ud83d\udd04 Reloading ${loadedPages} pages with new page size:`, currentPageSize)

      // Re-render all loaded pages with new page size
      const pagePromises = []
      for (let i = 1; i <= loadedPages; i++) {
        pagePromises.push(renderPageThumbnail(pdf, i, fitToPageEnabled))
      }

      const renderedPages = await Promise.all(pagePromises)
      const validPages = renderedPages.filter(p => p !== null)

      setPages(validPages)
      console.log(`\u2705 Successfully reloaded ${validPages.length} pages with new page size`)

    } catch (error) {
      console.error('❌ Error reloading pages with new size:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleFitToPage = async () => {
    if (!pdf) return

    try {
      setLoading(true)
      const newFitToPageState = !fitToPageEnabled
      setFitToPageEnabled(newFitToPageState)

      // Re-render all loaded pages with new fit-to-page setting
      const pagePromises = []
      for (let i = 1; i <= loadedPages; i++) {
        pagePromises.push(renderPageThumbnail(pdf, i, newFitToPageState))
      }

      const renderedPages = await Promise.all(pagePromises)
      const validPages = renderedPages.filter(p => p !== null)

      setPages(validPages)

    } catch (error) {
      console.error('❌ Error toggling fit to page:', error)
    } finally {
      setLoading(false)
    }
  }

  const isPageSelected = (page) => {
    if (page.isSheet && page.containsPages) {
      // For sheets, check if ALL contained pages are selected
      return page.containsPages.every(num => selectedPages.includes(num))
    }
    // For single pages
    return selectedPages.includes(page.pageNumber)
  }

  const togglePageSelection = (pageNumber) => {
    // Find the page/sheet to get its containsPages
    const pageOrSheet = pages.find(p => p.pageNumber === pageNumber)

    if (pageOrSheet?.isSheet && pageOrSheet.containsPages) {
      // For sheets, toggle all contained pages together
      const containedNumbers = pageOrSheet.containsPages
      const allSelected = containedNumbers.every(num => selectedPages.includes(num))

      let newSelection
      if (allSelected) {
        // Deselect all pages in this sheet
        newSelection = selectedPages.filter(n => !containedNumbers.includes(n))
      } else {
        // Select all pages in this sheet
        const toAdd = containedNumbers.filter(n => !selectedPages.includes(n))
        newSelection = [...selectedPages, ...toAdd].sort((a, b) => a - b)
      }

      onPagesSelected(newSelection)
    } else {
      // Normal single page toggle
      const newSelection = selectedPages.includes(pageNumber)
        ? selectedPages.filter(p => p !== pageNumber)
        : [...selectedPages, pageNumber].sort((a, b) => a - b)

      onPagesSelected(newSelection)
    }
  }

  const selectAllPages = () => {
    const allPages = Array.from({ length: totalPages }, (_, i) => i + 1)
    onPagesSelected(allPages)
  }

  const deselectAllPages = () => {
    onPagesSelected([])
  }

  // Setup intersection observer for auto-loading more pages on scroll
  React.useEffect(() => {
    if (!pdf || loadedPages >= totalPages) return

    const scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && loadedPages < totalPages && !loadingMore) {
            console.log('📜 Scroll trigger reached - loading more pages')
            loadMorePages()
          }
        })
      },
      {
        root: null,
        rootMargin: '400px', // Load when within 400px of trigger
        threshold: 0.01
      }
    )

    scrollObserverRef.current = scrollObserver

    if (loadMoreTriggerRef.current) {
      scrollObserver.observe(loadMoreTriggerRef.current)
    }

    return () => {
      scrollObserver.disconnect()
    }
  }, [pdf, loadedPages, totalPages, loadingMore])

  // Setup intersection observer for viewport-based quality upgrades
  React.useEffect(() => {
    if (!pdf || pages.length === 0) return

    // Create intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pageNumber = parseInt(entry.target.dataset.pageNumber)
            if (pageNumber && !isNaN(pageNumber)) {
              // Delay upgrade slightly to avoid overwhelming during fast scrolling
              setTimeout(() => {
                if (entry.isIntersecting) {
                  // Upgrade visible thumbnails from ULTRA_LOW to APPROPRIATE quality
                  upgradePageQuality(pageNumber, QUALITY_TIERS.APPROPRIATE)
                }
              }, 100)
            }
          }
        })
      },
      {
        root: null,
        rootMargin: '100px', // Start upgrading 100px before element enters viewport
        threshold: 0.1
      }
    )

    observerRef.current = observer

    // Observe all page elements
    const pageElements = document.querySelectorAll('[data-page-number]')
    pageElements.forEach(el => observer.observe(el))

    return () => {
      observer.disconnect()
    }
  }, [pdf, pages.length, fitToPageEnabled])

  const renderPageAtScale = async (pageNumber, scale) => {
    try {
      if (!pdf) {
        console.error('PDF document not loaded')
        return null
      }

      const page = await pdf.getPage(pageNumber)

      const targetPageSize = getPageSize(currentPageSize)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false })

      canvas.width = targetPageSize.width * scale
      canvas.height = targetPageSize.height * scale

      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Enable high-quality image smoothing
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      const viewport = page.getViewport({ scale: 1.0 })
      const pdfScale = Math.min(canvas.width / viewport.width, canvas.height / viewport.height)
      const scaledViewport = page.getViewport({ scale: pdfScale })
      const offsetX = (canvas.width - scaledViewport.width) / 2
      const offsetY = (canvas.height - scaledViewport.height) / 2

      ctx.save()
      ctx.translate(offsetX, offsetY)
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
      ctx.restore()

      if (currentColorMode === 'BW') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          data[i] = gray
          data[i + 1] = gray
          data[i + 2] = gray
        }
        ctx.putImageData(imageData, 0, 0)
      }

      return canvas
    } catch (error) {
      console.error(`Error rendering page ${pageNumber}:`, error)
      return null
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const pageNumber = parseInt(searchTerm)
    if (pageNumber && pageNumber >= 1 && pageNumber <= totalPages) {
      jumpToPage(pageNumber)
    }
  }

  const filteredPages = pages.filter(page => {
    if (!searchTerm) return true
    return page.pageNumber.toString().includes(searchTerm)
  })

  if (!file || file.type !== 'application/pdf') {
    return null
  }

  if (error) {
    return (
      <div className="border-2 border-red-300 rounded-lg p-6 bg-red-50">
        <div className="text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-red-600" />
          <p className="text-red-600 font-medium">Error loading PDF</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-sm sm:text-base font-medium text-gray-900">
          Selected Pages ({selectedPages.length}/{totalPages})
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={selectAllPages}
            className="text-xs sm:text-sm bg-blue-100 text-blue-700 px-2 sm:px-3 py-1 rounded hover:bg-blue-200 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={deselectAllPages}
            className="text-xs sm:text-sm bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 rounded hover:bg-gray-200 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search and Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Page number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 sm:pl-10 pr-2 sm:pr-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-36"
            />
          </div>
          <button
            type="submit"
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm hover:bg-blue-700 transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      {/* Conditional Rendering: Single Page View vs Grid View */}
      {viewMode === 'single' ? (
        /* === SINGLE PAGE VIEW === */
        (() => {
          // Use originalPages (actual thumbnails) instead of pages (which may have placeholders)
          const sourcePages = currentPagesPerSheet === 1 ? originalPages : pages
          
          // Apply filtering
          const singleViewFilteredPages = sourcePages.filter(page => {
            if (!searchTerm) return true
            return page.pageNumber.toString().includes(searchTerm)
          })
          
          const currentPage = singleViewFilteredPages[currentPageIndex]
          // Show editor immediately when PDF metadata is loaded (don't wait for pages)
          const hasPages = totalPages > 0
          
          // Handle page navigation with lazy loading
          const handlePageNav = (newIndex) => {
            const clampedIndex = Math.max(0, Math.min(newIndex, singleViewFilteredPages.length - 1))
            setCurrentPageIndex(clampedIndex)
            setCropActive(false)
            
            // If navigating to unloaded page, trigger load
            if (singleViewFilteredPages[clampedIndex] && !singleViewFilteredPages[clampedIndex].thumbnail && pdf) {
              const targetPageNumber = singleViewFilteredPages[clampedIndex].pageNumber
              if (targetPageNumber > loadedPages) {
                loadMorePages()
              }
            }
          }
          
          return (
            <div className="space-y-3">
              {/* PDF Editor - Direct rendering without extra boxes */}
              <div className={`${gridExpanded ? '' : 'max-h-[600px] overflow-y-auto'}`}>
                {hasPages || loading ? (
                  <Suspense fallback={
                    <div className="flex justify-center items-center min-h-[200px]">
                      <Loader className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  }>
                    <PDFEditor
                      ref={editorRef}
                      file={file}
                      initialPageIndex={0}
                      onSave={(editedFile) => {
                        // Reload the component after save
                        setReloadVersion(v => v + 1)
                      }}
                      onCancel={() => {
                        // Do nothing on cancel
                      }}
                      directPageEdit={false}
                      pageSize={currentPageSize}
                      onPageSizeChange={(newSize) => setCurrentPageSize(newSize)}
                      colorMode={currentColorMode}
                      pagesPerSheet={currentPagesPerSheet}
                      selectedPages={selectedPages}
                      onPageSelect={togglePageSelection}
                      onEditPage={onEditPage}
                      onPagesLoaded={onPagesLoaded}
                    />
                  </Suspense>
                ) : (
                  <div className="flex justify-center items-center min-h-[200px]">
                    <p className="text-gray-400">No pages available</p>
                  </div>
                )}
              </div>
            </div>
          )
        })()
      ) : (
        /* === GRID VIEW (Original) === */
        <div className="border rounded-lg p-2 sm:p-4 bg-gray-50 h-80 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
            {filteredPages.map((page) => (
            <div
              key={page.pageNumber}
              id={`page-${page.pageNumber}`}
              data-page-number={page.pageNumber}
              className={`relative border-2 rounded-lg p-1 sm:p-2 transition-all cursor-pointer ${
                isPageSelected(page)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Selection Checkbox */}
              <div className="absolute top-1 left-1 z-10">
                <button
                  onClick={() => togglePageSelection(page.pageNumber)}
                  className="bg-white rounded shadow-sm p-1"
                >
                  {isPageSelected(page) ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Page Thumbnail */}
              <div
                className="w-full aspect-[3/4] bg-gray-100 rounded flex items-center justify-center overflow-hidden relative"
                onClick={() => togglePageSelection(page.pageNumber)}
              >
                {page.thumbnail ? (
                  <>
                    <img
                      src={page.thumbnail}
                      alt={`Page ${page.pageNumber}`}
                      className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
                        page.quality === QUALITY_TIERS.BEST ? 'opacity-100' : 'opacity-95'
                      }`}
                      style={{ imageRendering: page.quality === QUALITY_TIERS.BEST ? 'crisp-edges' : 'auto' }}
                    />
                    {/* Loading shimmer overlay for quality upgrade */}
                    {upgradingPages.has(page.pageNumber) && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    )}
                    {/* Quality indicator badge */}
                    {page.quality === QUALITY_TIERS.BEST && (
                      <div className="absolute bottom-1 right-1 bg-green-500 text-white text-[8px] px-1 py-0.5 rounded font-bold">
                        BEST
                      </div>
                    )}
                    {page.quality === QUALITY_TIERS.APPROPRIATE && (
                      <div className="absolute bottom-1 right-1 bg-blue-500 text-white text-[8px] px-1 py-0.5 rounded font-bold">
                        OK
                      </div>
                    )}
                  </>
                ) : page.isLoaded === false ? (
                  <div className="text-center">
                    <Loader className="w-6 h-6 text-gray-400 mx-auto mb-1 animate-spin" />
                    <p className="text-xs text-gray-500">Not loaded</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <FileText className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-red-500">Failed to load</p>
                  </div>
                )}
              </div>

              {/* Page Number */}
              <div className="text-center mt-1 sm:mt-2">
                <span className="text-xs font-medium text-gray-700">
                  Page {page.pageNumber}
                </span>
                {page.isFittedToPage && (
                  <span className="text-xs text-green-600 ml-1">✓</span>
                )}
              </div>

              {/* Edit Button - Bottom of card */}
              {onEditPage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditPage(page.pageNumber - 1)
                  }}
                  className="w-full mt-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Auto-load trigger (invisible) + Optional Load More Button */}
        {loadedPages < totalPages && (
          <div className="text-center mt-6">
            {/* Invisible trigger for scroll-based auto-loading */}
            <div ref={loadMoreTriggerRef} className="h-px w-full" />
            
            {/* Loading indicator */}
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-gray-600 py-4">
                <Loader className="w-5 h-5 animate-spin" />
                <span>Loading more pages...</span>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Selection Summary */}
      {selectedPages.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3">
          <p className="text-blue-800 text-xs sm:text-sm mb-2">
            <strong>Selected:</strong> {selectedPages.length} page{selectedPages.length !== 1 ? 's' : ''}
          </p>
          <div className={`${showAllSelected ? 'h-auto' : 'h-10 sm:h-12'} overflow-y-auto bg-white rounded border border-blue-200 p-1.5 sm:p-2 transition-all duration-300`}>
            <p className="text-blue-600 text-xs leading-relaxed break-all">
              {selectedPages.join(', ')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 mt-2">
            <button
              onClick={() => setShowAllSelected(!showAllSelected)}
              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
            >
              {showAllSelected ? 'Less' : 'More'}
            </button>
          </div>
          {selectedPages.length !== totalPages && (
            <p className="text-blue-600 text-xs mt-2">
              Only selected pages will print
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default PDFPageSelector
