/**
 * DocumentLoader
 * 
 * Handles PDF document loading using pdf.js.
 * Extracts page info, renders initial previews and thumbnails.
 */

import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { PageInfo, PageDimensions } from '../types'
import { ProgressBus } from './progressBus'
import { MetadataStore } from '../state/metadataStore'
import { calculateA4Transform } from './visualNormalization'

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export interface LoadResult {
  documentId: string
  pages: PageInfo[]
  totalPages: number
}

export class DocumentLoader {
  private progressBus: ProgressBus
  private metadataStore: MetadataStore
  private pdfDoc: PDFDocumentProxy | null = null
  private pageProxies: Map<number, PDFPageProxy> = new Map()
  private renderLocks: Map<number, Promise<void>> = new Map()  // Prevent concurrent renders

  constructor(progressBus: ProgressBus, metadataStore: MetadataStore) {
    this.progressBus = progressBus
    this.metadataStore = metadataStore
  }

  /**
   * Load PDF from File
   */
  async loadFile(file: File): Promise<LoadResult> {
    this.progressBus.emitLoadStart()

    // ⏱️ PERFORMANCE: Start measuring
    const loadStart = performance.now()
    console.log(`📄 [DocumentLoader] Starting loadFile for ${file.name}`)

    try {
      // MEMORY OPTIMIZATION: Load PDF in 64KB chunks instead of entire file
      const fileSize = file.size
      const CHUNK_SIZE = 65536 // 64KB chunks

      console.log(`📄 [DocumentLoader] Loading PDF in chunks (file size: ${(fileSize / 1024 / 1024).toFixed(2)} MB)`)

      // ⏱️ STEP 1: Read initial chunk
      const chunkStart = performance.now()
      const initialChunk = file.slice(0, Math.min(CHUNK_SIZE, fileSize))
      const initialData = new Uint8Array(await initialChunk.arrayBuffer())
      const chunkTime = ((performance.now() - chunkStart) / 1000).toFixed(3)
      console.log(`⏱️ [CHUNK READ] Initial chunk read in ${chunkTime}s`)

      // Create range transport for on-demand chunk loading
      const transport = new pdfjsLib.PDFDataRangeTransport(fileSize, initialData)

      transport.requestDataRange = async (begin: number, end: number) => {
        const chunk = file.slice(begin, end)
        const data = new Uint8Array(await chunk.arrayBuffer())
        transport.onDataRange(begin, data)
      }

      // ⏱️ STEP 2: PDF.js document parsing
      const parseStart = performance.now()
      console.log(`⏱️ [PDF.JS PARSE START] Calling pdfjsLib.getDocument...`)

      const loadingTask = pdfjsLib.getDocument({
        range: transport,
        length: fileSize,
        disableAutoFetch: true,
        disableStream: true,
        cMapUrl: 'https://unpkg.com/pdfjs-dist/cmaps/',
        cMapPacked: true
      })

      this.pdfDoc = await loadingTask.promise

      const parseTime = ((performance.now() - parseStart) / 1000).toFixed(2)
      console.log(`⏱️ [PDF.JS PARSE COMPLETE] PDF.js parsing took ${parseTime}s`)

      const totalPages = this.pdfDoc.numPages
      const documentId = this.generateDocumentId(file)

      this.progressBus.emitLoadProgress(10, 1, totalPages)

      // ⏱️ STEP 3: FULL PAGE LOADING - Load all page proxies now
      const pagesStart = performance.now()
      console.log(`⏱️ [FULL LOADING] Loading all ${totalPages} pages immediately...`)

      const pages: PageInfo[] = []

      for (let i = 1; i <= totalPages; i++) {
        const page = await this.pdfDoc.getPage(i)
        this.pageProxies.set(i, page)

        const viewport = page.getViewport({ scale: 1, rotation: 0 })
        const dimensions: PageDimensions = {
          width: viewport.width,
          height: viewport.height
        }

        // Initialize metadata for this page
        this.metadataStore.initPage(i, dimensions)
        const a4Transform = calculateA4Transform(viewport.width, viewport.height, page.rotate || 0)

        this.metadataStore.setNormalization(i, {
          scale: a4Transform.scale,
          offsetX: a4Transform.offsetX,
          offsetY: a4Transform.offsetY,
          rotation: page.rotate || 0,
          targetWidth: a4Transform.targetWidth,
          targetHeight: a4Transform.targetHeight
        })

        pages.push({
          pageNumber: i,
          width: viewport.width,
          height: viewport.height,
          thumbnail: null
        })
      }

      const pagesTime = ((performance.now() - pagesStart) / 1000).toFixed(2)
      console.log(`⏱️ [FULL LOADING COMPLETE] Loaded ${totalPages} pages in ${pagesTime}s`)

      this.progressBus.emitLoadComplete(totalPages)

      const totalTime = ((performance.now() - loadStart) / 1000).toFixed(2)
      console.log(`⏱️ [DOCUMENT LOADER COMPLETE] Total loadFile time: ${totalTime}s`)

      return {
        documentId,
        pages,
        totalPages
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.progressBus.emitLoadError(err)
      throw err
    }
  }

  /**
   * Get a page proxy for rendering
   */
  getPageProxy(pageNumber: number): PDFPageProxy | null {
    return this.pageProxies.get(pageNumber) || null
  }

  /**
   * Get PDF document
   */
  getDocument(): PDFDocumentProxy | null {
    return this.pdfDoc
  }

  /**
   * Render page to canvas at given scale
   * Uses render lock to prevent concurrent renders on the same page (pdf.js limitation)
   * 
   * @param pageNumber - Page number to render
   * @param canvas - Target canvas element
   * @param scale - Scale factor (default 1)
   * @param signal - Optional AbortSignal for cancellation
   * @param applyA4Normalization - If true, renders page onto A4-sized canvas with proper scaling
   */
  async renderPageToCanvas(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number = 1,
    signal?: AbortSignal,
    applyA4Normalization: boolean = true
  ): Promise<void> {
    console.log(`📄 [DocumentLoader] renderPageToCanvas(${pageNumber}, scale=${scale}) START`)

    // Load page proxy on-demand if not cached
    let page = this.pageProxies.get(pageNumber)
    if (!page) {
      if (!this.pdfDoc) {
        throw new Error(`PDF document not loaded`)
      }
      // Load the page proxy on-demand
      page = await this.pdfDoc.getPage(pageNumber)
      this.pageProxies.set(pageNumber, page)

      // Update metadata with actual page dimensions
      const viewport = page.getViewport({ scale: 1, rotation: 0 })
      const dimensions: PageDimensions = {
        width: viewport.width,
        height: viewport.height
      }
      this.metadataStore.initPage(pageNumber, dimensions)

      const a4Transform = calculateA4Transform(viewport.width, viewport.height, page.rotate || 0)
      this.metadataStore.setNormalization(pageNumber, {
        scale: a4Transform.scale,
        offsetX: a4Transform.offsetX,
        offsetY: a4Transform.offsetY,
        rotation: page.rotate || 0,
        targetWidth: a4Transform.targetWidth,
        targetHeight: a4Transform.targetHeight
      })
    }

    // Wait for any previous render on this page to complete
    const existingLock = this.renderLocks.get(pageNumber)
    if (existingLock) {
      console.log(`📄 [DocumentLoader] renderPageToCanvas(${pageNumber}) - Waiting for previous render...`)
      await existingLock
    }

    // Create render promise with lock
    const renderPromise = (async () => {
      try {
        // Get native viewport first - EXPLICITLY pass rotation: 0 to get raw unrotated dimensions
        const nativeViewport = page.getViewport({ scale: 1, rotation: 0 })
        const pageRotation = page.rotate || 0

        let viewport: any
        let offsetX = 0
        let offsetY = 0

        if (applyA4Normalization) {
          // Calculate A4 transform using same logic as normalizeToA4.ts
          const a4Transform = calculateA4Transform(
            nativeViewport.width,
            nativeViewport.height,
            pageRotation
          )

          // Set canvas to A4 dimensions at requested scale
          canvas.width = a4Transform.targetWidth * scale
          canvas.height = a4Transform.targetHeight * scale

          // Calculate render scale (combines A4 fitting with requested scale)
          const renderScale = a4Transform.scale * scale
          viewport = page.getViewport({ scale: renderScale, rotation: 0 })

          // Calculate offset for centering
          offsetX = a4Transform.offsetX * scale
          offsetY = a4Transform.offsetY * scale
        } else {
          // Original behavior: render at native size (RAW)
          // EXPLICITLY pass rotation: 0 here too
          viewport = page.getViewport({ scale, rotation: 0 })
          canvas.width = viewport.width
          canvas.height = viewport.height
        }

        console.log(`📄 [DocumentLoader] renderPageToCanvas(${pageNumber}) - Canvas: ${canvas.width}x${canvas.height}`)

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Failed to get canvas context')
        }

        // CRITICAL: Fill with white background to avoid transparent/black bars
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Apply offset for centering (only when normalizing)
        if (applyA4Normalization && (offsetX !== 0 || offsetY !== 0)) {
          ctx.translate(offsetX, offsetY)
        }

        const renderTask = page.render({
          canvasContext: ctx,
          viewport
        })

        if (signal) {
          signal.addEventListener('abort', () => {
            renderTask.cancel()
            console.log(`📄 [DocumentLoader] renderPageToCanvas(${pageNumber}) - Render cancelled by signal.`)
          }, { once: true })
        }

        await renderTask.promise

        console.log(`📄 [DocumentLoader] renderPageToCanvas(${pageNumber}) COMPLETE`)
      } catch (error: any) {
        if (error.name === 'RenderingCancelledException') {
          console.log(`📄 [DocumentLoader] renderPageToCanvas(${pageNumber}) - Render cancelled.`)
        } else {
          console.error(`📄 [DocumentLoader] Error rendering page ${pageNumber}:`, error)
          throw error
        }
      }
    })()

    // Store the lock
    this.renderLocks.set(pageNumber, renderPromise)

    try {
      await renderPromise
    } finally {
      // Clean up lock after render completes
      if (this.renderLocks.get(pageNumber) === renderPromise) {
        this.renderLocks.delete(pageNumber)
      }
    }
  }

  /**
   * Render page at specific dimensions
   */
  async renderPageAtSize(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number
  ): Promise<void> {
    const page = this.pageProxies.get(pageNumber)
    if (!page) {
      throw new Error(`Page ${pageNumber} not loaded`)
    }

    const originalViewport = page.getViewport({ scale: 1 })
    const scaleX = targetWidth / originalViewport.width
    const scaleY = targetHeight / originalViewport.height
    const scale = Math.min(scaleX, scaleY)

    await this.renderPageToCanvas(pageNumber, canvas, scale)
  }

  /**
   * Get page dimensions at original scale
   */
  getPageDimensions(pageNumber: number): PageDimensions | null {
    const page = this.pageProxies.get(pageNumber)
    if (!page) return null

    const viewport = page.getViewport({ scale: 1 })
    return {
      width: viewport.width,
      height: viewport.height
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.pageProxies.clear()
    if (this.pdfDoc) {
      this.pdfDoc.destroy()
      this.pdfDoc = null
    }
  }

  /**
   * Check if loaded
   */
  isLoaded(): boolean {
    return this.pdfDoc !== null
  }

  /**
   * Get total pages
   */
  getTotalPages(): number {
    return this.pdfDoc?.numPages || 0
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`
  }
}
