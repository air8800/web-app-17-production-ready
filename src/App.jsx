import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ShopPage from './pages/ShopPage'
import OrderPage from './pages/OrderPage'
import PaymentPage from './pages/PaymentPage'
import StatusPage from './pages/StatusPage'
import DesignMockup from './pages/DesignMockup'

import { logDetailedMemory } from './utils/memoryProfiler'

// Log baseline memory immediately on module load
console.log('🚀 [App Module] Loading...')
if (typeof window !== 'undefined' && performance.memory) {
  const mb = (b) => (b / 1024 / 1024).toFixed(1)
  console.log(`📊 [Module Load Baseline] JS Heap: ${mb(performance.memory.usedJSHeapSize)}MB / Total: ${mb(performance.memory.totalJSHeapSize)}MB`)
}

function App() {
  // Log detailed memory when App mounts (after React + Router initialized)
  useEffect(() => {
    console.log('🚀 [App] Mounted - React + Router ready')
    logDetailedMemory('App Startup Baseline (before any PDF)')
  }, [])

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/design-mockup" element={<DesignMockup />} />
          <Route path="/shop/:shopId" element={<OrderPage />} />
          <Route path="/shop/:shopId/order" element={<OrderPage />} />
          <Route path="/payment/:jobId" element={<PaymentPage />} />
          <Route path="/status/:jobId" element={<StatusPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>

    </>
  )
}

export default App
