/**
 * NupCompositor
 * 
 * Creates N-up composite sheets for 2 pages per sheet layout.
 * Output is A4 Landscape with 2 portrait pages side-by-side.
 */

// A4 dimensions in points (72 dpi)
export const A4_PORTRAIT = { width: 595.3, height: 841.9 }
export const A4_LANDSCAPE = { width: 841.9, height: 595.3 }

export interface NupSheetConfig {
    sheetWidth: number   // Output sheet width (default: A4 landscape width)
    sheetHeight: number  // Output sheet height (default: A4 landscape height)
    gap: number          // Gap between pages in pixels
    margin: number       // Outer margin in pixels
    backgroundColor: string
}

const DEFAULT_CONFIG: NupSheetConfig = {
    sheetWidth: A4_LANDSCAPE.width,
    sheetHeight: A4_LANDSCAPE.height,
    gap: 10,
    margin: 10,
    backgroundColor: '#ffffff'
}

/**
 * Composite 2 pages into a single landscape sheet
 * 
 * @param page1Canvas - First page canvas (required)
 * @param page2Canvas - Second page canvas (null for odd last page)
 * @param config - Optional configuration override
 * @returns Composite canvas with both pages side-by-side
 */
export function compositeNupSheet(
    page1Canvas: HTMLCanvasElement,
    page2Canvas: HTMLCanvasElement | null,
    config: Partial<NupSheetConfig> = {}
): HTMLCanvasElement {
    const cfg = { ...DEFAULT_CONFIG, ...config }

    // Create output canvas (landscape orientation)
    const canvas = document.createElement('canvas')
    canvas.width = cfg.sheetWidth
    canvas.height = cfg.sheetHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
        throw new Error('Failed to get canvas 2D context')
    }

    // Fill background
    ctx.fillStyle = cfg.backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Calculate available space for each page cell
    const availableWidth = (cfg.sheetWidth - cfg.margin * 2 - cfg.gap) / 2
    const availableHeight = cfg.sheetHeight - cfg.margin * 2

    // Draw page 1 (left side)
    const pos1 = calculatePagePosition(
        page1Canvas.width,
        page1Canvas.height,
        cfg.margin,
        cfg.margin,
        availableWidth,
        availableHeight
    )
    ctx.drawImage(page1Canvas, pos1.x, pos1.y, pos1.width, pos1.height)

    // Draw dashed border around page 1 area
    drawPageBorder(ctx, cfg.margin, cfg.margin, availableWidth, availableHeight)

    // Draw page 2 (right side) if exists
    const rightCellX = cfg.margin + availableWidth + cfg.gap

    if (page2Canvas) {
        const pos2 = calculatePagePosition(
            page2Canvas.width,
            page2Canvas.height,
            rightCellX,
            cfg.margin,
            availableWidth,
            availableHeight
        )
        ctx.drawImage(page2Canvas, pos2.x, pos2.y, pos2.width, pos2.height)
        drawPageBorder(ctx, rightCellX, cfg.margin, availableWidth, availableHeight)
    } else {
        // Empty second cell for odd page count - draw empty border
        drawPageBorder(ctx, rightCellX, cfg.margin, availableWidth, availableHeight, true)
    }

    return canvas
}

/**
 * Calculate position and size for a page within its cell (centered, scaled to fit)
 */
function calculatePagePosition(
    pageWidth: number,
    pageHeight: number,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number
): { x: number; y: number; width: number; height: number } {
    // Scale to fit within cell maintaining aspect ratio
    const scaleX = cellWidth / pageWidth
    const scaleY = cellHeight / pageHeight
    const scale = Math.min(scaleX, scaleY, 1) // Don't scale up

    const scaledWidth = pageWidth * scale
    const scaledHeight = pageHeight * scale

    // Center within cell
    const x = cellX + (cellWidth - scaledWidth) / 2
    const y = cellY + (cellHeight - scaledHeight) / 2

    return { x, y, width: scaledWidth, height: scaledHeight }
}

/**
 * Draw dashed border around page area
 */
function drawPageBorder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    isEmpty: boolean = false
): void {
    ctx.save()
    ctx.strokeStyle = isEmpty ? '#d1d5db' : '#3B82F6'  // Gray for empty, blue for content
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(x, y, width, height)
    ctx.restore()
}

/**
 * Create N-up sheet from page data URLs
 * Convenience method for when you have data URLs instead of canvases
 */
export async function compositeNupSheetFromDataUrls(
    page1DataUrl: string,
    page2DataUrl: string | null,
    config: Partial<NupSheetConfig> = {}
): Promise<HTMLCanvasElement> {
    const page1Canvas = await dataUrlToCanvas(page1DataUrl)
    const page2Canvas = page2DataUrl ? await dataUrlToCanvas(page2DataUrl) : null

    return compositeNupSheet(page1Canvas, page2Canvas, config)
}

/**
 * Convert data URL to canvas
 */
function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Failed to get canvas context'))
                return
            }
            ctx.drawImage(img, 0, 0)
            resolve(canvas)
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = dataUrl
    })
}

/**
 * Get thumbnail dimensions for N-up sheet
 * Maintains landscape aspect ratio at thumbnail size
 */
export function getNupThumbnailDimensions(maxSize: number): { width: number; height: number } {
    const aspectRatio = A4_LANDSCAPE.width / A4_LANDSCAPE.height
    return {
        width: maxSize,
        height: maxSize / aspectRatio
    }
}
