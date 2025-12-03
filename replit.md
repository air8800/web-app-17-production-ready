# PrintFlow Pro - Web Application

## Overview
PrintFlow Pro is a modern React web application designed to connect users with local print shops. It enables users to upload documents (PDFs and images), customize print settings, receive instant pricing, and place orders for local pickup. The project aims to streamline the print ordering process, offering advanced editing capabilities for both PDFs and images, real-time pricing, and order tracking, with a business vision to simplify and enhance the print ordering experience.

## User Preferences
No specific user preferences were provided in the original document.

## System Architecture
PrintFlow Pro is built with a React 18 frontend using TypeScript and Vite 5, styled with Tailwind CSS, and uses React Router v6 for navigation and Zustand for state management. PDF processing is handled by `pdf-lib` and `pdfjs-dist`. The backend and database are powered by Supabase, utilizing PostgreSQL, Storage, and Realtime features.

**Key Features:**
- PDF & Image Upload with drag-and-drop.
- Advanced PDF Editor supporting rotation, cropping, page selection, and N-up printing.
- Advanced Image Editor for brightness, contrast, scaling, and cropping.
- Real-time pricing calculations based on print customization.
- Print customization options including paper size, color mode, duplex printing, and copies.
- Order tracking with real-time status updates.
- Mobile-first responsive design.
- Performance optimizations through lazy loading and efficient canvas operations.

**Project Structure and PDF Editor Architecture:**
The application follows a modular adapter system for PDF processing, transitioning to a `pdf2/` architecture for improved maintainability and separation of concerns. This includes `edits/`, `services/`, `state/`, `ui/`, and `controller/` modules. The PDF editor's design principle is "VISUAL PREVIEW ONLY," with actual rendering and transformation by a desktop print engine. The system addresses cross-component coordination using a synchronous blocking flag to prevent concurrent `pdf.js` canvas access. UI logic for the PDF editor is extracted into modular `pdf2/ui/` files. The transformation pipeline adheres to a strict order: CROP → ROTATE → SCALE → OFFSET.

The PDF editor now opens as a separate popup modal (`PDFEditorModal.jsx`) for enhanced user experience, especially on mobile, maximizing preview area with minimal controls. The `CropOverlay` component provides interactive cropping with coordinate transformation, handling rotations and scales, and supporting nested crops. The system employs a "fixed paper" rendering concept where the page boundary stays fixed, and content transforms within it.

**Coordinate Transform System (pdf2/ui/coordinateTransforms.ts):**
- `getContentBounds()`: Calculates where rotated/scaled content appears on canvas. Allows bounds to extend beyond [0,1] when scale > 100%.
- `forwardTransformBox()`: Transforms from content space to screen space (aspect-ratio aware).
- `inverseTransformBox()`: Transforms from screen space back to content space.
- Auto-fit scale is always calculated for 90°/270° rotations, regardless of user scale.

**Thumbnail Refresh System:**
- `ModernAdapter.refreshThumbnail(pageNum, transforms)`: Invalidates cache and regenerates thumbnail with applied transforms.
- `ModernAdapter.refreshAllThumbnails(totalPages, transforms)`: Batch refreshes all thumbnails.
- Thumbnails automatically update in the page list after Apply/Apply All in the editor.

**Environment Configuration:**
The application requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.

## External Dependencies
- **Frontend Framework:** React 18
- **Build Tool:** Vite 5
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **State Management:** Zustand
- **PDF Processing Libraries:** `pdf-lib`, `pdfjs-dist`
- **Backend & Database:** Supabase (PostgreSQL, Storage, Realtime)
- **Icons:** Lucide React
- **Notifications:** React Hot Toast