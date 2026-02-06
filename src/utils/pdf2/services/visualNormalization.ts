/**
 * Visual Normalization
 * 
 * Calculates transforms to visually display pages as if they were A4.
 * Uses the same logic as normalizeToA4.ts but applied to canvas rendering
 * instead of PDF modification.
 * 
 * This allows the web app to show "normalized" previews without
 * loading the entire PDF into memory for actual normalization.
 */

// A4 dimensions in PDF points (72 DPI)
export const A4_WIDTH_PORTRAIT = 595.28
export const A4_HEIGHT_PORTRAIT = 841.89
export const A4_WIDTH_LANDSCAPE = 841.89
export const A4_HEIGHT_LANDSCAPE = 595.28

// Margin multiplier (same as normalizeToA4.ts uses 0.95)
const MARGIN_SCALE = 0.95

// Tolerance for A4 detection
const A4_TOLERANCE = 20

export interface A4Transform {
    /** Scale factor to apply to the page */
    scale: number
    /** X offset for centering on A4 canvas */
    offsetX: number
    /** Y offset for centering on A4 canvas */
    offsetY: number
    /** Target canvas width (A4) */
    targetWidth: number
    /** Target canvas height (A4) */
    targetHeight: number
    /** Detected optimal orientation */
    orientation: 'portrait' | 'landscape'
    /** Whether the page was already A4 */
    wasAlreadyA4: boolean
}

/**
 * Check if dimensions match A4 (within tolerance)
 */
export function isA4Size(width: number, height: number, tolerance: number = A4_TOLERANCE): boolean {
    const isPortrait =
        Math.abs(width - A4_WIDTH_PORTRAIT) <= tolerance &&
        Math.abs(height - A4_HEIGHT_PORTRAIT) <= tolerance

    const isLandscape =
        Math.abs(width - A4_WIDTH_LANDSCAPE) <= tolerance &&
        Math.abs(height - A4_HEIGHT_LANDSCAPE) <= tolerance

    return isPortrait || isLandscape
}

/**
 * Detect optimal orientation based on page aspect ratio
 */
export function detectOptimalOrientation(width: number, height: number): 'portrait' | 'landscape' {
    return width > height ? 'landscape' : 'portrait'
}

/**
 * Get A4 dimensions for an orientation
 */
export function getA4Dimensions(orientation: 'portrait' | 'landscape'): { width: number; height: number } {
    return orientation === 'portrait'
        ? { width: A4_WIDTH_PORTRAIT, height: A4_HEIGHT_PORTRAIT }
        : { width: A4_WIDTH_LANDSCAPE, height: A4_HEIGHT_LANDSCAPE }
}

/**
 * Calculate visual transform to display a page as A4
 * 
 * @param pageWidth - Original page width in points
 * @param pageHeight - Original page height in points
 * @param rotation - Page rotation (0, 90, 180, 270)
 * @returns Transform parameters for visual normalization
 */
export function calculateA4Transform(
    pageWidth: number,
    pageHeight: number,
    rotation: number = 0
): A4Transform {
    // Account for rotation
    const isRotated90or270 = rotation === 90 || rotation === 270
    const visualWidth = isRotated90or270 ? pageHeight : pageWidth
    const visualHeight = isRotated90or270 ? pageWidth : pageHeight

    // Check if already A4
    const wasAlreadyA4 = isA4Size(visualWidth, visualHeight)

    // Detect orientation based on visual dimensions
    const orientation = detectOptimalOrientation(visualWidth, visualHeight)

    // Get A4 target dimensions
    const a4 = getA4Dimensions(orientation)
    const targetWidth = a4.width
    const targetHeight = a4.height

    // If already A4, minimal transform needed
    if (wasAlreadyA4) {
        return {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            targetWidth,
            targetHeight,
            orientation,
            wasAlreadyA4: true
        }
    }

    // Calculate scale to fit page into A4 (same logic as normalizeToA4.ts)
    const scaleX = targetWidth / visualWidth
    const scaleY = targetHeight / visualHeight
    const baseScale = Math.min(scaleX, scaleY)

    // Apply margin (0.95 = 5% margin on each side effectively)
    const scale = baseScale * MARGIN_SCALE

    // Calculate scaled dimensions
    const scaledWidth = visualWidth * scale
    const scaledHeight = visualHeight * scale

    // Center on A4 canvas
    const offsetX = (targetWidth - scaledWidth) / 2
    const offsetY = (targetHeight - scaledHeight) / 2

    return {
        scale,
        offsetX,
        offsetY,
        targetWidth,
        targetHeight,
        orientation,
        wasAlreadyA4: false
    }
}

/**
 * Apply A4 transform to a canvas rendering scale
 * 
 * This is used by the documentLoader when rendering pages.
 * Instead of rendering at native size, we render at a size that
 * will fit nicely into an A4 canvas.
 * 
 * @param baseScale - The original scale factor (e.g., for DPI)
 * @param pageWidth - Original page width
 * @param pageHeight - Original page height
 * @param rotation - Page rotation
 * @returns Adjusted scale and canvas dimensions
 */
export function getA4RenderParams(
    baseScale: number,
    pageWidth: number,
    pageHeight: number,
    rotation: number = 0
): {
    scale: number
    canvasWidth: number
    canvasHeight: number
    offsetX: number
    offsetY: number
    transform: A4Transform
} {
    const transform = calculateA4Transform(pageWidth, pageHeight, rotation)

    // The canvas should be A4 size at the given base scale (for DPI)
    const canvasWidth = transform.targetWidth * baseScale
    const canvasHeight = transform.targetHeight * baseScale

    // The page should be rendered at this combined scale
    const renderScale = transform.scale * baseScale

    // Offsets also need to be scaled
    const offsetX = transform.offsetX * baseScale
    const offsetY = transform.offsetY * baseScale

    return {
        scale: renderScale,
        canvasWidth,
        canvasHeight,
        offsetX,
        offsetY,
        transform
    }
}
