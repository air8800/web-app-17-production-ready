/**
 * GridService
 * 
 * Handles N-up grid layouts (1, 2, or 4 pages per sheet).
 * Generates combined preview canvases for multi-page sheets.
 */

import { PagesPerSheet, GridSheet, PageDimensions } from '../types'
import { PagePreviewService } from './pagePreviewService'
import { PageState } from './pageState'
import {
  compositeNupSheet
} from './nupCompositor'

export interface GridLayout {
  rows: number
  cols: number
  gap: number  // pixels between pages
}

const LAYOUTS: Record<PagesPerSheet, GridLayout> = {
  1: { rows: 1, cols: 1, gap: 0 },
  2: { rows: 1, cols: 2, gap: 10 },
  4: { rows: 2, cols: 2, gap: 10 }
}

export class GridService {
  private previewService: PagePreviewService
  private pageState: PageState
  private pagesPerSheet: PagesPerSheet = 1
  private sheetCache: Map<number, GridSheet> = new Map()

  constructor(previewService: PagePreviewService, pageState: PageState) {
    this.previewService = previewService
    this.pageState = pageState
  }

  /**
   * Set pages per sheet
   */
  setPagesPerSheet(pps: PagesPerSheet): void {
    if (pps !== this.pagesPerSheet) {
      this.pagesPerSheet = pps
      this.sheetCache.clear()
    }
  }

  /**
   * Get current pages per sheet
   */
  getPagesPerSheet(): PagesPerSheet {
    return this.pagesPerSheet
  }

  /**
   * Get total number of sheets
   */
  getSheetCount(): number {
    const includedCount = this.pageState.getIncludedCount()
    return Math.ceil(includedCount / this.pagesPerSheet)
  }

  /**
   * Get page numbers for a sheet
   */
  getSheetPages(sheetNumber: number): number[] {
    const included = this.pageState.getIncluded()
    const startIndex = (sheetNumber - 1) * this.pagesPerSheet
    const endIndex = startIndex + this.pagesPerSheet

    return included
      .slice(startIndex, endIndex)
      .map(p => p.pageNumber)
  }

  /**
   * Get all sheets
   */
  getAllSheets(): GridSheet[] {
    const sheetCount = this.getSheetCount()
    const sheets: GridSheet[] = []

    for (let i = 1; i <= sheetCount; i++) {
      const cached = this.sheetCache.get(i)
      if (cached) {
        sheets.push(cached)
      } else {
        sheets.push({
          sheetNumber: i,
          pages: this.getSheetPages(i),
          canvas: null,
          thumbnail: null
        })
      }
    }

    return sheets
  }

  /**
   * Render a sheet preview
   */
  async renderSheet(
    sheetNumber: number,
    sheetWidth: number,
    sheetHeight: number
  ): Promise<HTMLCanvasElement> {
    const pages = this.getSheetPages(sheetNumber)
    const isNupMode = this.pagesPerSheet > 1  // N-up mode when more than 1 page per sheet

    if (isNupMode) {
      console.log('%c════════════════════════════════════════', 'color: red; font-weight: bold')
      console.log('%c🔲 [GRID SERVICE] Rendering N-UP Sheet ' + sheetNumber + ' (pagesPerSheet=' + this.pagesPerSheet + ')', 'color: red; font-weight: bold; background: #ffeeee; padding: 2px 6px;')
      console.log('%c════════════════════════════════════════', 'color: red; font-weight: bold')
    }

    // For 2-up mode, use NupCompositor for proper A4 landscape layout
    if (this.pagesPerSheet === 2) {
      // Calculate target page dimensions based on sheet size
      // A 2-up sheet is 2 pages side-by-side
      const targetPageWidth = (sheetWidth - 20) / 2  // roughly half width minus margins/gap
      const targetPageHeight = sheetHeight - 16       // full height minus margins

      // Get page canvases (render at appropriate size for the target sheet)
      // Pass isNupMode: true to disable A4 normalization for N-up pages
      const page1Canvas = pages[0]
        ? await this.previewService.getPreview(pages[0], targetPageWidth, targetPageHeight, undefined, isNupMode)
        : null
      const page2Canvas = pages[1]
        ? await this.previewService.getPreview(pages[1], targetPageWidth, targetPageHeight, undefined, isNupMode)
        : null

      if (!page1Canvas) {
        // No pages to render
        const empty = document.createElement('canvas')
        empty.width = sheetWidth
        empty.height = sheetHeight
        const ctx = empty.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, sheetWidth, sheetHeight)
        }
        return empty
      }

      // Use NupCompositor for proper landscape layout
      const compositeCanvas = compositeNupSheet(page1Canvas, page2Canvas, {
        sheetWidth,
        sheetHeight,
        gap: 10,
        margin: 8
      })

      // Cache the sheet
      this.sheetCache.set(sheetNumber, {
        sheetNumber,
        pages,
        canvas: compositeCanvas,
        thumbnail: null
      })

      return compositeCanvas
    }

    // Default behavior for 1-up and 4-up modes
    const layout = LAYOUTS[this.pagesPerSheet]

    const result = document.createElement('canvas')
    result.width = sheetWidth
    result.height = sheetHeight

    const ctx = result.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')

    // Fill background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, sheetWidth, sheetHeight)

    if (pages.length === 0) {
      return result
    }

    // Calculate cell dimensions
    const cellWidth = (sheetWidth - (layout.cols - 1) * layout.gap) / layout.cols
    const cellHeight = (sheetHeight - (layout.rows - 1) * layout.gap) / layout.rows

    // Render each page into its cell
    for (let i = 0; i < pages.length; i++) {
      const pageNum = pages[i]
      const row = Math.floor(i / layout.cols)
      const col = i % layout.cols

      const x = col * (cellWidth + layout.gap)
      const y = row * (cellHeight + layout.gap)

      const pageCanvas = await this.previewService.getPreview(pageNum, cellWidth, cellHeight, undefined, isNupMode)

      // Center page in cell
      const offsetX = (cellWidth - pageCanvas.width) / 2
      const offsetY = (cellHeight - pageCanvas.height) / 2

      ctx.drawImage(pageCanvas, x + offsetX, y + offsetY)
    }

    // Cache the sheet
    this.sheetCache.set(sheetNumber, {
      sheetNumber,
      pages,
      canvas: result,
      thumbnail: null
    })

    return result
  }

  /**
   * Get sheet thumbnail
   */
  async getSheetThumbnail(
    sheetNumber: number,
    maxWidth: number = 150,
    maxHeight: number = 200
  ): Promise<string> {
    const cached = this.sheetCache.get(sheetNumber)
    if (cached?.thumbnail) {
      return cached.thumbnail
    }

    // Render at small size
    const canvas = await this.renderSheet(sheetNumber, maxWidth, maxHeight)
    const thumbnail = canvas.toDataURL('image/jpeg', 0.7)

    // Update cache
    const sheet = this.sheetCache.get(sheetNumber)
    if (sheet) {
      sheet.thumbnail = thumbnail
    }

    return thumbnail
  }

  /**
   * Calculate effective paper dimensions
   */
  getEffectiveDimensions(
    paperWidth: number,
    paperHeight: number
  ): PageDimensions {
    // For N-up, the effective page size changes
    const layout = LAYOUTS[this.pagesPerSheet]
    return {
      width: (paperWidth - (layout.cols - 1) * layout.gap) / layout.cols,
      height: (paperHeight - (layout.rows - 1) * layout.gap) / layout.rows
    }
  }

  /**
   * Invalidate sheet cache
   */
  invalidateSheet(sheetNumber: number): void {
    this.sheetCache.delete(sheetNumber)
  }

  /**
   * Invalidate all sheets containing a page
   */
  invalidateSheetsForPage(pageNumber: number): void {
    const included = this.pageState.getIncluded()
    const pageIndex = included.findIndex(p => p.pageNumber === pageNumber)

    if (pageIndex === -1) return

    const sheetNumber = Math.floor(pageIndex / this.pagesPerSheet) + 1
    this.sheetCache.delete(sheetNumber)
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.sheetCache.clear()
  }

  /**
   * Get layout for current pages per sheet
   */
  getLayout(): GridLayout {
    return { ...LAYOUTS[this.pagesPerSheet] }
  }
}
