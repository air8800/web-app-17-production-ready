/**
 * Fast PDF Page Count Extractor
 * 
 * Extracts page count from PDF WITHOUT full parsing.
 * implements a multi-strategy approach:
 * 1. Trailer Jumping (Standard PDF structure)
 * 2. XMP Metadata Search (Scanned PDFs)
 * 3. Linearization Dictionary (Fast Web View)
 * 4. Greedy Regex Search (Last Logic Fallback)
 */

/**
 * MAIN: Extract page count using multiple strategies
 */
export async function extractPageCountFast(file: File): Promise<number | null> {
    const startTime = performance.now()
    console.log(`⚡ [FastPageCount] Starting extraction for ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)

    try {
        // STRATEGY 1: Trailer Jumping (Standard PDF structure)
        const trailerCount = await tryTrailerJump(file)
        if (trailerCount) {
            logSuccess('Trailer Jumping', trailerCount, startTime)
            return trailerCount
        }

        // STRATEGY 2: XMP Metadata (Best for Scanned PDFs)
        // Scanners often embed XMP metadata with page count in header
        const xmpCount = await tryXMPMetadata(file)
        if (xmpCount) {
            logSuccess('XMP Metadata', xmpCount, startTime)
            return xmpCount
        }

        // STRATEGY 3: Linearization Dictionary (Fast Web View)
        const linearCount = await tryLinearization(file)
        if (linearCount) {
            logSuccess('Linearization Dict', linearCount, startTime)
            return linearCount
        }

        // STRATEGY 4: Greedy Regex Search (The "Desperate" Fallback)
        console.log(`⚡ [FastPageCount] Standard strategies failed, trying greedy regex...`)
        const greedyCount = await tryGreedyRegex(file)
        if (greedyCount) {
            logSuccess('Greedy Regex', greedyCount, startTime)
            return greedyCount
        }

        console.log(`⚡ [FastPageCount] All strategies failed`)
        return null

    } catch (error) {
        console.warn(`⚡ [FastPageCount] Error:`, error)
        return null
    }
}

function logSuccess(strategy: string, count: number, startTime: number) {
    const elapsed = ((performance.now() - startTime)).toFixed(0)
    console.log(`⚡ [FastPageCount] SUCCESS via ${strategy}: ${count} pages (${elapsed}ms)`)
}

// ==========================================
// HELPERS
// ==========================================

async function readChunk(file: File, start: number, length: number): Promise<Uint8Array> {
    const end = Math.min(start + length, file.size)
    const chunk = file.slice(start, end)
    const buffer = await chunk.arrayBuffer()
    return new Uint8Array(buffer)
}

function bytesToString(bytes: Uint8Array): string {
    let result = ''
    for (let i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes[i])
    }
    return result
}

function extractNumberAfter(text: string, pattern: string): number | null {
    const regex = new RegExp(pattern + '\\s*(\\d+)', 'i')
    const match = text.match(regex)
    if (match) {
        return parseInt(match[1], 10)
    }
    return null
}

function extractObjRef(text: string, pattern: string): { objNum: number; genNum: number } | null {
    const regex = new RegExp(pattern + '\\s*(\\d+)\\s+(\\d+)\\s+R', 'i')
    const match = text.match(regex)
    if (match) {
        return { objNum: parseInt(match[1], 10), genNum: parseInt(match[2], 10) }
    }
    return null
}

// ==========================================
// STRATEGY IMPLEMENTATIONS
// ==========================================

async function tryTrailerJump(file: File): Promise<number | null> {
    try {
        // 1. Find startxref at end of file
        const tailSize = Math.min(2048, file.size)
        const tailBytes = await readChunk(file, file.size - tailSize, tailSize)
        const tailText = bytesToString(tailBytes)

        const startxrefPos = tailText.lastIndexOf('startxref')
        if (startxrefPos === -1) return null

        const afterStartxref = tailText.substring(startxrefPos + 9)
        const xrefOffsetMatch = afterStartxref.match(/\s*(\d+)/)
        if (!xrefOffsetMatch) return null

        const xrefOffset = parseInt(xrefOffsetMatch[1], 10)

        // 2. Read XRef/Trailer section
        const xrefSize = Math.min(50000, file.size - xrefOffset)
        const xrefBytes = await readChunk(file, xrefOffset, xrefSize)
        const xrefText = bytesToString(xrefBytes)

        // Try direct /Count in trailer
        let count = extractNumberAfter(xrefText, '/Count')
        if (count && count > 0) return count

        // 3. Find /Root -> /Pages -> /Count
        const rootRef = extractObjRef(xrefText, '/Root')
        if (!rootRef) return null

        // Find Root object definition
        const rootObjPattern = `${rootRef.objNum} ${rootRef.genNum} obj`
        let rootSection = ''

        // Check if root is in the xref chunk we already read
        const rootInXref = xrefText.indexOf(rootObjPattern)
        if (rootInXref !== -1) {
            rootSection = xrefText.substring(rootInXref)
        } else {
            // simplified: we skip complex search logic here to allow fallbacks to take over
            return null
        }

        const pagesRef = extractObjRef(rootSection, '/Pages')
        if (!pagesRef) return null

        const pagesObjPattern = `${pagesRef.objNum} ${pagesRef.genNum} obj`

        // 4. Find Pages object (likely near start of file)
        const headBytes = await readChunk(file, 0, 100000)
        const headText = bytesToString(headBytes)

        const pagesPos = headText.indexOf(pagesObjPattern)
        if (pagesPos !== -1) {
            const pagesSection = headText.substring(pagesPos, pagesPos + 1000)
            return extractNumberAfter(pagesSection, '/Count')
        }

        const pagesInXref = xrefText.indexOf(pagesObjPattern)
        if (pagesInXref !== -1) {
            const pagesSection = xrefText.substring(pagesInXref, pagesInXref + 1000)
            return extractNumberAfter(pagesSection, '/Count')
        }

        return null
    } catch {
        return null
    }
}

async function tryXMPMetadata(file: File): Promise<number | null> {
    try {
        const headBytes = await readChunk(file, 0, 100000)
        const headText = bytesToString(headBytes)

        const xmpMatch = headText.match(/<(?:xmpTPg|pdf|xmp):NPages>(\d+)<\//i) ||
            headText.match(/NPages="(\d+)"/i)

        if (xmpMatch) {
            return parseInt(xmpMatch[1], 10)
        }
        return null
    } catch {
        return null
    }
}

async function tryLinearization(file: File): Promise<number | null> {
    try {
        const headBytes = await readChunk(file, 0, 4096)
        const headText = bytesToString(headBytes)

        const linearMatch = headText.match(/\/Linearized\s+[\d.]+[^>]*\/N\s+(\d+)/)
        if (linearMatch) {
            return parseInt(linearMatch[1], 10)
        }

        const nMatch = headText.match(/\/N\s+(\d+)/) && headText.includes('/Linearized')
        if (nMatch) {
            // @ts-ignore
            return parseInt(nMatch[1], 10)
        }

        return null
    } catch {
        return null
    }
}

async function tryGreedyRegex(file: File): Promise<number | null> {
    try {
        // Read Start (200KB) and End (200KB)
        const headBytes = await readChunk(file, 0, 200000)
        const tailBytes = await readChunk(file, Math.max(0, file.size - 200000), 200000)

        const fullText = bytesToString(headBytes) + "\n" + bytesToString(tailBytes)

        // Find all /Count N pattern
        const matches = fullText.matchAll(/\/Count\s+(\d+)/g)
        let maxCount = 0

        for (const match of matches) {
            const num = parseInt(match[1], 10)
            // Filter crazy values (e.g. byte offsets mistaken for counts)
            // Valid page count usually < 50000 and > 0
            if (num > 0 && num < 50000) {
                // We take the LARGEST count found, because /Count 5 might be a kid node,
                // but /Count 189 is the root node.
                if (num > maxCount) maxCount = num
            }
        }

        return maxCount > 0 ? maxCount : null
    } catch {
        return null
    }
}

/**
 * Check if PDF is linearized
 */
export async function isPdfLinearized(file: File): Promise<boolean> {
    try {
        const headBytes = await readChunk(file, 0, 1024)
        const headText = bytesToString(headBytes)
        return headText.includes('/Linearized')
    } catch {
        return false
    }
}
