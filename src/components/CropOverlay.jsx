import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  forwardTransformBox,
  inverseTransformBox,
  composeCrop,
  decomposeCrop,
  clampBox,
  FULL_PAGE_BOX
} from '../utils/pdf2/ui/coordinateTransforms'

// Set to true to enable verbose crop debugging
const DEBUG_CROP = true

const CropOverlay = ({
  cropArea,
  onCropChange,
  imageRef,
  rotation = 0,
  scale = 1,
  aspectRatio = 1,
  slotAspectRatio = 1,
  disabled = false,
  committedCrop = null
}) => {
  const [activeHandle, setActiveHandle] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const [initialCrop, setInitialCrop] = useState(null)

  // Track if user has manually interacted with crop - once they drag, preserve their position
  const userHasInteracted = useRef(false)

  // Props: rotation, scale, aspectRatio used for coordinate transforms

  // Step 1: Compose draft crop with committed crop to get absolute content coordinates
  // cropArea is relative to visible area (committedCrop), we need absolute for transforms
  const absoluteCrop = cropArea ? composeCrop(committedCrop, cropArea) : null

  // Step 2: Forward transform to screen space for display (aspect-ratio aware)
  const rawScreenCrop = absoluteCrop ? forwardTransformBox(absoluteCrop, rotation, scale, aspectRatio, slotAspectRatio) : null

  // Step 3: Clamp with conditional margin:
  // - Initial (before user interacts): Enforce 2% margin from edges
  // - After user has interacted (dragged): No margin - preserve their position
  const displayMargin = userHasInteracted.current ? 0 : 0.02

  const screenCrop = rawScreenCrop ? {
    x: Math.max(displayMargin, Math.min(1 - displayMargin, rawScreenCrop.x)),
    y: Math.max(displayMargin, Math.min(1 - displayMargin, rawScreenCrop.y)),
    width: Math.max(0.05, Math.min(1 - displayMargin - Math.max(displayMargin, rawScreenCrop.x), rawScreenCrop.width)),
    height: Math.max(0.05, Math.min(1 - displayMargin - Math.max(displayMargin, rawScreenCrop.y), rawScreenCrop.height))
  } : null

  // 🔍 DEBUG: Log crop coordinate transformations for debugging overlay vs actual crop
  // Also include pixel-level comparison for visual verification
  const imageRect = imageRef?.current?.getBoundingClientRect()
  const imagePixelWidth = imageRect?.width || 0
  const imagePixelHeight = imageRect?.height || 0

  if (DEBUG_CROP && cropArea && screenCrop) {
    const overlayPixelX = screenCrop.x * imagePixelWidth
    const overlayPixelY = screenCrop.y * imagePixelHeight
    const overlayPixelWidth = screenCrop.width * imagePixelWidth
    const overlayPixelHeight = screenCrop.height * imagePixelHeight

    console.log(`\n🎯 [CropOverlay] CROP COORDINATES DEBUG
    ═══════════════════════════════════════════════════════════════
    📊 Input Parameters:
       - rotation: ${rotation}°
       - scale: ${scale}
       - aspectRatio: ${aspectRatio?.toFixed(4) || 'null'}
       - committedCrop: ${committedCrop ? JSON.stringify(committedCrop) : 'null'}
    
    📐 IMAGE ELEMENT DIMENSIONS (visible on screen):
       width: ${imagePixelWidth.toFixed(0)}px
       height: ${imagePixelHeight.toFixed(0)}px
       aspect ratio: ${imagePixelWidth && imagePixelHeight ? (imagePixelWidth / imagePixelHeight).toFixed(4) : 'N/A'}
    
    📍 CROP COORDINATE CHAIN:
    ───────────────────────────────────────────────────────────────
    [1] cropArea (relative/draft - passed from parent):
        x: ${cropArea.x.toFixed(4)} (${(cropArea.x * 100).toFixed(1)}%)
        y: ${cropArea.y.toFixed(4)} (${(cropArea.y * 100).toFixed(1)}%)
        width: ${cropArea.width.toFixed(4)} (${(cropArea.width * 100).toFixed(1)}%)
        height: ${cropArea.height.toFixed(4)} (${(cropArea.height * 100).toFixed(1)}%)
    
    [2] absoluteCrop (after composeCrop with committedCrop):
        x: ${absoluteCrop.x.toFixed(4)} (${(absoluteCrop.x * 100).toFixed(1)}%)
        y: ${absoluteCrop.y.toFixed(4)} (${(absoluteCrop.y * 100).toFixed(1)}%)
        width: ${absoluteCrop.width.toFixed(4)} (${(absoluteCrop.width * 100).toFixed(1)}%)
        height: ${absoluteCrop.height.toFixed(4)} (${(absoluteCrop.height * 100).toFixed(1)}%)
    
    [3] rawScreenCrop (after forwardTransformBox - screen space):
        x: ${rawScreenCrop.x.toFixed(4)} (${(rawScreenCrop.x * 100).toFixed(1)}%)
        y: ${rawScreenCrop.y.toFixed(4)} (${(rawScreenCrop.y * 100).toFixed(1)}%)
        width: ${rawScreenCrop.width.toFixed(4)} (${(rawScreenCrop.width * 100).toFixed(1)}%)
        height: ${rawScreenCrop.height.toFixed(4)} (${(rawScreenCrop.height * 100).toFixed(1)}%)
    
    [4] screenCrop (after clamping - DISPLAYED ON OVERLAY):
        x: ${screenCrop.x.toFixed(4)} (${(screenCrop.x * 100).toFixed(1)}%)
        y: ${screenCrop.y.toFixed(4)} (${(screenCrop.y * 100).toFixed(1)}%)
        width: ${screenCrop.width.toFixed(4)} (${(screenCrop.width * 100).toFixed(1)}%)
        height: ${screenCrop.height.toFixed(4)} (${(screenCrop.height * 100).toFixed(1)}%)
    
    🎨 VISUAL OVERLAY (actual pixels on screen):
       x: ${overlayPixelX.toFixed(0)}px
       y: ${overlayPixelY.toFixed(0)}px
       width: ${overlayPixelWidth.toFixed(0)}px
       height: ${overlayPixelHeight.toFixed(0)}px
       
    ⚠️ VISUAL vs CONTENT HEIGHT RATIO:
       Overlay height: ${(screenCrop.height * 100).toFixed(2)}% of display
       Content height (cropArea): ${(cropArea.height * 100).toFixed(2)}% of content
       DIFFERENCE: ${((screenCrop.height - cropArea.height) * 100).toFixed(2)}%
    ═══════════════════════════════════════════════════════════════\n`)
  }

  const getPointerPosition = useCallback((e) => {
    if (!imageRef?.current) return { x: 0, y: 0 }

    const rect = imageRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    }
  }, [imageRef])

  const handlePointerDown = useCallback((e, handleType) => {
    if (disabled || !screenCrop) return
    e.preventDefault()
    e.stopPropagation()

    // Mark that user has manually interacted - disable margin clamping
    userHasInteracted.current = true

    const pos = getPointerPosition(e)
    setActiveHandle(handleType)
    setDragStart(pos)
    setInitialCrop({ ...screenCrop })
  }, [screenCrop, getPointerPosition, disabled])

  const handlePointerMove = useCallback((e) => {
    if (!activeHandle || !dragStart || !initialCrop) return

    const pos = getPointerPosition(e)
    const dx = pos.x - dragStart.x
    const dy = pos.y - dragStart.y

    // Work in screen space for dragging
    let newScreenCrop = { ...initialCrop }

    if (activeHandle === 'center') {
      // Allow dragging to edges - user can position crop anywhere
      newScreenCrop.x = Math.max(0, Math.min(1 - initialCrop.width, initialCrop.x + dx))
      newScreenCrop.y = Math.max(0, Math.min(1 - initialCrop.height, initialCrop.y + dy))
    } else {
      const minSize = 0.05

      switch (activeHandle) {
        case 'nw':
          newScreenCrop.x = Math.max(0, Math.min(initialCrop.x + initialCrop.width - minSize, initialCrop.x + dx))
          newScreenCrop.y = Math.max(0, Math.min(initialCrop.y + initialCrop.height - minSize, initialCrop.y + dy))
          newScreenCrop.width = initialCrop.x + initialCrop.width - newScreenCrop.x
          newScreenCrop.height = initialCrop.y + initialCrop.height - newScreenCrop.y
          break
        case 'ne':
          newScreenCrop.y = Math.max(0, Math.min(initialCrop.y + initialCrop.height - minSize, initialCrop.y + dy))
          newScreenCrop.width = Math.max(minSize, Math.min(1 - initialCrop.x, initialCrop.width + dx))
          newScreenCrop.height = initialCrop.y + initialCrop.height - newScreenCrop.y
          break
        case 'sw':
          newScreenCrop.x = Math.max(0, Math.min(initialCrop.x + initialCrop.width - minSize, initialCrop.x + dx))
          newScreenCrop.width = initialCrop.x + initialCrop.width - newScreenCrop.x
          newScreenCrop.height = Math.max(minSize, Math.min(1 - initialCrop.y, initialCrop.height + dy))
          break
        case 'se':
          newScreenCrop.width = Math.max(minSize, Math.min(1 - initialCrop.x, initialCrop.width + dx))
          newScreenCrop.height = Math.max(minSize, Math.min(1 - initialCrop.y, initialCrop.height + dy))
          break
        default:
          break
      }
    }

    // Step 1: Inverse transform screen crop back to absolute content space (aspect-ratio aware)
    const absoluteContentCrop = inverseTransformBox(newScreenCrop, rotation, scale, aspectRatio, slotAspectRatio)

    // Step 2: Decompose absolute crop back to relative coordinates within committed crop
    const relativeCrop = decomposeCrop(committedCrop, absoluteContentCrop)

    // Step 3: Clamp relative crop to valid [0,1] range (relative to visible area)
    const clampedCrop = clampBox(relativeCrop, 0.05)

    // 🔍 DEBUG: Log inverse transform chain when user drags/resizes
    console.log(`🔄 [CropOverlay] INVERSE TRANSFORM (on drag/resize)
    ───────────────────────────────────────────────────────────────
    [A] newScreenCrop (user's screen selection):
        x: ${newScreenCrop.x.toFixed(4)}, y: ${newScreenCrop.y.toFixed(4)}
        w: ${newScreenCrop.width.toFixed(4)}, h: ${newScreenCrop.height.toFixed(4)}
    
    [B] absoluteContentCrop (after inverseTransformBox):
        x: ${absoluteContentCrop.x.toFixed(4)}, y: ${absoluteContentCrop.y.toFixed(4)}
        w: ${absoluteContentCrop.width.toFixed(4)}, h: ${absoluteContentCrop.height.toFixed(4)}
    
    [C] relativeCrop (after decomposeCrop):
        x: ${relativeCrop.x.toFixed(4)}, y: ${relativeCrop.y.toFixed(4)}
        w: ${relativeCrop.width.toFixed(4)}, h: ${relativeCrop.height.toFixed(4)}
    
    [D] clampedCrop (FINAL - sent to onCropChange):
        x: ${clampedCrop.x.toFixed(4)}, y: ${clampedCrop.y.toFixed(4)}
        w: ${clampedCrop.width.toFixed(4)}, h: ${clampedCrop.height.toFixed(4)}
    ───────────────────────────────────────────────────────────────`)

    onCropChange(clampedCrop)
  }, [activeHandle, dragStart, initialCrop, getPointerPosition, onCropChange, rotation, scale, aspectRatio, committedCrop])

  const handlePointerUp = useCallback(() => {
    setActiveHandle(null)
    setDragStart(null)
    setInitialCrop(null)
  }, [])

  useEffect(() => {
    if (activeHandle) {
      const touchMoveOptions = { passive: false }

      const handleTouchMove = (e) => {
        e.preventDefault()
        handlePointerMove(e)
      }

      window.addEventListener('mousemove', handlePointerMove)
      window.addEventListener('mouseup', handlePointerUp)
      window.addEventListener('touchmove', handleTouchMove, touchMoveOptions)
      window.addEventListener('touchend', handlePointerUp)

      return () => {
        window.removeEventListener('mousemove', handlePointerMove)
        window.removeEventListener('mouseup', handlePointerUp)
        window.removeEventListener('touchmove', handleTouchMove, touchMoveOptions)
        window.removeEventListener('touchend', handlePointerUp)
      }
    }
  }, [activeHandle, handlePointerMove, handlePointerUp])

  if (!screenCrop) return null

  // Larger handles for better mobile touch experience
  const handleSize = 28
  const handleOffset = handleSize / 2

  const handles = [
    { id: 'nw', style: { left: `calc(${screenCrop.x * 100}% - ${handleOffset}px)`, top: `calc(${screenCrop.y * 100}% - ${handleOffset}px)` }, cursor: 'nwse-resize' },
    { id: 'ne', style: { left: `calc(${(screenCrop.x + screenCrop.width) * 100}% - ${handleOffset}px)`, top: `calc(${screenCrop.y * 100}% - ${handleOffset}px)` }, cursor: 'nesw-resize' },
    { id: 'sw', style: { left: `calc(${screenCrop.x * 100}% - ${handleOffset}px)`, top: `calc(${(screenCrop.y + screenCrop.height) * 100}% - ${handleOffset}px)` }, cursor: 'nesw-resize' },
    { id: 'se', style: { left: `calc(${(screenCrop.x + screenCrop.width) * 100}% - ${handleOffset}px)`, top: `calc(${(screenCrop.y + screenCrop.height) * 100}% - ${handleOffset}px)` }, cursor: 'nwse-resize' }
  ]

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <div
          className="absolute bg-black/40"
          style={{
            left: 0,
            top: 0,
            right: `${(1 - screenCrop.x) * 100}%`,
            bottom: 0
          }}
        />
        <div
          className="absolute bg-black/40"
          style={{
            left: `${(screenCrop.x + screenCrop.width) * 100}%`,
            top: 0,
            right: 0,
            bottom: 0
          }}
        />
        <div
          className="absolute bg-black/40"
          style={{
            left: `${screenCrop.x * 100}%`,
            top: 0,
            width: `${screenCrop.width * 100}%`,
            height: `${screenCrop.y * 100}%`
          }}
        />
        <div
          className="absolute bg-black/40"
          style={{
            left: `${screenCrop.x * 100}%`,
            top: `${(screenCrop.y + screenCrop.height) * 100}%`,
            width: `${screenCrop.width * 100}%`,
            bottom: 0
          }}
        />
      </div>

      <div
        className="absolute border-2 border-dashed border-blue-500"
        style={{
          left: `${screenCrop.x * 100}%`,
          top: `${screenCrop.y * 100}%`,
          width: `${screenCrop.width * 100}%`,
          height: `${screenCrop.height * 100}%`,
          zIndex: 11,
          pointerEvents: disabled ? 'none' : 'auto',
          cursor: activeHandle === 'center' ? 'grabbing' : 'grab',
          touchAction: 'none'  // Prevent scroll interference on touch
        }}
        onMouseDown={(e) => handlePointerDown(e, 'center')}
        onTouchStart={(e) => handlePointerDown(e, 'center')}
      >
        <div
          className="absolute bg-white/80 rounded-full border-2 border-blue-600 shadow-md flex items-center justify-center"
          style={{
            width: 20,
            height: 20,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            cursor: activeHandle === 'center' ? 'grabbing' : 'grab'
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" />
          </svg>
        </div>
      </div>

      {handles.map((handle) => (
        <div
          key={handle.id}
          className="absolute bg-white border-2 border-blue-600 rounded-full shadow-lg"
          style={{
            ...handle.style,
            width: handleSize,
            height: handleSize,
            cursor: disabled ? 'default' : handle.cursor,
            zIndex: 12,
            pointerEvents: disabled ? 'none' : 'auto',
            touchAction: 'none'  // Prevent scroll interference on touch
          }}
          onMouseDown={(e) => handlePointerDown(e, handle.id)}
          onTouchStart={(e) => handlePointerDown(e, handle.id)}
        />
      ))}
    </>
  )
}

export default CropOverlay
