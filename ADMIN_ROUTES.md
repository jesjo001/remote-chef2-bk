# Admin Routes Documentation

## Overview
All admin routes require authentication via `adminProtect` middleware. Superadmin-only routes require `superAdminOnly` middleware.

**Base URL:** `http://localhost:5000/api`

---

## Authentication Routes

### Admin Login
- **Endpoint:** `POST /auth/admin/login`
- **Auth Required:** ❌ No
- **Body:**
  ```json
  {
    "email": "automationlounge@gmail.com",
    "password": "RemoteChef@2025!"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "token": "jwt_token_here",
    "admin": {
      "id": "admin_id",
      "name": "RemoteChef Admin",
      "email": "automationlounge@gmail.com",
      "role": "superadmin"
    }
  }
  ```

### Get Admin Profile
- **Endpoint:** `GET /auth/admin/me`
- **Auth Required:** ✅ Yes (Admin Token)
- **Response:**
  ```json
  {
    "success": true,
    "admin": {
      "id": "admin_id",
      "name": "RemoteChef Admin",
      "email": "automationlounge@gmail.com",
      "role": "superadmin"
    }
  }
  ```

---

## Dashboard & Analytics

### Dashboard Statistics
- **Endpoint:** `GET /admin/dashboard`
- **Auth Required:** ✅ Yes (Admin Token)
- **Response:**
  ```json
  {
    "success": true,
    "stats": {
      "totalUsers": 42,
      "activeSubscriptions": 15,
      "pendingPayments": 3,
      "todayDeliveries": 8,
      "thisMonthRevenue": 125000,
      "allTimeRevenue": 450000,
      "estimatedProfit": 80000,
      "pendingTransfers": 2,
      "recent": [...]
    }
  }
  ```

### Revenue Report
- **Endpoint:** `GET /admin/revenue?year=2026`
- **Auth Required:** ✅ Yes (Admin Token)
- **Query Parameters:**
  - `year` (optional): Default current year
- **Response:**
  ```json
  {
    "success": true,
    "monthlyRevenue": [
      {
        "_id": 1,
        "revenue": 45000,
        "count": 12
      }
    ],
    "profitByMonth": [...]
  }
  ```

---

## User Management

### Get All Users
- **Endpoint:** `GET /admin/users`
- **Auth Required:** ✅ Yes (Admin Token)
- **Response:**
  ```json
  {
    "success": true,
    "users": [
      {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+234701234567",
        "isActive": true,
        "createdAt": "2026-01-15T10:30:00Z"
      }
    ]
  }
  ```

### Toggle User Status
- **Endpoint:** `PUT /admin/users/:userId/status`
- **Auth Required:** ✅ Yes (Admin Token)
- **Body:**
  ```json
  {
    "isActive": false
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "User deactivated.",
    "user": {
      "id": "user_id",
      "email": "john@example.com",
      "isActive": false
    }
  }
  ```

### Soft Delete User
- **Endpoint:** `DELETE /admin/users/:userId`
- **Auth Required:** ✅ Yes (Admin Token)
- **Response:**
  ```json
  {
    "success": true,
    "message": "User deactivated successfully."
  }
  ```

---

## Subscriber Management

### Get All Subscribers
- **Endpoint:** `GET /admin/subscribers?status=active&page=1&limit=20`
- **Auth Required:** ✅ Yes (Admin Token)
- **Query Parameters:**
  - `status` (optional): `active`, `pending_payment`, `paused`, `expired`, `cancelled`
  - `page` (optional): Default 1
  - `limit` (optional): Default 20, max 100
- **Response:**
  ```json
  {
    "success": true,
    "total": 50,
    "page": 1,
    "pages": 3,
    "limit": 20,
    "subscriptions": [
      {
        "_id": "sub_id",
        "user": {
          "_id": "user_id",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "status": "active",
        "mealsPerDay": 2,
        "createdAt": "2026-01-15T10:30:00Z"
      }
    ]
  }
  ```

### Toggle Subscription Status
- **Endpoint:** `PUT /admin/subscriptions/:subscriptionId/status`
- **Auth Required:** ✅ Yes (Admin Token)
- **Body:**
  ```json
  {
    "status": "paused"
  }
  ```
- **Allowed Status Values:** `active`, `paused`, `cancelled`
- **Response:**
  ```json
  {
    "success": true,
    "message": "Subscription paused.",
    "subscription": {...}
  }
  ```

---

## Pricing Management

### Get Pricing Configuration
- **Endpoint:** `GET /api/pricing/admin`
- **Auth Required:** ✅ Yes (Admin Token)
- **Response:**
  ```json
  {
    "success": true,
    "pricing": {
      "basePrice": 5000,
      "locations": [...],
      "discounts": [...]
    }
  }
  ```

### Update Pricing Configuration
- **Endpoint:** `PUT /api/pricing/admin`
- **Auth Required:** ✅ Yes (Admin Token)
- **Body:**
  ```json
  {
    "basePrice": 5500,
    "locations": [...],
    "discounts": [...]
  }
  ```

---

## Admin Management (Superadmin Only)

### Get All Admins
- **Endpoint:** `GET /admin/admins`
- **Auth Required:** ✅ Yes (Superadmin Token)
- **Response:**
  ```json
  {
    "success": true,
    "admins": [
      {
        "_id": "admin_id",
        "name": "RemoteChef Admin",
        "email": "admin@remotechef.ng",
        "role": "superadmin",
        "isActive": true
      }
    ]
  }
  ```

### Create Admin User
- **Endpoint:** `POST /admin/create-admin`
- **Auth Required:** ✅ Yes (Superadmin Token)
- **Body:**
  ```json
  {
    "name": "New Admin",
    "email": "newadmin@remotechef.ng",
    "password": "SecurePass123!",
    "role": "admin"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "admin": {
      "id": "new_admin_id",
      "name": "New Admin",
      "email": "newadmin@remotechef.ng",
      "role": "admin"
    }
  }
  ```

### Toggle Admin Status
- **Endpoint:** `PUT /admin/admins/:adminId/status`
- **Auth Required:** ✅ Yes (Superadmin Token)
- **Body:**
  ```json
  {
    "isActive": false
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Admin deactivated.",
    "admin": {
      "id": "admin_id",
      "email": "admin@remotechef.ng",
      "isActive": false
    }
  }
  ```

---

## Payment Management

### Get Pending Transfers
- **Endpoint:** `GET /api/payments/manual/pending`
- **Auth Required:** ✅ Yes (Admin Token)

### Review Manual Transfer
- **Endpoint:** `PUT /api/payments/manual/:id/review`
- **Auth Required:** ✅ Yes (Admin Token)
- **Body:**
  ```json
  {
    "status": "approved"
  }
  ```
- **Status Values:** `approved`, `rejected`

---

## Delivery Management

### Get Today's Deliveries
- **Endpoint:** `GET /api/deliveries/admin/today`
- **Auth Required:** ✅ Yes (Admin Token)

### Get Deliveries by Date Range
- **Endpoint:** `GET /api/deliveries/admin/range?startDate=2026-01-01&endDate=2026-12-31`
- **Auth Required:** ✅ Yes (Admin Token)

### Update Delivery Status
- **Endpoint:** `PUT /api/deliveries/admin/:id/status`
- **Auth Required:** ✅ Yes (Admin Token)
- **Body:**
  ```json
  {
    "status": "delivered"
  }
  ```

---

## Error Responses

All endpoints follow this error format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information (in development)"
}
```

### Common Status Codes
- `200` - Success
- `201` - Resource created
- `400` - Bad request
- `401` - Unauthorized / Invalid token
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `409` - Conflict (e.g., duplicate email)
- `500` - Server error

---

## Authentication Header

All protected endpoints require:
```
Authorization: Bearer <admin_jwt_token>
```

---

## Initial Setup

1. **Seed the superadmin:**
   ```bash
   cd backend
   npx ts-node src/scripts/seed-admin.ts
   ```

2. **Get admin token:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/admin/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "automationlounge@gmail.com",
       "password": "RemoteChef@2025!"
     }'
   ```

3. **Use token in subsequent requests:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:5000/api/admin/dashboard
   ```
