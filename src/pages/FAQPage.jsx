import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

const faqs = [
    {
        category: "How it Works",
        questions: [
            {
                q: "How do I use PrintGet?",
                a: "It's simple: upload your document, select your print settings (color/B&W, pages, etc.), choose a nearby print shop, and pay via UPI. Once your order is ready, you'll see the status update and you can go pick it up."
            },
            {
                q: "Do I need to create an account?",
                a: "No! You don't need to download an app or create an account. You just enter your name (for the shop to identify your order) and phone number (in case they need to contact you about pickup)."
            },
            {
                q: "How will I know when my print is ready?",
                a: "After you place an order, you'll be given an Order ID and a tracking link. You can check the real-time status of your order there, so you only need to visit the shop when it's done."
            }
        ]
    },
    {
        category: "Files & Privacy",
        questions: [
            {
                q: "Is my personal document safe?",
                a: "Yes. Your files are encrypted during upload. We do not review, monitor, or use your files for any purpose other than facilitating your print order."
            },
            {
                q: "How long do you keep my files?",
                a: "We never store files permanently. Files are held in temporary encrypted storage, transferred to the shop, and are automatically deleted within minutes after printing is complete."
            },
            {
                q: "Will the shop owner keep a copy of my document?",
                a: "No. The PrintGet system on the shop's side is designed to automatically clear and delete files shortly after the print job is done to protect your privacy."
            }
        ]
    },
    {
        category: "Payments & Refunds",
        questions: [
            {
                q: "How do I pay?",
                a: "We currently accept payments via UPI. It's fast, secure, and doesn't require us to store any of your banking details."
            },
            {
                q: "Can I cancel my order or get a refund?",
                a: "No. Because files are sent directly to the print shop's queue and payments are processed via direct UPI transfer, all orders are final. We cannot offer cancellations or refunds once an order is placed. Please review your file and settings carefully before paying."
            },
            {
                q: "What if there is a problem with the print quality?",
                a: "If your document didn't print correctly due to a printer issue (e.g., low ink, paper jam), please speak directly with the print shop owner when you go to pick it up. PrintGet is a routing platform and does not handle physical printing."
            }
        ]
    }
]

const FAQItem = ({ faq }) => {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className={`rounded-xl bg-white shadow-sm border transition-colors duration-300 ${isOpen ? 'border-blue-200' : 'border-gray-100'}`}>
            <button
                className="no-scale w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none rounded-xl"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`font-semibold pr-4 transition-colors duration-300 ${isOpen ? 'text-blue-700' : 'text-gray-800'}`}>{faq.q}</span>
                <span className={`text-xl text-gray-400 shrink-0 w-5 text-center leading-none transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>+</span>
            </button>

            <div
                className={`overflow-hidden transition-all ease-in-out ${isOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}
                style={{ transitionDuration: '500ms' }}
            >
                <div className="px-5 pb-4 text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                    {faq.a}
                </div>
            </div>
        </div>
    )
}

const FAQPage = () => {
    usePageTitle('FAQ / Help')

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

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h1>
                    <p className="text-gray-500 text-lg">Everything you need to know about PrintGet.</p>
                </div>

                {/* FAQs */}
                <div className="space-y-10">
                    {faqs.map((section, idx) => (
                        <div key={idx}>
                            <h2 className="text-xl font-bold text-gray-900 mb-4 px-1">{section.category}</h2>
                            <div className="space-y-3">
                                {section.questions.map((faq, i) => (
                                    <FAQItem key={i} faq={faq} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Still need help? */}
                <div className="mt-12 text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Still have questions?</h2>
                    <p className="text-gray-600 mb-5">We're here to help. Reach out to our support team.</p>
                    <Link
                        to="/contact"
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
                    >
                        Contact Support
                    </Link>
                </div>

                {/* Footer Links */}
                <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-400">
                    <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms</Link>
                    <span>·</span>
                    <Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy</Link>
                    <span>·</span>
                    <Link to="/cookie-policy" className="hover:text-blue-600 transition-colors">Cookies</Link>
                </div>
            </div>
        </div>
    )
}

export default FAQPage
