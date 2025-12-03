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
    containerHeight: number
  ): Promise<HTMLCanvasElement> {
    console.log(`🔍 [PagePreviewService] getPreview(${pageNumber}, ${containerWidth}x${containerHeight}) START`)
    const transforms = this.metadataStore.getTransforms(pageNumber)
    const cacheKey = this.getCacheKey(pageNumber, transforms, containerWidth, containerHeight)

    // Check cache
    if (this.previewCache.has(cacheKey)) {
      const cached = this.previewCache.get(cacheKey)!
      console.log(`🔍 [PagePreviewService] getPreview(${pageNumber}) - CACHE HIT, size: ${cached.width}x${cached.height}`)
      return cached
    }

    this.progressBus.emitRenderStart(pageNumber)

    // Render base page
    console.log(`🔍 [PagePreviewService] getPreview(${pageNumber}) - Rendering base page...`)
    const baseCanvas = document.createElement('canvas')
    const scale = this.calculateScale(pageNumber, containerWidth, containerHeight)
    console.log(`🔍 [PagePreviewService] getPreview(${pageNumber}) - Scale: ${scale}`)
    await this.documentLoader.renderPageToCanvas(pageNumber, baseCanvas, scale)
    console.log(`🔍 [PagePreviewService] getPreview(${pageNumber}) - Base canvas: ${baseCanvas.width}x${baseCanvas.height}`)

    // Apply transforms
    const transformedCanvas = this.applyTransforms(baseCanvas, transforms)
    console.log(`🔍 [PagePreviewService] getPreview(${pageNumber}) - Transformed canvas: ${transformedCanvas.width}x${transformedCanvas.height}`)

    // Cache result
    this.addToCache(cacheKey, transformedCanvas)

    this.progressBus.emitRenderComplete(pageNumber)
    console.log(`🔍 [PagePreviewService] getPreview(${pageNumber}) COMPLETE`)
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
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.previewCache.clear()
  }

  /**
   * Get raw page canvas without transforms
   */
  async getRawPreview(
    pageNumber: number,
    scale: number = 1
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas')
    await this.documentLoader.renderPageToCanvas(pageNumber, canvas, scale)
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
    console.log(`📄 [PagePreviewService] getPreviewWithFixedPage(${pageNumber}) START`)
    
    // Get transforms (either passed or from store)
    const pageTransforms = transforms || this.metadataStore.getTransforms(pageNumber)
    
    // Get original page dimensions
    const pageDimensions = this.documentLoader.getPageDimensions(pageNumber)
    if (!pageDimensions) {
      throw new Error(`Cannot get dimensions for page ${pageNumber}`)
    }
    
    // Calculate render scale to fit container
    const renderScale = Math.min(
      containerWidth / pageDimensions.width,
      containerHeight / pageDimensions.height,
      2 // Cap at 2x for performance
    )
    
    // Create the FIXED page canvas (this is the "paper")
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = Math.round(pageDimensions.width * renderScale)
    pageCanvas.height = Math.round(pageDimensions.height * renderScale)
    
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
    if (pageTransforms.rotation !== 0) {
      ctx.rotate((pageTransforms.rotation * Math.PI) / 180)
    }
    
    // Calculate auto-fit scale for rotated content at 100% user scale
    // When rotation is 90° or 270°, dimensions are swapped, so we need to scale down to fit
    // This ONLY applies when user scale is exactly 100% (original size)
    let autoFitScale = 1.0
    if (pageTransforms.scale === 100) {
      // Normalize rotation to 0-359 range (handle negative rotations)
      const rotation = ((pageTransforms.rotation % 360) + 360) % 360
      if (rotation === 90 || rotation === 270) {
        // Dimensions are swapped after rotation
        const contentWidth = contentCanvas.width
        const contentHeight = contentCanvas.height
        const pageWidth = pageCanvas.width
        const pageHeight = pageCanvas.height
        
        // After rotation, content's width becomes page's height dimension and vice versa
        // So we need to fit: contentWidth into pageHeight, contentHeight into pageWidth
        autoFitScale = Math.min(
          pageWidth / contentHeight,
          pageHeight / contentWidth,
          1.0 // Never scale up, only down to fit
        )
        console.log(`📐 [PagePreviewService] Auto-fit scale for ${rotation}° rotation: ${autoFitScale.toFixed(3)}`)
      }
    }
    
    // Apply content scale (user scale * auto-fit scale)
    const userScale = pageTransforms.scale / 100
    const finalScale = userScale * autoFitScale
    ctx.scale(finalScale, finalScale)
    
    if (autoFitScale !== 1.0) {
      console.log(`📐 [PagePreviewService] Final scale: ${finalScale.toFixed(3)} (user: ${userScale}, auto-fit: ${autoFitScale.toFixed(3)})`)
    }
    
    // Apply offset
    ctx.translate(pageTransforms.offsetX || 0, pageTransforms.offsetY || 0)
    
    // Determine source region (apply crop if present)
    let sx = 0, sy = 0, sw = contentCanvas.width, sh = contentCanvas.height
    if (pageTransforms.crop) {
      sx = pageTransforms.crop.x * contentCanvas.width
      sy = pageTransforms.crop.y * contentCanvas.height
      sw = pageTransforms.crop.width * contentCanvas.width
      sh = pageTransforms.crop.height * contentCanvas.height
      
      // Debug logging
      console.log(`🖼️ [PagePreviewService] Rendering with crop at rotation=${pageTransforms.rotation}°:`)
      console.log(`  Crop: {x:${pageTransforms.crop.x.toFixed(3)}, y:${pageTransforms.crop.y.toFixed(3)}, w:${pageTransforms.crop.width.toFixed(3)}, h:${pageTransforms.crop.height.toFixed(3)}} (${pageTransforms.crop.width > pageTransforms.crop.height ? 'HORIZONTAL' : 'VERTICAL'})`)
      console.log(`  Source region: sx=${sx.toFixed(0)}, sy=${sy.toFixed(0)}, sw=${sw.toFixed(0)}, sh=${sh.toFixed(0)} (${sw > sh ? 'WIDE' : 'TALL'})`)
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
    
    console.log(`📄 [PagePreviewService] getPreviewWithFixedPage(${pageNumber}) COMPLETE - ${pageCanvas.width}x${pageCanvas.height}`)
    return pageCanvas
  }
}
