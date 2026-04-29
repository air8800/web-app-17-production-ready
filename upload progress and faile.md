# Upload Progress and Failure Handling Summary

This document explains the technical implementation of the upload progress tracking and failure recovery (resumption) in the PrintGet Web Application.

## 1. Background Upload Progress
To ensure a "Zero Wait" experience, we start the file upload the moment a user selects a file or finishes an edit.

*   **Global Progress Store**: We use a `Zustand` store (`uploadStore.js`) to bridge the gap between `OrderPage` (where the upload starts) and `StatusPage` (where the user monitors it).
*   **Progress Tracking**: The `tus-js-client` provides real-time byte-level progress, which is fed into the global store and synchronized with the browser's `localStorage`.
*   **Persistence**: Even if the user closes the tab and reopens it from history, the status page retrieves the "last known progress" from `localStorage` while it reconnects to the server.

## 2. Failure Recovery (Resumption)
If an upload is interrupted due to a network error, browser crash, or accidental refresh, we use **TUS Resumable Uploads** to recover.

### How it works:
1.  **Unique Session ID**: Each upload session is assigned a consistent filename (e.g., `shopId/timestamp_filename.pdf`).
2.  **Metadata Persistence**: This unique filename is saved to `localStorage` linked to the specific Job ID.
3.  **TUS Fingerprinting**: When you click "Resume" and select the file, the system uses the saved filename to re-identify the previous upload on the server.
4.  **Byte-Level Continuity**: TUS queries the server to see how many bytes were already received. It then skips those bytes and continues from the exact failure point (e.g., jumping from 0% back to 45% instantly).

## 3. Desktop App Integration
To prevent errors in the shop's desktop app:
*   **Sentinel URL**: While a file is still uploading, we set the `file_url` in the database to `__uploading__`.
*   **Silence Filter**: The desktop app is configured to completely ignore any order where the URL is `__uploading__`. This ensures the shop operator only sees and hears about orders that are 100% ready to print.

## 4. Key Functions Involved
*   `uploadFileChunked`: The core engine using `tus-js-client`.
*   `handleResumeUpload`: The logic in `StatusPage.jsx` that reconnects existing files to their previous sessions.
*   `sanitizeFilename`: Ensures filenames are safe for storage while remaining consistent for resumption.

---

## 5. Recent Issues & Troubleshooting (Resolved)

During the implementation of the resumption logic, we encountered and fixed several critical issues with background uploading:

*   **Issue: Background Upload "Turning Off" (Silent Crash)**
    *   **Cause**: When users selected images or edited files, the resulting "Blob" object occasionally lacked a `.name` property. The `sanitizeFilename` function would then crash, stopping the background process silently.
    *   **Fix**: Added a fallback name (`document.pdf`) and forced the filename to a string before sanitization to prevent crashes.

*   **Issue: Resumption Starting from 0%**
    *   **Cause**: The system was generating a new timestamped filename every time an upload was restarted, making the server treat it as a new file.
    *   **Fix**: Implemented `localStorage` persistence for the original filename and added a **Custom TUS Fingerprint** that uses the exact Order ID to ensure the session is recovered.

*   **Issue: App-wide Upload Freeze**
    *   **Cause**: A duplicate code block was accidentally left outside of the `uploadFileChunked` function during an automated edit, causing a JavaScript syntax error.
    *   **Fix**: Cleaned up the code structure and added `try/catch` blocks to ensure that even if one upload fails, the rest of the app continues to function.

---
**Status**: Robust resumption enabled. Background uploading fully restored and hardened.

