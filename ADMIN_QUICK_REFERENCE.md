# Admin Quick Reference Guide

## Most Common Admin Operations

### 1. Login & Get Token
```bash
curl -X POST http://localhost:5000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "automationlounge@gmail.com",
    "password": "RemoteChef@2025!"
  }'

# Response: {"success": true, "token": "eyJhbGc..."}
# Save the token for subsequent requests
```

### 2. View Dashboard
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/admin/dashboard
```

**Key Metrics Returned:**
- totalUsers: Total registered users
- activeSubscriptions: Active meal plans
- thisMonthRevenue: Revenue this month
- pendingTransfers: Manual payments awaiting review

### 3. Manage Users

#### List All Users
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/admin/users
```

#### Deactivate a User
```bash
curl -X PUT http://localhost:5000/api/admin/users/USER_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

#### Reactivate a User
```bash
curl -X PUT http://localhost:5000/api/admin/users/USER_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}'
```

### 4. Manage Subscriptions

#### View All Subscriptions
```bash
# All subscriptions
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/admin/subscribers

# Active only
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/admin/subscribers?status=active"

# Paginated (page 2, 30 items)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/admin/subscribers?page=2&limit=30"
```

#### Pause a Subscription
```bash
curl -X PUT http://localhost:5000/api/admin/subscriptions/SUB_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "paused"}'
```

#### Cancel a Subscription
```bash
curl -X PUT http://localhost:5000/api/admin/subscriptions/SUB_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "cancelled"}'
```

#### Reactivate a Subscription
```bash
curl -X PUT http://localhost:5000/api/admin/subscriptions/SUB_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

### 5. Manage Payments

#### Review Pending Manual Transfer
```bash
# Get pending transfers
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/payments/manual/pending

# Approve transfer (activates subscription automatically)
curl -X PUT http://localhost:5000/api/payments/manual/TRANSFER_ID/review \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'

# Reject transfer
curl -X PUT http://localhost:5000/api/payments/manual/TRANSFER_ID/review \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "rejected"}'
```

### 6. Revenue Reports

```bash
# Current year
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/admin/revenue

# Specific year (2025)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/admin/revenue?year=2025"

# Returns monthly breakdown with revenue, profit, and counts
```

### 7. Manage Admins (Superadmin Only)

#### List All Admins
```bash
curl -H "Authorization: Bearer SUPERADMIN_TOKEN" \
  http://localhost:5000/api/admin/admins
```

#### Create New Admin
```bash
curl -X POST http://localhost:5000/api/admin/create-admin \
  -H "Authorization: Bearer SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Admin",
    "email": "john@remotechef.ng",
    "password": "SecurePass123!",
    "role": "admin"
  }'
```

#### Deactivate Admin
```bash
curl -X PUT http://localhost:5000/api/admin/admins/ADMIN_ID/status \
  -H "Authorization: Bearer SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

### 8. Manage Deliveries

#### Get Today's Deliveries
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/deliveries/admin/today
```

#### Get Deliveries by Date Range
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/deliveries/admin/range?startDate=2026-01-01&endDate=2026-12-31"
```

#### Update Delivery Status
```bash
curl -X PUT http://localhost:5000/api/deliveries/admin/DELIVERY_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "delivered"}'
```

---

## Helpful Notes

### Subscription Status Values
- `active` - Subscription is running
- `pending_payment` - Awaiting payment
- `paused` - Temporarily paused by admin
- `expired` - Subscription duration ended
- `cancelled` - User cancelled

### Subscriber Filter Options
- `status=active` - Active subscriptions
- `status=pending_payment` - Awaiting payment
- `status=paused` - Paused by admin
- `status=expired` - Expired subscriptions
- `status=cancelled` - Cancelled subscriptions

### Delivery Status Values
- `scheduled` - Upcoming delivery
- `out_for_delivery` - Currently being delivered
- `delivered` - Completed
- `failed` - Delivery failed

### Common Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad request (invalid data)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `409` - Conflict (duplicate email, etc.)
- `500` - Server error

---

## Token Management

### Save Token to File (Bash)
```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"automationlounge@gmail.com","password":"RemoteChef@2025!"}' \
  | jq -r '.token')

echo $TOKEN  # Display token
```

### Use Token in Subsequent Requests
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/admin/dashboard
```

---

## Postman Collection (Quick Import)

Save as `admin-routes.postman_collection.json`:

```json
{
  "info": {
    "name": "RemoteChef Admin API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "http://localhost:5000/api/auth/admin/login",
            "body": {
              "mode": "raw",
              "raw": "{\"email\": \"automationlounge@gmail.com\", \"password\": \"RemoteChef@2025!\"}"
            }
          }
        }
      ]
    },
    {
      "name": "Dashboard",
      "item": [
        {
          "name": "Dashboard Stats",
          "request": {
            "method": "GET",
            "url": "http://localhost:5000/api/admin/dashboard",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

---

## Environment Variables

Make sure `.env` is configured:

```
FRONTEND_URL=http://localhost:5178
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/remotechef
JWT_ADMIN_SECRET=your_admin_jwt_secret_here
```

---

## Troubleshooting

### 401 Unauthorized
- Check token is included in Authorization header
- Verify token format: `Bearer <token>` (with space)
- Token may have expired (1 day expiration)
- Get new token by logging in again

### 403 Forbidden
- Operation requires superadmin role
- Only superadmin can create/manage other admins
- Contact superadmin if needed

### 404 Not Found
- Check ID is valid
- Verify resource exists in database
- Double-check endpoint URL spelling

### Invalid Status
- Use exact status values (case-sensitive)
- For subscriptions: `active`, `paused`, `cancelled`
- For deliveries: `scheduled`, `out_for_delivery`, `delivered`, `failed`

---

## Related Documentation
- Full API Docs: `backend/ADMIN_ROUTES.md`
- Integration Summary: `backend/ADMIN_INTEGRATION_SUMMARY.md`
- Frontend Admin Pages: `frontend/src/pages/admin/`
