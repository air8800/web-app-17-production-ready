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
import HistoryPage from './pages/HistoryPage'
import DesignMockup from './pages/DesignMockup'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import CookiePolicyPage from './pages/CookiePolicyPage'
import FAQPage from './pages/FAQPage'
import NotFoundPage from './pages/NotFoundPage'
import RefundPolicyPage from './pages/RefundPolicyPage'
import DesktopAuthCallbackPage from './pages/DesktopAuthCallbackPage'
import InstallPrompt from './components/InstallPrompt'

function App() {
  useEffect(() => {

    // Initialize Unique Device ID for tracking history/preferences without login
    if (typeof window !== 'undefined') {
      let deviceId = localStorage.getItem('printget_device_id')
      if (!deviceId) {
        deviceId = `pg_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`
        localStorage.setItem('printget_device_id', deviceId)
      } else {
      }
    }
  }, [])

  return (
    <>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/design-mockup" element={<DesignMockup />} />
          <Route path="/shop/:shopId" element={<OrderPage />} />
          <Route path="/shop/:shopId/order" element={<OrderPage />} />
          <Route path="/payment/:jobId" element={<PaymentPage />} />
          <Route path="/status/:jobId" element={<StatusPage />} />
          <Route path="/auth/desktop-callback" element={<DesktopAuthCallbackPage />} />
          <Route path="/history" element={<HistoryPage />} />
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
      <Analytics debug={false} />
      <SpeedInsights debug={false} />
      <InstallPrompt />
    </>
  )
}

export default App

