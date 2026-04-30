import React from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft, Mail, Clock, MessageCircle, Phone, MapPin } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

const ContactPage = () => {
    usePageTitle('Contact Us')

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Sticky Header */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium hidden sm:inline">Home</span>
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
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

                {/* Title */}
                <div className="mb-10">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Contact Us</h1>
                    <p className="text-gray-500">We're here to help. Reach out to us anytime.</p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                    {/* Email - Primary */}
                    <div className="p-6 sm:p-8">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                                <Mail className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">Email Us</h2>
                                <p className="text-gray-500 text-sm mb-3">The best way to reach us for any queries or support.</p>
                                <a
                                    href="mailto:support@printget.in"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-lg transition-colors"
                                >
                                    support@printget.in
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Phone */}
                    <div className="p-6 sm:p-8">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                                <Phone className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">Call Us</h2>
                                <p className="text-gray-500 text-sm mb-3">For urgent issues with an active order.</p>
                                <a
                                    href="tel:+918329232242"
                                    className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold text-lg transition-colors"
                                >
                                    +91 83292 32242
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Location */}
                    <div className="p-6 sm:p-8">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                                <MapPin className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">Where We're Based</h2>
                                <p className="text-gray-500 text-sm mb-4">PrintGet is operated as a sole proprietorship registered under the MSME / Udyam scheme.</p>

                                <div className="space-y-3">
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Registered Office</p>
                                        <p className="text-gray-800 font-semibold">Ambajogai, Beed</p>
                                        <p className="text-gray-600 text-sm">Maharashtra, India</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Operations Branch</p>
                                        <p className="text-gray-800 font-semibold">Nashik</p>
                                        <p className="text-gray-600 text-sm">Maharashtra, India</p>
                                        <p className="text-gray-500 text-xs mt-1.5 italic">All currently listed partner print shops are located here.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Response Time & Tips */}
                    <div className="p-6 sm:p-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    <h3 className="text-sm font-semibold text-gray-800">Response Time</h3>
                                </div>
                                <p className="text-sm text-gray-600">
                                    We typically respond within <strong className="text-gray-800">24–48 hours</strong>.
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <MessageCircle className="w-4 h-4 text-blue-500" />
                                    <h3 className="text-sm font-semibold text-gray-800">Helpful Tips</h3>
                                </div>
                                <p className="text-sm text-gray-600">
                                    Include your <strong className="text-gray-800">order ID</strong> if contacting about a specific order.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* What to contact about */}
                    <div className="p-6 sm:p-8">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">You can reach out to us for:</h3>
                        <div className="space-y-2">
                            {[
                                'Questions about your order',
                                'Issues with printing or payment',
                                'Bug reports or feature suggestions',
                                'Privacy & data-related requests',
                                'General questions about PrintGet',
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2.5 text-sm text-gray-600">
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full shrink-0" />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Grievance */}
                    <div className="p-6 sm:p-8">
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-amber-800 mb-1">Grievance / Complaints</h3>
                            <p className="text-sm text-amber-700">
                                For formal grievances or complaints, email us at{' '}
                                <a href="mailto:support@printget.in" className="font-medium underline">support@printget.in</a>{' '}
                                with <strong>"Grievance"</strong> in the subject line. We will acknowledge your complaint within 48 hours
                                and aim to resolve it as quickly as possible.
                            </p>
                        </div>
                    </div>

                </div>

                {/* Footer Links */}
                <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-400">
                    <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms & Conditions</Link>
                    <span>·</span>
                    <Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                    <span>·</span>
                    <Link to="/about" className="hover:text-blue-600 transition-colors">About Us</Link>
                </div>
            </div>
        </div>
    )
}

export default ContactPage
