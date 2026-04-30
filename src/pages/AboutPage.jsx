import React from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft, Upload, Store, Zap, Shield, Globe, Users, MapPin } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

const AboutPage = () => {
    usePageTitle('About Us')

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

                {/* Hero */}
                <div className="mb-12 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
                        <Printer className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                        About Print<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500">Get</span>
                    </h1>
                    <p className="text-gray-500 text-lg max-w-lg mx-auto leading-relaxed">
                        A dedicated platform for document printing.
                    </p>
                </div>

                {/* Story */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">

                    {/* The Problem */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">The Problem We Saw</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Need to print a document? Most people send their files to a print shop through messaging apps.
                            It works, but it's far from ideal — files get lost in chats, there's no way to customize
                            print settings, and your personal documents sit on someone else's phone.
                        </p>
                        <p className="text-gray-600 leading-relaxed mt-3">
                            And then there's the waiting. You drop off your file and have no idea when it'll be done.
                            So you either stand around in a crowded shop or keep going back to check. There's no way to
                            know if your document is still in queue or already printed.
                        </p>
                        <p className="text-gray-600 leading-relaxed mt-3">
                            We thought there should be a better way — a dedicated platform that solves all of this.
                        </p>
                    </div>

                    {/* The Solution */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">What PrintGet Does</h2>
                        <p className="text-gray-600 leading-relaxed mb-5">
                            PrintGet is a dedicated platform that connects you with local print shops. Upload your document,
                            choose your print settings, select a shop, pay — and pick up your printout when it's ready.
                            Everything in one place, designed specifically for printing.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-blue-50/70 rounded-xl p-4 flex gap-3">
                                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Upload className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Upload from anywhere</p>
                                    <p className="text-xs text-gray-500 mt-0.5">PDF, images — right from your phone or laptop</p>
                                </div>
                            </div>
                            <div className="bg-blue-50/70 rounded-xl p-4 flex gap-3">
                                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Store className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Choose your shop</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Compare prices and pick one near you</p>
                                </div>
                            </div>
                            <div className="bg-blue-50/70 rounded-xl p-4 flex gap-3">
                                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                    <MapPin className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Real-time order tracking</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Know exactly when your printout is ready — come only when it's done</p>
                                </div>
                            </div>
                            <div className="bg-blue-50/70 rounded-xl p-4 flex gap-3">
                                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Zap className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Fast & simple</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Order in under a minute, no app download needed</p>
                                </div>
                            </div>
                            <div className="bg-blue-50/70 rounded-xl p-4 flex gap-3">
                                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Shield className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Your files, protected</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Encrypted storage, auto-deleted after printing</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* How the business works */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">How PrintGet Works (Business Model)</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            PrintGet is an <strong className="text-gray-800">online marketplace</strong> — we don't own or operate
                            any printers ourselves. Instead, we connect customers with independent local print shops and handle
                            the digital part (file upload, queue, status, payment) so both sides have a smooth experience.
                        </p>
                        <div className="space-y-3">
                            <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
                                <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                                <p className="text-sm text-gray-700"><strong className="text-gray-900">You upload your file</strong> on printget.in, choose paper size, colour mode, copies and any other settings, and pick a nearby shop from the list.</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
                                <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                                <p className="text-sm text-gray-700"><strong className="text-gray-900">We show you the price</strong> calculated from the rates set by that shop. The amount you see at checkout is what you pay — no hidden charges.</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
                                <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                                <p className="text-sm text-gray-700"><strong className="text-gray-900">Your file is securely sent</strong> to the shop's PrintGet app. The shop accepts the order and starts printing.</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
                                <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</div>
                                <p className="text-sm text-gray-700"><strong className="text-gray-900">You get a live status link</strong> showing whether your job is queued, printing, or ready. We notify you (and email you, if you opt-in) the moment it's ready.</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
                                <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">5</div>
                                <p className="text-sm text-gray-700"><strong className="text-gray-900">You pick it up &amp; pay at the shop.</strong> Currently all orders are settled at the shop counter ("Pay at Shop"). Online payment via our payment gateway is being enabled and will be available shortly.</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
                                <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">6</div>
                                <p className="text-sm text-gray-700"><strong className="text-gray-900">Your file is auto-deleted</strong> from the shop's app within minutes of printing. We never keep a permanent copy.</p>
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-5">
                            <p className="text-sm text-blue-900 leading-relaxed">
                                <strong>How we make money:</strong> Once online payments are live, PrintGet retains a small platform
                                fee per order; the rest is settled to the print shop. There are no hidden charges to the customer.
                                Pricing shown at checkout is final.
                            </p>
                        </div>
                    </div>

                    {/* Who We Are */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Who We Are</h2>
                        <p className="text-gray-600 leading-relaxed">
                            PrintGet is an Indian-built marketplace, operated as a registered sole proprietorship under the
                            <strong className="text-gray-800"> MSME / Udyam</strong> scheme of the Government of India. The
                            business is registered in <strong className="text-gray-800">Ambajogai, Beed, Maharashtra</strong>,
                            and our day-to-day operations and partner print shops are based out of our
                            <strong className="text-gray-800"> Nashik branch</strong>. We're starting with Nashik and have
                            plans to expand to more cities.
                        </p>
                        <p className="text-gray-600 leading-relaxed mt-3">
                            We started PrintGet because printing documents — something so many people do every day — still
                            relied on messaging apps and informal methods. We built a single, dedicated platform for it: no app
                            download, no account, no hassle. We're a small team, growing one step at a time, and we'd love your
                            feedback.
                        </p>
                    </div>

                    {/* Built in India */}
                    <div className="p-6 sm:p-8 text-center">
                        <p className="text-2xl mb-2">🇮🇳</p>
                        <p className="text-gray-800 font-semibold">Built in India</p>
                        <p className="text-gray-500 text-sm mt-1">Because printing a document shouldn't be this complicated.</p>
                    </div>

                    {/* CTA */}
                    <div className="p-6 sm:p-8">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 text-center">
                            <h3 className="text-base font-semibold text-gray-900 mb-2">Have Questions or Feedback?</h3>
                            <p className="text-gray-600 text-sm mb-4">
                                We're always happy to hear from you — whether it's a bug report, a feature request, or just a hello.
                            </p>
                            <Link
                                to="/contact"
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                            >
                                Contact Us
                            </Link>
                        </div>
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

export default AboutPage
