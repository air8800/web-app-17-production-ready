import React from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft, Mail } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'
import PrintGetLogo from '../components/PrintGetLogo'

const CookiePolicyPage = () => {
    usePageTitle({
        title: 'Cookie Policy - PrintGet',
        description: 'PrintGet Cookie Policy. Understand how we use cookies and similar technologies on our website to improve your experience.',
        path: '/cookie-policy'
    })

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Sticky Header */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium hidden sm:inline">Home</span>
                    </Link>
                    <PrintGetLogo to="/" size="sm" />
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

                {/* Title */}
                <div className="mb-10">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
                    <p className="text-gray-400 text-sm">Last updated: March 2, 2026</p>
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">

                    {/* Intro */}
                    <div className="p-6 sm:p-8">
                        <p className="text-gray-600 leading-relaxed">
                            This Cookie Policy explains how <strong className="text-gray-800">PrintGet</strong> uses cookies and
                            browser storage when you visit our website. We believe in being transparent about what data we
                            store and how your browser handles it.
                        </p>
                    </div>

                    {/* What Are Cookies */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">1. What Are Cookies?</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Cookies are small pieces of data stored by your <strong className="text-gray-800">web browser</strong> (like Chrome, Safari, or Firefox).
                            They help websites remember your preferences so you don't have to re-enter them each time you visit.
                        </p>
                        <p className="text-gray-600 leading-relaxed mt-3">
                            We also use your browser's <strong className="text-gray-800">localStorage</strong> — this is storage
                            managed entirely by your browser, not your phone or device storage. It is only accessible by PrintGet's
                            website and can be cleared from your browser settings at any time.
                        </p>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4">
                            <p className="text-sm text-blue-800">
                                <strong>About files:</strong> When you upload a document on PrintGet, you are actively selecting and
                                sharing that file through your browser's file picker. We do not access any files on your device
                                without your action — you choose what to share.
                            </p>
                        </div>
                    </div>

                    {/* What We Use */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">2. What We Store in Your Browser</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            We only use <strong className="text-gray-800">essential browser storage</strong> that is necessary for the
                            platform to work properly. We do not use any advertising cookies.
                        </p>
                        <div className="overflow-hidden rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="text-left px-4 py-2.5 font-semibold text-gray-700">What</th>
                                        <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Purpose</th>
                                        <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Storage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr>
                                        <td className="px-4 py-2.5 text-gray-700 font-medium">Selected city</td>
                                        <td className="px-4 py-2.5 text-gray-600">Remembers which city you chose so you don't have to select it again</td>
                                        <td className="px-4 py-2.5 text-gray-500">Browser localStorage</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2.5 text-gray-700 font-medium">Recent shops</td>
                                        <td className="px-4 py-2.5 text-gray-600">Shows your recently visited shops for quick access</td>
                                        <td className="px-4 py-2.5 text-gray-500">Browser localStorage</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2.5 text-gray-700 font-medium">UI preferences</td>
                                        <td className="px-4 py-2.5 text-gray-600">Remembers if you've completed the guided tour or dismissed tips</td>
                                        <td className="px-4 py-2.5 text-gray-500">Browser localStorage</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* What We Don't Use */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">3. What We Don't Use</h2>
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                            <div className="space-y-2 text-sm text-green-800">
                                <p className="flex gap-2">
                                    <span className="shrink-0">✗</span>
                                    <span>No <strong>tracking cookies</strong> — we don't track your browsing activity</span>
                                </p>
                                <p className="flex gap-2">
                                    <span className="shrink-0">✗</span>
                                    <span>No <strong>advertising cookies</strong> — we don't show ads or share data with ad networks</span>
                                </p>
                                <p className="flex gap-2">
                                    <span className="shrink-0">✗</span>
                                    <span>No <strong>cross-site tracking</strong> — we don't follow you across other websites</span>
                                </p>
                                <p className="flex gap-2">
                                    <span className="shrink-0">✗</span>
                                    <span>No <strong>device storage access</strong> — we only use your browser's storage, never your phone or local files</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* How to Manage */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Managing Your Data</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            You can clear all data stored by PrintGet at any time through your browser settings:
                        </p>
                        <ul className="space-y-2 text-gray-600 text-[15px]">
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">a.</span>
                                <span><strong className="text-gray-700">Clear cookies & site data</strong> — In your browser's settings, find "Clear browsing data" or "Clear site data" and select PrintGet.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">b.</span>
                                <span><strong className="text-gray-700">Clear localStorage</strong> — In most browsers, go to Developer Tools → Application → Local Storage → select and delete.</span>
                            </li>
                        </ul>
                        <p className="text-gray-500 text-sm mt-3 italic">
                            Note: Clearing this data will reset your city preference and recent shops. It won't affect any active orders.
                        </p>
                    </div>

                    {/* Changes & Contact */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Changes & Contact</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            If we ever add new types of cookies or storage in the future, we will update this page.
                            For any questions about our cookie practices, contact us at:
                        </p>
                        <a
                            href="mailto:support@printget.in"
                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                        >
                            <Mail className="w-4 h-4" />
                            support@printget.in
                        </a>
                    </div>

                </div>

                {/* Footer Links */}
                <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-400">
                    <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms & Conditions</Link>
                    <span>·</span>
                    <Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                    <span>·</span>
                    <Link to="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
                </div>
            </div>
        </div>
    )
}

export default CookiePolicyPage
