/**
 * OPFS (Origin Private File System) Storage Utility
 * 
 * Saves large files to disk instead of RAM to reduce memory footprint.
 * This is critical for mobile devices with limited RAM.
 * 
 * Browser Support:
 * - Chrome 86+, Edge 86+, Firefox 111+, Safari 15.2+
 * - Falls back to RAM (Blob) on unsupported browsers
 */

/**
 * Check if OPFS is supported in the current browser
 */
export async function isOPFSSupported(): Promise<boolean> {
    try {
        // Check for secure context first (OPFS requires HTTPS or localhost)
        if (!window.isSecureContext) {
            console.warn('⚠️ [OPFS] Not available: Requires secure context (HTTPS or localhost)');
            console.warn('   💡 Tip: Access via http://localhost:3030 instead of IP address');
            return false;
        }

        if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
            console.warn('⚠️ [OPFS] Not available: Browser does not support File System API');
            return false;
        }

        // Try to actually get the directory to confirm it works
        await navigator.storage.getDirectory();
        console.log('✅ [OPFS] Available and ready for disk storage');
        return true;
    } catch (error) {
        console.warn('⚠️ [OPFS] Failed to initialize:', error);
        return false;
    }
}

/**
 * Save data to OPFS and return a disk-backed File object
 * This file does NOT consume RAM like a regular Blob would.
 * 
 * @param filename - Name for the file in OPFS
 * @param data - The file data (ArrayBuffer or Uint8Array)
 * @returns A File object backed by disk storage
 */
export async function saveToOPFS(
    filename: string,
    data: ArrayBuffer | Uint8Array
): Promise<File> {
    console.log(`💾 [OPFS] Saving ${(data.byteLength / 1024 / 1024).toFixed(2)}MB to disk...`);
    const startTime = performance.now();

    // Get the private file system root
    const root = await navigator.storage.getDirectory();

    // Create or overwrite the file
    const fileHandle = await root.getFileHandle(filename, { create: true });

    // Write data to the file (cast to any to avoid TypeScript strictness issues)
    const writable = await fileHandle.createWritable();
    await writable.write(data as unknown as ArrayBuffer);
    await writable.close();

    // Get a File object that references the disk file (NOT a RAM copy)
    const diskFile = await fileHandle.getFile();

    const elapsed = performance.now() - startTime;
    console.log(`✅ [OPFS] Saved to disk in ${elapsed.toFixed(0)}ms (0 MB RAM used)`);

    return diskFile;
}

/**
 * Delete a file from OPFS
 */
export async function deleteFromOPFS(filename: string): Promise<void> {
    try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(filename);
        console.log(`🗑️ [OPFS] Deleted: ${filename}`);
    } catch (error) {
        // File might not exist, ignore
        console.log(`⚠️ [OPFS] Could not delete ${filename}:`, error);
    }
}

/**
 * Clear all files from OPFS (cleanup on app exit or new upload)
 */
export async function clearOPFS(): Promise<void> {
    try {
        const root = await navigator.storage.getDirectory();
        // @ts-ignore - entries() is available but not in all TS definitions
        for await (const [name] of root.entries()) {
            await root.removeEntry(name);
            console.log(`🗑️ [OPFS] Cleared: ${name}`);
        }
    } catch (error) {
        console.log('⚠️ [OPFS] Could not clear storage:', error);
    }
}
