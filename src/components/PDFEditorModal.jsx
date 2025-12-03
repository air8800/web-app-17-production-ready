import React, { Suspense, useEffect, useCallback, useState, useRef } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import PDFEditorPopup from './PDFEditorPopup'

const PDFEditorNew = React.lazy(() => import('./PDFEditorNew'))

const PDFEditorModal = ({
  isOpen,
  onClose,
  file,
  initialPageIndex = 0,
  onSave,
  pageSize,
  onPageSizeChange,
  colorMode,
  pagesPerSheet,
  selectedPages = [],
  onPageSelect = null
}) => {
  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [editingPage, setEditingPage] = useState(null)
  const [editingPageIndex, setEditingPageIndex] = useState(-1)
  const [editingPageNumber, setEditingPageNumber] = useState(-1)
  const [pagesData, setPagesData] = useState([])
  const [controllerRef, setControllerRef] = useState(null)
  const [applyEditRef, setApplyEditRef] = useState(null)
  
  const editorRef = useRef(null)

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && !editPopupOpen) {
      onClose()
    }
  }, [onClose, editPopupOpen])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, handleKeyDown])

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !editPopupOpen) {
      onClose()
    }
  }

  const handleSave = (data) => {
    if (onSave) {
      onSave(data)
    }
    onClose()
  }
  
  const handleEditPage = useCallback((pageIndex, pageData, controller, applyEdit) => {
    console.log('PDFEditorModal.handleEditPage called:', { pageIndex, pageData, controller: !!controller, applyEdit: !!applyEdit })
    if (pageData) {
      setEditingPage(pageData)
      setEditingPageIndex(pageIndex)
      setEditingPageNumber(pageData.pageNumber)
      setControllerRef(controller)
      setApplyEditRef(() => applyEdit)
      setEditPopupOpen(true)
      console.log('PDFEditorModal: Opening popup with editPopupOpen=true')
    } else {
      console.warn('PDFEditorModal: No pageData provided')
    }
  }, [])
  
  const handleCloseEditPopup = useCallback(() => {
    setEditPopupOpen(false)
    setEditingPage(null)
    setEditingPageIndex(-1)
    setEditingPageNumber(-1)
  }, [])
  
  const handleApply = useCallback((pageIndex, edits) => {
    setPagesData(prev => prev.map((p, idx) => 
      idx === pageIndex ? {
        ...p,
        editHistory: { 
          rotation: edits.rotation || 0, 
          scale: edits.scale || 100, 
          offsetX: 0, 
          offsetY: 0, 
          crop: edits.crop || null 
        },
        edited: true
      } : p
    ))
  }, [])
  
  const handleApplyAll = useCallback((edits) => {
    setPagesData(prev => prev.map(p => ({
      ...p,
      editHistory: { 
        rotation: edits.rotation || 0, 
        scale: edits.scale || 100, 
        offsetX: 0, 
        offsetY: 0, 
        crop: edits.crop || null 
      },
      edited: true
    })))
  }, [])

  if (!isOpen) return null

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] max-w-6xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit PDF</h2>
            <p className="text-sm text-gray-500">Make changes to your document</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors group"
            aria-label="Close editor"
          >
            <X className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-600 border-t-transparent mx-auto mb-3"></div>
                <p className="text-gray-600 text-sm">Loading editor...</p>
              </div>
            </div>
          }>
            <PDFEditorNew
              ref={editorRef}
              file={file}
              initialPageIndex={initialPageIndex}
              onSave={handleSave}
              onCancel={onClose}
              directPageEdit={true}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
              colorMode={colorMode}
              pagesPerSheet={pagesPerSheet}
              selectedPages={selectedPages}
              onPageSelect={onPageSelect}
              onEditPage={handleEditPage}
              onPagesLoaded={setPagesData}
            />
          </Suspense>
        </div>
      </div>
      
      <PDFEditorPopup
        isOpen={editPopupOpen}
        onClose={handleCloseEditPopup}
        page={editingPage}
        pageNumber={editingPageNumber}
        pageIndex={editingPageIndex}
        controller={controllerRef}
        applyEdit={applyEditRef}
        onApply={handleApply}
        onApplyAll={handleApplyAll}
        totalPages={pagesData.length || 1}
      />
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default PDFEditorModal
