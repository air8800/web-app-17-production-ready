/**
 * LegacyAdapter
 * 
 * Wraps the old PDFEditor.jsx functionality to conform to the new PdfController interface.
 * This allows gradual migration - the feature flag can switch between legacy and modern.
 */

import {
  PdfController,
  EditCommand,
  Recipe,
  PageMetadata,
  ProgressCallback,
  DEFAULT_TRANSFORMS,
  RecipeOptions
} from '../types'

export interface LegacyPdfEditorRef {
  exportPDF: () => Promise<void>
  clearAllEdits: () => void
  pages?: Array<{
    pageNumber: number
    width: number
    height: number
    canvas: HTMLCanvasElement | null
    thumbnail: string | null
    editHistory?: {
      crop: { x: number; y: number; width: number; height: number } | null
      rotation: number
      scale: number
      offsetX: number
      offsetY: number
    }
  }>
}

export class LegacyAdapter implements PdfController {
  private ref: LegacyPdfEditorRef | null = null
  private progressCallbacks: Set<ProgressCallback> = new Set()
  private currentFile: File | null = null

  setRef(ref: LegacyPdfEditorRef): void {
    this.ref = ref
  }

  async loadDocument(file: File): Promise<void> {
    this.currentFile = file
    this.notifyProgress(0, 'parsing')
    this.notifyProgress(100, 'loading')
  }

  getPagePreview(pageNum: number): HTMLCanvasElement | null {
    if (!this.ref?.pages) return null
    const page = this.ref.pages.find(p => p.pageNumber === pageNum)
    return page?.canvas || null
  }

  applyEdit(pageNum: number, edit: EditCommand): void {
    console.log('[LegacyAdapter] applyEdit called', pageNum, edit.type)
  }

  getThumbnail(pageNum: number): string | null {
    if (!this.ref?.pages) return null
    const page = this.ref.pages.find(p => p.pageNumber === pageNum)
    return page?.thumbnail || null
  }

  exportRecipe(): Recipe {
    if (!this.currentFile) {
      throw new Error('No file loaded')
    }

    const pages = this.ref?.pages || []

    return {
      version: '1.0',
      type: 'print_job',
      generatedAt: new Date().toISOString(),
      source: {
        fileName: this.currentFile.name,
        fileSize: this.currentFile.size,
        fileType: this.currentFile.type || 'application/pdf',
        totalPages: pages.length
      },
      print: {
        paperSize: 'A4',
        colorMode: 'color',
        duplex: false,
        copies: 1,
        pagesPerSheet: 1,
        quality: 'normal'
      },
      pages: pages.map(page => ({
        pageNumber: page.pageNumber,
        originalDimensions: { width: page.width, height: page.height },
        transforms: page.editHistory ? {
          crop: page.editHistory.crop,
          rotation: (page.editHistory.rotation as 0 | 90 | 180 | 270) || 0,
          scale: page.editHistory.scale || 100,
          offsetX: page.editHistory.offsetX || 0,
          offsetY: page.editHistory.offsetY || 0
        } : { ...DEFAULT_TRANSFORMS },
        hasEdits: !!(page.editHistory?.crop || page.editHistory?.rotation),
        isCropped: !!page.editHistory?.crop,
        fitCropToPage: false
      })),
      destination: {
        shopId: null
      }
    }
  }

  setSelectedPages(_pageNumbers: number[]): void {
    // Legacy doesn't support selection syncing via adapter
  }

  setOptions(_options: Partial<RecipeOptions>): void {
    // Legacy doesn't support structured print options via adapter
  }

  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    return () => this.progressCallbacks.delete(callback)
  }

  getPageCount(): number {
    return this.ref?.pages?.length || 0
  }

  getPageMetadata(pageNum: number): PageMetadata | null {
    if (!this.ref?.pages) return null
    const page = this.ref.pages.find(p => p.pageNumber === pageNum)
    if (!page) return null

    return {
      pageNumber: page.pageNumber,
      originalDimensions: { width: page.width, height: page.height },
      transforms: page.editHistory ? {
        crop: page.editHistory.crop,
        rotation: (page.editHistory.rotation as 0 | 90 | 180 | 270) || 0,
        scale: page.editHistory.scale || 100,
        offsetX: page.editHistory.offsetX || 0,
        offsetY: page.editHistory.offsetY || 0
      } : { ...DEFAULT_TRANSFORMS },
      edited: !!(page.editHistory?.crop || page.editHistory?.rotation),
      isCropped: !!page.editHistory?.crop,
      fitCropToPage: false
    }
  }

  resetPage(pageNum: number): void {
    console.log('[LegacyAdapter] resetPage called', pageNum)
  }

  resetAll(): void {
    if (this.ref?.clearAllEdits) {
      this.ref.clearAllEdits()
    }
  }

  destroy(): void {
    this.ref = null
    this.progressCallbacks.clear()
    this.currentFile = null
  }

  private notifyProgress(progress: number, stage?: string): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress, stage)
      } catch (e) {
        console.error('[LegacyAdapter] Progress callback error:', e)
      }
    })
  }

  isLoaded(): boolean {
    return !!this.ref
  }

  getInternalPdfDoc(): any {
    return null
  }
}
