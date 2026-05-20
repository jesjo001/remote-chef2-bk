# REMOTECHEF BACKEND — VS CODE AI PROMPT
## Optimized for: Cursor / GitHub Copilot / Claude in VS Code
---

[ROLE]
You are a senior Node.js backend engineer with expertise in Express.js, TypeScript, MongoDB/Mongoose, REST API design, and payment gateway integration. You write production-grade, type-safe, modular backend code with proper error handling and security practices.

[TASK]
Build the complete RESTful API backend for RemoteChef — a monthly food delivery subscription platform for remote workers in Abeokuta, Nigeria. Users subscribe to meal packages, pay via Flutterwave or manual bank transfer, and receive daily food deliveries. Admins manage pricing, subscribers, deliveries, and manual payment confirmations.

[CONTEXT]
Stack: Node.js + Express.js + TypeScript + MongoDB (Mongoose)
Deployment: cPanel shared hosting via Phusion Passenger
Payment: Flutterwave (card/bank/USSD) + Manual Bank Transfer (receipt upload, admin approval)
File uploads: Multer (local disk to /uploads/receipts/)
Scheduling: node-cron (Africa/Lagos timezone)
Auth: JWT (separate secrets for users vs admins)

Project structure:
remotechef-backend/
├── src/
│   ├── config/db.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Admin.ts
│   │   ├── PricingConfig.ts      ← single-document config
│   │   ├── Subscription.ts
│   │   ├── Payment.ts            ← also exports ManualTransfer model
│   │   └── Delivery.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── pricing.controller.ts
│   │   ├── subscription.controller.ts
│   │   ├── payment.controller.ts
│   │   ├── delivery.controller.ts
│   │   └── admin.controller.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   └── index.ts              ← exports all other routers
│   ├── middleware/
│   │   ├── auth.middleware.ts    ← protect (user) + adminProtect + superAdminOnly
│   │   └── upload.middleware.ts  ← multer config for receipts
│   ├── services/
│   │   ├── flutterwave.service.ts
│   │   └── cron.service.ts
│   ├── utils/pricing.util.ts     ← calculatePricing(), generateDeliveryDates(), generateTxRef()
│   └── index.ts                  ← Express app bootstrap
├── .env.example
├── package.json
└── tsconfig.json

[REQUIREMENTS]

FUNCTIONAL REQUIREMENTS:
1. User registration + login (JWT, bcrypt password hashing)
2. Admin login (separate JWT secret, role: admin | superadmin)
3. PricingConfig: single-document upsert model with:
   - Selling prices: mealPrice, deliveryFee, processingFee
   - Cost prices: mealCostPrice, deliveryCostPrice (for profit margin tracking)
   - Schedule counts: workdayCount (default 20), allDayCount (default 26)
   - Manual transfer toggle: manualTransferEnabled + bankName + accountNumber + accountName
4. Pricing calculator endpoint: accepts { mealsPerDay: 1|2, scheduleType: 'workdays'|'alldays' }
   Formula: dailyTotal = (mealPrice × mealsPerDay) + deliveryFee
            monthlyBase = dailyTotal × deliveryDays
            total = monthlyBase + processingFee
5. Subscription creation: locks in a pricing snapshot at time of purchase (includes cost/profit)
6. Flutterwave payment: initiate (return FLW inline config), webhook (verify + activate sub), verify endpoint
7. Manual transfer: upload receipt (Multer), admin approve/reject workflow
8. Delivery generation: createDeliveryDates() generates all delivery dates when subscription activates
9. Admin delivery board: today's deliveries with user address + status management
10. Admin dashboard: totalUsers, activeSubscriptions, todayDeliveries, thisMonthRevenue, estimatedProfit
11. Revenue report: monthly breakdown aggregation

NON-FUNCTIONAL:
- All endpoints return { success: boolean, message?: string, data? }
- Proper HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500)
- Async/await with try-catch in every controller
- TypeScript strict mode
- MongoDB indexes on: scheduledDate+status (Delivery), email (User, Admin)
- CORS configured for frontend URL
- Helmet for security headers
- Morgan for logging

[API ENDPOINTS]

AUTH:
POST   /api/auth/register         → create user
POST   /api/auth/login            → user login
GET    /api/auth/me               → get user profile (protect)
PUT    /api/auth/me               → update profile (protect)
POST   /api/auth/admin/login      → admin login
GET    /api/auth/admin/me         → admin profile (adminProtect)

PRICING:
GET    /api/pricing               → public: selling prices + manual transfer status
POST   /api/pricing/calculate     → public: live breakdown { mealsPerDay, scheduleType }
GET    /api/pricing/admin         → admin: full config incl. cost prices + margins
PUT    /api/pricing/admin         → admin: update config (adminProtect)

SUBSCRIPTIONS:
POST   /api/subscriptions         → create subscription (protect)
GET    /api/subscriptions         → my subscriptions (protect)
GET    /api/subscriptions/active  → my active subscription + upcoming deliveries (protect)
PUT    /api/subscriptions/:id/cancel → cancel (protect)

PAYMENTS:
POST   /api/payments/flutterwave/initiate → get FLW inline config (protect)
POST   /api/payments/flutterwave/webhook  → FLW webhook (no auth, verify by hash)
GET    /api/payments/verify               → verify by tx_ref (protect)
POST   /api/payments/manual/upload        → upload receipt FormData (protect)
GET    /api/payments/manual/pending       → list pending transfers (adminProtect)
PUT    /api/payments/manual/:id/review    → approve/reject (adminProtect)

DELIVERIES:
GET    /api/deliveries/my              → my deliveries, optional ?month&year (protect)
GET    /api/deliveries/admin/today     → today's board (adminProtect)
GET    /api/deliveries/admin/range     → ?from&to&status (adminProtect)
PUT    /api/deliveries/admin/:id/status → update status (adminProtect)

ADMIN:
GET    /api/admin/dashboard        → stats overview (adminProtect)
GET    /api/admin/subscribers      → paginated list ?status&page&limit (adminProtect)
GET    /api/admin/users            → all users (adminProtect)
GET    /api/admin/revenue          → monthly aggregation (adminProtect)
POST   /api/admin/create-admin     → create new admin (adminProtect + superAdminOnly)

[OUTPUT FORMAT]
- TypeScript (.ts) files only
- Use named exports for controllers and utilities
- Use default exports for Mongoose models and the Express router
- All Mongoose schemas must include timestamps: true
- Add MongoDB indexes where specified
- Cron jobs must use { timezone: 'Africa/Lagos' }
- generateTxRef() format: RC-{timestamp}-{random6chars}
- generateDeliveryDates() must skip Sundays for alldays, skip Sat+Sun for workdays

[EXAMPLES — Key patterns to follow]

Pricing calculation (in utils/pricing.util.ts):
const deliveryDays = scheduleType === 'workdays' ? config.workdayCount : config.allDayCount;
const mealCostPerDay = config.mealPrice * mealsPerDay;
const dailyTotal = mealCostPerDay + config.deliveryFee;
const monthlyBase = dailyTotal * deliveryDays;
const totalAmount = monthlyBase + config.processingFee;
const totalCost = (config.mealCostPrice * mealsPerDay + config.deliveryCostPrice) * deliveryDays;
const totalProfit = totalAmount - totalCost;

Flutterwave webhook verification:
const hash = req.headers['verif-hash'];
if (hash !== process.env.FLW_WEBHOOK_HASH) → reject 401

Manual transfer approval flow:
approve → Payment.status = 'successful' → activateSubscription(subscriptionId)
reject  → Payment.status = 'failed' → subscription stays 'pending_payment'

activateSubscription():
1. Subscription.status = 'active'
2. generateDeliveryDates(startDate, endDate, scheduleType) → Date[]
3. Delivery.insertMany(dates.map → { subscription, user, scheduledDate, mealsCount, status:'scheduled' })

[CONSTRAINTS]
- DO NOT expose cost prices or profit data to non-admin endpoints
- DO NOT allow manual transfer payment if manualTransferEnabled === false in config
- DO NOT create a new PricingConfig on every update — use findOneAndUpdate with upsert: true
- DO NOT trust Flutterwave webhook without verifying the verif-hash header AND re-verifying transaction via their API
- ALWAYS return { success: false } with appropriate status codes on errors
- NEVER let failed webhook crash the server — always respond 200 to Flutterwave even on internal errors (log the error instead)
- Handle the case where subscription is already 'active' before processing payment again (idempotency)
- Multer should only accept: image/jpeg, image/jpg, image/png, image/webp, application/pdf
- Max upload size: 5MB
