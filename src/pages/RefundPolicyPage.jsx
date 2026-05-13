import React from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft, Mail, Clock, ShieldCheck, AlertCircle } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

const RefundPolicyPage = () => {
    usePageTitle({
        title: 'Refund & Cancellation Policy - PrintGet',
        description: 'PrintGet Refund & Cancellation Policy. Learn when and how refunds are processed for online print orders placed through our platform.',
        path: '/refund-policy'
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
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Refund &amp; Cancellation Policy</h1>
                    <p className="text-gray-400 text-sm">Last updated: April 30, 2026</p>
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">

                    {/* Intro */}
                    <div className="p-6 sm:p-8">
                        <p className="text-gray-600 leading-relaxed">
                            At <strong className="text-gray-800">PrintGet</strong>, we deal with immediate, customised digital-to-physical
                            printing — once paper and ink are consumed, the cost cannot be recovered. This policy explains exactly when
                            cancellations and refunds are possible, and how to request one.
                        </p>
                    </div>

                    {/* 1. Cancellations */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-500" />
                            1. Order Cancellations
                        </h2>
                        <ul className="space-y-2.5 text-gray-600 text-[15px]">
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">a.</span>
                                <span><strong className="text-gray-800">Before printing starts:</strong> Once an order is confirmed, the print job is queued at the selected shop. If the shop has not yet started the physical printing process, you may contact support to cancel the order.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">b.</span>
                                <span><strong className="text-gray-800">After printing starts:</strong> If the shop has already started or completed the print job, the order cannot be cancelled and no refund will be issued, as physical paper and ink have been consumed.</span>
                            </li>
                        </ul>
                    </div>

                    {/* 2. Refund Eligibility */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-green-500" />
                            2. When You Are Eligible for a Refund
                        </h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            Refunds are evaluated on a case-by-case basis. You are eligible <strong className="text-gray-800">only</strong> in the
                            following situations:
                        </p>
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-2.5 text-[15px]">
                            <div className="flex gap-2.5">
                                <span className="text-green-500 font-bold mt-0.5 shrink-0">•</span>
                                <span className="text-gray-700"><strong className="text-gray-900">Shop failure:</strong> The selected print shop's machine is down, out of paper or ink, or the shop is closed and unable to fulfil the order.</span>
                            </div>
                            <div className="flex gap-2.5">
                                <span className="text-green-500 font-bold mt-0.5 shrink-0">•</span>
                                <span className="text-gray-700"><strong className="text-gray-900">Major print defect:</strong> Missing pages (due to a system error, not user selection), completely illegible prints, or severe physical damage to the paper.</span>
                            </div>
                            <div className="flex gap-2.5">
                                <span className="text-green-500 font-bold mt-0.5 shrink-0">•</span>
                                <span className="text-gray-700"><strong className="text-gray-900">Payment error:</strong> Double deduction, or payment debited but the order not registered in our system.</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Non-Refundable Cases */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            3. Cases That Are Not Refundable
                        </h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            Because the print shop has already used physical resources to fulfil your order, the following situations
                            are not eligible for refunds:
                        </p>
                        <ul className="space-y-2.5 text-gray-600 text-[15px]">
                            <li className="flex gap-2.5">
                                <span className="text-red-400 font-bold mt-0.5 shrink-0">•</span>
                                <span>You uploaded the wrong file or an unoptimised file.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-red-400 font-bold mt-0.5 shrink-0">•</span>
                                <span>You selected the wrong print settings (e.g., B&amp;W instead of colour, wrong paper size, wrong number of copies).</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-red-400 font-bold mt-0.5 shrink-0">•</span>
                                <span>Minor colour variation between your screen and the printed output.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-red-400 font-bold mt-0.5 shrink-0">•</span>
                                <span>You did not pick up the printed documents from the shop in time.</span>
                            </li>
                        </ul>
                    </div>

                    {/* 4. How to Request */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">4. How to Request a Refund</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            If your situation falls under section 2 above, please follow these steps:
                        </p>
                        <ol className="space-y-2.5 text-gray-600 text-[15px]">
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">1.</span>
                                <span>Email us at{' '}
                                    <a href="mailto:support@printget.in" className="text-blue-600 hover:underline font-medium">support@printget.in</a>{' '}
                                    within <strong className="text-gray-800">1 hour</strong> of the transaction.
                                </span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">2.</span>
                                <span>Include your <strong className="text-gray-800">Order ID</strong>, registered <strong className="text-gray-800">phone number</strong>, and clear photographic proof of any defect.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">3.</span>
                                <span>Our team will review your claim and respond within 24–48 hours with a decision.</span>
                            </li>
                        </ol>
                    </div>

                    {/* 5. Processing Time */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Refund Processing Time</h2>

                        {/* Auto-refund highlight */}
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex gap-3">
                            <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <p className="text-green-800 text-[15px] leading-relaxed">
                                If your refund is approved, you will be <strong>automatically refunded</strong> to your original payment method within <strong>5–10 business days</strong>. No separate action is required from your end.
                            </p>
                        </div>

                        <p className="text-gray-600 leading-relaxed mb-3">
                            Once a refund request is approved:
                        </p>
                        <ul className="space-y-2 text-gray-600 text-[15px]">
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">•</span>
                                <span>The amount typically reflects in your bank account within <strong className="text-gray-800">5–10 business days</strong>, depending on your bank or payment method.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">•</span>
                                <span>Until our online payment gateway is fully active, eligible refunds are issued via direct bank transfer to the source account.</span>
                            </li>
                        </ul>
                    </div>

                    {/* 6. Contact */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Need Help?</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            Our support team is here to help with any cancellation or refund questions.
                        </p>
                        <div className="bg-gradient-to-br from-gray-50 to-blue-50/50 border border-gray-200 rounded-xl p-5 space-y-2 text-sm">
                            <p className="text-gray-700">
                                <strong className="text-gray-900">Email:</strong>{' '}
                                <a href="mailto:support@printget.in" className="text-blue-600 hover:underline">support@printget.in</a>
                            </p>
                            <p className="text-gray-700">
                                <strong className="text-gray-900">Phone:</strong>{' '}
                                <a href="tel:+918329232242" className="text-blue-600 hover:underline">+91 83292 32242</a>
                            </p>
                            <p className="text-gray-700"><strong className="text-gray-900">Registered Office:</strong> Ambajogai, Beed, Maharashtra, India</p>
                            <a
                                href="mailto:support@printget.in"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors mt-2"
                            >
                                <Mail className="w-4 h-4" />
                                Contact Support
                            </a>
                        </div>
                    </div>

                </div>

                {/* Footer Links */}
                <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-400">
                    <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms &amp; Conditions</Link>
                    <span>·</span>
                    <Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                    <span>·</span>
                    <Link to="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
                </div>
            </div>
        </div>
    )
}

export default RefundPolicyPage
