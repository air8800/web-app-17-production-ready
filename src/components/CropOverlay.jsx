import React, { useState, useCallback, useRef, useEffect } from 'react'
import { 
  forwardTransformBox, 
  inverseTransformBox, 
  composeCrop, 
  decomposeCrop, 
  clampBox,
  FULL_PAGE_BOX 
} from '../utils/pdf2/ui/coordinateTransforms'

const CropOverlay = ({
  cropArea,
  onCropChange,
  imageRef,
  rotation = 0,
  scale = 1,
  aspectRatio = 1,
  disabled = false,
  committedCrop = null
}) => {
  const [activeHandle, setActiveHandle] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const [initialCrop, setInitialCrop] = useState(null)
  
  // DEBUG: Log the received props
  console.log(`📐 [CropOverlay] RECEIVED rotation=${rotation}°, scale=${scale}, AR=${aspectRatio.toFixed(3)}`)
  
  // Step 1: Compose draft crop with committed crop to get absolute content coordinates
  // cropArea is relative to visible area (committedCrop), we need absolute for transforms
  const absoluteCrop = cropArea ? composeCrop(committedCrop, cropArea) : null
  
  // Step 2: Forward transform to screen space for display (aspect-ratio aware)
  const rawScreenCrop = absoluteCrop ? forwardTransformBox(absoluteCrop, rotation, scale, aspectRatio) : null
  
  // Step 3: Clamp to [0,1] to prevent handles from going outside page at high scales
  const screenCrop = rawScreenCrop ? {
    x: Math.max(0, Math.min(1, rawScreenCrop.x)),
    y: Math.max(0, Math.min(1, rawScreenCrop.y)),
    width: Math.max(0, Math.min(1 - Math.max(0, rawScreenCrop.x), rawScreenCrop.width)),
    height: Math.max(0, Math.min(1 - Math.max(0, rawScreenCrop.y), rawScreenCrop.height))
  } : null
  
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
    const absoluteContentCrop = inverseTransformBox(newScreenCrop, rotation, scale, aspectRatio)
    
    // Step 2: Decompose absolute crop back to relative coordinates within committed crop
    const relativeCrop = decomposeCrop(committedCrop, absoluteContentCrop)
    
    // Step 3: Clamp relative crop to valid [0,1] range (relative to visible area)
    const clampedCrop = clampBox(relativeCrop, 0.05)
    
    // Debug logging
    console.log(`🎯 [CropOverlay] Drag at rotation=${rotation}°, AR=${aspectRatio.toFixed(3)}:`)
    console.log(`  Screen: {x:${newScreenCrop.x.toFixed(3)}, y:${newScreenCrop.y.toFixed(3)}, w:${newScreenCrop.width.toFixed(3)}, h:${newScreenCrop.height.toFixed(3)}} (${newScreenCrop.width > newScreenCrop.height ? 'HORIZONTAL' : 'VERTICAL'})`)
    console.log(`  Content: {x:${absoluteContentCrop.x.toFixed(3)}, y:${absoluteContentCrop.y.toFixed(3)}, w:${absoluteContentCrop.width.toFixed(3)}, h:${absoluteContentCrop.height.toFixed(3)}} (${absoluteContentCrop.width > absoluteContentCrop.height ? 'HORIZONTAL' : 'VERTICAL'})`)
    
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
  
  const handleSize = 14
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
          cursor: activeHandle === 'center' ? 'grabbing' : 'grab'
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
            pointerEvents: disabled ? 'none' : 'auto'
          }}
          onMouseDown={(e) => handlePointerDown(e, handle.id)}
          onTouchStart={(e) => handlePointerDown(e, handle.id)}
        />
      ))}
    </>
  )
}

export default CropOverlay
