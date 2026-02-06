/**
 * Comprehensive Memory Profiler for debugging browser memory usage
 * This tracks everything we can measure from JavaScript
 */

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2)
const kb = (bytes) => (bytes / 1024).toFixed(2)

/**
 * Estimate size of a data URL string
 */
function estimateDataUrlSize(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return 0
    // Base64 is ~33% larger than binary, so actual binary ≈ dataUrl.length * 0.75
    // But the string itself uses 2 bytes per char in JS
    return dataUrl.length * 2 // String memory in JS (UTF-16)
}

/**
 * Estimate canvas memory usage
 */
function estimateCanvasMemory(canvas) {
    if (!canvas) return 0
    // Canvas uses 4 bytes per pixel (RGBA)
    return canvas.width * canvas.height * 4
}

/**
 * Get all canvases in the document
 */
function getAllCanvases() {
    const canvases = document.querySelectorAll('canvas')
    let totalMemory = 0
    const details = []

    canvases.forEach((canvas, i) => {
        const mem = estimateCanvasMemory(canvas)
        totalMemory += mem
        if (mem > 100000) { // Only log canvases > 100KB
            details.push({
                index: i,
                size: `${canvas.width}x${canvas.height}`,
                memory: `${kb(mem)}KB`,
                id: canvas.id || '(no id)',
                class: canvas.className || '(no class)'
            })
        }
    })

    return { count: canvases.length, totalMemory, details }
}

/**
 * Get all images in the document
 */
function getAllImages() {
    const images = document.querySelectorAll('img')
    let totalEstimated = 0
    let dataUrlCount = 0
    let blobUrlCount = 0
    let externalCount = 0

    images.forEach((img) => {
        const src = img.src || ''
        if (src.startsWith('data:')) {
            dataUrlCount++
            totalEstimated += estimateDataUrlSize(src)
        } else if (src.startsWith('blob:')) {
            blobUrlCount++
            // Can't measure blob size directly, estimate from natural dimensions
            totalEstimated += (img.naturalWidth || 100) * (img.naturalHeight || 100) * 4
        } else if (src) {
            externalCount++
        }
    })

    return {
        total: images.length,
        dataUrlCount,
        blobUrlCount,
        externalCount,
        estimatedMemory: totalEstimated
    }
}

/**
 * Measure size of an object (rough estimate)
 */
function roughSizeOfObject(object) {
    const objectList = new Set()
    const stack = [object]
    let bytes = 0

    while (stack.length) {
        const value = stack.pop()
        if (value === null || value === undefined) continue

        if (typeof value === 'boolean') {
            bytes += 4
        } else if (typeof value === 'string') {
            bytes += value.length * 2
        } else if (typeof value === 'number') {
            bytes += 8
        } else if (typeof value === 'object' && !objectList.has(value)) {
            objectList.add(value)

            if (value instanceof ArrayBuffer) {
                bytes += value.byteLength
            } else if (ArrayBuffer.isView(value)) {
                bytes += value.byteLength
            } else if (value instanceof Blob) {
                bytes += value.size
            } else {
                for (const key in value) {
                    if (Object.prototype.hasOwnProperty.call(value, key)) {
                        bytes += key.length * 2 // Key string
                        stack.push(value[key])
                    }
                }
            }
        }
    }
    return bytes
}

/**
 * Main memory profiler function
 */
export function logDetailedMemory(label = 'Memory Profile', extras = {}) {
    console.group(`📊 ${label}`)

    // 1. JS Heap Memory (Chrome only)
    if (performance.memory) {
        const mem = performance.memory
        console.log(`🧠 JS Heap:`)
        console.log(`   Used: ${mb(mem.usedJSHeapSize)}MB`)
        console.log(`   Total: ${mb(mem.totalJSHeapSize)}MB`)
        console.log(`   Limit: ${mb(mem.jsHeapSizeLimit)}MB`)
    } else {
        console.log(`🧠 JS Heap: Not available (Chrome only)`)
    }

    // 2. Canvas Memory
    const canvasInfo = getAllCanvases()
    console.log(`🎨 Canvases:`)
    console.log(`   Count: ${canvasInfo.count}`)
    console.log(`   Est. Memory: ${mb(canvasInfo.totalMemory)}MB`)
    if (canvasInfo.details.length > 0) {
        console.log(`   Large canvases:`, canvasInfo.details)
    }

    // 3. Images
    const imageInfo = getAllImages()
    console.log(`🖼️ Images:`)
    console.log(`   Total: ${imageInfo.total}`)
    console.log(`   Data URLs: ${imageInfo.dataUrlCount}`)
    console.log(`   Blob URLs: ${imageInfo.blobUrlCount}`)
    console.log(`   External: ${imageInfo.externalCount}`)
    console.log(`   Est. Memory: ${mb(imageInfo.estimatedMemory)}MB`)

    // 4. Extra tracking from caller
    if (extras.pdfArrayBuffer) {
        console.log(`📄 PDF ArrayBuffer: ${mb(extras.pdfArrayBuffer)}MB`)
    }

    if (extras.pageProxies !== undefined) {
        console.log(`📑 PDF Page Proxies: ${extras.pageProxies} loaded`)
    }

    if (extras.thumbnailCache) {
        console.log(`🖼️ Thumbnail Cache:`)
        console.log(`   Entries: ${extras.thumbnailCache.count}`)
        console.log(`   Est. Size: ${mb(extras.thumbnailCache.size)}MB`)
    }

    if (extras.previewCache) {
        console.log(`🎞️ Preview Cache:`)
        console.log(`   Entries: ${extras.previewCache.count}`)
        console.log(`   Est. Size: ${mb(extras.previewCache.size)}MB`)
    }

    if (extras.statePages) {
        console.log(`📋 React State Pages: ${extras.statePages}`)
    }

    if (extras.dataUrlsInState) {
        console.log(`🔗 Data URLs in State: ${mb(extras.dataUrlsInState)}MB`)
    }

    // 5. Summary estimate
    const totalEstimate =
        (performance.memory?.usedJSHeapSize || 0) +
        canvasInfo.totalMemory +
        imageInfo.estimatedMemory +
        (extras.pdfArrayBuffer || 0)

    console.log(`─────────────────────────────`)
    console.log(`📈 TOTAL MEASURABLE: ~${mb(totalEstimate)}MB`)
    console.log(`⚠️ Note: Real tab memory includes pdf.js internals, GPU buffers, and browser overhead`)

    console.groupEnd()

    return {
        jsHeap: performance.memory?.usedJSHeapSize || 0,
        canvases: canvasInfo,
        images: imageInfo,
        totalEstimate
    }
}

/**
 * Track memory over time (call this periodically)
 */
let memoryHistory = []
export function trackMemoryOverTime(label) {
    const snapshot = {
        time: Date.now(),
        label,
        jsHeap: performance.memory?.usedJSHeapSize || 0,
        canvases: getAllCanvases().totalMemory,
        images: getAllImages().estimatedMemory
    }
    memoryHistory.push(snapshot)

    // Keep only last 50 snapshots
    if (memoryHistory.length > 50) {
        memoryHistory = memoryHistory.slice(-50)
    }

    return snapshot
}

/**
 * Print memory history as a table
 */
export function printMemoryHistory() {
    console.table(memoryHistory.map(s => ({
        label: s.label,
        jsHeap: `${mb(s.jsHeap)}MB`,
        canvases: `${mb(s.canvases)}MB`,
        images: `${mb(s.images)}MB`,
        total: `${mb(s.jsHeap + s.canvases + s.images)}MB`
    })))
}

/**
 * Expose globally for debugging in console
 */
if (typeof window !== 'undefined') {
    window.memoryProfiler = {
        log: logDetailedMemory,
        track: trackMemoryOverTime,
        history: printMemoryHistory,
        getAllCanvases,
        getAllImages
    }
    console.log('💾 Memory profiler loaded. Use window.memoryProfiler.log() in console.')
}

export default { logDetailedMemory, trackMemoryOverTime, printMemoryHistory }
