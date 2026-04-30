import React from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft, Home, Search } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

const NotFoundPage = () => {
    usePageTitle({
        title: 'Page Not Found (404)',
        description: 'The page you are looking for does not exist. Return to PrintGet home to find a print shop near you.'
    })

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium hidden sm:inline">Back</span>
                    </Link>
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <Printer className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-bold text-gray-900">
                            Print<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500">Get</span>
                        </span>
                    </Link>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center px-4 py-20 pb-32">
                <div className="max-w-md w-full text-center">

                    {/* Illustration/Icon */}
                    <div className="relative mb-8 inline-block">
                        <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-indigo-50 rounded-full flex items-center justify-center mx-auto absolute -top-4 -left-4 -right-4 -bottom-4 animate-pulse opacity-50"></div>
                        <div className="w-24 h-24 bg-white rounded-2xl shadow-xl shadow-blue-500/10 flex items-center justify-center relative z-10 border border-gray-100">
                            <span className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-600 to-indigo-600">
                                404
                            </span>
                        </div>
                    </div>

                    {/* Text */}
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">Oops! Document misplaced.</h1>
                    <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                        The page you're looking for seems to have gotten lost in the print queue. It might have been moved or no longer exists.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all w-full sm:w-auto"
                        >
                            <Home className="w-5 h-5" />
                            Go to Homepage
                        </Link>
                        <Link
                            to="/contact"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors w-full sm:w-auto"
                        >
                            <Search className="w-5 h-5 text-gray-400" />
                            Contact Support
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default NotFoundPage
