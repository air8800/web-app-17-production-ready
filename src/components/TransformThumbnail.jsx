import React, { useRef, useEffect, memo } from 'react'
import { detectContentBounds } from '../utils/pdf2/ui/pageTransforms'

/**
 * TransformThumbnail - Renders a thumbnail by applying transforms to a base image
 * 
 * This component takes a base (untransformed) image and applies rotation, scale,
 * and crop transforms at DISPLAY TIME, making updates INSTANT when transforms change.
 * 
 * Now includes content-aware centering to match preview behavior.
 * 
 * @param baseImage - Base image URL (untransformed)
 * @param transforms - { rotation, scale, crop } to apply
 * @param size - Thumbnail size in pixels
 * @param onClick - Click handler
 */
const TransformThumbnail = memo(({
    baseImage,
    transforms = {},
    size = 150,
    className = '',
    onClick
}) => {
    const canvasRef = useRef(null)
    const imageRef = useRef(null)

    const { rotation = 0, scale = 100, crop = null } = transforms

    // Render transforms when base image or transforms change
    useEffect(() => {
        if (!baseImage || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Load image if not already loaded
        const renderWithImage = (img) => {
            // Calculate thumbnail dimensions (maintain aspect ratio)
            const aspectRatio = img.height / img.width
            const thumbWidth = size
            const thumbHeight = size * aspectRatio

            // Set canvas size
            canvas.width = thumbWidth
            canvas.height = thumbHeight

            // Fill with white background
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, thumbWidth, thumbHeight)

            // Calculate content dimensions (after crop)
            let contentWidth = img.width
            let contentHeight = img.height
            let sx = 0, sy = 0, sw = img.width, sh = img.height

            if (crop && crop.width && crop.height) {
                sx = crop.x * img.width
                sy = crop.y * img.height
                sw = crop.width * img.width
                sh = crop.height * img.height
                contentWidth = sw
                contentHeight = sh
            }

            // Normalize rotation
            const normalizedRotation = ((rotation % 360) + 360) % 360

            // Calculate auto-fit scale for rotated content
            let autoFitScale = 1.0
            if (normalizedRotation === 90 || normalizedRotation === 270) {
                autoFitScale = Math.min(
                    thumbWidth / contentHeight,
                    thumbHeight / contentWidth,
                    1.0
                )
            }

            // Final scale = user scale * auto-fit * thumbnail scale factor
            const thumbnailScaleFactor = thumbWidth / img.width
            const userScale = scale / 100
            const finalScale = userScale * autoFitScale * thumbnailScaleFactor

            // Content-aware centering: detect content bounds and calculate offset
            let contentOffsetX = 0
            let contentOffsetY = 0

            if (crop && crop.width && crop.height) {
                // Detect actual content within the crop region
                const contentBounds = detectContentBounds(img, sx, sy, sw, sh)

                if (contentBounds) {
                    // Calculate geometric center of crop box
                    const cropCenterX = contentWidth / 2
                    const cropCenterY = contentHeight / 2

                    // Calculate visual center of actual content
                    const visualCenterX = contentBounds.offsetX + contentBounds.width / 2
                    const visualCenterY = contentBounds.offsetY + contentBounds.height / 2

                    // Offset to shift from geometric center to content center
                    contentOffsetX = cropCenterX - visualCenterX
                    contentOffsetY = cropCenterY - visualCenterY
                }
            }

            // Draw with transforms
            ctx.save()
            ctx.translate(thumbWidth / 2, thumbHeight / 2)
            ctx.rotate((normalizedRotation * Math.PI) / 180)
            ctx.scale(finalScale, finalScale)

            // Apply content-aware offset to destination
            const destX = -contentWidth / 2 + contentOffsetX
            const destY = -contentHeight / 2 + contentOffsetY

            ctx.drawImage(
                img,
                sx, sy, sw, sh,
                destX, destY, contentWidth, contentHeight
            )
            ctx.restore()
        }

        // Check if we already have the image loaded
        if (imageRef.current && imageRef.current.src === baseImage && imageRef.current.complete) {
            renderWithImage(imageRef.current)
        } else {
            // Load new image
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                imageRef.current = img
                renderWithImage(img)
            }
            img.onerror = () => {
                // Fill with placeholder on error
                ctx.fillStyle = '#f3f4f6'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.fillStyle = '#9ca3af'
                ctx.font = '12px sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText('Error', canvas.width / 2, canvas.height / 2)
            }
            img.src = baseImage
        }
    }, [baseImage, rotation, scale, crop, size])

    return (
        <canvas
            ref={canvasRef}
            className={className}
            onClick={onClick}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                cursor: onClick ? 'pointer' : 'default'
            }}
        />
    )
})

TransformThumbnail.displayName = 'TransformThumbnail'

export default TransformThumbnail
