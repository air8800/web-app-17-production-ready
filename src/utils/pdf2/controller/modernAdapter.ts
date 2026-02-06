/**
 * ModernAdapter
 * 
 * Implements PdfController using the new pdf2 services.
 * This is the modern, modular implementation.
 */

import {
  PdfController,
  EditCommand,
  Recipe,
  PageMetadata,
  ProgressCallback,
  RecipeOptions,
  PageDimensions
} from '../types'
import { MetadataStore } from '../state/metadataStore'
import { EditOrchestrator } from '../edits/editOrchestrator'
import { ProgressBus } from '../services/progressBus'
import { PageState } from '../services/pageState'
import { SelectionState } from '../services/selectionState'
import { DocumentLoader, LoadResult } from '../services/documentLoader'
import { PagePreviewService } from '../services/pagePreviewService'
import { ThumbnailService } from '../services/thumbnailService'
import { RecipeService } from '../services/recipeService'
import { GridService } from '../services/gridService'
import { UIStateManager } from '../ui/uiState'
import { CanvasInteraction } from '../ui/canvasInteraction'
import { logDetailedMemory } from '../../memoryProfiler'

export interface ModernAdapterOptions {
  containerWidth?: number
  containerHeight?: number
  thumbnailSize?: number
}

const DEFAULT_OPTIONS: ModernAdapterOptions = {
  containerWidth: 800,
  containerHeight: 600,
  thumbnailSize: 150
}

export class ModernAdapter implements PdfController {
  // Core services
  private metadataStore: MetadataStore
  private progressBus: ProgressBus
  private pageState: PageState
  private selectionState: SelectionState
  private documentLoader: DocumentLoader
  private pagePreviewService: PagePreviewService
  private thumbnailService: ThumbnailService
  private recipeService: RecipeService
  private gridService: GridService
  private editOrchestrator: EditOrchestrator
  private uiState: UIStateManager
  private canvasInteraction: CanvasInteraction

  // State
  private currentFile: File | null = null
  private options: ModernAdapterOptions
  private isInitialized: boolean = false
  private previewCache: Map<number, HTMLCanvasElement> = new Map()
  private pendingRenders: Map<number, Promise<HTMLCanvasElement>> = new Map()
  private pageVersions: Map<number, number> = new Map()  // Version tracking for cache invalidation

  constructor(options: ModernAdapterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }

    // Initialize services in dependency order
    this.metadataStore = new MetadataStore()
    this.progressBus = new ProgressBus()
    this.pageState = new PageState()
    this.selectionState = new SelectionState()
    this.documentLoader = new DocumentLoader(this.progressBus, this.metadataStore)
    this.pagePreviewService = new PagePreviewService(
      this.documentLoader,
      this.metadataStore,
      this.progressBus
    )
    this.thumbnailService = new ThumbnailService(
      this.pagePreviewService,
      this.metadataStore
    )
    this.recipeService = new RecipeService(this.metadataStore, this.pageState)
    this.gridService = new GridService(this.pagePreviewService, this.pageState)
    this.editOrchestrator = new EditOrchestrator(this.metadataStore)
    this.uiState = new UIStateManager()
    this.canvasInteraction = new CanvasInteraction()
  }

  /**
   * Load PDF document
   */
  async loadDocument(file: File): Promise<void> {
    if (this.currentFile === file && this.isInitialized) {
      console.log(`📥 [ModernAdapter] Document already loaded for ${file.name}, skipping load`)
      return
    }

    // ⏱️ PERFORMANCE: Start measuring total load time
    const totalLoadStart = performance.now()
    console.log(`📥 [ModernAdapter] loadDocument START - file: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
    console.log(`⏱️ [TOTAL LOAD START] Measuring end-to-end load time...`)

    // Memory checkpoint: Before loading
    logDetailedMemory('Before pdf.js load', { pdfArrayBuffer: file.size })

    this.currentFile = file
    this.uiState.startLoading('parsing')

    // ⚡ FAST PAGE COUNT: Extract page count from PDF trailer BEFORE full parsing
    // This allows showing the grid instantly while PDF.js parses in background
    let fastPageCount: number | null = null
    try {
      const { extractPageCountFast } = await import('../services/fastPageCount')
      const pdfStore = (await import('../../../stores/pdfStore')).default
      fastPageCount = await extractPageCountFast(file)

      if (fastPageCount) {
        console.log(`⚡ [FAST GRID] Showing grid with ${fastPageCount} pages IMMEDIATELY!`)

        // Update store so PDFPageSelector can read it immediately (solves timing issue)
        pdfStore.getState().setFastPageCount(fastPageCount)

        // Emit early grid event so UI can display placeholders instantly
        this.progressBus.emit({
          type: 'fastPageCount',
          totalPages: fastPageCount,
          data: { file: file }
        })
      }
    } catch (e) {
      console.error(`⚡ [FAST PAGE COUNT ERROR] Detail:`, e) // Explicit error logging
      console.log(`⚡ [FAST PAGE COUNT] Could not extract fast page count, falling back to full parse`)
    }

    try {
      // ⏱️ PERFORMANCE: Measure PDF parsing time specifically
      const pdfParseStart = performance.now()
      console.log(`⏱️ [PDF PARSE START] Starting PDF.js document loading...`)

      const result: LoadResult = await this.documentLoader.loadFile(file)

      const pdfParseEnd = performance.now()
      const pdfParseTime = ((pdfParseEnd - pdfParseStart) / 1000).toFixed(2)
      console.log(`⏱️ [PDF PARSE COMPLETE] PDF.js loading took ${pdfParseTime}s`)
      console.log(`📥 [ModernAdapter] Document loaded - ${result.totalPages} pages, docId: ${result.documentId}`)

      // Check if fast page count was accurate
      if (fastPageCount && fastPageCount !== result.totalPages) {
        console.log(`⚡ [FAST PAGE COUNT] Correction: was ${fastPageCount}, actual is ${result.totalPages}`)
        // Emit correction event for UI to update
        this.progressBus.emit({
          type: 'pageCountCorrected',
          totalPages: result.totalPages,
          data: { oldCount: fastPageCount, newCount: result.totalPages }
        })
      }

      // Memory checkpoint: After pdf.js parse
      logDetailedMemory('After pdf.js parse', {
        pdfArrayBuffer: file.size,
        pageProxies: result.totalPages
      })

      // Initialize page state
      this.pageState.init(result.pages, result.documentId)

      // Set source for recipe
      this.recipeService.setSource(file, result.totalPages)

      // Pre-render first page preview immediately
      this.isInitialized = true
      console.log(`📥 [ModernAdapter] Generating first page preview...`)
      await this.ensurePreview(1)
      console.log(`📥 [ModernAdapter] First page preview complete`)

      // Memory checkpoint: After first preview
      logDetailedMemory('After first preview render', {
        pdfArrayBuffer: file.size,
        pageProxies: result.totalPages
      })

      // ⏱️ PERFORMANCE: Grid should be ready now
      const gridReadyTime = performance.now()
      const gridDelay = ((gridReadyTime - totalLoadStart) / 1000).toFixed(2)
      console.log(`⏱️ [GRID READY] Grid should appear now (${gridDelay}s after loadDocument started)`)

      // Generate remaining previews and thumbnails in background
      // CRITICAL: Disable background processing for LARGE PDFs (>= 10MB) 
      // We will rely on UI-driven on-demand loading to save CPU/Memory
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB < 10) {
        console.log(`📥 [ModernAdapter] Small PDF detected (${fileSizeMB.toFixed(1)}MB), starting background generation`)
        this.generatePreviewsAsync(result.totalPages)
        this.generateThumbnailsAsync()
      } else {
        console.log(`📥 [ModernAdapter] Large PDF detected (${fileSizeMB.toFixed(1)}MB), background generation SKIPPED`)
      }

      this.uiState.finishLoading()

      const totalLoadEnd = performance.now()
      const totalLoadTime = ((totalLoadEnd - totalLoadStart) / 1000).toFixed(2)
      console.log(`⏱️ [TOTAL LOAD COMPLETE] Total loadDocument time: ${totalLoadTime}s`)
      console.log(`📥 [ModernAdapter] loadDocument COMPLETE`)
    } catch (error) {
      console.error(`📥 [ModernAdapter] loadDocument FAILED:`, error)
      const message = error instanceof Error ? error.message : 'Failed to load PDF'
      this.uiState.setError(message)
      throw error
    }
  }

  /**
   * Get page preview canvas from cache
   * Returns cached preview if available, or triggers async render and returns null
   * For guaranteed canvas, use ensurePreview() or getPagePreviewAsync()
   */
  getPagePreview(pageNum: number): HTMLCanvasElement | null {
    if (!this.isInitialized) return null

    const cached = this.previewCache.get(pageNum)
    if (cached) return cached

    // Trigger render in background if not already pending
    if (!this.pendingRenders.has(pageNum)) {
      this.triggerPreviewRender(pageNum)
    }

    return null
  }

  /**
   * Get current version for a page
   */
  private getPageVersion(pageNum: number): number {
    return this.pageVersions.get(pageNum) || 0
  }

  /**
   * Increment version for a page (called on invalidation)
   */
  private incrementPageVersion(pageNum: number): void {
    this.pageVersions.set(pageNum, this.getPageVersion(pageNum) + 1)
  }

  /**
   * Trigger preview render in background
   */
  private triggerPreviewRender(pageNum: number): void {
    const versionAtStart = this.getPageVersion(pageNum)

    const renderPromise = this.pagePreviewService.getPreview(
      pageNum,
      this.options.containerWidth!,
      this.options.containerHeight!
    ).then(canvas => {
      // Only write to cache if version hasn't changed (no invalidation occurred)
      if (this.getPageVersion(pageNum) === versionAtStart) {
        this.previewCache.set(pageNum, canvas)
      }
      this.pendingRenders.delete(pageNum)
      return canvas
    }).catch(e => {
      this.pendingRenders.delete(pageNum)
      throw e
    })

    this.pendingRenders.set(pageNum, renderPromise)
  }

  /**
   * Ensure preview exists (renders if needed) and returns it
   * This is the guaranteed async way to get a preview
   */
  async ensurePreview(pageNum: number): Promise<HTMLCanvasElement> {

    // Check cache first
    const cached = this.previewCache.get(pageNum)
    if (cached) {
      return cached
    }

    // Check if already rendering
    const pending = this.pendingRenders.get(pageNum)
    if (pending) {
      return pending
    }

    // Capture version at render start
    const versionAtStart = this.getPageVersion(pageNum)
    // Start new render
    const renderPromise = this.pagePreviewService.getPreview(
      pageNum,
      this.options.containerWidth!,
      this.options.containerHeight!
    ).then(canvas => {
      // Only write to cache if version hasn't changed (no invalidation occurred)
      if (this.getPageVersion(pageNum) === versionAtStart) {
        this.previewCache.set(pageNum, canvas)
      }
      this.pendingRenders.delete(pageNum)
      return canvas
    }).catch(e => {
      this.pendingRenders.delete(pageNum)
      throw e
    })

    this.pendingRenders.set(pageNum, renderPromise)
    return renderPromise
  }

  /**
   * Wait for a specific page preview to be ready
   */
  async waitForPreview(pageNum: number): Promise<HTMLCanvasElement> {
    return this.ensurePreview(pageNum)
  }

  /**
   * Get page preview (async version)
   */
  async getPagePreviewAsync(
    pageNum: number,
    width: number,
    height: number
  ): Promise<HTMLCanvasElement> {
    try {
      const canvas = await this.pagePreviewService.getPreview(pageNum, width, height)
      return canvas
    } catch (e) {
      console.error(`🎨 [ModernAdapter] getPagePreviewAsync(${pageNum}) - FAILED:`, e)
      throw e
    }
  }

  /**
   * Get page preview with FIXED page dimensions (paper stays fixed, content transforms inside)
   * Use this for the edit popup where we want to show content transforming within a fixed page
   */
  async getPreviewWithFixedPage(
    pageNum: number,
    width: number,
    height: number,
    transforms?: { rotation: number; scale: number; crop: any; offsetX?: number; offsetY?: number }
  ): Promise<HTMLCanvasElement> {
    const canvas = await this.pagePreviewService.getPreviewWithFixedPage(pageNum, width, height, transforms as any)
    return canvas
  }

  /**
   * Get raw page preview WITHOUT any transforms applied
   * Use this for caching base image that can have transforms applied client-side
   * @param pageNum - Page number
   * @param scale - Render scale
   * @param signal - Optional AbortSignal
   * @param isNupMode - If true, disables A4 normalization for N-up layout
   */
  async getRawPreview(pageNum: number, scale: number = 1, signal?: AbortSignal, isNupMode: boolean = false): Promise<HTMLCanvasElement> {
    return this.pagePreviewService.getRawPreview(pageNum, scale, signal, isNupMode)
  }

  /**
   * Apply edit to page
   */
  applyEdit(pageNum: number, edit: EditCommand): void {
    this.editOrchestrator.applyEdit(pageNum, edit)

    // Invalidate all caches for this page
    this.incrementPageVersion(pageNum)  // Prevents stale renders from writing to cache
    this.previewCache.delete(pageNum)
    this.pendingRenders.delete(pageNum)
    this.pagePreviewService.clearPageCache(pageNum)
    this.thumbnailService.invalidate(pageNum)
    this.gridService.invalidateSheetsForPage(pageNum)
  }

  /**
   * Set selected pages
   */
  setSelectedPages(pageNumbers: number[]): void {
    this.selectionState.clearAll()
    pageNumbers.forEach(pageNum => this.selectionState.select(pageNum))

    // Also sync to pageState which is used by recipeService
    this.pageState.includeAll()
    const allPageNumbers = this.pageState.getOrder()
    allPageNumbers.forEach(pageNum => {
      if (!pageNumbers.includes(pageNum)) {
        this.pageState.excludePage(pageNum)
      }
    })
  }

  /**
   * Set print options for recipe
   */
  setOptions(options: Partial<RecipeOptions>): void {
    this.recipeService.setOptions(options)
  }

  /**
   * Get thumbnail
   */
  getThumbnail(pageNum: number): string | null {
    return this.thumbnailService.getCachedThumbnail(pageNum)
  }

  /**
   * Get thumbnail (async version) - WITH transforms from metadata
   */
  async getThumbnailAsync(pageNum: number): Promise<string> {
    try {
      const thumbnail = await this.thumbnailService.getThumbnail(pageNum, {
        maxWidth: this.options.thumbnailSize,
        maxHeight: this.options.thumbnailSize! * 1.4 // ~A4 ratio
      })
      return thumbnail
    } catch (e) {
      console.error(`📷 [ModernAdapter] getThumbnailAsync(${pageNum}) - FAILED:`, e)
      throw e
    }
  }

  /**
   * Get RAW thumbnail WITHOUT any transforms applied
   * Use this for TransformThumbnail component which applies transforms at display time
   */
  async getRawThumbnailAsync(pageNum: number): Promise<string> {
    return this.thumbnailService.getRawThumbnail(pageNum, {
      maxWidth: this.options.thumbnailSize,
      maxHeight: this.options.thumbnailSize! * 1.4
    })
  }

  // Cache for base thumbnails (raw renders without transforms) for fast refresh
  private baseThumbnailCache: Map<number, HTMLImageElement> = new Map()

  /**
   * Refresh thumbnail for a page after edits are applied
   * Uses cached base thumbnail and applies transforms client-side for instant updates
   * 
   * @param pageNum - Page number to refresh
   * @param transforms - Optional transforms to apply (if not provided, uses current metadata)
   * @returns The new thumbnail data URL
   */
  async refreshThumbnail(
    pageNum: number,
    transforms?: { rotation: number; scale: number; crop: any; offsetX?: number; offsetY?: number }
  ): Promise<string> {
    // Invalidate old caches
    this.incrementPageVersion(pageNum)
    this.previewCache.delete(pageNum)
    this.pendingRenders.delete(pageNum)
    this.pagePreviewService.clearPageCache(pageNum)
    this.thumbnailService.invalidate(pageNum)

    const thumbnailSize = this.options.thumbnailSize || 150

    // Try to use cached base thumbnail for fast client-side transform
    let baseImage = this.baseThumbnailCache.get(pageNum)

    if (!baseImage) {
      // Render at LOW resolution (calculated) for thumbnails - much faster!
      const dimensions = this.pagePreviewService.getPageDimensions(pageNum)
      let renderScale = 0.3
      if (dimensions) {
        renderScale = ((this.options.thumbnailSize || 150) / dimensions.width) * 1.2
      }
      const canvas = await this.pagePreviewService.getRawPreview(pageNum, renderScale)

      // Convert to Image for caching
      baseImage = new Image()
      baseImage.src = canvas.toDataURL('image/jpeg', 0.9)
      await new Promise<void>((resolve) => { baseImage!.onload = () => resolve() })
      this.baseThumbnailCache.set(pageNum, baseImage)
    }

    // Apply transforms client-side (fast)
    const dimensions = this.pagePreviewService.getPageDimensions(pageNum)
    const dataUrl = this.applyTransformsToThumbnail(baseImage, thumbnailSize, dimensions, transforms)
    return dataUrl
  }

  /**
   * Refresh thumbnails for all pages after bulk edits
   * Uses PARALLEL BATCH PROCESSING for fast updates on large PDFs
   * 
   * @param totalPages - Total number of pages
   * @param transforms - Transforms to apply to all pages
   * @param onProgress - Optional progress callback (pageNum, total)
   * @returns Map of page numbers to new thumbnail data URLs
   */
  async refreshAllThumbnails(
    totalPages: number,
    transforms: { rotation: number; scale: number; crop: any; offsetX?: number; offsetY?: number },
    onProgress?: (pageNum: number, total: number) => void
  ): Promise<Map<number, string>> {
    const result = new Map<number, string>()
    const BATCH_SIZE = 5  // Process 5 pages in parallel for optimal speed
    const thumbnailSize = this.options.thumbnailSize || 150

    // Process pages in parallel batches
    for (let batchStart = 1; batchStart <= totalPages; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)
      const batchPromises: Promise<{ pageNum: number; thumbnail: string } | null>[] = []

      // Create batch of parallel thumbnail renders
      for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
        const p = (async (pn: number) => {
          try {
            // Invalidate old caches
            this.incrementPageVersion(pn)
            this.previewCache.delete(pn)
            this.pendingRenders.delete(pn)
            this.pagePreviewService.clearPageCache(pn)
            this.thumbnailService.invalidate(pn)

            // Get or create base thumbnail
            let baseImage = this.baseThumbnailCache.get(pn)

            if (!baseImage) {
              // Render at LOW resolution (calculated) for thumbnails - much faster!
              const dimensions = this.pagePreviewService.getPageDimensions(pn)
              let renderScale = 0.3
              if (dimensions) {
                renderScale = ((thumbnailSize || 150) / dimensions.width) * 1.2
              }
              const canvas = await this.pagePreviewService.getRawPreview(pn, renderScale)
              baseImage = new Image()
              baseImage.src = canvas.toDataURL('image/jpeg', 0.8)
              await new Promise<void>((resolve) => { baseImage!.onload = () => resolve() })
              this.baseThumbnailCache.set(pn, baseImage)
            }

            // Apply transforms client-side (fast)
            const dimensions = this.pagePreviewService.getPageDimensions(pn)
            const thumbnail = this.applyTransformsToThumbnail(baseImage, thumbnailSize, dimensions, transforms)
            return { pageNum: pn, thumbnail }
          } catch (e) {
            console.warn(`[ModernAdapter] Failed to refresh thumbnail ${pn}:`, e)
            return null
          }
        })(pageNum)

        batchPromises.push(p)
      }

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises)

      // Collect results
      for (const res of batchResults) {
        if (res) {
          result.set(res.pageNum, res.thumbnail)
        }
      }

      // Report progress at end of each batch
      if (onProgress) {
        onProgress(batchEnd, totalPages)
      }
    }

    return result
  }

  /**
   * Apply transforms to base thumbnail image on fixed-size canvas (client-side, instant)
   */
  private applyTransformsToThumbnail(
    baseImage: HTMLImageElement,
    thumbnailSize: number,
    dimensions: PageDimensions | null,
    transforms?: { rotation: number; scale: number; crop: any; offsetX?: number; offsetY?: number }
  ): string {
    const rot = transforms?.rotation || 0
    const scl = transforms?.scale || 100
    const crop = transforms?.crop || null

    // Normalize rotation
    const normalizedRotation = ((rot % 360) + 360) % 360

    // Calculate orientation-aware page dimensions
    const isRotated90or270 = normalizedRotation === 90 || normalizedRotation === 270
    const visualWidth = isRotated90or270 ? baseImage.height : baseImage.width
    const visualHeight = isRotated90or270 ? baseImage.width : baseImage.height

    const aspectRatio = visualHeight / visualWidth
    const pageWidth = thumbnailSize
    const pageHeight = thumbnailSize * aspectRatio

    // Create canvas matching visual orientation
    const canvas = document.createElement('canvas')
    canvas.width = pageWidth
    canvas.height = pageHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    // Fill with white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageWidth, pageHeight)

    // No auto-fit scale needed here because we chose the canvas size to match visual orientation
    let autoFitScale = 1.0

    // Draw with transforms
    ctx.save()

    // 1. Target: Center of the thumbnail box
    ctx.translate(pageWidth / 2, pageHeight / 2)

    // 2. Rotate
    ctx.rotate((normalizedRotation * Math.PI) / 180)

    // 3. Determine base scale from full image to thumbnail box
    // Since we chose canvas dimensions to match, baseScale is just the width ratio
    const baseScale = pageWidth / (isRotated90or270 ? baseImage.height : baseImage.width)
    let finalScale = (scl / 100) * baseScale

    // 4. FOCUS: If cropped, scale up to fill thumbnail box
    let sx = 0, sy = 0, sw = baseImage.width, sh = baseImage.height

    if (crop && crop.width && crop.height) {
      // Source region in raw pixels
      sx = crop.x * baseImage.width
      sy = crop.y * baseImage.height
      sw = crop.width * baseImage.width
      sh = crop.height * baseImage.height

      // Calculate visual dimensions of the crop after rotation
      const visualCropWidth = (normalizedRotation === 90 || normalizedRotation === 270) ? sh : sw
      const visualCropHeight = (normalizedRotation === 90 || normalizedRotation === 270) ? sw : sh

      // Scale to fit visual crop into thumbnail box
      const focusScale = Math.min(pageWidth / visualCropWidth, pageHeight / visualCropHeight)
      finalScale = focusScale
    }

    ctx.scale(finalScale, finalScale)

    // 5. Apply user offset (scaled appropriately for thumbnail)
    // Offset is in "page dimensions" (points), we need to relate it to baseImage pixels
    // Since baseImage width is the "pageWidth" equivalent
    const offX = (transforms?.offsetX || 0) * (baseImage.width / (dimensions?.width || 1))
    const offY = (transforms?.offsetY || 0) * (baseImage.height / (dimensions?.height || 1))

    ctx.translate(offX, offY)

    // 6. Draw image centered on its crop center
    // If no crop, draw centers on center. If crop, draw center of sx, sy, sw, sh at (0,0)
    const centerX = crop ? sx + sw / 2 : baseImage.width / 2
    const centerY = crop ? sy + sh / 2 : baseImage.height / 2

    ctx.drawImage(
      baseImage,
      0, 0, baseImage.width, baseImage.height,
      -centerX, -centerY, baseImage.width, baseImage.height
    )

    ctx.restore()

    return canvas.toDataURL('image/jpeg', 0.7)
  }

  /**
   * Export recipe for desktop cpdf
   */
  exportRecipe(): Recipe {
    return this.recipeService.generate()
  }

  /**
   * Subscribe to progress events
   */
  onProgress(callback: ProgressCallback): () => void {
    return this.progressBus.on('*', event => {
      callback(event.progress || 0, event.type)
    })
  }

  /**
   * Get page count
   */
  getPageCount(): number {
    return this.pageState.getTotalPages()
  }

  /**
   * Get page metadata
   */
  getPageMetadata(pageNum: number): PageMetadata | null {
    return this.metadataStore.get(pageNum)
  }

  /**
   * Reset page
   */
  resetPage(pageNum: number): void {
    this.editOrchestrator.resetPage(pageNum)
    this.incrementPageVersion(pageNum)  // Prevents stale renders from writing to cache
    this.previewCache.delete(pageNum)
    this.pendingRenders.delete(pageNum)
    this.pagePreviewService.clearPageCache(pageNum)
    this.thumbnailService.invalidate(pageNum)
    this.gridService.invalidateSheetsForPage(pageNum)
  }

  /**
   * Reset all pages
   */
  resetAll(): void {
    this.editOrchestrator.resetAll()

    // Increment version for ALL pages (not just those with entries)
    // This invalidates any in-flight renders started before this reset
    const totalPages = this.pageState.getTotalPages()
    for (let i = 1; i <= totalPages; i++) {
      this.incrementPageVersion(i)
    }

    this.previewCache.clear()
    this.pendingRenders.clear()
    this.pagePreviewService.clearCache()
    this.thumbnailService.invalidateAll()
    this.gridService.clearCache()
  }

  /**
   * Clean up resources - CRITICAL for memory management
   * This releases the pdf.js worker memory (~250-600MB for large PDFs)
   */
  destroy(): void {
    console.log('🧹 [ModernAdapter] Destroying adapter and releasing memory...')
    this.documentLoader.destroy()
    this.pageVersions.clear()
    this.previewCache.clear()
    this.pendingRenders.clear()
    this.pagePreviewService.clearCache()
    this.thumbnailService.invalidateAll()
    this.gridService.clearCache()
    this.progressBus.clear()
    this.uiState.reset()
    this.currentFile = null
    this.isInitialized = false
    console.log('✅ [ModernAdapter] All resources released')
  }

  // ============================================
  // ADDITIONAL PUBLIC METHODS
  // ============================================

  /**
   * Get services for direct access (advanced use)
   */
  getServices() {
    return {
      metadataStore: this.metadataStore,
      progressBus: this.progressBus,
      pageState: this.pageState,
      selectionState: this.selectionState,
      documentLoader: this.documentLoader,
      pagePreviewService: this.pagePreviewService,
      thumbnailService: this.thumbnailService,
      recipeService: this.recipeService,
      gridService: this.gridService,
      editOrchestrator: this.editOrchestrator,
      uiState: this.uiState,
      canvasInteraction: this.canvasInteraction
    }
  }

  /**
   * Get edit orchestrator
   */
  getEditOrchestrator(): EditOrchestrator {
    return this.editOrchestrator
  }

  /**
   * Get UI state manager
   */
  getUIState(): UIStateManager {
    return this.uiState
  }

  /**
   * Get page state
   */
  getPageState(): PageState {
    return this.pageState
  }

  /**
   * Get selection state
   */
  getSelectionState(): SelectionState {
    return this.selectionState
  }

  /**
   * Check if loaded
   */
  isLoaded(): boolean {
    return this.isInitialized
  }

  /**
   * Get current file
   */
  getCurrentFile(): File | null {
    return this.currentFile
  }

  /**
   * Get internal PDF document proxy
   */
  getInternalPdfDoc(): any {
    return this.documentLoader.getDocument()
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Generate previews in background (starting from page 2)
   */
  private async generatePreviewsAsync(totalPages: number): Promise<void> {
    for (let i = 2; i <= totalPages; i++) {
      try {
        await this.ensurePreview(i)
      } catch (e) {
        console.warn(`[ModernAdapter] Failed to generate preview for page ${i}:`, e)
      }
    }
  }

  /**
   * Generate thumbnails in background
   */
  private async generateThumbnailsAsync(): Promise<void> {
    const totalPages = this.pageState.getTotalPages()

    for (let i = 1; i <= totalPages; i++) {
      try {
        await this.thumbnailService.getThumbnail(i)
      } catch (e) {
        console.warn(`[ModernAdapter] Failed to generate thumbnail for page ${i}:`, e)
      }
    }
  }

  // =====================
  // N-UP LAYOUT METHODS
  // =====================

  /**
   * Set pages per sheet (1, 2, or 4)
   */
  setPagesPerSheet(pps: 1 | 2 | 4): void {
    console.log(`📄 [ModernAdapter] Setting pagesPerSheet to ${pps}`)
    this.gridService.setPagesPerSheet(pps)
  }

  /**
   * Get current pages per sheet
   */
  getPagesPerSheet(): 1 | 2 | 4 {
    return this.gridService.getPagesPerSheet()
  }

  /**
   * Get total sheet count (pages / pagesPerSheet)
   */
  getSheetCount(): number {
    return this.gridService.getSheetCount()
  }

  /**
   * Get sheet thumbnail for N-up display
   */
  async getSheetThumbnail(sheetNumber: number): Promise<string> {
    return this.gridService.getSheetThumbnail(sheetNumber)
  }

  /**
   * Get pages for a specific sheet
   */
  getSheetPages(sheetNumber: number): number[] {
    return this.gridService.getSheetPages(sheetNumber)
  }

  /**
   * Get all sheets
   */
  getAllSheets(): { sheetNumber: number; pages: number[] }[] {
    return this.gridService.getAllSheets().map(s => ({
      sheetNumber: s.sheetNumber,
      pages: s.pages
    }))
  }

}
