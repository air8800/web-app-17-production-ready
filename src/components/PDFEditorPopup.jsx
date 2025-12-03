import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, RotateCw, RotateCcw, Crop, Check, Loader2 } from 'lucide-react'
import { CropHandler, RotationHandler } from '../utils/pdf2'
import CropOverlay from './CropOverlay'
import { composeCrop, FULL_PAGE_BOX } from '../utils/pdf2/ui/coordinateTransforms'

const TABS = [
  { id: 'size', label: 'Size' },
  { id: 'crop', label: 'Crop' },
  { id: 'transform', label: 'Transform' }
]

const PDFEditorPopup = ({
  isOpen,
  onClose,
  page,
  pageNumber,
  pageIndex,
  controller,
  applyEdit,
  onApply,
  onApplyAll,
  totalPages = 1
}) => {
  const [activeTab, setActiveTab] = useState('size')
  const [rotation, setRotation] = useState(0)
  const [scale, setScale] = useState(100)
  const [cropArea, setCropArea] = useState(null)
  const [draftCropArea, setDraftCropArea] = useState(null)
  const [cropMode, setCropMode] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isApplyingAll, setIsApplyingAll] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  
  const cropHandlerRef = useRef(new CropHandler())
  const rotationHandlerRef = useRef(new RotationHandler())
  const previewImageRef = useRef(null)
  const cropHandler = cropHandlerRef.current
  const rotationHandler = rotationHandlerRef.current
  
  // Initialize state when popup opens
  useEffect(() => {
    if (isOpen && page) {
      setRotation(page.editHistory?.rotation || 0)
      setScale(page.editHistory?.scale || 100)
      setCropArea(page.editHistory?.crop || null)
      setCropMode(false)
      rotationHandler.initialize(page.editHistory?.rotation || 0)
    }
  }, [isOpen, page])
  
  // Render preview with current transforms (re-renders when rotation/scale/cropArea changes)
  // Note: draftCropArea is NOT in dependencies - preview doesn't update while dragging
  useEffect(() => {
    if (!isOpen || !page) return
    
    const renderPreview = async () => {
      try {
        if (controller && controller.getPreviewWithFixedPage) {
          // Use fixed page rendering - paper stays fixed, content transforms inside
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const previewWidth = Math.min(window.innerWidth * dpr, 1200)
          const previewHeight = Math.min((window.innerHeight - 200) * dpr, 1600)
          
          // Pass current transforms to render content inside fixed page
          // Note: Always use cropArea (committed crop), not draftCropArea
          // Overlay shows visual feedback with draftCropArea, but preview doesn't update until Confirm
          const transforms = {
            rotation: rotation,
            scale: scale,
            crop: cropArea,
            offsetX: 0,
            offsetY: 0
          }
          
          console.log(`📄 [PDFEditorPopup] Rendering preview with transforms:`, transforms)
          const canvas = await controller.getPreviewWithFixedPage(pageNumber, previewWidth, previewHeight, transforms)
          setPreviewImage(canvas)
          console.log(`📄 [PDFEditorPopup] Preview ready: ${canvas.width}x${canvas.height}`)
        } else if (controller && controller.getPagePreviewAsync) {
          // Fallback to regular preview
          const previewWidth = Math.min(window.innerWidth, 800)
          const previewHeight = Math.min(window.innerHeight - 200, 1000)
          const canvas = await controller.getPagePreviewAsync(pageNumber, previewWidth, previewHeight)
          setPreviewImage(canvas)
        } else {
          // Fallback to thumbnail
          setPreviewImage(page.thumbnail || page.canvas)
        }
      } catch (err) {
        console.error('Failed to render preview:', err)
        setPreviewImage(page.thumbnail || page.canvas)
      }
    }
    
    renderPreview()
  }, [isOpen, page, controller, pageNumber, rotation, scale, cropArea])
  
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])
  
  const handleRotate = useCallback((direction) => {
    const delta = direction === 'cw' ? 90 : -90
    const newRotation = ((rotation + delta) % 360 + 360) % 360
    setRotation(newRotation)
    rotationHandler.setRotation(newRotation)
  }, [rotation])
  
  const startCrop = useCallback(() => {
    // Initialize draft crop:
    // - If there's a committed crop, start with FULL_PAGE_BOX (relative to visible area = full visible)
    // - If no committed crop, start with centered default (absolute coordinates)
    // This ensures CropOverlay's compose logic doesn't double-compose
    const initialDraftCrop = cropArea 
      ? { ...FULL_PAGE_BOX }  // Re-crop: start as full visible area (relative)
      : cropHandler.createCenteredCrop(0.1)  // New crop: centered default (absolute)
    
    console.log(`🎯 [PDFEditorPopup] Starting crop with rotation=${rotation}°, scale=${scale}`)
    console.log(`  Initial draft: ${JSON.stringify(initialDraftCrop)}`)
    console.log(`  Committed crop: ${JSON.stringify(cropArea)}`)
    
    setDraftCropArea(initialDraftCrop)
    setCropMode(true)
  }, [cropArea, rotation, scale])
  
  const applyCropAction = useCallback(() => {
    // Apply draft crop to actual crop
    // - If there's a committed crop, compose draft (relative) with committed (absolute) to get final absolute
    // - If no committed crop, draft is already absolute
    if (draftCropArea) {
      const validated = cropHandler.validateCropBox(draftCropArea)
      const finalCrop = cropArea 
        ? composeCrop(cropArea, validated)  // Compose relative draft with absolute committed
        : validated  // Draft is already absolute
      
      // Debug logging
      console.log(`✅ [PDFEditorPopup] Confirming crop at rotation=${rotation}°:`)
      console.log(`  Draft: {x:${validated.x.toFixed(3)}, y:${validated.y.toFixed(3)}, w:${validated.width.toFixed(3)}, h:${validated.height.toFixed(3)}} (${validated.width > validated.height ? 'HORIZONTAL' : 'VERTICAL'})`)
      console.log(`  Final: {x:${finalCrop.x.toFixed(3)}, y:${finalCrop.y.toFixed(3)}, w:${finalCrop.width.toFixed(3)}, h:${finalCrop.height.toFixed(3)}} (${finalCrop.width > finalCrop.height ? 'HORIZONTAL' : 'VERTICAL'})`)
      
      setCropArea(finalCrop)
    }
    setDraftCropArea(null)
    setCropMode(false)
  }, [draftCropArea, cropArea, rotation])
  
  const cancelCrop = useCallback(() => {
    // Discard draft crop without applying
    setDraftCropArea(null)
    setCropMode(false)
  }, [])
  
  const handleApply = useCallback(async () => {
    if (isApplying) return
    setIsApplying(true)
    
    try {
      const edits = { rotation, scale, crop: cropArea, offsetX: 0, offsetY: 0 }
      
      if (controller && pageNumber > 0 && applyEdit) {
        if (cropArea) {
          await applyEdit(pageNumber, { type: 'crop', value: cropArea })
        }
        if (rotation !== 0) {
          await applyEdit(pageNumber, { type: 'rotate', value: rotation })
        }
        if (scale !== 100) {
          await applyEdit(pageNumber, { type: 'scale', value: scale })
        }
      }
      
      window.dispatchEvent(new CustomEvent('pdfPageEdited', {
        detail: { pageIndex, edits }
      }))
      
      if (onApply) {
        onApply(pageIndex, edits)
      }
      
      onClose()
    } catch (err) {
      console.error('Apply failed:', err)
    } finally {
      setIsApplying(false)
    }
  }, [rotation, scale, cropArea, controller, pageNumber, pageIndex, applyEdit, onApply, onClose, isApplying])
  
  const handleApplyAll = useCallback(async () => {
    if (isApplyingAll) return
    setIsApplyingAll(true)
    
    try {
      const edits = { rotation, scale, crop: cropArea, offsetX: 0, offsetY: 0 }
      
      for (let i = 1; i <= totalPages; i++) {
        if (controller && applyEdit) {
          if (cropArea) {
            await applyEdit(i, { type: 'crop', value: cropArea })
          }
          if (rotation !== 0) {
            await applyEdit(i, { type: 'rotate', value: rotation })
          }
          if (scale !== 100) {
            await applyEdit(i, { type: 'scale', value: scale })
          }
        }
      }
      
      window.dispatchEvent(new CustomEvent('pdfAllPagesEdited', {
        detail: { edits }
      }))
      
      if (onApplyAll) {
        onApplyAll(edits)
      }
      
      onClose()
    } catch (err) {
      console.error('Apply All failed:', err)
    } finally {
      setIsApplyingAll(false)
    }
  }, [rotation, scale, cropArea, controller, totalPages, applyEdit, onApplyAll, onClose, isApplyingAll])
  
  if (!isOpen) return null
  
  const hasChanges = rotation !== (page?.editHistory?.rotation || 0) ||
                     scale !== (page?.editHistory?.scale || 100) ||
                     JSON.stringify(cropArea) !== JSON.stringify(page?.editHistory?.crop || null)

  const pageLabel = totalPages > 1 ? `Page ${pageNumber}-${totalPages}` : `Page ${pageNumber}`
  
  // Calculate auto-fit scale for rotated content at 100% user scale
  // When rotation is 90° or 270°, dimensions are swapped, so we need to scale down to fit
  // This ONLY applies when user scale is exactly 100% (original size)
  const calculateAutoFitScale = () => {
    if (scale !== 100) return 1.0
    
    // Normalize rotation to 0-359 range (handle negative rotations)
    const normalizedRotation = ((rotation % 360) + 360) % 360
    
    if (normalizedRotation === 90 || normalizedRotation === 270) {
      // For rotated content, we need to fit swapped dimensions
      // This matches the EXACT logic in pagePreviewService.ts
      if (previewImageRef.current) {
        // The preview image represents the fixed page (paper) dimensions
        const pageWidth = previewImageRef.current.naturalWidth || previewImageRef.current.width
        const pageHeight = previewImageRef.current.naturalHeight || previewImageRef.current.height
        
        // Content has the same dimensions as the page before rotation
        const contentWidth = pageWidth
        const contentHeight = pageHeight
        
        // After 90°/270° rotation, content's width needs to fit in page's height and vice versa
        // Formula from pagePreviewService: min(pageWidth / contentHeight, pageHeight / contentWidth, 1.0)
        const autoFit = Math.min(
          pageWidth / contentHeight,
          pageHeight / contentWidth,
          1.0 // Never scale up, only down to fit
        )
        
        console.log(`📐 [PDFEditorPopup] Auto-fit scale for ${normalizedRotation}° rotation: ${autoFit.toFixed(3)}`)
        return autoFit
      }
    }
    return 1.0
  }
  
  const autoFitScale = calculateAutoFitScale()
  const effectiveScale = (scale / 100) * autoFitScale
  
  // Calculate aspect ratio of the page content
  const calculateAspectRatio = () => {
    if (previewImageRef.current) {
      const width = previewImageRef.current.naturalWidth || previewImageRef.current.width
      const height = previewImageRef.current.naturalHeight || previewImageRef.current.height
      return width / height
    }
    return 1 // Default to square if unknown
  }
  
  const aspectRatio = calculateAspectRatio()
  
  const content = (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <span className="font-medium">{pageLabel}</span>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center hover:bg-blue-700 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 flex items-center justify-center bg-gray-100 p-3 min-h-0 overflow-hidden">
        <div className="relative inline-block">
          {previewImage ? (
            <>
              <img
                ref={previewImageRef}
                src={typeof previewImage === 'string' ? previewImage : previewImage.toDataURL?.()}
                alt={`Page ${pageNumber}`}
                className="shadow-lg rounded block"
                style={{
                  maxWidth: 'calc(100vw - 24px)',
                  maxHeight: 'calc(100vh - 200px)',
                  width: 'auto',
                  height: 'auto'
                }}
              />
              {cropMode && draftCropArea && (
                <CropOverlay
                  cropArea={draftCropArea}
                  onCropChange={setDraftCropArea}
                  imageRef={previewImageRef}
                  rotation={rotation}
                  scale={effectiveScale}
                  aspectRatio={aspectRatio}
                  committedCrop={cropArea}
                />
              )}
            </>
          ) : (
            <div className="w-64 h-80 flex flex-col items-center justify-center bg-white rounded-lg shadow-lg">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-3" />
              <span className="text-sm text-gray-500">Loading preview...</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white border-t border-gray-200">
        <div className="flex gap-1 px-3 py-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-transparent text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        
        <div className="px-3 pb-2">
          {activeTab === 'size' && (
            <div className="flex items-center gap-3 py-2">
              <input
                type="range"
                min="25"
                max="200"
                step="5"
                value={scale}
                onChange={(e) => setScale(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-semibold text-blue-600 w-12 text-right">{scale}%</span>
            </div>
          )}
          
          {activeTab === 'crop' && (
            <div className="py-2">
              {!cropMode ? (
                <div className="space-y-2">
                  <button
                    onClick={startCrop}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Crop className="w-4 h-4" />
                    <span>Start Cropping</span>
                  </button>
                  
                  {cropArea && (
                    <div className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700">Crop applied</span>
                      </div>
                      <button
                        onClick={() => setCropArea(null)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={cancelCrop}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={applyCropAction}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm</span>
                  </button>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'transform' && (
            <div className="flex gap-2 py-2">
              <button
                onClick={() => handleRotate('ccw')}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-700">Left 90°</span>
              </button>
              <div className="flex items-center justify-center px-4 py-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-lg font-bold text-blue-600">{rotation}°</span>
              </div>
              <button
                onClick={() => handleRotate('cw')}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RotateCw className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-700">Right 90°</span>
              </button>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 px-3 py-3 border-t border-gray-200">
          <button
            onClick={handleApply}
            disabled={isApplying || !hasChanges}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-gray-50 text-blue-600 border border-blue-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span className="text-sm">Apply</span>
          </button>
          
          <button
            onClick={handleApplyAll}
            disabled={isApplyingAll || !hasChanges}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplyingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            <span className="text-sm">Apply All</span>
          </button>
        </div>
      </div>
    </div>
  )
  
  return createPortal(content, document.body)
}

export default PDFEditorPopup
