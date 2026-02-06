import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, RotateCw, RotateCcw, Crop, Check, Loader2 } from 'lucide-react'
import { CropHandler, RotationHandler } from '../utils/pdf2'
import CropOverlay from './CropOverlay'
import { composeCrop, FULL_PAGE_BOX } from '../utils/pdf2/ui/coordinateTransforms'
import { applyPageTransformsToDataUrl } from '../utils/pdf2/ui/pageTransforms'

const TABS = [
  { id: 'size', label: 'Size' },
  { id: 'crop', label: 'Crop' },
  { id: 'transform', label: 'Transform' }
]

// NOTE: CropOverlay handles all rotation/aspect-ratio transforms internally via
// forwardTransformBox/inverseTransformBox from coordinateTransforms.ts.
// We pass the stored crop directly - no pre-transformation needed.

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
  const [isLoadingBase, setIsLoadingBase] = useState(false)

  // Track initial values when popup opens
  const initialRotationRef = useRef(0)
  const initialScaleRef = useRef(100)
  const initialCropRef = useRef(null)

  // Cache for base image (raw PDF render without transforms)
  const baseImageRef = useRef(null)
  const pageDimensionsRef = useRef({ width: 0, height: 0 })

  const cropHandlerRef = useRef(new CropHandler())
  const rotationHandlerRef = useRef(new RotationHandler())
  const previewImageRef = useRef(null)
  const cropHandler = cropHandlerRef.current
  const rotationHandler = rotationHandlerRef.current

  // Initialize state when popup opens
  useEffect(() => {
    if (isOpen && page) {
      const initRotation = page.editHistory?.rotation || 0
      const initScale = page.editHistory?.scale || 100
      const initCrop = page.editHistory?.crop || null

      setRotation(initRotation)
      setScale(initScale)
      setCropArea(initCrop)
      setCropMode(false)
      rotationHandler.initialize(initRotation)

      // Store initial values
      initialRotationRef.current = initRotation
      initialScaleRef.current = initScale
      initialCropRef.current = initCrop

      // Clear cached base image to force reload
      baseImageRef.current = null
      setPreviewImage(null)
    }
  }, [isOpen, page])

  // Load base image ONCE when popup opens (raw PDF render - no transforms)
  useEffect(() => {
    if (!isOpen || !page || !controller) return
    if (baseImageRef.current) return // Already loaded

    const loadBaseImage = async () => {
      setIsLoadingBase(true)
      try {
        // Use getRawPreview to get truly RAW page WITHOUT any transforms
        // This is critical - getPagePreviewAsync applies metadata transforms!
        if (controller.getRawPreview) {
          // Get RAW page preview WITHOUT transforms at scale 0.8
          // Enable disableNormalization (4th arg) to ensure we edit distinct raw pages, not A4 fitting
          const canvas = await controller.getRawPreview(pageNumber, 0.8, undefined, true)

          // Store page dimensions for fixed-page rendering
          pageDimensionsRef.current = { width: canvas.width, height: canvas.height }

          // Convert to Image object for fast reuse
          const img = new Image()
          img.src = canvas.toDataURL('image/jpeg', 0.8)
          await new Promise((resolve) => { img.onload = resolve })
          baseImageRef.current = img

          // Render initial preview with initial transforms
          const initialTransforms = {
            rotation: page.editHistory?.rotation || 0,
            scale: page.editHistory?.scale || 100,
            crop: page.editHistory?.crop || null
          }
          const previewDataUrl = applyTransformsToFixedCanvas(img, initialTransforms)
          setPreviewImage(previewDataUrl)
        } else {
          // Fallback to thumbnail
          const fallback = page.thumbnail || page.canvas
          setPreviewImage(fallback)
        }
      } catch (err) {
        console.error('Failed to load base image:', err)
        const fallback = page.thumbnail || page.canvas
        setPreviewImage(fallback)
      } finally {
        setIsLoadingBase(false)
      }
    }

    loadBaseImage()
  }, [isOpen, page, controller, pageNumber])

  // Apply transforms immediately for smooth slider experience
  // No debounce needed since transforms are applied to cached base image (fast)
  useEffect(() => {
    if (!isOpen || !baseImageRef.current) return

    // Apply transforms immediately for instant feedback
    const currentCrop = cropMode ? null : cropArea
    const transforms = { rotation, scale, crop: currentCrop }
    const previewDataUrl = applyTransformsToFixedCanvas(baseImageRef.current, transforms)
    setPreviewImage(previewDataUrl)
  }, [isOpen, rotation, scale, cropArea, cropMode])

  // Helper: Apply transforms to base image using shared utility
  // Uses pageDimensionsRef for target canvas size
  const applyTransformsToFixedCanvas = useCallback((baseImage, transforms) => {
    if (!baseImage) return null
    const targetDimensions = {
      width: pageDimensionsRef.current.width,
      height: pageDimensionsRef.current.height
    }
    return applyPageTransformsToDataUrl(baseImage, transforms, targetDimensions)
  }, [])

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
    // Initialize draft crop with margin
    const EDGE_MARGIN = 0.05
    const defaultCrop = {
      x: EDGE_MARGIN,
      y: EDGE_MARGIN,
      width: 1 - (EDGE_MARGIN * 2),
      height: 1 - (EDGE_MARGIN * 2)
    }

    // Pass stored crop directly - CropOverlay handles the visual transform
    setDraftCropArea(cropArea || defaultCrop)
    setCropMode(true)
  }, [cropArea])

  const applyCropAction = useCallback(() => {
    // Apply draft crop to actual crop
    // CropOverlay already returns the crop in content (source) coordinates
    // via inverseTransformBox, so no additional transform needed.

    if (draftCropArea) {
      const validated = cropHandler.validateCropBox(draftCropArea)
      setCropArea(validated)
    }
    setDraftCropArea(null)
    setCropMode(false)
  }, [draftCropArea, rotation, scale])

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
        // CORRECTION: Use setRotation (absolute) instead of rotate (delta) to prevent double-rotation
        // Also allow setting to 0 if the user rotated back to original
        await applyEdit(pageNumber, { type: 'setRotation', value: rotation })
        if (scale !== 100) {
          await applyEdit(pageNumber, { type: 'scale', value: scale })
        }
      }

      window.dispatchEvent(new CustomEvent('pdfPageEdited', {
        detail: { pageIndex, edits, previewImage }  // Include preview for instant thumbnail
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
          // CORRECTION: Use setRotation (absolute) instead of rotate (delta)
          await applyEdit(i, { type: 'setRotation', value: rotation })
          if (scale !== 100) {
            await applyEdit(i, { type: 'scale', value: scale })
          }
        }
      }

      window.dispatchEvent(new CustomEvent('pdfAllPagesEdited', {
        detail: { edits, previewImage }  // Include preview for instant thumbnails
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

  const pageLabel = `Page ${pageNumber}`

  // Calculate auto-fit scale for rotated content
  // When rotation is 90° or 270°, dimensions are swapped, so we need to scale down to fit
  // This applies regardless of user scale - auto-fit ensures content fits in the paper
  const calculateAutoFitScale = () => {
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
      <div id="pdf-editor-popup-modal" className="flex flex-col h-full">
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
                    maxHeight: 'calc(100vh - 280px)',  // Account for header + tabs + buttons
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
                    scale={effectiveScale}  // Use actual scale - coordinateTransforms handles the mapping
                    aspectRatio={aspectRatio}
                    slotAspectRatio={aspectRatio}
                    committedCrop={null}
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
                  id={`edit-popup-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
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
                <div className="flex-1 relative h-2">
                  {/* Background track */}
                  <div className="absolute inset-0 bg-gray-200 rounded-full" />
                  {/* Filled track */}
                  <div
                    className="absolute left-0 top-0 h-full bg-blue-600 rounded-full"
                    style={{ width: `${((scale - 25) / (200 - 25)) * 100}%` }}
                  />
                  {/* Range input */}
                  <input
                    type="range"
                    min="25"
                    max="200"
                    step="1"
                    value={scale}
                    onChange={(e) => setScale(parseInt(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ touchAction: 'none' }}
                  />
                  {/* Thumb indicator */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-600 rounded-full shadow-md border-2 border-white pointer-events-none"
                    style={{ left: `calc(${((scale - 25) / (200 - 25)) * 100}% - 10px)` }}
                  />
                </div>
                <span className="text-sm font-semibold text-blue-600 w-12 text-right">{scale}%</span>
              </div>
            )}

            {activeTab === 'crop' && (
              <div className="py-2">
                {!cropMode ? (
                  <div className="flex gap-2 items-center">
                    <button
                      id="edit-popup-crop-start"
                      onClick={startCrop}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Crop className="w-4 h-4" />
                      <span className="text-sm">Start Crop</span>
                    </button>

                    {cropArea && (
                      <button
                        onClick={() => setCropArea(null)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 border border-red-200 rounded-lg group hover:bg-red-100 transition-colors"
                      >
                        <X className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                        <span className="text-sm text-red-700 font-medium">Remove Crop</span>
                      </button>
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
              <div id="edit-popup-rotation-group" className="flex gap-2 py-2">
                <button
                  id="edit-popup-rotate-left"
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
                  id="edit-popup-rotate-right"
                  onClick={() => handleRotate('cw')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <RotateCw className="w-5 h-5 text-gray-700" />
                  <span className="text-sm text-gray-700">Right 90°</span>
                </button>
              </div>
            )}
          </div>

          <div id="edit-popup-apply-group" className="flex gap-2 px-3 py-3 border-t border-gray-200">
            <button
              id="edit-popup-apply-page"
              onClick={handleApply}
              disabled={isApplying || !hasChanges}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span className="text-sm">Apply to Page {pageNumber}</span>
            </button>

            <button
              id="edit-popup-apply-all"
              onClick={handleApplyAll}
              disabled={isApplyingAll || !hasChanges}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplyingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span className="text-sm">Apply to All Pages</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // Early return if popup is not open
  if (!isOpen) return null

  return createPortal(content, document.body)
}

export default PDFEditorPopup
