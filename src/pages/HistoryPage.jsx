import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getJobsByIds } from '../utils/supabase'
import { Package, ArrowLeft, Clock, MapPin, Search, Trash2, Printer } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

const HistoryPage = () => {
  usePageTitle()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadOrderHistory()
  }, [])

  const loadOrderHistory = async () => {
    try {
      setLoading(true)
      const history = JSON.parse(localStorage.getItem('printget_order_history') || '[]')
      
      if (history.length === 0) {
        setOrders([])
        setLoading(false)
        return
      }

      const { data, error } = await getJobsByIds(history)
      if (error) throw new Error(error.message)
      
      setOrders(data)
    } catch (err) {
      console.error('Error loading history:', err)
      setError('Failed to load your order history. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your order history from this device?')) {
      localStorage.removeItem('printget_order_history')
      setOrders([])
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-md border border-green-200">Completed</span>
      case 'cancelled':
        return <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-md border border-red-200">Cancelled</span>
      case 'printing':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-md border border-blue-200 animate-pulse">Printing</span>
      default:
        return <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-md border border-yellow-200">Pending</span>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              My Orders
            </h1>
          </div>
          {orders.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear History</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-5 rounded-2xl border shadow-sm animate-pulse">
                <div className="flex justify-between mb-4">
                  <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-5 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center border border-red-100">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 sm:p-12 text-center mt-10">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-blue-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No past orders found</h2>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Your order history is stored locally on this device. You haven't placed any orders here recently.
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm inline-flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Find a Print Shop
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/status/${order.id}`}
                className="block bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-[0.99] group"
              >
                <div className="flex justify-between items-start mb-3 gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-base sm:text-lg truncate group-hover:text-blue-700 transition-colors">
                      {order.shops?.name || 'Unknown Shop'}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 flex items-center gap-1.5 mt-0.5 truncate">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{order.shops?.address || 'Address not available'}</span>
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {getStatusBadge(order.job_status)}
                    <span className="font-bold text-gray-900">{formatCurrency(order.total_cost)}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Package className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-700 truncate" title={order.filename}>
                      {order.filename}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
