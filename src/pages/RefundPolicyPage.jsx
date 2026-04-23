import React, { useEffect } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

const RefundPolicyPage = () => {
  usePageTitle('Refund & Cancellation Policy');

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10 text-white">
            <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
              <RefreshCw className="w-8 h-8" />
              Refund & Cancellation Policy
            </h1>
            <p className="text-blue-100 font-medium">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          {/* Content */}
          <div className="p-8 prose prose-slate max-w-none">
            <p className="text-lg text-slate-600 mb-8">
              At PrintGet, we strive to ensure the highest quality of service. Because we deal with immediate, customized digital-to-physical printing, our policies are designed to be fair while respecting the physical resources consumed by our partner shops.
            </p>

            <div className="space-y-8">
              {/* Section 1 */}
              <section className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 mb-4">
                  <Clock className="w-6 h-6 text-blue-500" />
                  1. Order Cancellations
                </h2>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span><strong className="text-slate-900">Before Printing:</strong> Once an order is paid via UPI, the printing command is immediately sent to the selected print shop. If the shop has not yet started the physical printing process, you may contact support for a cancellation request.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span><strong className="text-slate-900">After Printing:</strong> If the shop has already initiated or completed the print job, the order <strong>cannot be cancelled</strong> and no refund will be issued, as physical paper and ink have been consumed.</span>
                  </li>
                </ul>
              </section>

              {/* Section 2 */}
              <section className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 mb-4">
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                  2. Refund Eligibility
                </h2>
                <p className="text-slate-700 mb-4">Refunds are strictly evaluated on a case-by-case basis. You are eligible for a refund ONLY under the following circumstances:</p>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span><strong>Shop Failure:</strong> The selected print shop machine is down, out of paper/ink, or the shop is closed and unable to fulfill the order.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span><strong>Major Defect:</strong> Missing pages (due to system error, not user selection), completely illegible prints, or severe physical damage to the paper.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span><strong>Payment Error:</strong> Double deduction or payment debited but order not registered in the system.</span>
                  </li>
                </ul>
              </section>

              {/* Section 3 */}
              <section className="bg-slate-50 rounded-2xl p-6 border border-red-50">
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 mb-4">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                  3. Non-Refundable Cases
                </h2>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span>You uploaded the wrong file or an unoptimized file.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span>You selected the wrong print settings (e.g., selected B&W instead of Color, wrong paper size).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span>Minor color variations from your screen display.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span>You failed to pick up the printed documents from the shop.</span>
                  </li>
                </ul>
              </section>

              {/* Section 4 */}
              <section className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 mb-4">4. Refund Processing</h2>
                <p className="text-slate-700 mb-4">
                  Because PrintGet currently facilitates direct payments to shops via UPI, automated refund APIs are not available. 
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-700 ml-2">
                  <li>To request a refund, contact us at <strong>billing@printget.in</strong> within 1 hour of the transaction.</li>
                  <li>Include your Order ID, Phone Number, and photographic proof of any defects.</li>
                  <li>Validated refunds will be processed manually via UPI transfer to the source bank account.</li>
                  <li>Please allow 5-7 business days for the amount to reflect in your account.</li>
                </ol>
              </section>
            </div>
            
            {/* Footer Links */}
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-slate-400">
              <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms & Conditions</Link>
              <span>·</span>
              <Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
              <span>·</span>
              <Link to="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;
