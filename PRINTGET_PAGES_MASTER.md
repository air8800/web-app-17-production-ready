# PrintGet — Master Pages & Content Plan

> Master reference for all pages to build. Updated as we discuss and decide things.
> **Last updated**: 16 April 2026

---

## Current Status

| Page | Status | Route |
|------|--------|-------|
| Terms & Conditions | ✅ Done | `/terms` |
| Privacy Policy | ✅ Done | `/privacy` |
| Refund & Cancellation Policy | ✅ Done | `/refund-policy` | Created for PhonePe compliance |
| Contact Us | ⬜ Not Started | `/contact` |
| About Us | ⬜ Not Started | `/about` |
| FAQ / Help | ✅ Done | `/faq` |
| Cookie Policy | ⬜ Not Started | `/cookie-policy` |
| 404 Page | ⬜ Not Started | `*` (catch-all) |
| Footer Link Fixes | ✅ Done | — |
| Branding Fix | ✅ Done | — |

---

## 🔍 Branding Audit — ✅ RESOLVED

All branding now unified to **PrintGet**. "PrintFlow Pro" removed from all user-visible UI.

- `index.html` → PrintGet ✅
- `usePageTitle.js` → PrintGet ✅
- `HomePage.jsx` footer → PrintGet (with gradient) ✅
- `package.json` → `printget-web` ✅
- `pdf2/index.ts` comment → PrintGet ✅
- localStorage keys → kept as `printflow_` (internal, invisible to users) ✅

---

## Business Context

- **App Name**: **PrintGet** ✅
- **Type**: Tech platform / Marketplace (connects customers with local print shops)
- **Operator**: Team (don't disclose names). Use "we" language everywhere. Never say solo/single developer.
- **Support**: Email only → `support@printget.in` ⚠️ PLACEHOLDER (see tracking below)
- **Location**: India (no physical office address on website)
- **Payment**: PhonePe Payment Gateway (0% MSME Tier) ✅ Transitioning from Direct UPI
- **Refunds**: Manual via PhonePe Dashboard. Policy strictly limits refunds to shop failures.
- **File Retention**: Encrypted app storage (`%APPDATA%/PrintGet/temp/`). Never stored as browsable files. 10-min auto-delete after printing. Reprint within 10 min pauses timer → deleted immediately after reprint.
- **Supabase**: File deleted from Supabase after desktop app downloads it.
- **Data**: Users upload PDFs/images, provide phone number for order tracking

### 📁 File Storage — Technical Detail (for desktop app implementation)

| Step | What Happens |
|------|--------------|
| 1. Upload | User uploads file → stored in Supabase (encrypted cloud) |
| 2. Download | Desktop app downloads to encrypted app storage (not browsable filesystem) |
| 3. Supabase cleanup | File deleted from Supabase after download |
| 4. Print | File printed from encrypted app storage |
| 5. Post-print | 10-min timer starts |
| 6a. No reprint | Timer expires → file deleted from app storage |
| 6b. Reprint | Timer paused → reprint completes → file deleted immediately |

> **User-facing language for Privacy Policy / Terms:**
> *"Your files are stored temporarily in encrypted storage and are automatically deleted within minutes of printing. Files are never stored permanently on any device."*

### 📧 Placeholder Email Tracking

> [!WARNING]
> Using `support@printget.in` as placeholder. Replace with real email when ready.
> Search for `support@printget.in` across all files to find every usage.

---

## Build Priority

| Priority | What | Est. Time |
|----------|------|-----------|
| 🔴 1 | Terms + Privacy + Refund Policy | ✅ Completed |
| 🔴 2 | Contact Us | ~15 min |
| 🟡 3 | About Us | ~20 min |
| 🟡 4 | FAQ Page | ✅ Completed |
| 🟡 5 | Footer Fixes + Branding Fix | ✅ Completed |
| 🟢 6 | Cookie Policy | ~15 min |
| 🟢 7 | 404 Page | ~15 min |
| 🟢 8 | Terms Checkbox + SEO Meta | ~20 min |

---

## Page Content Outlines

### Page 1: Terms & Conditions (`/terms`)

1. **Introduction** — Platform connects customers with print shops
2. **Definitions** — "Platform", "User", "Shop Owner", "Order"
3. **Usage** — No account needed, identified by phone, 18+ or parental consent
4. **Orders** — PrintGet is intermediary, not the printer. Quality = shop's responsibility. Pricing set by shops.
5. **File Uploads** — User owns content, no illegal/copyrighted material, files auto-deleted after printing
6. **Payments** — Third-party gateway, not liable for gateway issues
7. **Cancellation & Refunds** — Link to Refund Policy
8. **IP** — PrintGet brand owned by us, user content stays theirs
9. **Liability** — Intermediary only, max liability = order amount
10. **Governing Law** — Laws of India
11. **Contact** — Support email

### Page 2: Privacy Policy (`/privacy`)

1. **Data Collected** — Phone number, uploaded files, order details, device info, cookies
2. **How Used** — Process orders, communicate status, analytics
3. **File Handling** — Encrypted storage (Supabase), files never saved to local disk, kept in app memory only, auto-deleted within 10 minutes after printing
4. **Data Sharing** — Shop (for order), payment gateway. No selling data.
5. **Retention** — Files deleted from cloud within minutes of printing, never stored on local filesystem. Order metadata kept for support.
6. **Your Rights** — Request deletion, opt out of analytics
7. **Security** — HTTPS, encrypted cloud storage
8. **Third-Party** — Supabase, payment gateway
9. **Contact** — Support email, grievance officer (same email)

### Page 3: Refund & Cancellation (`/refund-policy`)

1. **Cancellation** — Allowed before shop starts printing. Contact support.
2. **Refund Eligible** — Wrong print, quality defects, order not fulfilled
3. **Not Refundable** — User uploaded wrong file, selected wrong settings, minor quality variations
4. **How to Request** — Email support with order ID + photos. Response in 48-72 hrs.
5. **Timeline** — 5-7 business days, refund sent manually via UPI
6. **Note** — Currently using direct UPI, refunds processed manually

### Page 4: Contact Us (`/contact`)

- Support email (`support@printget.in`) with mailto link
- Response time: 24-48 hours
- Grievance: same email, "Grievance" in subject
- *(Shop owners section: deferred for later)*

### Page 5: About Us (`/about`)

- Mission: Making printing as easy as ordering food
- Story: Born from frustration of USB drives and waiting in line
- Built in India 🇮🇳 — "We're a team passionate about simplifying everyday tasks"
- Link to Contact page

### Page 6: FAQ (`/faq`)

- General: What is it, is it free
- Files: Formats, size limits, safety
- Orders: Tracking, cancellation, timing
- Printing: Paper sizes, color, N-up
- Payment: How to pay, security, refunds
- Shops: How to list, who sets prices

### Page 7: Cookie Policy (`/cookie-policy`)

- Essential cookies: session, city preference, recent shops
- No third-party tracking cookies (currently)
- How to manage cookies in browser

### Page 8: 404 Page

- Friendly "page not found" with icon
- "Go back to home" button

---

## Non-Page Tasks

| Task | Details | Status |
|------|---------|--------|
| **Footer links** | Updated all `href="#"` to actual routes | ✅ Done |
| **Branding** | Changed "PrintFlow Pro" → "PrintGet" everywhere | ✅ Done |
| **Social links** | Removed placeholder social media icons | ✅ Done |
| **Terms checkbox** | Add "I agree to T&C" on OrderPage before submit | ⬜ |
| **SEO** | Meta tags already done (index.html has OG + Twitter cards) | ✅ Done |

---

## 💬 Discussion Log

### Questions Asked → Waiting for User Answers

| # | Question | Answer |
|---|----------|--------|
| 1 | **Final brand name?** | ✅ **PrintGet** — fully rebranded |
| 2 | **Support email?** | ✅ Using `support@printget.in` as placeholder. Will be replaced with real email later. |
| 3 | **Refund policy?** | ✅ Created dedicated `/refund-policy` to satisfy PhonePe Payment Gateway legal compliance. |
| 4 | **File retention?** | ✅ No local filesystem storage (privacy). Kept in app memory only. 10-min auto-delete after print, with pause-on-reprint. |
| 5 | **Payment gateway?** | ✅ Transitioning to PhonePe PG for 0% fees and removing direct UPIGateway bypass. |
| 6 | **"For Shop Owners" section?** | ✅ Deferred — will add later when ready to recruit shops. |
| 7 | **Social media accounts?** | ✅ None — icons removed from footer. |
