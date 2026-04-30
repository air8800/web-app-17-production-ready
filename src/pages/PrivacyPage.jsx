import React from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft, Mail } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

const PrivacyPage = () => {
    usePageTitle('Privacy Policy')

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
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
                    <p className="text-gray-400 text-sm">Last updated: April 30, 2026</p>
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">

                    {/* Intro */}
                    <div className="p-6 sm:p-8">
                        <p className="text-gray-600 leading-relaxed">
                            At <strong className="text-gray-800">PrintGet</strong>, we take your privacy seriously. This Privacy Policy
                            explains what information we collect, how we use it, and how we protect it when you use our platform
                            at <a href="https://www.printget.in" className="text-blue-600 hover:underline">www.printget.in</a>.
                            By using PrintGet, you agree to the practices described in this policy.
                        </p>
                    </div>

                    {/* 1. What We Collect */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            We collect only the minimum information needed to process your print order:
                        </p>
                        <div className="space-y-3">
                            <div className="bg-gray-50 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-gray-800 mb-2">Information you provide</h3>
                                <ul className="space-y-1.5 text-sm text-gray-600">
                                    <li className="flex gap-2">
                                        <span className="text-blue-400 shrink-0">•</span>
                                        <span><strong className="text-gray-700">Name</strong> — to identify you at the print shop for order pickup</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-blue-400 shrink-0">•</span>
                                        <span><strong className="text-gray-700">Phone number</strong> — for contact purposes only (e.g., pickup reminders)</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-blue-400 shrink-0">•</span>
                                        <span><strong className="text-gray-700">Uploaded files</strong> — the documents you want printed (PDF, images)</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-blue-400 shrink-0">•</span>
                                        <span><strong className="text-gray-700">Print settings</strong> — paper size, color mode, copies, and other preferences</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-gray-800 mb-2">Information collected automatically</h3>
                                <ul className="space-y-1.5 text-sm text-gray-600">
                                    <li className="flex gap-2">
                                        <span className="text-blue-400 shrink-0">•</span>
                                        <span><strong className="text-gray-700">Device information</strong> — browser type, screen size (for responsive design)</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-blue-400 shrink-0">•</span>
                                        <span><strong className="text-gray-700">Cookies</strong> — essential cookies for site functionality (city preference, recent shops)</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* 2. How We Use It */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            We use your information solely for the following purposes:
                        </p>
                        <ul className="space-y-2 text-gray-600 text-[15px]">
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">a.</span>
                                <span>To process and deliver your print order to the selected shop</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">b.</span>
                                <span>To communicate order status and updates</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">c.</span>
                                <span>To contact you if there are issues with your order or pickup</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">d.</span>
                                <span>To improve our platform and user experience</span>
                            </li>
                        </ul>
                        <p className="text-gray-500 text-sm mt-4 italic">
                            We do not use your information for marketing, advertising, or any purpose unrelated to your print order.
                        </p>
                    </div>

                    {/* 3. File Handling */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How We Handle Your Files</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            We understand that your files may contain sensitive or personal content. Here is exactly what happens to them:
                        </p>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-3">
                            <div className="flex gap-3">
                                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                                <p className="text-sm text-gray-700"><strong>Upload:</strong> Your file is uploaded to encrypted cloud storage over a secure HTTPS connection.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                                <p className="text-sm text-gray-700"><strong>Transfer:</strong> The file is securely transferred to the print shop's application for printing.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                                <p className="text-sm text-gray-700"><strong>Deletion:</strong> Your file is automatically deleted from cloud storage after transfer. On the shop's system,
                                    the file is held temporarily in encrypted app storage and is <strong>automatically deleted within minutes of printing</strong>.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✓</div>
                                <p className="text-sm text-gray-700"><strong>No permanent storage:</strong> Your files are never stored permanently on any device, server, or local disk.</p>
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm mt-3 italic">
                            We do not open, view, read, or monitor the contents of your uploaded files.
                        </p>
                    </div>

                    {/* 4. Data Sharing */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Who We Share Data With</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            We only share your data with parties directly involved in fulfilling your order:
                        </p>
                        <ul className="space-y-2 text-gray-600 text-[15px]">
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">a.</span>
                                <span><strong className="text-gray-700">The print shop you select</strong> — receives your name, phone number, files, and print settings to fulfill your order</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">b.</span>
                                <span><strong className="text-gray-700">Payment services</strong> — when online payments are enabled, the payment is processed by our payment gateway provider directly; we do not store your card or banking details. Until then, payment is collected by the print shop at pickup.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">c.</span>
                                <span><strong className="text-gray-700">Cloud infrastructure</strong> — third-party cloud services for temporary file storage and order data, secured with encryption</span>
                            </li>
                        </ul>
                        <div className="mt-4 bg-green-50 border border-green-100 rounded-xl p-4">
                            <p className="text-sm text-green-800 font-medium">
                                We never sell, rent, or share your personal information with advertisers or any other third parties.
                            </p>
                        </div>
                    </div>

                    {/* 5. Data Retention */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Retention</h2>
                        <div className="overflow-hidden rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Data Type</th>
                                        <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Retention</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr>
                                        <td className="px-4 py-2.5 text-gray-600">Uploaded files</td>
                                        <td className="px-4 py-2.5 text-gray-600">Deleted within minutes of printing</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2.5 text-gray-600">Order details</td>
                                        <td className="px-4 py-2.5 text-gray-600">Kept for support and dispute resolution</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2.5 text-gray-600">Name & phone number</td>
                                        <td className="px-4 py-2.5 text-gray-600">Associated with order records</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2.5 text-gray-600">Cookies</td>
                                        <td className="px-4 py-2.5 text-gray-600">Session-based or browser-managed</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 6. Cookies */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Cookies</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            We use only <strong className="text-gray-800">essential cookies</strong> required for the platform to function properly. These include:
                        </p>
                        <ul className="space-y-1.5 text-sm text-gray-600 mb-3">
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span>Your selected city preference</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span>Recently visited shops</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span>UI preferences (e.g., tour completion status)</span>
                            </li>
                        </ul>
                        <p className="text-gray-500 text-sm italic">
                            We do not use tracking cookies, advertising cookies, or any third-party analytics cookies.
                        </p>
                    </div>

                    {/* 7. Security */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Security</h2>
                        <p className="text-gray-600 leading-relaxed">
                            We take reasonable measures to protect your data, including:
                        </p>
                        <ul className="space-y-1.5 text-sm text-gray-600 mt-3">
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span>HTTPS encryption for all data in transit</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span>Encrypted cloud storage for files</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span>Encrypted temporary storage on the shop's application</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span>Automatic file deletion after printing</span>
                            </li>
                        </ul>
                        <p className="text-gray-500 text-sm mt-3 italic">
                            While no system is 100% secure, we strive to protect your information using industry-standard practices.
                        </p>
                    </div>

                    {/* 8. Your Rights */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Your Rights</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            You have the right to:
                        </p>
                        <ul className="space-y-2 text-gray-600 text-[15px]">
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">a.</span>
                                <span>Request information about what data we hold about you</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">b.</span>
                                <span>Request deletion of your personal data by contacting us</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">c.</span>
                                <span>Clear cookies and local storage through your browser settings at any time</span>
                            </li>
                        </ul>
                        <p className="text-gray-600 text-sm mt-3">
                            To exercise any of these rights, email us at{' '}
                            <a href="mailto:support@printget.in" className="text-blue-600 hover:underline">support@printget.in</a>.
                        </p>
                    </div>

                    {/* 9. Third-Party Services */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Third-Party Services</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            PrintGet uses the following third-party services to operate:
                        </p>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <div className="space-y-2 text-sm text-gray-600">
                                <p><strong className="text-gray-700">Cloud hosting & database</strong> — for website hosting and temporary file storage</p>
                                <p><strong className="text-gray-700">Payment gateway</strong> — for online payment collection once enabled (we do not store your card or banking details)</p>
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm mt-3 italic">
                            Each third-party service has its own privacy policy. We recommend reviewing their policies for details on how they handle data.
                        </p>
                    </div>

                    {/* 10. Changes & Contact */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
                        <p className="text-gray-600 leading-relaxed mb-6">
                            We may update this Privacy Policy from time to time. Changes will be reflected on this page with a revised
                            "Last updated" date. Your continued use of PrintGet after updates constitutes acceptance of the revised policy.
                        </p>

                        <div className="bg-gradient-to-br from-gray-50 to-blue-50/50 border border-gray-200 rounded-xl p-5">
                            <h3 className="text-base font-semibold text-gray-900 mb-1">Grievance Officer</h3>
                            <p className="text-gray-600 text-sm mb-3">
                                For any privacy-related concerns, complaints, or data requests, contact us:
                            </p>
                            <a
                                href="mailto:support@printget.in"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                            >
                                <Mail className="w-4 h-4" />
                                support@printget.in
                            </a>
                            <p className="text-gray-400 text-xs mt-2">
                                Please include "Privacy" or "Grievance" in the subject line for faster resolution.
                            </p>
                        </div>
                    </div>

                </div>

                {/* Footer Links */}
                <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-400">
                    <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms & Conditions</Link>
                    <span>·</span>
                    <Link to="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
                </div>
            </div>
        </div>
    )
}

export default PrivacyPage
