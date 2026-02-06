import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

// Premium Styling Injection
const injectDriverStyles = () => {
    if (document.getElementById('driver-custom-styles')) return

    const style = document.createElement('style')
    style.id = 'driver-custom-styles'
    style.innerHTML = `
    .driver-popover.driverjs-theme {
      background-color: #ffffff;
      color: #1e293b;
      border-radius: 16px;
      box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2);
      padding: 20px;
      max-width: 320px;
    }
    .driver-popover.driverjs-theme .driver-popover-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #2563eb;
    }
    .driver-popover.driverjs-theme .driver-popover-description {
      font-size: 14px;
      line-height: 1.5;
      color: #475569;
      margin-bottom: 16px;
    }
    .driver-popover.driverjs-theme button {
      background-color: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      text-shadow: none;
      transition: background-color 0.2s;
    }
    .driver-popover.driverjs-theme button:hover {
      background-color: #1d4ed8;
    }
    .driver-popover.driverjs-theme button.driver-popover-close-btn {
      color: #94a3b8;
      background: transparent;
    }
    .driver-popover.driverjs-theme button.driver-popover-close-btn:hover {
      color: #64748b;
      background: #f1f5f9;
    }
    
    /* Ensure the popover arrow is visible and styled */
    .driver-popover.driverjs-theme .driver-popover-arrow {
      border-width: 8px; 
    }
    /* Side: Top -> Arrow points down (Triangle points down) */
    .driver-popover.driverjs-theme.driver-popover-side-top .driver-popover-arrow {
      border-top-color: #ffffff;
      border-bottom-color: transparent;
      border-left-color: transparent;
      border-right-color: transparent;
    }
    /* Side: Bottom -> Arrow points up */
    .driver-popover.driverjs-theme.driver-popover-side-bottom .driver-popover-arrow {
      border-bottom-color: #ffffff;
      border-top-color: transparent;
      border-left-color: transparent;
      border-right-color: transparent;
    }
    /* Side: Left -> Arrow points right */
    .driver-popover.driverjs-theme.driver-popover-side-left .driver-popover-arrow {
      border-left-color: #ffffff;
      border-right-color: transparent;
      border-top-color: transparent;
      border-bottom-color: transparent;
    }
    /* Side: Right -> Arrow points left */
    .driver-popover.driverjs-theme.driver-popover-side-right .driver-popover-arrow {
      border-right-color: #ffffff;
      border-left-color: transparent;
      border-top-color: transparent;
      border-bottom-color: transparent;
    }
    
    /* Highlight Box Fix - ensure it covers the element */
    .driver-active-element {
        position: relative;
        z-index: 100004 !important;
    }
  `
    document.head.appendChild(style)
}

export const useTour = () => {
    const driverRef = useRef(null)

    useEffect(() => {
        injectDriverStyles()
    }, [])

    const runTour = (key, steps) => {
        const hasSeen = localStorage.getItem(`printflow_tour_${key}`)
        if (hasSeen) return

        // Set flag IMMEDIATELY before starting - simplistic but robust
        // This ensures it never runs again even if the user refreshes instantly
        try {
            localStorage.setItem(`printflow_tour_${key}`, 'true')
        } catch (e) {
            console.error('Failed to set localStorage', e)
        }

        driverRef.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: 'Got it',
            nextBtnText: 'Next',
            prevBtnText: 'Back',
            popoverClass: 'driverjs-theme',
            steps: steps
        })

        // Slight delay to allow UI to settle
        setTimeout(() => {
            driverRef.current.drive()
        }, 500)
    }

    // 1. Initial Welcome Tour (Upload Only)
    const startWelcomeTour = () => {
        runTour('welcome', [
            {
                element: '#upload-section',
                popover: {
                    title: 'Start Here',
                    description: 'Drag & drop your PDF or images here to begin.',
                    side: 'bottom',
                    align: 'center'
                }
            }
        ])
    }

    // 2. Post-Upload Tour (Edit Button + Settings)
    const startEditButtonTour = () => {
        runTour('post_upload', [
            {
                element: '#setting-paper-size',
                popover: {
                    title: '1. Paper Size',
                    description: 'Choose your preferred paper size (A4, Legal, etc.).',
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#setting-color-mode',
                popover: {
                    title: '2. Color Mode',
                    description: 'Select Black & White or Color printing.',
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#setting-pages-sheet',
                popover: {
                    title: '3. Pages Per Sheet',
                    description: 'Print multiple pages on a single sheet (N-up) to save paper.',
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#setting-print-type',
                popover: {
                    title: '4. Print Side',
                    description: 'Choose Single Sided or Double Sided (Front & Back).',
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#setting-copies',
                popover: {
                    title: '5. Copies',
                    description: 'Set the number of copies you need.',
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#edit-pages-btn',
                popover: {
                    title: 'Custom Selection',
                    description: 'Click here to select specific pages, crop content, or preview your file.',
                    side: 'bottom',
                    align: 'start'
                }
            }
        ])
    }

    // 3. Editor Modal Tour (Triggers when full editor opens)
    const startEditorTour = () => {
        runTour('editor_modal', [
            {
                element: '#pdf-editor-modal',
                popover: {
                    title: 'Full Editor',
                    description: 'Welcome to the full editor! Use the sidebar to find advanced tools.',
                    side: 'center',
                    align: 'center'
                }
            },
            {
                element: '#editor-sidebar',
                popover: {
                    title: 'Page Tools',
                    description: 'Use these tools to select, rotate, or crop individual pages.',
                    side: 'right',
                    align: 'start'
                }
            }
        ])
    }

    // 4. Sheet Editor Tour (Triggers when n-up sheet editor opens)
    const startSheetEditorTour = () => {
        runTour('sheet_editor', [
            {
                element: '#pdf-sheet-editor-modal',
                popover: {
                    title: 'Sheet Editor',
                    description: 'Here you can adjust the layout of specific pages on a sheet.',
                    side: 'center',
                    align: 'center'
                }
            }
        ])
    }

    // 5. Page Selector Tour (Triggers when Edit Pages is expanded)
    const startPageSelectorTour = () => {
        runTour('page_selector', [
            {
                element: '#page-selector-select-all',
                popover: {
                    title: 'Bulk Selection',
                    description: 'Quickly select all pages to apply changes.',
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#page-selector-search',
                popover: {
                    title: 'Find Pages',
                    description: 'Search for specific page numbers to jump to them.',
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#page-selector-grid',
                popover: {
                    title: 'Page Grid',
                    description: 'Click any page to select it, or use the "Edit" button on a page to modify it.',
                    side: 'top',
                    align: 'center'
                }
            }
        ])
    }

    // 6. Page Edit Popup Tour (Triggers when single page edit popup opens)
    const startEditPopupTour = () => {
        // Robust Helper to click tabs
        const clickTab = (id) => {
            const el = document.getElementById(id)
            if (el) {
                // Try native click
                el.click()
                // Try MouseEvent dispatch for robustness
                const event = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                })
                el.dispatchEvent(event)
            } else {
                console.warn(`[Tour] Tab not found: ${id}`)
            }
        }

        // Attempt to reset to Transform tab initially
        setTimeout(() => clickTab('edit-popup-tab-transform'), 100)

        const driverObj = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: 'Got it',
            nextBtnText: 'Next',
            prevBtnText: 'Back',
            popoverClass: 'driverjs-theme',
            onDestroy: () => {
                localStorage.setItem('printflow_tour_edit_popup', 'true')
            },
            steps: [
                {
                    element: '#edit-popup-rotate-right',
                    popover: {
                        title: 'Rotate',
                        description: 'Rotate the page 90 degrees to fix orientation.',
                        side: 'top',
                        align: 'center'
                    },
                    onHighlightStarted: () => {
                        // Redundant ensure transform tab
                        clickTab('edit-popup-tab-transform')
                    },
                    onNextClick: (el, step, { moveNext }) => {
                        clickTab('edit-popup-tab-crop') // Start switching early
                        setTimeout(() => {
                            moveNext()
                        }, 800)
                    }
                },
                {
                    element: '#edit-popup-tab-crop', // TARGET THE TAB: Always visible
                    popover: {
                        title: 'Crop',
                        description: 'Click this tab to access the cropping tool for precise adjustments.',
                        side: 'bottom',
                        align: 'center'
                    },
                    onHighlightStarted: () => {
                        // Still ensure the tab is clicked so the content shows
                        clickTab('edit-popup-tab-crop')
                    },
                    onPrevClick: (el, step, { movePrev }) => {
                        clickTab('edit-popup-tab-transform')
                        setTimeout(() => {
                            movePrev()
                        }, 800)
                    },
                    onNextClick: (el, step, { moveNext }) => {
                        moveNext()
                    }
                },
                {
                    element: '#edit-popup-apply-group',
                    popover: {
                        title: 'Apply Changes',
                        description: 'Save your changes for this page only, or choose "Apply to All" to update everything.',
                        side: 'top',
                        align: 'center'
                    },
                    onPrevClick: (el, step, { movePrev }) => {
                        clickTab('edit-popup-tab-crop')
                        setTimeout(() => {
                            movePrev()
                        }, 800)
                    }
                }
            ]
        })

        driverRef.current = driverObj

        // Check if seen
        const hasSeen = localStorage.getItem('printflow_tour_edit_popup')
        if (hasSeen) return

        // Set flag IMMEDIATELY before starting to ensure robustness
        try {
            localStorage.setItem('printflow_tour_edit_popup', 'true')
        } catch (e) {
            console.error('Failed to set localStorage', e)
        }

        setTimeout(() => {
            driverObj.drive()
        }, 400)
    }

    return {
        startWelcomeTour,
        startEditButtonTour,
        startEditorTour,
        startSheetEditorTour,
        startPageSelectorTour,
        startEditPopupTour
    }
}
