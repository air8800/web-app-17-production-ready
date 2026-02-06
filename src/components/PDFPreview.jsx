import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Columns2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePdfController, USE_NEW_PDF_CONTROLLER } from '../utils/pdf2';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PDFPreview = ({ file, pagesPerSheet = 1 }) => {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [renderedItems, setRenderedItems] = useState([]);
  const canvasRefs = useRef([]);
  const pageCanvasCache = useRef(new Map()); // Cache individual page canvases
  const { controller } = usePdfController();

  useEffect(() => {
    if (USE_NEW_PDF_CONTROLLER && controller?.isLoaded() && !pdfDoc) {
      const internalPdf = controller.getInternalPdfDoc();
      if (internalPdf) {
        console.log('🔗 [PDFPreview] Reusing shared PDF document from controller');
        setPdfDoc(internalPdf);
      }
    }
  }, [controller, pdfDoc]);

  useEffect(() => {
    if (!file) return;

    // Skip independent load if we have a controller and it's loading or loaded
    if (USE_NEW_PDF_CONTROLLER && controller) {
      return;
    }

    const loadPDF = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(doc);
        pageCanvasCache.current.clear(); // Clear cache on new file
      } catch (error) {
        console.error('Error loading PDF for preview:', error);
      }
    };

    loadPDF();
  }, [file]);

  // Render a single page to an off-screen canvas
  const renderPageToCanvas = useCallback(async (pageNum, scale) => {
    if (!pdfDoc) return null;

    // Check cache first
    const cacheKey = `${pageNum}_${scale}`;
    if (pageCanvasCache.current.has(cacheKey)) {
      return pageCanvasCache.current.get(cacheKey);
    }

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Cache it
      pageCanvasCache.current.set(cacheKey, canvas);
      return canvas;
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
      return null;
    }
  }, [pdfDoc]);

  // Combine two page canvases into a single sheet canvas
  const combinePages = useCallback((canvas1, canvas2) => {
    if (!canvas1) return null;

    const gap = 12;
    const margin = 8;
    const pageWidth = canvas1.width;
    const pageHeight = canvas1.height;

    const combinedCanvas = document.createElement('canvas');
    combinedCanvas.width = pageWidth * 2 + gap + margin * 2;
    combinedCanvas.height = pageHeight + margin * 2;

    const ctx = combinedCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

    // Draw page 1
    ctx.drawImage(canvas1, margin, margin);

    // Draw page 2 or placeholder
    if (canvas2) {
      ctx.drawImage(canvas2, margin + pageWidth + gap, margin);
    } else {
      // Empty placeholder for odd last page
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(margin + pageWidth + gap, margin, pageWidth, pageHeight);
      ctx.strokeStyle = '#d1d5db';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(margin + pageWidth + gap, margin, pageWidth, pageHeight);
      ctx.setLineDash([]);

      // "Empty" text
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${Math.max(16, pageHeight / 20)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Empty', margin + pageWidth + gap + pageWidth / 2, margin + pageHeight / 2);
    }

    return combinedCanvas;
  }, []);

  useEffect(() => {
    if (!pdfDoc) return;

    const renderItems = async () => {
      const baseScale = 1.5 * zoom;
      const isNupMode = pagesPerSheet > 1;

      // Determine what to render
      let itemsToRender;
      if (isNupMode) {
        // N-up mode: render combined sheets
        const sheetCount = Math.ceil(pdfDoc.numPages / pagesPerSheet);
        itemsToRender = Math.min(4, sheetCount);
      } else {
        // Normal mode: render individual pages
        itemsToRender = Math.min(4, pdfDoc.numPages);
      }

      const rendered = [];

      for (let i = 0; i < itemsToRender; i++) {
        try {
          const canvas = canvasRefs.current[i];
          if (!canvas) continue;

          if (isNupMode) {
            // N-up: Combine two pages
            const pageNum1 = i * pagesPerSheet + 1;
            const pageNum2 = i * pagesPerSheet + 2 <= pdfDoc.numPages ? i * pagesPerSheet + 2 : null;

            const canvas1 = await renderPageToCanvas(pageNum1, baseScale);
            const canvas2 = pageNum2 ? await renderPageToCanvas(pageNum2, baseScale) : null;

            if (canvas1) {
              const combinedCanvas = combinePages(canvas1, canvas2);
              if (combinedCanvas) {
                canvas.width = combinedCanvas.width;
                canvas.height = combinedCanvas.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(combinedCanvas, 0, 0);
                rendered.push(i);
              }
            }
          } else {
            // Normal mode: render single page
            const pageNum = i + 1;
            const pageCanvas = await renderPageToCanvas(pageNum, 2 * zoom);

            if (pageCanvas) {
              canvas.width = pageCanvas.width;
              canvas.height = pageCanvas.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(pageCanvas, 0, 0);
              rendered.push(i);
            }
          }
        } catch (error) {
          console.error(`Error rendering item ${i}:`, error);
        }
      }

      setRenderedItems(rendered);
    };

    renderItems();
  }, [pdfDoc, zoom, pagesPerSheet, renderPageToCanvas, combinePages]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  if (!file || !pdfDoc) return null;

  const isNupMode = pagesPerSheet > 1;
  const totalItems = isNupMode
    ? Math.min(4, Math.ceil(pdfDoc.numPages / pagesPerSheet))
    : Math.min(4, pdfDoc.numPages);

  const itemLabel = isNupMode ? 'Sheets' : 'Pages';

  return (
    <div className="mt-8 border-t pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {isNupMode && <Columns2 className="w-5 h-5 text-blue-600" />}
            PDF Preview (First {totalItems} {itemLabel})
          </h3>
          <p className="text-sm text-gray-500">
            {isNupMode
              ? `Side by Side View - ${pagesPerSheet} pages per sheet`
              : 'Development/Testing View - High Quality Render'
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5 text-gray-700" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors ml-2"
            title="Reset Zoom"
          >
            <RotateCcw className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      <div className={`grid gap-4 bg-gray-50 p-4 rounded-lg overflow-x-auto ${isNupMode
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}>
        {[...Array(totalItems)].map((_, index) => (
          <div key={index} className="flex flex-col items-center">
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <canvas
                ref={el => canvasRefs.current[index] = el}
                className="max-w-full h-auto"
                style={{
                  display: renderedItems.includes(index) ? 'block' : 'none'
                }}
              />
              {!renderedItems.includes(index) && (
                <div className={`flex items-center justify-center bg-gray-100 ${isNupMode ? 'w-full h-48' : 'w-full h-64'
                  }`}>
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">
                      {isNupMode
                        ? `Loading sheet ${index + 1}...`
                        : `Loading page ${index + 1}...`
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm font-medium text-gray-600 mt-2">
              {isNupMode
                ? `Sheet ${index + 1} (Pages ${index * pagesPerSheet + 1}-${Math.min(index * pagesPerSheet + pagesPerSheet, pdfDoc.numPages)})`
                : `Page ${index + 1}`
              }
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        <p>✓ High quality render ({isNupMode ? '1.5x' : '2x'} scale)</p>
        <p>✓ No pixel loss - Vector-based rendering</p>
      </div>
    </div>
  );
};

export default PDFPreview;
