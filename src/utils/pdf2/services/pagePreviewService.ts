/**
 * PagePreviewService
 * 
 * Renders page previews with transforms applied.
 * Handles the visual preview for the canvas display.
 */

import { PageTransforms } from '../types'
import { DocumentLoader } from './documentLoader'
import { MetadataStore } from '../state/metadataStore'
import { ProgressBus } from './progressBus'

export class PagePreviewService {
  private documentLoader: DocumentLoader
  private metadataStore: MetadataStore
  private progressBus: ProgressBus
  private previewCache: Map<string, HTMLCanvasElement> = new Map()
  private rawPreviewCache: Map<string, HTMLCanvasElement> = new Map()
  private maxCacheSize: number = 20

  constructor(
    documentLoader: DocumentLoader,
    metadataStore: MetadataStore,
    progressBus: ProgressBus
  ) {
    this.documentLoader = documentLoader
    this.metadataStore = metadataStore
    this.progressBus = progressBus
  }

  /**
   * Get preview canvas for a page with transforms applied
   */
  async getPreview(
    pageNumber: number,
    containerWidth: number,
    containerHeight: number,
    signal?: AbortSignal,
    isNupMode: boolean = false  // When true, disable A4 normalization
  ): Promise<HTMLCanvasElement> {
    const transforms = this.metadataStore.getTransforms(pageNumber)
    const cacheKey = this.getCacheKey(pageNumber, transforms, containerWidth, containerHeight) + (isNupMode ? '_nup' : '')

    // Check cache
    if (this.previewCache.has(cacheKey)) {
      return this.previewCache.get(cacheKey)!
    }

    this.progressBus.emitRenderStart(pageNumber)

    // Render base page
    const baseCanvas = document.createElement('canvas')
    const scale = this.calculateScale(pageNumber, containerWidth, containerHeight)

    // N-up mode: disable A4 normalization
    const applyA4Normalization = !isNupMode
    if (isNupMode) {
      console.log('%c🔲 [N-UP PREVIEW] Page ' + pageNumber + ' - A4 Normalization: DISABLED', 'color: red; font-weight: bold; background: #ffeeee; padding: 2px 6px;')
    }
    await this.documentLoader.renderPageToCanvas(pageNumber, baseCanvas, scale, signal, applyA4Normalization)

    // Apply transforms
    const transformedCanvas = this.applyTransforms(baseCanvas, transforms)

    // Cache result
    this.addToCache(cacheKey, transformedCanvas)

    this.progressBus.emitRenderComplete(pageNumber)
    return transformedCanvas
  }

  /**
   * Apply all transforms to a canvas
   */
  private applyTransforms(source: HTMLCanvasElement, transforms: PageTransforms): HTMLCanvasElement {
    let current = source

    // Apply transforms in order: CROP → ROTATE → SCALE
    if (transforms.crop) {
      current = this.applyCrop(current, transforms.crop)
    }

    if (transforms.rotation !== 0) {
      current = this.applyRotation(current, transforms.rotation)
    }

    if (transforms.scale !== 100) {
      current = this.applyScale(current, transforms.scale)
    }

    return current
  }

  /**
   * Apply crop to canvas
   */
  private applyCrop(
    source: HTMLCanvasElement,
    crop: { x: number; y: number; width: number; height: number }
  ): HTMLCanvasElement {
    const result = document.createElement('canvas')
    const sx = crop.x * source.width
    const sy = crop.y * source.height
    const sw = crop.width * source.width
    const sh = crop.height * source.height

    result.width = sw
    result.height = sh

    const ctx = result.getContext('2d')
    if (ctx) {
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
    }

    return result
  }

  /**
   * Apply rotation to canvas
   */
  private applyRotation(source: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
    const result = document.createElement('canvas')
    const ctx = result.getContext('2d')
    if (!ctx) return source

    const radians = (degrees * Math.PI) / 180

    if (degrees === 90 || degrees === 270) {
      result.width = source.height
      result.height = source.width
    } else {
      result.width = source.width
      result.height = source.height
    }

    ctx.translate(result.width / 2, result.height / 2)
    ctx.rotate(radians)
    ctx.drawImage(source, -source.width / 2, -source.height / 2)

    return result
  }

  /**
   * Apply scale to canvas
   */
  private applyScale(source: HTMLCanvasElement, scalePercent: number): HTMLCanvasElement {
    const result = document.createElement('canvas')
    const scale = scalePercent / 100

    result.width = source.width * scale
    result.height = source.height * scale

    const ctx = result.getContext('2d')
    if (ctx) {
      ctx.drawImage(source, 0, 0, result.width, result.height)
    }

    return result
  }

  /**
   * Calculate scale to fit in container
   */
  private calculateScale(
    pageNumber: number,
    containerWidth: number,
    containerHeight: number
  ): number {
    const dimensions = this.documentLoader.getPageDimensions(pageNumber)
    if (!dimensions) return 1

    const scaleX = containerWidth / dimensions.width
    const scaleY = containerHeight / dimensions.height
    return Math.min(scaleX, scaleY, 2) // Cap at 2x for performance
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    pageNumber: number,
    transforms: PageTransforms,
    width: number,
    height: number
  ): string {
    return JSON.stringify({
      page: pageNumber,
      transforms,
      width: Math.round(width),
      height: Math.round(height)
    })
  }

  /**
   * Add to cache with LRU eviction
   */
  private addToCache(key: string, canvas: HTMLCanvasElement): void {
    if (this.previewCache.size >= this.maxCacheSize) {
      const firstKey = this.previewCache.keys().next().value
      if (firstKey) {
        this.previewCache.delete(firstKey)
      }
    }
    this.previewCache.set(key, canvas)
  }

  /**
   * Clear cache for a specific page
   */
  clearPageCache(pageNumber: number): void {
    const keysToDelete: string[] = []
    this.previewCache.forEach((_, key) => {
      if (key.includes(`"page":${pageNumber}`)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.previewCache.delete(key))

    // Also clear raw preview cache for this page
    const rawKeysToDelete: string[] = []
    this.rawPreviewCache.forEach((_, key) => {
      if (key.startsWith(`raw_${pageNumber}_`)) {
        rawKeysToDelete.push(key)
      }
    })
    rawKeysToDelete.forEach(key => this.rawPreviewCache.delete(key))
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.previewCache.clear()
    this.rawPreviewCache.clear()
  }

  /**
   * Get raw page canvas without transforms (CACHED)
   * First call renders, subsequent calls return instantly.
   */
  async getRawPreview(
    pageNumber: number,
    scale: number = 1,
    signal?: AbortSignal,
    isNupMode: boolean = false  // When true, disable A4 normalization
  ): Promise<HTMLCanvasElement> {
    // Cache key includes page number and scale
    const cacheKey = `raw_${pageNumber}_${scale.toFixed(2)}` + (isNupMode ? '_nup' : '')

    // Check raw preview cache first
    if (this.rawPreviewCache.has(cacheKey)) {
      console.log(`⚡ [getRawPreview] Cache HIT: page ${pageNumber} @ ${scale}`)
      return this.rawPreviewCache.get(cacheKey)!
    }

    console.log(`🖼️ [getRawPreview] Cache MISS: Rendering page ${pageNumber} @ ${scale}`)
    const canvas = document.createElement('canvas')

    // N-up mode: disable A4 normalization
    const applyA4Normalization = !isNupMode
    if (isNupMode) {
      console.log('%c🔲 [N-UP RAW PREVIEW] Page ' + pageNumber + ' - A4 Normalization: DISABLED', 'color: red; font-weight: bold; background: #ffeeee; padding: 2px 6px;')
    }
    await this.documentLoader.renderPageToCanvas(pageNumber, canvas, scale, signal, applyA4Normalization)

    // If cancelled, don't cache empty/partial canvas
    if (signal?.aborted) {
      throw new Error('Aborted')
    }

    // Store in raw preview cache
    this.rawPreviewCache.set(cacheKey, canvas)

    // Evict old entries if cache grows too large
    if (this.rawPreviewCache.size > this.maxCacheSize * 2) {
      const keys = Array.from(this.rawPreviewCache.keys())
      for (let i = 0; i < keys.length - this.maxCacheSize; i++) {
        this.rawPreviewCache.delete(keys[i])
      }
    }

    return canvas
  }

  /**
   * Get preview with FIXED page dimensions (paper stays fixed, content transforms inside)
   * This is the correct way to preview: paper = fixed rectangle, content = transforms within
   * 
   * @param pageNumber - Page number to render
   * @param containerWidth - Container width for scaling
   * @param containerHeight - Container height for scaling
   * @param transforms - Optional explicit transforms (if not provided, uses stored transforms)
   */
  async getPreviewWithFixedPage(
    pageNumber: number,
    containerWidth: number,
    containerHeight: number,
    transforms?: PageTransforms
  ): Promise<HTMLCanvasElement> {

    // Get transforms (either passed or from store)
    const pageTransforms = transforms || this.metadataStore.getTransforms(pageNumber)

    // Get original page dimensions
    const pageDimensions = this.documentLoader.getPageDimensions(pageNumber)
    if (!pageDimensions) {
      throw new Error(`Cannot get dimensions for page ${pageNumber}`)
    }

    // Normalize rotation to 0-359 range
    const rotation = ((pageTransforms.rotation % 360) + 360) % 360
    const isRotated90or270 = rotation === 90 || rotation === 270

    // Calculate the VISUAL page dimensions (swapped if rotated)
    const visualPageWidth = isRotated90or270 ? pageDimensions.height : pageDimensions.width
    const visualPageHeight = isRotated90or270 ? pageDimensions.width : pageDimensions.height

    // Calculate render scale to fit container
    const renderScale = Math.min(
      containerWidth / visualPageWidth,
      containerHeight / visualPageHeight,
      2 // Cap at 2x for performance
    )

    // Create the page canvas matching visual orientation
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = Math.round(visualPageWidth * renderScale)
    pageCanvas.height = Math.round(visualPageHeight * renderScale)

    const ctx = pageCanvas.getContext('2d')
    if (!ctx) {
      throw new Error('Cannot get 2D context')
    }

    // Fill with white background (the paper)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)

    // Render the base page content
    const contentCanvas = document.createElement('canvas')
    await this.documentLoader.renderPageToCanvas(pageNumber, contentCanvas, renderScale)

    // Now draw the content with transforms applied
    // Order: CROP → ROTATE → SCALE → OFFSET

    ctx.save()

    // Move to center of page (for rotation/scale around center)
    ctx.translate(pageCanvas.width / 2, pageCanvas.height / 2)

    // Apply rotation (around center)
    const radians = (rotation * Math.PI) / 180
    if (rotation !== 0) {
      ctx.rotate(radians)
    }

    // Since we rotated the canvas to match orientation, we don't need auto-fit scale
    // of the content relative to the paper (it fits by default)
    let autoFitScale = 1.0

    // Apply offset
    // Include normalization if present
    const metadata = this.metadataStore.get(pageNumber)
    const norm = metadata?.normalization || { scale: 1, offsetX: 0, offsetY: 0 }

    // Total scale includes user scale, auto-fit, and A4 normalization
    const userScale = pageTransforms.scale / 100
    const finalScale = (userScale * autoFitScale) * norm.scale
    ctx.scale(finalScale, finalScale)

    // Total offset includes user offset and normalization offset
    // Normalization offset is in points, need to scale to canvas
    const totalOffX = (pageTransforms.offsetX || 0) + (norm.offsetX || 0)
    const totalOffY = (pageTransforms.offsetY || 0) + (norm.offsetY || 0)

    ctx.translate(totalOffX, totalOffY)

    // Determine source region (apply crop if present)
    let sx = 0, sy = 0, sw = contentCanvas.width, sh = contentCanvas.height
    if (pageTransforms.crop) {
      sx = pageTransforms.crop.x * contentCanvas.width
      sy = pageTransforms.crop.y * contentCanvas.height
      sw = pageTransforms.crop.width * contentCanvas.width
      sh = pageTransforms.crop.height * contentCanvas.height
    }

    // Draw content centered (accounting for crop)
    const drawWidth = pageTransforms.crop ? sw : contentCanvas.width
    const drawHeight = pageTransforms.crop ? sh : contentCanvas.height

    ctx.drawImage(
      contentCanvas,
      sx, sy, sw, sh,  // Source region
      -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight  // Destination (centered)
    )

    ctx.restore()
    return pageCanvas
  }
  /**
   * Get page dimensions
   */
  getPageDimensions(pageNumber: number) {
    return this.documentLoader.getPageDimensions(pageNumber)
  }
}
