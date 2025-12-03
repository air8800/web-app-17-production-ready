import React, { useState, useEffect, useRef, useCallback, forwardRef, useMemo } from 'react'
import { X, Save, RotateCw, RotateCcw, Crop, RefreshCw, ZoomIn, ZoomOut, Grid2x2 as Grid, Check, FileText, Maximize2, AlertCircle, Loader2, Square, CheckSquare } from 'lucide-react'
import { ShimmerLoader } from './ThumbnailLoadingStates'
import LoadingExperience from './LoadingExperience'
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
  onPagesLoaded = null
}, ref) => {
  console.log('📄 PDFEditorNew mounted with pagesPerSheet:', pagesPerSheet)
  
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
  
  const canvasRef = useRef(null)
  const imageContainerRef = useRef(null)

  const cropHandlerRef = useRef(null)
  const rotationHandlerRef = useRef(null)
  const uiStateManagerRef = useRef(null)
  const coordinateHandlerRef = useRef(null)
  const zoomPanHandlerRef = useRef(null)

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
        
        const loadedPages = []
        for (let i = 1; i <= pageCount; i++) {
          const metadata = controller?.getPageMetadata(i)
          const thumbnail = controller?.getThumbnail(i)
          
          loadedPages.push({
            pageNumber: i,
            width: metadata?.originalDimensions.width || 595,
            height: metadata?.originalDimensions.height || 842,
            thumbnail: thumbnail,
            canvas: null,
            originalCanvas: null,
            editHistory: metadata?.transforms || { rotation: 0, scale: 100, offsetX: 0, offsetY: 0, crop: null },
            edited: metadata?.edited || false,
            isLoading: !thumbnail
          })
        }
        
        setPages(loadedPages)
        setLoadingStage('ready')
        setLoading(false)
        
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

  useEffect(() => {
    if (!controller || !isReady || pages.length === 0) return
    
    const loadThumbnails = async () => {
      const pageCount = controller.getPageCount()
      
      for (let i = 1; i <= pageCount; i++) {
        try {
          const thumbnail = await controller.getThumbnailAsync?.(i) || controller.getThumbnail(i)
          if (thumbnail) {
            setPages(prev => prev.map(p => 
              p.pageNumber === i ? { ...p, thumbnail, isLoading: false } : p
            ))
            setThumbnail(i, thumbnail)
          }
        } catch (err) {
          console.warn(`⚠️ Thumbnail ${i} failed:`, err)
        }
      }
    }
    
    loadThumbnails()
  }, [controller, isReady, pages.length])
  
  useEffect(() => {
    const handlePageEdited = async (e) => {
      const { pageIndex, edits } = e.detail
      
      // Update edit history immediately
      setPages(prev => prev.map((p, idx) => 
        idx === pageIndex ? {
          ...p,
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
      
      // Refresh thumbnail to reflect edits
      if (controller && controller.refreshThumbnail) {
        try {
          const pageNumber = pageIndex + 1
          const thumbnail = await controller.refreshThumbnail(pageNumber, edits)
          setPages(prev => prev.map((p, idx) => 
            idx === pageIndex ? { ...p, thumbnail } : p
          ))
          setThumbnail(pageNumber, thumbnail)
        } catch (err) {
          console.warn('Failed to refresh thumbnail:', err)
        }
      }
      
      if (onPagesLoaded) {
        setPages(prev => {
          onPagesLoaded(prev)
          return prev
        })
      }
    }
    
    const handleAllPagesEdited = async (e) => {
      const { edits } = e.detail
      
      // Update edit history immediately for all pages
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
          onPagesLoaded(updated)
        }
        return updated
      })
      
      // Refresh all thumbnails to reflect edits
      if (controller && controller.refreshAllThumbnails) {
        try {
          const totalPages = controller.getPageCount()
          const thumbnails = await controller.refreshAllThumbnails(totalPages, edits)
          
          // Update all thumbnails in state
          setPages(prev => prev.map((p, idx) => {
            const pageNum = idx + 1
            const newThumbnail = thumbnails.get(pageNum)
            if (newThumbnail) {
              setThumbnail(pageNum, newThumbnail)
              return { ...p, thumbnail: newThumbnail }
            }
            return p
          }))
        } catch (err) {
          console.warn('Failed to refresh thumbnails:', err)
        }
      }
    }
    
    window.addEventListener('pdfPageEdited', handlePageEdited)
    window.addEventListener('pdfAllPagesEdited', handleAllPagesEdited)
    
    return () => {
      window.removeEventListener('pdfPageEdited', handlePageEdited)
      window.removeEventListener('pdfAllPagesEdited', handleAllPagesEdited)
    }
  }, [controller, onPagesLoaded, setThumbnail])

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

  if (loading && loadingStage === 'parsing') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingExperience stage="parsing" />
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Pages ({pages.length})</h3>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pages.map((page, index) => {
              const isSelected = selectedPages.includes(page.pageNumber)
              return (
                <div
                  key={page.pageNumber}
                  className={`relative rounded-lg border-2 transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : page.edited 
                        ? 'border-purple-500 bg-purple-50' 
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
                    {page.thumbnail ? (
                      <img 
                        src={page.thumbnail} 
                        alt={`Page ${page.pageNumber}`}
                        className="w-full h-full object-contain"
                      />
                    ) : page.isLoading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShimmerLoader />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <FileText className="w-8 h-8" />
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
                    className="w-full py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-b-lg transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )
            })}
          </div>
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
