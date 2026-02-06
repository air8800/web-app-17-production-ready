import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, RotateCw, RotateCcw, Crop, Check, Loader2 } from 'lucide-react'
import { CropHandler, RotationHandler } from '../utils/pdf2'
import CropOverlay from './CropOverlay'
import { composeCrop, getVisibleContentWindow } from '../utils/pdf2/ui/coordinateTransforms'
import { applyPageTransformsToCanvas } from '../utils/pdf2/ui/pageTransforms'

const TABS = [
    { id: 'size', label: 'Size' },
    { id: 'crop', label: 'Crop' },
    { id: 'transform', label: 'Transform' }
]

/**
 * PDFEditorSheetPopup - Editor for N-up sheets (2 pages combined)
 * Shows combined preview with page selector (Page 1 / Page 2 / Both)
 */
const PDFEditorSheetPopup = ({
    isOpen,
    onClose,
    sheetData,
    onApply,
    onApplyAll,
    pageSize = 'A4'
}) => {
    const [activeTab, setActiveTab] = useState('size')
    const [editTarget, setEditTarget] = useState('both')

    // Transforms
    const [rotation1, setRotation1] = useState(0)
    const [scale1, setScale1] = useState(100)
    const [cropArea1, setCropArea1] = useState(null)

    const [rotation2, setRotation2] = useState(0)
    const [scale2, setScale2] = useState(100)
    const [cropArea2, setCropArea2] = useState(null)

    const [cropMode, setCropMode] = useState(false)
    // Dual draft crop areas for separate pages
    const [draftCropArea1, setDraftCropArea1] = useState(null)
    const [draftCropArea2, setDraftCropArea2] = useState(null)

    const [isApplying, setIsApplying] = useState(false)
    const [combinedPreview, setCombinedPreview] = useState(null)
    // Geometry of page slots in preview { x, y, width, height }
    const [pageLayouts, setPageLayouts] = useState([])
    const [drawnGeometry, setDrawnGeometry] = useState([null, null])
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)

    // Page aspect ratios (raw page width/height). Needed for correct crop mapping on 90°/270°.
    const [pageAspectRatios, setPageAspectRatios] = useState([1, 1])

    const page1CanvasRef = useRef(null)
    const page2CanvasRef = useRef(null)
    const combinedCanvasRef = useRef(null)
    const previewImageRef = useRef(null)
    const slot1Ref = useRef(null)
    const slot2Ref = useRef(null)

    const cropHandler = useRef(new CropHandler()).current
    const rotationHandler1 = useRef(new RotationHandler()).current
    const rotationHandler2 = useRef(new RotationHandler()).current

    // Initialize state when popup opens
    useEffect(() => {
        if (isOpen && sheetData) {
            const { page1Data, page2Data } = sheetData

            // Clear previous preview immediately to show loading spinner
            setCombinedPreview(null)
            setIsLoadingPreview(true)

            // Initialize page 1 transforms
            setRotation1(page1Data?.page?.editHistory?.rotation || 0)
            setScale1(page1Data?.page?.editHistory?.scale || 100)
            setCropArea1(page1Data?.page?.editHistory?.crop || null)
            rotationHandler1.initialize(page1Data?.page?.editHistory?.rotation || 0)

            // Initialize page 2 transforms (or reset if no page2)
            if (page2Data) {
                setRotation2(page2Data?.page?.editHistory?.rotation || 0)
                setScale2(page2Data?.page?.editHistory?.scale || 100)
                setCropArea2(page2Data?.page?.editHistory?.crop || null)
                rotationHandler2.initialize(page2Data?.page?.editHistory?.rotation || 0)
            } else {
                // Reset page 2 state to avoid stale data
                setRotation2(0)
                setScale2(100)
                setCropArea2(null)
            }

            setEditTarget('both')
            setCropMode(false)
            setDraftCropArea1(null)
            setDraftCropArea2(null)
        }
    }, [isOpen, sheetData])

    // Render combined preview
    useEffect(() => {
        if (!isOpen || !sheetData?.controller) return

        const renderPreview = async () => {
            setIsLoadingPreview(true)
            try {
                const { controller, pages } = sheetData

                // Get raw page canvases at scale 0.8
                const canvas1 = await controller.getRawPreview?.(pages[0], 0.8)
                const canvas2 = pages[1] ? await controller.getRawPreview?.(pages[1], 0.8) : null

                page1CanvasRef.current = canvas1
                page2CanvasRef.current = canvas2

                // Store raw aspect ratios for crop coordinate transforms
                const ar1 = canvas1?.width && canvas1?.height ? (canvas1.width / canvas1.height) : 1
                const ar2 = canvas2?.width && canvas2?.height ? (canvas2.width / canvas2.height) : 1
                setPageAspectRatios([
                    Number.isFinite(ar1) && ar1 > 0 ? ar1 : 1,
                    Number.isFinite(ar2) && ar2 > 0 ? ar2 : 1
                ])

                // Apply transforms and combine
                // In crop mode: Keep scale to user's zoom level
                const inCropMode1 = cropMode && (editTarget === 'page1' || editTarget === 'both')
                const inCropMode2 = cropMode && (editTarget === 'page2' || editTarget === 'both')

                const t1 = {
                    rotation: rotation1,
                    scale: scale1,
                    crop: inCropMode1 ? null : cropArea1
                }

                const t2 = {
                    rotation: rotation2,
                    scale: scale2,
                    crop: inCropMode2 ? null : cropArea2
                }

                const result = combinePagesWithTransforms(canvas1, t1, canvas2, t2)

                if (result) {
                    setCombinedPreview(result.dataURL)
                    setPageLayouts(result.layouts)
                    setDrawnGeometry(result.drawnGeometry || [null, null])
                }
            } catch (err) {
                console.error('Failed to render sheet preview:', err)
            } finally {
                setIsLoadingPreview(false)
            }
        }

        renderPreview()
    }, [isOpen, sheetData, rotation1, scale1, cropArea1, rotation2, scale2, cropArea2, cropMode, editTarget])



    // Combine two page canvases into a single preview
    const combinePagesWithTransforms = useCallback((canvas1, transforms1, canvas2, transforms2) => {
        if (!canvas1) return null

        // Sheet Dimensions (always landscape for side-by-side viewing)
        const baseDim = Math.max(canvas1.width, canvas1.height)
        const minorDim = Math.min(canvas1.width, canvas1.height)
        const sheetWidth = baseDim
        const sheetHeight = minorDim

        const combinedCanvas = document.createElement('canvas')
        combinedCanvas.width = sheetWidth
        combinedCanvas.height = sheetHeight
        const ctx = combinedCanvas.getContext('2d')

        // Fill background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, sheetWidth, sheetHeight)

        // Define Slots (Horizontal side-by-side layout)
        const margin = sheetWidth * 0.02
        const gap = sheetWidth * 0.02
        const slotWidth = (sheetWidth - (2 * margin) - gap) / 2
        const slotHeight = sheetHeight - (2 * margin)

        const layout1 = { x: margin, y: margin, width: slotWidth, height: slotHeight }
        const layout2 = { x: margin + slotWidth + gap, y: margin, width: slotWidth, height: slotHeight }

        // Store actual drawn geometry for crop overlay positioning
        let drawnGeometry1 = null
        let drawnGeometry2 = null

        // Helper to draw fit-to-slot and return actual drawn geometry
        // Returns FULL SLOT dimensions for overlay positioning
        const drawInSlot = (cvs, layouts, isTargeted, sourceCanvas, rotation) => {
            if (!cvs || !sourceCanvas) return null

            // Draw the fitted canvas (which takes up full slot)
            // cvs is already slotWidth x slotHeight
            ctx.drawImage(cvs, layouts.x, layouts.y)

            // Selection indicator (on full slot)
            if (isTargeted) {
                ctx.strokeStyle = '#3B82F6'
                ctx.lineWidth = Math.max(2, sheetWidth * 0.003)
                ctx.strokeRect(layouts.x, layouts.y, layouts.width, layouts.height)
            }

            // Return FULL SLOT geometry
            return {
                x: layouts.x,
                y: layouts.y,
                width: layouts.width,
                height: layouts.height,
                sourceWidth: sourceCanvas.width,
                sourceHeight: sourceCanvas.height
            }
        }

        // Apply transforms and draw Page 1 using shared utility
        const t1 = applyPageTransformsToCanvas(canvas1, transforms1, { width: slotWidth, height: slotHeight })
        drawnGeometry1 = drawInSlot(t1, layout1, editTarget === 'page1' || editTarget === 'both', canvas1, transforms1.rotation)

        // Apply transforms and draw Page 2
        if (canvas2) {
            const t2 = applyPageTransformsToCanvas(canvas2, transforms2, { width: slotWidth, height: slotHeight })
            drawnGeometry2 = drawInSlot(t2, layout2, editTarget === 'page2' || editTarget === 'both', canvas2, transforms2.rotation)
        } else {
            // Empty slot placeholder
            ctx.fillStyle = '#f9fafb'
            ctx.fillRect(layout2.x, layout2.y, layout2.width, layout2.height)
            ctx.strokeStyle = '#d1d5db'
            ctx.textAlign = 'center'
            ctx.fillStyle = '#9ca3af'
            ctx.font = `${Math.max(16, sheetHeight / 20)}px sans-serif`
            ctx.fillText('Empty', layout2.x + layout2.width / 2, layout2.y + layout2.height / 2)
        }

        combinedCanvasRef.current = combinedCanvas
        return {
            dataURL: combinedCanvas.toDataURL('image/jpeg', 0.7),
            layouts: [layout1, layout2],
            drawnGeometry: [drawnGeometry1, drawnGeometry2]
        }
    }, [editTarget])

    // (applyTransformsToCanvas removed - now using shared applyPageTransformsToCanvas)

    // Get current transforms based on edit target
    const getCurrentRotation = () => editTarget === 'page2' ? rotation2 : rotation1
    const getCurrentScale = () => editTarget === 'page2' ? scale2 : scale1
    const getCurrentCrop = () => editTarget === 'page2' ? cropArea2 : cropArea1

    // Handle rotation
    const handleRotate = useCallback((direction) => {
        const delta = direction === 'cw' ? 90 : -90

        if (editTarget === 'page1' || editTarget === 'both') {
            const newRot1 = ((rotation1 + delta) % 360 + 360) % 360
            setRotation1(newRot1)
        }
        if (editTarget === 'page2' || editTarget === 'both') {
            const newRot2 = ((rotation2 + delta) % 360 + 360) % 360
            setRotation2(newRot2)
        }
    }, [editTarget, rotation1, rotation2])

    // Handle scale
    const handleScaleChange = useCallback((newScale) => {
        if (editTarget === 'page1' || editTarget === 'both') {
            setScale1(newScale)
        }
        if (editTarget === 'page2' || editTarget === 'both') {
            setScale2(newScale)
        }
    }, [editTarget])

    // Start crop mode
    // Note: CropOverlay handles all rotation/aspect-ratio transforms internally via
    // forwardTransformBox/inverseTransformBox from coordinateTransforms.ts.
    // We pass the stored crop directly - no pre-transformation needed.
    const startCrop = useCallback(() => {
        const EDGE_MARGIN = 0.05
        const defaultCrop = {
            x: EDGE_MARGIN,
            y: EDGE_MARGIN,
            width: 1 - (EDGE_MARGIN * 2),
            height: 1 - (EDGE_MARGIN * 2)
        }

        if (editTarget === 'page1' || editTarget === 'both') {
            // Pass stored crop directly - CropOverlay handles the visual transform
            setDraftCropArea1(cropArea1 || defaultCrop)
        }
        if (editTarget === 'page2' || editTarget === 'both') {
            setDraftCropArea2(cropArea2 || defaultCrop)
        }
        setCropMode(true)
    }, [editTarget, cropArea1, cropArea2])


    // Apply crop
    // Use effective aspect ratio (PageAR / SlotAR) to account for non-square slot distortion
    const applyCropAction = useCallback(() => {
        // Calculate slot aspect ratios from layouts
        const slotAR1 = pageLayouts[0] ? pageLayouts[0].width / pageLayouts[0].height : 1
        const slotAR2 = pageLayouts[1] ? pageLayouts[1].width / pageLayouts[1].height : 1

        const pageAR1 = pageAspectRatios[0] || 1
        const pageAR2 = pageAspectRatios[1] || 1

        // Validate and apply for Page 1
        if ((editTarget === 'page1' || editTarget === 'both') && draftCropArea1) {
            // Since CropOverlay uses committedCrop=null (Full Page), draft is already Absolute
            const absoluteCrop1 = composeCrop(null, draftCropArea1)
            const validated1 = cropHandler.validateCropBox(absoluteCrop1)
            setCropArea1(validated1)
        }

        // Validate and apply for Page 2
        if ((editTarget === 'page2' || editTarget === 'both') && draftCropArea2) {
            const absoluteCrop2 = composeCrop(null, draftCropArea2)
            const validated2 = cropHandler.validateCropBox(absoluteCrop2)
            setCropArea2(validated2)
        }

        setCropMode(false)
        setDraftCropArea1(null)
        setDraftCropArea2(null)
        setActiveTab('size')
    }, [draftCropArea1, draftCropArea2, editTarget, cropHandler, pageLayouts, pageAspectRatios, rotation1, rotation2, scale1, scale2])


    // Sync crop handlers
    const handleCropChange1 = (newCrop) => {
        setDraftCropArea1(newCrop)
        if (editTarget === 'both') setDraftCropArea2(newCrop)
    }

    const handleCropChange2 = (newCrop) => {
        setDraftCropArea2(newCrop)
        if (editTarget === 'both') setDraftCropArea1(newCrop)
    }

    // Cancel crop
    const cancelCrop = useCallback(() => {
        setDraftCropArea1(null)
        setDraftCropArea2(null)
        setCropMode(false)
    }, [])

    // Apply all edits
    const handleApply = useCallback(async () => {
        if (isApplying || !sheetData) return
        setIsApplying(true)

        try {
            const { pages, page1Data, page2Data, applyEdit } = sheetData

            // Apply edits to page 1
            const edits1 = { rotation: rotation1, scale: scale1, crop: cropArea1, offsetX: 0, offsetY: 0 }
            if (applyEdit) {
                if (cropArea1) await applyEdit(pages[0], { type: 'crop', value: cropArea1 })
                if (rotation1 !== 0) await applyEdit(pages[0], { type: 'rotate', value: rotation1 })
                if (scale1 !== 100) await applyEdit(pages[0], { type: 'scale', value: scale1 })
            }

            // Apply edits to page 2
            if (page2Data && pages[1] && applyEdit) {
                if (cropArea2) await applyEdit(pages[1], { type: 'crop', value: cropArea2 })
                if (rotation2 !== 0) await applyEdit(pages[1], { type: 'rotate', value: rotation2 })
                if (scale2 !== 100) await applyEdit(pages[1], { type: 'scale', value: scale2 })
            }

            // Dispatch atomic sheet update event
            // This prevents race conditions in PDFEditorNew where separate events caused stale state issues
            const edits2 = (page2Data && pages[1]) ? { rotation: rotation2, scale: scale2, crop: cropArea2, offsetX: 0, offsetY: 0 } : null

            window.dispatchEvent(new CustomEvent('pdfSheetEdited', {
                detail: {
                    sheetNumber: sheetData.sheetNumber,
                    page1: { index: page1Data.index, edits: edits1 },
                    page2: edits2 ? { index: page2Data.index, edits: edits2 } : null
                }
            }))

            if (onApply) {
                onApply(sheetData.sheetNumber, { edits1, edits2: page2Data ? { rotation: rotation2, scale: scale2, crop: cropArea2 } : null })
            }

            onClose()
        } catch (err) {
            console.error('Apply failed:', err)
        } finally {
            setIsApplying(false)
        }
    }, [sheetData, rotation1, scale1, cropArea1, rotation2, scale2, cropArea2, onApply, onClose, isApplying])

    // Check for changes
    const hasChanges = () => {
        const init1 = sheetData?.page1Data?.page?.editHistory || {}
        const init2 = sheetData?.page2Data?.page?.editHistory || {}

        return rotation1 !== (init1.rotation || 0) ||
            scale1 !== (init1.scale || 100) ||
            JSON.stringify(cropArea1) !== JSON.stringify(init1.crop || null) ||
            rotation2 !== (init2.rotation || 0) ||
            scale2 !== (init2.scale || 100) ||
            JSON.stringify(cropArea2) !== JSON.stringify(init2.crop || null)
    }

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!isOpen) return null

    const sheetLabel = sheetData ? `Pages ${sheetData.pages.join('-')}` : 'Sheet'

    const content = (
        <div id="pdf-sheet-editor-modal" className="fixed inset-0 z-[9999] bg-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white shadow-md">
                <span className="font-semibold text-lg">{sheetLabel}</span>
                <button
                    onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center hover:bg-blue-700 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Page Selector */}
            <div className="flex gap-2 px-3 py-2 bg-gray-50 border-b">
                <span className="text-sm text-gray-600 self-center">Apply to:</span>
                <button
                    onClick={() => setEditTarget('page1')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${editTarget === 'page1' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
                        }`}
                >
                    Page {sheetData?.pages[0]}
                </button>
                {sheetData?.page2Data && (
                    <button
                        onClick={() => setEditTarget('page2')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${editTarget === 'page2' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
                            }`}
                    >
                        Page {sheetData?.pages[1]}
                    </button>
                )}
                <button
                    onClick={() => setEditTarget('both')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${editTarget === 'both' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
                        }`}
                >
                    Both
                </button>
            </div>

            {/* Preview Area */}
            <div className="flex-1 flex items-center justify-center bg-gray-100 p-3 min-h-0 overflow-auto">
                <div className="relative inline-block">
                    {combinedPreview ? (
                        <>
                            <img
                                ref={previewImageRef}
                                src={combinedPreview}
                                alt={sheetLabel}
                                className="shadow-lg rounded block"
                                style={{
                                    maxWidth: 'calc(100vw - 24px)',
                                    maxHeight: 'calc(100vh - 320px)',
                                    width: 'auto',
                                    height: 'auto'
                                }}
                            />

                            {/* Overlay 1 for Page 1 - drawnGeometry now returns full slot */}
                            {cropMode && draftCropArea1 && drawnGeometry[0] && (editTarget === 'page1' || editTarget === 'both') && (
                                <div
                                    ref={slot1Ref}
                                    style={{
                                        position: 'absolute',
                                        left: `${(drawnGeometry[0].x / (combinedCanvasRef.current?.width || 1)) * 100}%`,
                                        top: `${(drawnGeometry[0].y / (combinedCanvasRef.current?.height || 1)) * 100}%`,
                                        width: `${(drawnGeometry[0].width / (combinedCanvasRef.current?.width || 1)) * 100}%`,
                                        height: `${(drawnGeometry[0].height / (combinedCanvasRef.current?.height || 1)) * 100}%`
                                    }}>
                                    {/* Pass separate ARs */}
                                    {(() => {
                                        const slotAR = pageLayouts[0] ? pageLayouts[0].width / pageLayouts[0].height : 1
                                        const pageAR = pageAspectRatios[0] || 1
                                        return (
                                            <CropOverlay
                                                cropArea={draftCropArea1}
                                                onCropChange={handleCropChange1}
                                                imageRef={slot1Ref}
                                                rotation={rotation1}
                                                scale={scale1 / 100}
                                                aspectRatio={1}
                                                slotAspectRatio={1}
                                                committedCrop={null}
                                            />
                                        )
                                    })()}
                                </div>
                            )}

                            {/* Overlay 2 for Page 2 - drawnGeometry now returns full slot */}
                            {cropMode && draftCropArea2 && drawnGeometry[1] && (editTarget === 'page2' || editTarget === 'both') && (
                                <div
                                    ref={slot2Ref}
                                    style={{
                                        position: 'absolute',
                                        left: `${(drawnGeometry[1].x / (combinedCanvasRef.current?.width || 1)) * 100}%`,
                                        top: `${(drawnGeometry[1].y / (combinedCanvasRef.current?.height || 1)) * 100}%`,
                                        width: `${(drawnGeometry[1].width / (combinedCanvasRef.current?.width || 1)) * 100}%`,
                                        height: `${(drawnGeometry[1].height / (combinedCanvasRef.current?.height || 1)) * 100}%`
                                    }}>
                                    {(() => {
                                        const slotAR = pageLayouts[1] ? pageLayouts[1].width / pageLayouts[1].height : 1
                                        const pageAR = pageAspectRatios[1] || 1
                                        return (
                                            <CropOverlay
                                                cropArea={draftCropArea2}
                                                onCropChange={handleCropChange2}
                                                imageRef={slot2Ref}
                                                rotation={rotation2}
                                                scale={scale2 / 100}
                                                aspectRatio={1}
                                                slotAspectRatio={1}
                                                committedCrop={null}
                                            />
                                        )
                                    })()}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-96 h-64 flex flex-col items-center justify-center bg-white rounded-lg shadow-lg">
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-3" />
                            <span className="text-sm text-gray-500">Loading preview...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs and Controls */}
            <div className="bg-white border-t border-gray-200">
                <div className="flex gap-1 px-3 py-2">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-600'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
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
                                    style={{ width: `${(((editTarget === 'page2' ? scale2 : scale1) - 25) / (200 - 25)) * 100}%` }}
                                />
                                {/* Range input */}
                                <input
                                    type="range"
                                    min="25"
                                    max="200"
                                    step="1"
                                    value={editTarget === 'page2' ? scale2 : scale1}
                                    onChange={(e) => handleScaleChange(parseInt(e.target.value))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    style={{ touchAction: 'none' }}
                                />
                                {/* Thumb indicator */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-600 rounded-full shadow-md border-2 border-white pointer-events-none"
                                    style={{ left: `calc(${(((editTarget === 'page2' ? scale2 : scale1) - 25) / (200 - 25)) * 100}% - 10px)` }}
                                />
                            </div>
                            <span className="text-sm font-semibold text-blue-600 w-12 text-right">
                                {editTarget === 'page2' ? scale2 : scale1}%
                            </span>
                        </div>
                    )}

                    {activeTab === 'crop' && (
                        <div className="py-2">
                            <div className="py-4 flex flex-col items-center justify-center text-center px-4">
                                <span className="text-sm font-medium text-gray-600 mb-1">
                                    Dual Page / Booklet Mode doesn't support crop for now.
                                </span>
                                <span className="text-xs text-gray-500">
                                    Please switch to Single Page mode to use crop, then return to Booklet Mode to view changes.
                                </span>
                            </div>
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
                                <span className="text-lg font-bold text-blue-600">
                                    {editTarget === 'page2' ? rotation2 : rotation1}°
                                </span>
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

                {/* Apply Button */}
                <div className="flex gap-2 px-3 py-3 border-t border-gray-200">
                    <button
                        onClick={handleApply}
                        disabled={isApplying || !hasChanges()}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isApplying ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        <span className="text-sm">Apply to Pages {sheetData?.pages.join('-')}</span>
                    </button>
                    {onApplyAll && (
                        <button
                            onClick={() => {
                                const edits1 = { rotation: rotation1, scale: scale1, crop: cropArea1, offsetX: 0, offsetY: 0, type: 'modify' }
                                const edits2 = { rotation: rotation2, scale: scale2, crop: cropArea2, offsetX: 0, offsetY: 0, type: 'modify' }
                                onApplyAll(edits1, edits2)
                                onClose()
                            }}
                            disabled={!hasChanges()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Check className="w-4 h-4" />
                            <span className="text-sm">Apply to All Pages</span>
                        </button>
                    )}
                </div>
            </div>
        </div >
    )

    return createPortal(content, document.body)
}

export default PDFEditorSheetPopup
