import { PDFDocument, PageSizes } from 'pdf-lib';
import { isOPFSSupported, saveToOPFS } from '../opfs';

export interface NormalizeOptions {
  onProgress?: (progress: number, message: string) => void;
  skipIfA4?: boolean;
  tolerance?: number;
}

export interface NormalizeResult {
  normalizedFile: File;
  wasNormalized: boolean;
  pageCount: number;
  orientations: ('portrait' | 'landscape')[];
}

const A4_PORTRAIT = PageSizes.A4;
const A4_LANDSCAPE = [PageSizes.A4[1], PageSizes.A4[0]] as [number, number];

const A4_TOLERANCE = 20;

function isA4Size(width: number, height: number, tolerance: number = A4_TOLERANCE): boolean {
  const isPortrait =
    Math.abs(width - A4_PORTRAIT[0]) <= tolerance &&
    Math.abs(height - A4_PORTRAIT[1]) <= tolerance;

  const isLandscape =
    Math.abs(width - A4_LANDSCAPE[0]) <= tolerance &&
    Math.abs(height - A4_LANDSCAPE[1]) <= tolerance;

  return isPortrait || isLandscape;
}

function detectOptimalOrientation(
  pageWidth: number,
  pageHeight: number
): 'portrait' | 'landscape' {
  if (pageWidth > pageHeight) {
    return 'landscape';
  }
  return 'portrait';
}

function getA4Dimensions(orientation: 'portrait' | 'landscape'): [number, number] {
  return orientation === 'portrait' ? A4_PORTRAIT : A4_LANDSCAPE;
}

/**
 * Lightweight check using pdf.js chunked loading to detect if PDF is already A4
 * This avoids loading the entire file into memory before checking
 */
async function checkIfA4WithPdfJs(file: File, tolerance: number): Promise<{ allA4: boolean; pageCount: number }> {
  // Dynamic import to avoid circular dependencies
  const pdfjsLib = await import('pdfjs-dist');

  const fileSize = file.size;
  const CHUNK_SIZE = 65536; // 64KB chunks

  // Read only first chunk for header
  const initialChunk = file.slice(0, Math.min(CHUNK_SIZE, fileSize));
  const initialData = new Uint8Array(await initialChunk.arrayBuffer());

  // Create range transport for chunked loading
  const transport = new pdfjsLib.PDFDataRangeTransport(fileSize, initialData);

  transport.requestDataRange = async (begin: number, end: number) => {
    const chunk = file.slice(begin, end);
    const data = new Uint8Array(await chunk.arrayBuffer());
    transport.onDataRange(begin, data);
  };

  try {
    const pdf = await pdfjsLib.getDocument({
      range: transport,
      length: fileSize,
      disableAutoFetch: true,
      disableStream: true
    }).promise;

    const pageCount = pdf.numPages;

    // Check first few pages (most PDFs have consistent dimensions)
    const pagesToCheck = Math.min(3, pageCount);

    for (let i = 1; i <= pagesToCheck; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });

      if (!isA4Size(viewport.width, viewport.height, tolerance)) {
        await pdf.destroy();
        return { allA4: false, pageCount };
      }
    }

    await pdf.destroy();
    return { allA4: true, pageCount };
  } catch (error) {
    console.warn('⚠️ pdf.js pre-check failed, falling back to full load:', error);
    return { allA4: false, pageCount: 0 };
  }
}

export async function normalizePdfToA4(
  file: File,
  options: NormalizeOptions = {}
): Promise<NormalizeResult> {
  const { onProgress, skipIfA4 = true, tolerance = A4_TOLERANCE } = options;

  try {
    onProgress?.(0, 'Checking PDF dimensions...');

    // OPTIMIZATION: Use pdf.js (chunked) to check if PDF is already A4 BEFORE loading into pdf-lib
    // This avoids the 250MB memory spike for files that don't need normalization
    if (skipIfA4) {
      const isAlreadyA4 = await checkIfA4WithPdfJs(file, tolerance);
      if (isAlreadyA4.allA4) {
        console.log('ℹ️ PDF already A4-sized (detected via lightweight check), skipping normalization');
        onProgress?.(100, 'PDF already A4-sized');
        return {
          normalizedFile: file,
          wasNormalized: false,
          pageCount: isAlreadyA4.pageCount,
          orientations: Array(isAlreadyA4.pageCount).fill('portrait'),
        };
      }
      console.log(`📐 PDF needs normalization (${isAlreadyA4.pageCount} pages)`);
    }

    onProgress?.(5, 'Loading PDF for normalization...');

    let arrayBuffer: ArrayBuffer | null = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    // CRITICAL (Memory): Release input buffer immediately after parsing
    arrayBuffer = null;

    const pageCount = pdfDoc.getPageCount();
    const orientations: ('portrait' | 'landscape')[] = [];

    // NOTE: A4 check already done with pdf.js (lightweight chunked loading)
    // If we reach here, the PDF needs normalization

    onProgress?.(10, `Normalizing ${pageCount} pages to A4...`);

    console.log(`🔄 Starting normalization of ${pageCount} pages...`);

    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);

      const rotation = page.getRotation().angle;
      const isRotated90or270 = rotation === 90 || rotation === 270;

      const cropBox = page.getCropBox();
      const mediaBox = page.getMediaBox();

      const box = cropBox || mediaBox;
      const boxX = box.x;
      const boxY = box.y;
      const boxWidth = box.width;
      const boxHeight = box.height;

      const unrotatedWidth = isRotated90or270 ? boxHeight : boxWidth;
      const unrotatedHeight = isRotated90or270 ? boxWidth : boxHeight;

      const visualWidth = isRotated90or270 ? boxHeight : boxWidth;
      const visualHeight = isRotated90or270 ? boxWidth : boxHeight;

      const orientation = detectOptimalOrientation(visualWidth, visualHeight);
      orientations.push(orientation);

      // Removed verbose per-page logging for cleaner console

      const [a4VisualWidth, a4VisualHeight] = getA4Dimensions(orientation);

      const a4UnrotatedWidth = isRotated90or270 ? a4VisualHeight : a4VisualWidth;
      const a4UnrotatedHeight = isRotated90or270 ? a4VisualWidth : a4VisualHeight;

      const scaleX = a4UnrotatedWidth / unrotatedWidth;
      const scaleY = a4UnrotatedHeight / unrotatedHeight;
      const baseScale = Math.min(scaleX, scaleY);

      const scale = baseScale * 0.95;

      const scaledUnrotatedWidth = unrotatedWidth * scale;
      const scaledUnrotatedHeight = unrotatedHeight * scale;

      const centeringOffsetX = (a4UnrotatedWidth - scaledUnrotatedWidth) / 2;
      const centeringOffsetY = (a4UnrotatedHeight - scaledUnrotatedHeight) / 2;

      // Scaling applied silently for performance

      page.translateContent(-boxX, -boxY);

      page.scaleContent(scale, scale);

      page.translateContent(centeringOffsetX, centeringOffsetY);

      page.setMediaBox(0, 0, a4UnrotatedWidth, a4UnrotatedHeight);
      page.setCropBox(0, 0, a4UnrotatedWidth, a4UnrotatedHeight);

      // Page normalized (silent)


      try {
        page.setTrimBox(0, 0, a4UnrotatedWidth, a4UnrotatedHeight);
        page.setBleedBox(0, 0, a4UnrotatedWidth, a4UnrotatedHeight);
      } catch {
        // TrimBox/BleedBox not present or not settable
      }

      const progress = 10 + ((i + 1) / pageCount) * 80;
      onProgress?.(
        progress,
        `Normalizing page ${i + 1}/${pageCount} (${orientation})...`
      );

      if (i % 10 === 0 && i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    onProgress?.(90, 'Finalizing PDF...');

    let normalizedBytes: Uint8Array | null = await pdfDoc.save({
      useObjectStreams: true,
    });

    const timestamp = Date.now();
    const originalName = file.name.replace(/\.pdf$/i, '');
    const normalizedFileName = `${originalName}_normalized_${timestamp}.pdf`;

    let normalizedFile: File;

    // OPTIMIZATION: Use OPFS (disk storage) instead of RAM for large files
    // This prevents the 900MB RAM spike on mobile devices
    if (await isOPFSSupported()) {
      console.log('💾 [OPFS] Saving normalized PDF to disk (saves ~250MB RAM)...');
      // saveToOPFS returns a File object that is DISK-BACKED (not in RAM)
      // DO NOT wrap it in new File() - that would copy it back to RAM!
      normalizedFile = await saveToOPFS(normalizedFileName, normalizedBytes);
      console.log('✅ [OPFS] Using disk-backed file directly (0 MB RAM)');
    } else {
      console.log('⚠️ OPFS not supported, using RAM-based Blob (higher memory usage)');
      const normalizedBlob = new Blob([new Uint8Array(normalizedBytes)], { type: 'application/pdf' });
      normalizedFile = new File([normalizedBlob], normalizedFileName, {
        type: 'application/pdf',
        lastModified: timestamp,
      });
    }

    const originalSize = (file.size / 1024 / 1024).toFixed(2);
    const newSize = (normalizedFile.size / 1024 / 1024).toFixed(2);
    console.log(`✅ Normalization complete: ${pageCount} pages`);
    console.log(`📐 Orientations: ${orientations.join(', ')}`);
    console.log(`📦 File size: ${originalSize} MB → ${newSize} MB`);

    onProgress?.(100, 'Normalization complete!');

    // CRITICAL: Help garbage collection by nullifying large objects
    // This can free 250MB+ of memory for large PDFs
    console.log('🧹 Cleaning up normalization memory...');
    // @ts-ignore - intentionally clearing for GC
    pdfDoc.context = null;
    normalizedBytes = null;

    return {
      normalizedFile,
      wasNormalized: true,
      pageCount,
      orientations,
    };
  } catch (error) {
    console.error('Error normalizing PDF to A4:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to normalize PDF: ${errorMessage}`);
  }
}
