/**
 * Comprehensive Memory Profiler for debugging browser memory usage
 */

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2)
const kb = (bytes) => (bytes / 1024).toFixed(2)

function estimateDataUrlSize(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return 0
    return dataUrl.length * 2 
}

function estimateCanvasMemory(canvas) {
    if (!canvas) return 0
    return canvas.width * canvas.height * 4
}

function getAllCanvases() {
    const canvases = document.querySelectorAll('canvas')
    let totalMemory = 0
    const details = []

    canvases.forEach((canvas, i) => {
        const mem = estimateCanvasMemory(canvas)
        totalMemory += mem
        if (mem > 100000) { 
            details.push({
                index: i,
                size: `${canvas.width}x${canvas.height}`,
                memory: `${kb(mem)}KB`,
                id: canvas.id || '(no id)'
            })
        }
    })

    return { count: canvases.length, totalMemory, details }
}

function getAllImages() {
    const images = document.querySelectorAll('img')
    let totalEstimated = 0
    let dataUrlCount = 0
    let blobUrlCount = 0

    images.forEach((img) => {
        const src = img.src || ''
        if (src.startsWith('data:')) {
            dataUrlCount++
            totalEstimated += estimateDataUrlSize(src)
        } else if (src.startsWith('blob:')) {
            blobUrlCount++
            totalEstimated += (img.naturalWidth || 100) * (img.naturalHeight || 100) * 4
        }
    })

    return {
        total: images.length,
        dataUrlCount,
        blobUrlCount,
        estimatedMemory: totalEstimated
    }
}

export function logDetailedMemory(label = 'Memory Profile', extras = {}) {
    if (!performance.memory) return null

    const jsHeap = performance.memory.usedJSHeapSize
    const canvasInfo = getAllCanvases()
    const imageInfo = getAllImages()

    const totalEstimate = jsHeap + canvasInfo.totalMemory + imageInfo.estimatedMemory + (extras.pdfArrayBuffer || 0)

    return {
        jsHeap,
        canvases: canvasInfo,
        images: imageInfo,
        totalEstimate
    }
}

export function trackMemoryOverTime(label) {
    if (!performance.memory) return null
    return {
        time: Date.now(),
        label,
        jsHeap: performance.memory.usedJSHeapSize,
        canvases: getAllCanvases().totalMemory,
        images: getAllImages().estimatedMemory
    }
}

export default { logDetailedMemory, trackMemoryOverTime }
