/**
 * ThumbnailService
 * 
 * Generates and caches page thumbnails.
 * Thumbnails are small preview images for the page list.
 */

import { PageTransforms } from '../types'
import { PagePreviewService } from './pagePreviewService'
import { MetadataStore } from '../state/metadataStore'

export interface ThumbnailOptions {
  maxWidth: number
  maxHeight: number
  quality: number  // 0-1
}

const DEFAULT_OPTIONS: ThumbnailOptions = {
  maxWidth: 150,
  maxHeight: 200,
  quality: 0.7
}

export class ThumbnailService {
  private previewService: PagePreviewService
  private metadataStore: MetadataStore
  private thumbnailCache: Map<string, string> = new Map()
  private maxCacheSize: number = 100

  constructor(previewService: PagePreviewService, metadataStore: MetadataStore) {
    this.previewService = previewService
    this.metadataStore = metadataStore
  }

  /**
   * Get thumbnail Blob URL for a page (YouTube-style memory optimization)
   * Returns a blob: URL instead of data: URL to save ~800MB RAM on large PDFs
   */
  async getThumbnail(
    pageNumber: number,
    options: Partial<ThumbnailOptions> = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const transforms = this.metadataStore.getTransforms(pageNumber)
    const cacheKey = this.getCacheKey(pageNumber, transforms, opts)

    // Check cache
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!
    }

    // Generate preview
    const previewCanvas = await this.previewService.getPreview(
      pageNumber,
      opts.maxWidth,
      opts.maxHeight
    )

    // Scale to thumbnail size
    const thumbnailCanvas = this.scaleToThumbnail(previewCanvas, opts)

    // Convert to Blob URL (YouTube-style: saves ~800MB RAM)
    const blobUrl = await this.canvasToBlobUrl(thumbnailCanvas, opts.quality)

    // Cache
    this.addToCache(cacheKey, blobUrl)

    return blobUrl
  }

  /**
   * Get RAW thumbnail WITHOUT any transforms applied (Blob URL version)
   * Use this for TransformThumbnail component which applies transforms at display time
   */
  async getRawThumbnail(
    pageNumber: number,
    options: Partial<ThumbnailOptions> = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const cacheKey = `raw-${pageNumber}-${opts.maxWidth}x${opts.maxHeight}`

    // Check cache
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!
    }

    // Get page dimensions to calculate optimal scale
    const dimensions = this.previewService.getPageDimensions(pageNumber)
    let scale = 0.3 // Fallback

    if (dimensions) {
      const scaleX = opts.maxWidth / dimensions.width
      const scaleY = opts.maxHeight / dimensions.height
      // Use slightly larger scale (1.2x) to ensure crispness before downscaling
      scale = Math.min(scaleX, scaleY) * 1.2
    }

    // Get RAW preview without transforms
    const rawCanvas = await this.previewService.getRawPreview(pageNumber, scale)

    // Scale to thumbnail size
    const thumbnailCanvas = this.scaleToThumbnail(rawCanvas, opts)

    // Convert to Blob URL (saves RAM)
    const blobUrl = await this.canvasToBlobUrl(thumbnailCanvas, opts.quality)

    // Cache
    this.addToCache(cacheKey, blobUrl)

    return blobUrl
  }

  /**
   * Get cached thumbnail (if exists)
   */
  getCachedThumbnail(pageNumber: number): string | null {
    const transforms = this.metadataStore.getTransforms(pageNumber)
    const cacheKey = this.getCacheKey(pageNumber, transforms, DEFAULT_OPTIONS)
    return this.thumbnailCache.get(cacheKey) || null
  }

  /**
   * Generate all thumbnails in batch
   */
  async generateAll(
    totalPages: number,
    options: Partial<ThumbnailOptions> = {}
  ): Promise<Map<number, string>> {
    const result = new Map<number, string>()

    for (let i = 1; i <= totalPages; i++) {
      const thumbnail = await this.getThumbnail(i, options)
      result.set(i, thumbnail)
    }

    return result
  }

  /**
   * Invalidate thumbnail for a page (revokes blob URLs to free memory)
   */
  invalidate(pageNumber: number): void {
    const keysToDelete: string[] = []
    this.thumbnailCache.forEach((url, key) => {
      if (key.startsWith(`${pageNumber}-`) || key.startsWith(`raw-${pageNumber}-`)) {
        // Revoke blob URL to free memory
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.thumbnailCache.delete(key))
  }

  /**
   * Invalidate all thumbnails (revokes all blob URLs)
   */
  invalidateAll(): void {
    // Revoke all blob URLs before clearing
    this.thumbnailCache.forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    })
    this.thumbnailCache.clear()
  }

  /**
   * Scale canvas to fit thumbnail dimensions
   */
  private scaleToThumbnail(
    source: HTMLCanvasElement,
    options: ThumbnailOptions
  ): HTMLCanvasElement {
    const scaleX = options.maxWidth / source.width
    const scaleY = options.maxHeight / source.height
    const scale = Math.min(scaleX, scaleY, 1) // Don't upscale

    const result = document.createElement('canvas')
    result.width = source.width * scale
    result.height = source.height * scale

    const ctx = result.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'medium'
      ctx.drawImage(source, 0, 0, result.width, result.height)
    }

    return result
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    pageNumber: number,
    transforms: PageTransforms,
    options: ThumbnailOptions
  ): string {
    return `${pageNumber}-${JSON.stringify(transforms)}-${options.maxWidth}x${options.maxHeight}`
  }

  /**
   * Add to cache with LRU eviction (revokes old blob URLs)
   */
  private addToCache(key: string, url: string): void {
    if (this.thumbnailCache.size >= this.maxCacheSize) {
      const firstKey = this.thumbnailCache.keys().next().value
      if (firstKey) {
        // Revoke old blob URL before evicting
        const oldUrl = this.thumbnailCache.get(firstKey)
        if (oldUrl && oldUrl.startsWith('blob:')) {
          URL.revokeObjectURL(oldUrl)
        }
        this.thumbnailCache.delete(firstKey)
      }
    }
    this.thumbnailCache.set(key, url)
  }

  /**
   * Convert canvas to Blob URL (YouTube-style memory optimization)
   * Returns blob: URL instead of data: URL
   */
  private canvasToBlobUrl(canvas: HTMLCanvasElement, quality: number): Promise<string> {
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob)
            resolve(blobUrl)
          } else {
            // Fallback to data URL if toBlob fails
            resolve(canvas.toDataURL('image/jpeg', quality))
          }
        },
        'image/jpeg',
        quality
      )
    })
  }
}
