/**
 * Shared Page Transform Utility
 * 
 * One unified function for applying transforms (rotation, scale, crop) to page canvases.
 * Used by:
 * - Individual page editor (PDFEditorPopup)
 * - N-up sheet editor (PDFEditorSheetPopup)  
 * - Thumbnail generation (thumbnailService)
 */

export interface PageTransformOptions {
    rotation?: number;  // degrees (0, 90, 180, 270)
    scale?: number;     // percentage (100 = 100%)
    crop?: {
        x: number;        // 0-1 normalized
        y: number;
        width: number;
        height: number;
    } | null;
    center?: boolean;   // If true (default), content is centered. If false, maintains relative position.
}

export interface CanvasDimensions {
    width: number;
    height: number;
}

/**
 * Detects the bounding box of non-white content in a canvas region.
 * Used for content-aware centering.
 * Exported so TransformThumbnail can also use it.
 */
export function detectContentBounds(
    source: HTMLCanvasElement | HTMLImageElement,
    sx: number, sy: number, sw: number, sh: number,
    threshold: number = 250 // Pixels with R,G,B all > threshold are considered "white"
): { offsetX: number; offsetY: number; width: number; height: number } | null {
    // Create a temporary canvas to analyze the cropped region
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.floor(sw);
    tempCanvas.height = Math.floor(sh);
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
        console.log('❌ detectContentBounds: Failed to get canvas context');
        return null;
    }

    console.log(`🔍 detectContentBounds: Starting scan...
        Source: ${source.width || (source as HTMLImageElement).naturalWidth} x ${source.height || (source as HTMLImageElement).naturalHeight}
        Crop region: sx=${sx.toFixed(0)}, sy=${sy.toFixed(0)}, sw=${sw.toFixed(0)}, sh=${sh.toFixed(0)}
        Temp canvas: ${tempCanvas.width} x ${tempCanvas.height}`);

    // Draw the cropped region
    try {
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height);
    } catch (e) {
        console.log('❌ detectContentBounds: drawImage failed', e);
        return null;
    }

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    // Sample some pixels for debugging
    const samplePixels = [];
    const samplePositions = [
        { x: 0, y: 0 },
        { x: Math.floor(tempCanvas.width / 2), y: 0 },
        { x: Math.floor(tempCanvas.width / 2), y: Math.floor(tempCanvas.height / 2) },
        { x: Math.floor(tempCanvas.width / 2), y: tempCanvas.height - 1 },
    ];
    for (const pos of samplePositions) {
        const idx = (pos.y * tempCanvas.width + pos.x) * 4;
        samplePixels.push(`(${pos.x},${pos.y}): RGB(${data[idx]},${data[idx + 1]},${data[idx + 2]})`);
    }
    console.log(`🔍 Sample pixels: ${samplePixels.join(' | ')}`);

    let minX = tempCanvas.width, minY = tempCanvas.height, maxX = 0, maxY = 0;
    let hasContent = false;
    let whiteCount = 0, contentCount = 0;

    // Scan for non-white pixels
    for (let y = 0; y < tempCanvas.height; y++) {
        for (let x = 0; x < tempCanvas.width; x++) {
            const idx = (y * tempCanvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            // Check if pixel is NOT white (below threshold)
            if (r < threshold || g < threshold || b < threshold) {
                hasContent = true;
                contentCount++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            } else {
                whiteCount++;
            }
        }
    }

    console.log(`🔍 Scan result: ${contentCount} content pixels, ${whiteCount} white pixels, hasContent=${hasContent}`);

    if (!hasContent) {
        console.log('❌ detectContentBounds: No content found (all white)');
        return null;
    }

    const result = {
        offsetX: minX,
        offsetY: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };

    console.log(`✅ detectContentBounds: Content box detected at (${result.offsetX}, ${result.offsetY}) size ${result.width}x${result.height}`);

    return result;
}

/**
 * Apply transforms to a canvas and return a new canvas with transforms applied.
 * 
 * @param sourceCanvas - The source canvas (raw page render)
 * @param transforms - Rotation, scale, and crop to apply
 * @param targetDimensions - Target canvas size. If not provided, uses source dimensions.
 *                           For N-up, pass slot dimensions for proper fitting.
 * @param returnDataUrl - If true, returns dataURL string. If false, returns canvas.
 */
export function applyPageTransforms(
    sourceCanvas: HTMLCanvasElement | HTMLImageElement,
    transforms: PageTransformOptions,
    targetDimensions?: CanvasDimensions,
    returnDataUrl: boolean = false
): HTMLCanvasElement | string | null {
    if (!sourceCanvas) return null;

    const { rotation = 0, scale = 100, crop = null } = transforms;

    // Get source dimensions
    const sourceWidth = sourceCanvas.width || (sourceCanvas as HTMLImageElement).naturalWidth;
    const sourceHeight = sourceCanvas.height || (sourceCanvas as HTMLImageElement).naturalHeight;

    // 🔍 DEBUG: Log incoming crop and source dimensions (DISABLED per user request)
    // if (crop) {
    //     console.log(`\n📥 [pageTransforms] applyPageTransforms() - INCOMING CROP
    //     ... (verbose logging disabled)
    // }

    // Calculate target dimensions
    let resultWidth = targetDimensions?.width || sourceWidth;
    let resultHeight = targetDimensions?.height || sourceHeight;

    // If target dimensions provided (e.g., N-up slot), use them directly
    if (targetDimensions) {
        resultWidth = targetDimensions.width;
        resultHeight = targetDimensions.height;
    }

    // Create result canvas
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = resultWidth;
    resultCanvas.height = resultHeight;

    const ctx = resultCanvas.getContext('2d');
    if (!ctx) return null;

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, resultWidth, resultHeight);

    // Calculate source region (crop)
    let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
    if (crop && crop.width && crop.height) {
        sx = crop.x * sourceWidth;
        sy = crop.y * sourceHeight;
        sw = crop.width * sourceWidth;
        sh = crop.height * sourceHeight;

        // 🔍 DEBUG: Log pixel-level crop extraction (DISABLED per user request)
        // console.log(`    
        //     📍 CROP → PIXEL CONVERSION: ...
        // `);
    }

    // Calculate content dimensions after crop
    const contentWidth = sw;
    const contentHeight = sh;

    // Normalize rotation
    const normalizedRotation = ((rotation % 360) + 360) % 360;

    // Calculate dimensions after rotation
    const isRotated90or270 = normalizedRotation === 90 || normalizedRotation === 270;
    // const rotatedWidth = isRotated90or270 ? contentHeight : contentWidth; // Unused
    // const rotatedHeight = isRotated90or270 ? contentWidth : contentHeight; // Unused

    // Calculate base scale
    // USE ORIGINAL DIMENSIONS to prevent auto-zoom on crop (User requested no scale up)
    // The cropped content will be centered but remain at its original relative scale
    const originalRotatedWidth = isRotated90or270 ? sourceHeight : sourceWidth;
    const originalRotatedHeight = isRotated90or270 ? sourceWidth : sourceHeight;

    const baseScale = Math.min(
        resultWidth / originalRotatedWidth,
        resultHeight / originalRotatedHeight
    );

    // Log for debugging centering issues (DISABLED per user request)
    // if (crop && crop.width && crop.height) {
    //     console.log(`✂️ CROP CENTERING: ...`);
    // }

    // Final scale = user scale * base scale
    const userScale = scale / 100;
    const finalScale = userScale * baseScale;

    // Draw content with transforms
    ctx.save();

    // Calculate translation
    let translateX = 0;
    let translateY = 0;

    const { center = true } = transforms;

    // Content-aware centering: Detect actual content bounds within the crop
    let contentOffsetX = 0;
    let contentOffsetY = 0;

    if (center && crop && crop.width && crop.height) {
        // Detect where the actual (non-white) content is within the crop region
        const contentBounds = detectContentBounds(sourceCanvas, sx, sy, sw, sh);

        if (contentBounds) {
            // Calculate the geometric center of the crop box
            const cropCenterX = contentWidth / 2;
            const cropCenterY = contentHeight / 2;

            // Calculate the visual center of the actual content
            const visualCenterX = contentBounds.offsetX + contentBounds.width / 2;
            const visualCenterY = contentBounds.offsetY + contentBounds.height / 2;

            // The offset needed to move from geometric center to visual content center
            contentOffsetX = cropCenterX - visualCenterX;
            contentOffsetY = cropCenterY - visualCenterY;

            // Content-aware centering log (DISABLED per user request)
            // console.log(`🎯 CONTENT-AWARE CENTERING: ...`);
        }
    }

    if (center) {
        // CENTERED: Move to center of result canvas
        translateX = resultWidth / 2;
        translateY = resultHeight / 2;
    } else {
        // NOT CENTERED (Top-Left): Pivot align
        const pivotX = isRotated90or270 ? contentHeight / 2 : contentWidth / 2;
        const pivotY = isRotated90or270 ? contentWidth / 2 : contentHeight / 2;
        translateX = pivotX * finalScale;
        translateY = pivotY * finalScale;
    }

    ctx.translate(translateX, translateY);

    // Apply rotation
    ctx.rotate((normalizedRotation * Math.PI) / 180);

    // Apply scale
    ctx.scale(finalScale, finalScale);

    // Destination coords (relative to transformed origin)
    // Apply content-aware offset to shift visual content to center
    const destX = -contentWidth / 2 + contentOffsetX;
    const destY = -contentHeight / 2 + contentOffsetY;
    const destW = contentWidth;
    const destH = contentHeight;

    // Detailed Logging for User Debugging (DISABLED per user request)
    // if (crop) {
    //     console.log(`📐 CROP PLACEMENT DETECTIVE: ...`);
    // }

    // Draw content
    ctx.drawImage(
        sourceCanvas,
        sx, sy, sw, sh,  // Source region (crop)
        destX, destY, destW, destH  // Destination
    );

    ctx.restore();

    if (returnDataUrl) {
        return resultCanvas.toDataURL('image/jpeg', 0.85);
    }

    return resultCanvas;
}

/**
 * Simplified version that returns dataURL (for preview rendering)
 */
export function applyPageTransformsToDataUrl(
    sourceCanvas: HTMLCanvasElement | HTMLImageElement,
    transforms: PageTransformOptions,
    targetDimensions?: CanvasDimensions
): string | null {
    const result = applyPageTransforms(sourceCanvas, transforms, targetDimensions, true);
    return result as string | null;
}

/**
 * Simplified version that returns canvas (for further processing)
 */
export function applyPageTransformsToCanvas(
    sourceCanvas: HTMLCanvasElement | HTMLImageElement,
    transforms: PageTransformOptions,
    targetDimensions?: CanvasDimensions
): HTMLCanvasElement | null {
    const result = applyPageTransforms(sourceCanvas, transforms, targetDimensions, false);
    return result as HTMLCanvasElement | null;
}
