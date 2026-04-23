# PrintGet — Email Directory & Roles

This document is the **master record** for all PrintGet email addresses.
All emails are aliases under the primary inbox: `hello@printget.in`
Google Workspace Account: `hello@printget.in` (Shivam R)
Domain: `printget.in`

---

## 📋 All Email Addresses

| Email | Role | Priority |
|---|---|---|
| `hello@printget.in` | **Primary inbox** — main business email, sign-in account | 🔴 Core |
| `orders@printget.in` | **Automated** — sends "Your print is ready!" notification | 🔴 Core |
| `noreply@printget.in` | **Automated** — system emails (payment confirmed, order received) | 🔴 Core |
| `support@printget.in` | **Customer support** — complaints, help, issues | 🟡 Important |
| `contact@printget.in` | **General contact** — listed on Contact Us page & website | 🟡 Important |
| `info@printget.in` | **General info** — listed in About page, FAQs | 🟡 Important |
| `billing@printget.in` | **Billing queries** — payment issues, refund requests | 🟡 Important |
| `admin@printget.in` | **Internal only** — admin operations, never shown publicly | 🟢 Internal |
| `team@printget.in` | **Internal only** — team communication (future use) | 🟢 Internal |

---

## 🌐 Where Each Email Should Be Used

### Legal & Public Pages

| Page | Email to Use |
|---|---|
| **Contact Us** (`/contact`) | `contact@printget.in` |
| **Terms & Conditions** (`/terms`) | `legal@printget.in` → use `hello@printget.in` for now |
| **Privacy Policy** (`/privacy`) | `hello@printget.in` |
| **Refund Policy** (`/refund-policy`) | `billing@printget.in` |
| **About Page** (`/about`) | `info@printget.in` |
| **Footer (website-wide)** | `hello@printget.in` |
| **FAQ Page** (`/faq`) | `support@printget.in` |

### App Features (Automated Emails)

| Feature | Email to Send FROM |
|---|---|
| **"Your print is ready!" notification** | `orders@printget.in` |
| **Order received confirmation** | `noreply@printget.in` |
| **Payment confirmed** | `noreply@printget.in` |
| **Order cancelled** | `noreply@printget.in` |
| **Refund processed** | `billing@printget.in` |

### External Platforms & Services

| Platform | Email to Use |
|---|---|
| **PhonePe Payment Gateway** | `hello@printget.in` |
| **Google Workspace Admin** | `hello@printget.in` |
| **Supabase account** | `hello@printget.in` |
| **Vercel / Hosting** | `hello@printget.in` |
| **Domain Registrar** | `hello@printget.in` |
| **App Store / Play Store (future)** | `hello@printget.in` |

---

## ⚙️ Automated Email Setup (TODO)

- [ ] Add `customer_email` field to `print_jobs` table in Supabase
- [ ] Add email input field in OrderPage.jsx
- [ ] Create Supabase Edge Function triggered on `job_status = 'completed'`
- [ ] Configure Gmail SMTP in Edge Function using Google Workspace credentials
- [ ] Send from `orders@printget.in` when print is ready
- [ ] Send from `noreply@printget.in` on order confirmation

---

## 📌 Quick Reference Card

```
hello@printget.in    → Main inbox / sign in / all important platforms
orders@printget.in   → Print ready notifications (automated)
noreply@printget.in  → System emails (automated)
support@printget.in  → Customer help & complaints
contact@printget.in  → Contact Us page
info@printget.in     → General info / About page
billing@printget.in  → Refund & billing issues
admin@printget.in    → Internal only (never public)
team@printget.in     → Internal only (future team)
```

---

*Last updated: April 2026*
*All emails are aliases under hello@printget.in (Google Workspace Base Plan — ₹120/month)*
