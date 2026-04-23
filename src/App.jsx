import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

// Scrolls to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

import HomePage from './pages/HomePage'
import ShopPage from './pages/ShopPage'
import OrderPage from './pages/OrderPage'
import PaymentPage from './pages/PaymentPage'
import StatusPage from './pages/StatusPage'
import DesignMockup from './pages/DesignMockup'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import CookiePolicyPage from './pages/CookiePolicyPage'
import FAQPage from './pages/FAQPage'
import NotFoundPage from './pages/NotFoundPage'
import RefundPolicyPage from './pages/RefundPolicyPage'


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
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/design-mockup" element={<DesignMockup />} />
          <Route path="/shop/:shopId" element={<OrderPage />} />
          <Route path="/shop/:shopId/order" element={<OrderPage />} />
          <Route path="/payment/:jobId" element={<PaymentPage />} />
          <Route path="/status/:jobId" element={<StatusPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
      <Analytics />
      <SpeedInsights />
    </>
  )
}

export default App

