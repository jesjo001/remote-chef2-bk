# REMOTECHEF — LOVABLE FRONTEND PROMPT
## Optimized for: Lovable.dev | React + Tailwind + shadcn/ui
---

[ROLE]
You are a senior React frontend engineer and UI/UX designer building a production-grade food subscription SaaS platform called RemoteChef. You write clean, modular, fully responsive React code with Tailwind CSS and shadcn/ui components.

[TASK]
Build the complete RemoteChef web application frontend — a food delivery subscription platform for remote workers in Abeokuta, Nigeria. Users pay monthly upfront to receive daily meal deliveries (workdays or all days). The app includes a public-facing site, authenticated user dashboard, and a separate admin panel.

[BRAND & DESIGN SYSTEM]
- Brand name: RemoteChef
- Tagline: "Eat Well. Work Hard. We Deliver."
- Color palette:
  - Primary: #E85D26 (warm orange — appetite, energy)
  - Secondary: #1A1A2E (deep navy — trust, professionalism)
  - Accent: #F5A623 (golden yellow — warmth)
  - Background: #FAFAF8 (off-white — clean, calm)
  - Surface: #FFFFFF
  - Text: #1A1A2E
  - Muted: #6B7280
  - Success: #22C55E
  - Error: #EF4444
- Font: 'Plus Jakarta Sans' (headings) + 'Inter' (body) — import from Google Fonts
- Border radius: rounded-2xl for cards, rounded-full for buttons
- Design tone: Warm, modern, trustworthy. Nigerian food culture with a clean SaaS polish. NOT generic. Feels like a premium service built for professionals.

[PAGES & ROUTES]
Build all the following pages/routes:

### PUBLIC ROUTES (no auth required)
1. `/` — Landing Page
2. `/pricing` — Pricing Calculator Page
3. `/login` — User Login
4. `/register` — User Registration

### USER ROUTES (protected, requires JWT auth)
5. `/dashboard` — User Dashboard
6. `/dashboard/subscription` — My Subscription details
7. `/dashboard/deliveries` — Delivery calendar/history
8. `/dashboard/payment` — Payment history
9. `/subscribe` — Subscribe flow (step wizard)

### ADMIN ROUTES (protected, admin JWT)
10. `/admin/login` — Admin Login (separate from user login)
11. `/admin/dashboard` — Admin Dashboard overview
12. `/admin/pricing` — Pricing & Cost Config
13. `/admin/subscribers` — Subscriber list & management
14. `/admin/deliveries` — Today's delivery board + date range
15. `/admin/transfers` — Manual transfer review (approve/reject)
16. `/admin/revenue` — Revenue & profit report

[PAGE SPECIFICATIONS]

### 1. LANDING PAGE (`/`)
Hero section:
- Full-width hero with background: subtle pattern of Nigerian food illustrations or warm gradient
- H1: "Fresh Meals. Every Workday. Delivered to You." 
- Subtext: "Subscribe monthly. We handle breakfast & lunch delivery in Abeokuta so you can stay focused on your work."
- Two CTAs: "See Pricing" (primary) + "Get Started" (outline)
- Show a live pricing preview widget inline (fetch from /api/pricing)

How It Works section (3 steps with icons):
1. Pick your plan (meals/day + schedule)
2. Pay once monthly
3. We deliver every day

Benefits section (4 cards):
- No cooking stress
- Fixed monthly cost
- Consistent quality
- 100% punctual delivery

Sample Meal Photos section (placeholder cards with meal names)
Testimonials section (3 fake testimonials — Nigerian names)
Footer: Logo + links + "Serving Abeokuta, Ogun State 🇳🇬"

### 2. PRICING CALCULATOR PAGE (`/pricing`)
Interactive calculator:
- Two toggle options: "1 Meal/Day" | "2 Meals/Day"
- Two toggle options: "Workdays Only (Mon–Fri)" | "All Days (Mon–Sat)"
- As user selects, immediately show the live cost breakdown fetched from POST /api/pricing/calculate
- Breakdown displayed line by line (animated reveal):
  - Meal per day: ₦X,XXX
  - Delivery fee: ₦X,XXX  
  - Daily total: ₦X,XXX (highlighted)
  - × 20 working days: ₦XX,XXX
  - Processing fee: ₦XX,XXX
  - ━━━━━━━━━━━━━━━━━━━━
  - TOTAL DUE: ₦XX,XXX/month (large, orange)
- CTA button: "Subscribe Now — ₦XX,XXX/month"
- Note below: "Prices are all-inclusive. No hidden charges."

### 3. SUBSCRIBE FLOW (`/subscribe`) — 4-step wizard
Step 1: Choose Plan
- Meal count toggle (1 or 2)
- Schedule toggle (workdays / all days)
- Live price breakdown shown on right side panel
- Start date picker (date input, min: tomorrow)

Step 2: Confirm Details
- Show user's delivery address (from profile)
- Allow editing inline
- Show full order summary

Step 3: Choose Payment Method
- Card/Bank/USSD via Flutterwave (always shown)
- Manual Bank Transfer (only shown if manualTransferEnabled === true from API)
  - Show bank name, account number, account name
  - "Upload Receipt" file input (jpg, png, pdf — max 5MB)

Step 4: Confirmation
- Success screen with order summary
- "View My Dashboard" button

### 4. USER DASHBOARD (`/dashboard`)
- Welcome header: "Good morning, [Name] 👋"
- Active plan card: shows plan type, status badge, next delivery date, days remaining
- Next delivery card: "Tomorrow — 1x Meal, Est. 12pm–2pm"
- Quick links: View Schedule | Manage Plan | Payment History
- Plan status: Active (green badge) / Pending Payment (yellow) / Expired (red)

### 5. DELIVERY CALENDAR (`/dashboard/deliveries`)
- Monthly calendar view showing delivery days (green dot = scheduled, tick = delivered, X = missed)
- List view below: date, status, meals count
- Filter by month

### 6. ADMIN DASHBOARD (`/admin/dashboard`)
Stat cards (top row):
- Total Users
- Active Subscriptions  
- Today's Deliveries
- This Month Revenue (₦)
- Estimated Profit (₦)
- Pending Manual Transfers (with red badge if > 0)

Recent Activity section
Quick action buttons: View Today's Deliveries | Review Transfers

### 7. ADMIN PRICING CONFIG (`/admin/pricing`)
Two-column form:
LEFT — Selling Prices (what customers pay):
- Meal Price per Day (₦)
- Delivery Fee per Day (₦)  
- Processing Fee per Month (₦)
- Workday count (default 20)
- All-day count (default 26)

RIGHT — Cost Prices (your business cost):
- Meal Cost Price (₦)
- Delivery Cost Price (₦)

Auto-computed margin display (read-only, calculated in real-time):
- Meal Profit per Unit: ₦500 (25%)
- Delivery Profit per Unit: ₦300 (30%)
- Est. Monthly Profit per Subscriber: ₦XX,XXX

Manual Transfer section (toggle + bank details form):
- Toggle: Enable Manual Transfer
- Bank Name, Account Number, Account Name fields (shown when enabled)

"Save Configuration" button

### 8. ADMIN DELIVERY BOARD (`/admin/deliveries`)
Today's board (default view):
- Table: Customer Name | Phone | Area | Meals | Status | Action
- Status dropdown per row: Scheduled → Out for Delivery → Delivered | Missed
- Color-coded rows (green=delivered, yellow=out, grey=scheduled, red=missed)
- "Mark All Out for Delivery" bulk action button
- Print view button

Date range filter at top

### 9. ADMIN MANUAL TRANSFERS (`/admin/transfers`)
Table of pending receipts:
- Customer Name | Amount | Date Submitted | Receipt (View link) | Actions
- Approve button (green) | Reject button (red)
- Modal when reviewing: show receipt image, enter admin note, confirm action

[STATE MANAGEMENT]
- Use React Context or Zustand for:
  - authState: { user, token, isAuthenticated }
  - adminAuthState: { admin, adminToken, isAdminAuthenticated }
  - pricingState: { config, breakdown }
- Store JWT in localStorage
- Axios instance with Authorization header interceptor

[API INTEGRATION]
Base URL: from .env → VITE_API_URL=http://localhost:5000/api

Key API calls to wire up:
- GET /api/pricing → public pricing config
- POST /api/pricing/calculate → { mealsPerDay, scheduleType } → breakdown
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/subscriptions → create subscription
- GET /api/subscriptions/active → user's active plan
- GET /api/deliveries/my → user delivery history
- POST /api/payments/flutterwave/initiate → get FLW config then use inline JS SDK
- POST /api/payments/manual/upload → FormData with receipt file
- Admin: GET /api/admin/dashboard
- Admin: PUT /api/pricing/admin → update pricing
- Admin: GET /api/deliveries/admin/today
- Admin: GET /api/payments/manual/pending
- Admin: PUT /api/payments/manual/:id/review

[FLUTTERWAVE INTEGRATION]
Load Flutterwave inline JS from: https://checkout.flutterwave.com/v3.js
After getting config from /api/payments/flutterwave/initiate, call:
FlutterwaveCheckout({ public_key, tx_ref, amount, currency, ...rest, callback: handlePaymentCallback })
On callback success → call GET /api/payments/verify?tx_ref=xxx to confirm

[COMPONENTS TO BUILD]
Reusable components:
- <Navbar /> — logo + nav links + auth state (login/register vs avatar+dropdown)
- <AdminSidebar /> — admin nav with icons
- <PriceBreakdown breakdown={} /> — the animated line-item breakdown
- <PlanToggle /> — meal count and schedule toggles  
- <SubscriptionCard subscription={} /> — active plan display
- <DeliveryCalendar deliveries={[]} /> — calendar grid
- <StatusBadge status={} /> — color-coded status pills
- <ReceiptUpload /> — file upload with preview
- <StatCard title value icon trend /> — admin dashboard cards
- <DeliveryTable deliveries={[]} onStatusChange /> — admin delivery board

[FORMS & VALIDATION]
- Use react-hook-form + zod for all forms
- Show inline validation errors
- Disable submit button while loading
- Show toast notifications (success/error) using shadcn/ui toast

[OUTPUT FORMAT]
- File structure: src/pages/, src/components/, src/context/, src/lib/api.ts, src/hooks/
- Each page is a separate file
- Components are modular and reusable
- All pages are mobile-responsive (mobile-first)
- Use shadcn/ui components where applicable (Button, Card, Input, Badge, Dialog, Table, Calendar)
- Format currency as: ₦ + toLocaleString() → "₦70,000"

[CONSTRAINTS]
- DO NOT use dummy/static data — always wire to the real API
- DO NOT skip mobile responsiveness
- DO NOT use purple/generic color schemes — follow the RemoteChef brand colors
- DO NOT build a monolithic App.tsx — split into proper pages and components
- Handle loading states with skeletons
- Handle empty states with friendly illustrations or messages
- Handle API errors with toast notifications
- The admin section must be completely separate from the user section in routing and auth

[NOTES FOR ABEOKUTA CONTEXT]
- All currency is ₦ (Naira)
- Phone numbers are Nigerian format (+234 or 080/081/090/070...)
- Address fields: Street, Area (e.g. Kuto, Ibara, Panseke, Oke-Mosan), City: Abeokuta, State: Ogun
- Delivery times: "12pm–2pm" is a realistic window
- The platform will expand to other cities later — build with city field in address
