# PrintGet: Payment & Legal Business Architecture

This document serves as the master record for the business, legal, and payment infrastructure decisions made for PrintGet. 

## 1. Legal Entity & Registration

**Current Structure:** Sole Proprietorship (Unregistered / Individual)
**Registration Type:** MSME / Udyam Registration
**Udyam Registration Status:** ✅ Active
**Udyam Business Category:** Services -> Non-Trading -> 63121 (Operation of web portals)
**GST Status:** ❌ Not Applicable (Annual turnover < ₹20 Lakhs)

### Why this structure?
- Bypasses the need for expensive Private Limited incorporation.
- Costs ₹0 to set up and maintain.
- Provides the necessary government proof-of-business to unlock Payment Gateway access without needing GST.

## 2. Payment Gateway Strategy

**Gateway Selected:** PhonePe Payment Gateway
**Pricing Tier:** Promotional 0% MSME Tier
- **Setup Fee:** ₹0
- **Annual Maintenance Charge (AMC):** ₹0
- **Transaction Fee (MDR) for standard UPI:** 0%
- **Validity:** Indefinite (Guaranteed minimum 30-90 days notice before any fee changes, realistic runway of 1-2 years).

### Why PhonePe instead of UPIGateway or Razorpay?
- Automatically handles NPCI Merchant VPA routing, completely eliminating the "Risky Payment" warning on Google Pay / PhonePe for customers.
- 0% transaction fee preserves the razor-thin margins of partner print shops.
- Fully automated standard S2S webhook callbacks for instant order verification.

## 3. Future Roadmap

### Short-Term (Months 0-6): MVP Validation
- Operate as Sole Proprietor under the current PhonePe 0% tier.
- Validate the marketplace with the first 5-10 print shops.

### Medium-Term (Months 6-12): Custom Gateway
- When transaction volume scales to the point where PhonePe introduces a platform fee, we will build a custom direct-to-bank notification API (like PeaPay). 
- This custom API will use variable-decimal pricing (e.g., ₹50.01 vs ₹50.02) to automatically reconcile orders directly against the Print Shop's personal Merchant QR code.

### Long-Term (When externally funded): Upgrading Entity
- Register as a Private Limited (Pvt Ltd) company to accept VC funding.
- **Process:** Secure a new Company PAN + Company Bank Account. Surrender the current Proprietorship Udyam Certificate and register a new one under the Company PAN. Provide the new documents to PhonePe to migrate the gateway account seamlessly.

## 4. Required Legal Pages for Gateway Compliance
PhonePe and all official Indian Payment Gateways require these public pages to be visible in the website footer:
1. Terms & Conditions (`/terms`)
2. Privacy Policy (`/privacy`)
3. Contact Us (`/contact`)
4. Refund & Cancellation Policy (`/refund-policy`) - Created to meet legal requirements, even though the actual policy states "All Sales Final" post-printing.
