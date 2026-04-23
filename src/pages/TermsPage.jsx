import React from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft, Mail } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

const TermsPage = () => {
    usePageTitle('Terms & Conditions')

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
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Terms & Conditions</h1>
                    <p className="text-gray-400 text-sm">Last updated: March 2, 2026</p>
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">

                    {/* Intro */}
                    <div className="p-6 sm:p-8">
                        <p className="text-gray-600 leading-relaxed">
                            Welcome to <strong className="text-gray-800">PrintGet</strong> (<a href="https://www.printget.in" className="text-blue-600 hover:underline">www.printget.in</a>).
                            These Terms & Conditions ("Terms") govern your access to and use of our platform. By using PrintGet, you acknowledge
                            that you have read, understood, and agree to be bound by these Terms. If you do not agree, please do not use our services.
                        </p>
                    </div>

                    {/* 1. About PrintGet */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">1. About PrintGet</h2>
                        <p className="text-gray-600 leading-relaxed">
                            PrintGet is a technology platform that connects customers with local print shops. We serve as an
                            <strong className="text-gray-800"> intermediary marketplace</strong> — we do not own, operate, or manage any print shops.
                            Our role is limited to facilitating the connection between you and the print shop you choose.
                        </p>
                        <div className="mt-4 bg-gray-50 rounded-xl p-4">
                            <p className="text-sm text-gray-500 font-medium mb-2">In these Terms:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                                <p><strong className="text-gray-700">"Platform"</strong> — PrintGet website & services</p>
                                <p><strong className="text-gray-700">"User" / "You"</strong> — Anyone using PrintGet</p>
                                <p><strong className="text-gray-700">"Shop"</strong> — A print shop listed on PrintGet</p>
                                <p><strong className="text-gray-700">"Order"</strong> — A print request via PrintGet</p>
                            </div>
                        </div>
                    </div>

                    {/* 2. Eligibility */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Eligibility</h2>
                        <p className="text-gray-600 leading-relaxed">
                            No account registration is required to use PrintGet. When placing an order, you provide your
                            name and phone number. Your order is identified by a unique order ID, and your name is used
                            to identify you at the print shop. Your phone number is collected only for contact purposes —
                            for example, if you need to be reached regarding your order or pickup. By using the platform
                            and making payments, you confirm that you are legally able to enter into transactions.
                        </p>
                    </div>

                    {/* 3. How Orders Work */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How Orders Work</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            When you place an order through PrintGet, you are submitting a print request to an independent print shop.
                            Please note the following:
                        </p>
                        <ul className="space-y-2.5 text-gray-600 text-[15px]">
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">a.</span>
                                <span>PrintGet does not print your documents. The print shop you select is solely responsible for print quality, accuracy, turnaround time, and order fulfillment.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">b.</span>
                                <span>An order is confirmed only after the shop accepts it. Submission does not guarantee acceptance.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">c.</span>
                                <span>Pricing is determined by each print shop independently. PrintGet does not set, control, or guarantee pricing.</span>
                            </li>
                        </ul>
                    </div>

                    {/* 4. Your Files */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Your Files</h2>
                        <p className="text-gray-600 leading-relaxed mb-3">
                            You retain full ownership of all files you upload. We do not claim any rights over your content. However,
                            by uploading files, you represent and warrant that:
                        </p>
                        <ul className="space-y-2.5 text-gray-600 text-[15px] mb-4">
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">a.</span>
                                <span>You have the right to print the content, and it does not infringe any third-party copyright or intellectual property rights.</span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="text-blue-400 font-bold mt-0.5 shrink-0">b.</span>
                                <span>The content is not illegal, defamatory, obscene, or otherwise objectionable under Indian law.</span>
                            </li>
                        </ul>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                            <p className="text-sm text-blue-800 leading-relaxed">
                                <strong>File Security:</strong> Your files are stored temporarily in encrypted storage and are
                                automatically deleted within minutes of printing. Files are never stored permanently on any device.
                                We do not review, screen, or monitor uploaded content.
                            </p>
                        </div>
                    </div>

                    {/* 5. Payments */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Payments</h2>
                        <p className="text-gray-600 leading-relaxed">
                            All prices are set by the respective print shops and displayed at the time of order. Payments are
                            made to PrintGet via UPI or other supported methods, and we settle with the print shop on your behalf.
                            You agree to pay the full amount shown at checkout. PrintGet is not liable for payment processing
                            failures or issues arising from third-party payment services.
                        </p>
                    </div>

                    {/* 6. Payments are Final */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">6. No Cancellations or Refunds</h2>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-3">
                            <p className="text-amber-800 text-sm font-medium">
                                All payments made through PrintGet are final. We do not offer cancellations or refunds at this time.
                            </p>
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                            Once a payment is made, it cannot be reversed or refunded. Please review your order details carefully —
                            including file, print settings, and pricing — before submitting your order. If you experience any issues
                            with your order, please contact the print shop directly or reach out to us at{' '}
                            <a href="mailto:hello@printget.in" className="text-blue-600 hover:underline">hello@printget.in</a>{' '}
                            and we will try our best to help resolve the matter.
                        </p>
                    </div>

                    {/* 7. Intellectual Property */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Intellectual Property</h2>
                        <p className="text-gray-600 leading-relaxed">
                            The PrintGet name, logo, design, and all platform content are our property and are protected under applicable
                            intellectual property laws. You may not copy, reproduce, modify, or create derivative works from any part
                            of the platform without our prior written consent. Content you upload remains your property.
                        </p>
                    </div>

                    {/* 8. Limitation of Liability */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5">
                            <p className="text-gray-700 leading-relaxed mb-3">
                                PrintGet operates solely as an intermediary. To the maximum extent permitted by applicable law:
                            </p>
                            <ul className="space-y-2 text-gray-600 text-[15px]">
                                <li className="flex gap-2.5">
                                    <span className="text-amber-500 font-bold mt-0.5 shrink-0">•</span>
                                    <span>We are <strong className="text-gray-700">not liable</strong> for the print quality, delays, errors, or any issues arising from the services provided by the print shop.</span>
                                </li>
                                <li className="flex gap-2.5">
                                    <span className="text-amber-500 font-bold mt-0.5 shrink-0">•</span>
                                    <span>We are <strong className="text-gray-700">not responsible</strong> for any loss, damage, or inconvenience resulting from your use of the platform or inability to use it.</span>
                                </li>
                                <li className="flex gap-2.5">
                                    <span className="text-amber-500 font-bold mt-0.5 shrink-0">•</span>
                                    <span>In no event shall our total liability exceed the <strong className="text-gray-700">amount you paid for the specific order</strong> giving rise to the claim.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* 9. Privacy */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Privacy</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Your use of PrintGet is also governed by our{' '}
                            <Link to="/privacy" className="text-blue-600 hover:underline font-medium">Privacy Policy</Link>,
                            which describes how we collect, use, and protect your personal information. The Privacy Policy is
                            incorporated into these Terms by reference.
                        </p>
                    </div>

                    {/* 10. Termination */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Termination</h2>
                        <p className="text-gray-600 leading-relaxed">
                            We may suspend or restrict your access to PrintGet at any time, without prior notice, if we reasonably
                            believe you have violated these Terms or engaged in conduct that is harmful to other users, the platform,
                            or third parties.
                        </p>
                    </div>

                    {/* 11. Governing Law & Disputes */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Governing Law & Disputes</h2>
                        <p className="text-gray-600 leading-relaxed">
                            These Terms are governed by and construed in accordance with the laws of India. Any disputes arising
                            from or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in India.
                            We encourage you to contact us first at{' '}
                            <a href="mailto:hello@printget.in" className="text-blue-600 hover:underline">hello@printget.in</a>{' '}
                            to attempt to resolve any issues before initiating legal proceedings.
                        </p>
                    </div>

                    {/* 12. Changes & Contact */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Changes to These Terms</h2>
                        <p className="text-gray-600 leading-relaxed mb-6">
                            We may revise these Terms at any time by updating this page. The "Last updated" date at the top reflects
                            the most recent revision. Your continued use of PrintGet after changes are posted constitutes your
                            acceptance of the revised Terms.
                        </p>

                        <div className="bg-gradient-to-br from-gray-50 to-blue-50/50 border border-gray-200 rounded-xl p-5">
                            <h3 className="text-base font-semibold text-gray-900 mb-2">Questions?</h3>
                            <p className="text-gray-600 text-sm mb-3">
                                If you have any questions or concerns about these Terms, please contact us:
                            </p>
                            <a
                                href="mailto:hello@printget.in"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                            >
                                <Mail className="w-4 h-4" />
                                hello@printget.in
                            </a>
                        </div>
                    </div>

                </div>

                {/* Footer Links */}
                <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-400">
                    <Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                    <span>·</span>
                    <Link to="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
                </div>
            </div>
        </div>
    )
}

export default TermsPage
