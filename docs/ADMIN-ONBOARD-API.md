# 📋 Admin Onboarding API — FASE 4 GO-LIVE

**Endpoint:** `POST /api/v1/admin/onboard-customer`
**Purpose:** Onboard new customers programmatically without manual SQL
**Status:** ✅ Ready for Production

---

## 🚀 Quick Start — Onboard MINUTOS PAGOS

### Option 1: cURL (Direct API Call)

```bash
curl -X POST http://localhost:3001/api/v1/admin/onboard-customer \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "MINUTOS PAGOS",
    "email": "guilhermesimas542@gmail.com",
    "gateway": "perfectpay",
    "funnelName": "Minutos Pagos - Instituton Nexxa",
    "funnelUrl": "https://institutonexxa.com"
  }'
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "funnelId": "660f9511-f39d-52e5-b827-557766551111",
  "tenantSlug": "minutos-pagos",
  "webhookUrl": "https://api.track-ai.com/api/v1/webhooks/perfectpay/550e8400-e29b-41d4-a716-446655440000",
  "trackingPixelCode": "<!-- Track AI Pixel -->\n<script async>...",
  "message": "✅ Customer onboarded successfully. Deploy tracking pixel on https://institutonexxa.com."
}
```

---

### Option 2: Node.js Script

```javascript
// onboard-customer.js
const axios = require('axios');

async function onboardCustomer() {
  try {
    const response = await axios.post(
      'http://localhost:3001/api/v1/admin/onboard-customer',
      {
        companyName: 'MINUTOS PAGOS',
        email: 'guilhermesimas542@gmail.com',
        gateway: 'perfectpay',
        funnelName: 'Minutos Pagos - Instituton Nexxa',
        funnelUrl: 'https://institutonexxa.com'
      }
    );

    console.log('✅ Customer onboarded!');
    console.log('Tenant ID:', response.data.tenantId);
    console.log('Funnel ID:', response.data.funnelId);
    console.log('\nWebhook URL:', response.data.webhookUrl);
    console.log('\nTracking Pixel Code:');
    console.log(response.data.trackingPixelCode);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

onboardCustomer();
```

---

## 📝 Request Schema

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `companyName` | string | ✅ | "MINUTOS PAGOS" |
| `email` | string | ✅ | "guilhermesimas542@gmail.com" |
| `gateway` | enum | ✅ | "perfectpay" |
| `funnelName` | string | ❌ | "Minutos Pagos - Instituton Nexxa" |
| `funnelUrl` | string | ❌ | "https://institutonexxa.com" |

**Gateway Options:**
- `perfectpay`
- `hotmart`
- `kiwify`
- `stripe`

---

## 📦 Response Schema

**Success (201):**
```javascript
{
  success: true,
  tenantId: string (UUID),
  funnelId: string (CUID, empty if no funnelName),
  tenantSlug: string (auto-generated from companyName),
  webhookUrl: string,
  trackingPixelCode: string (JavaScript code),
  message: string
}
```

**Error (400):**
```javascript
{
  success: false,
  message: string (error description)
}
```

---

## 🔧 What Gets Created

### 1. Tenant
```sql
INSERT INTO tenant (id, slug, name, status)
VALUES (uuid, 'minutos-pagos', 'MINUTOS PAGOS', 'active')
```

### 2. Funnel (if funnelName provided)
```sql
INSERT INTO funnel (id, tenantId, name, status)
VALUES (cuid, tenantId, 'Minutos Pagos - Instituton Nexxa', 'active')
```

### 3. Webhook URL
Generated automatically: `https://api.track-ai.com/api/v1/webhooks/perfectpay/{tenantId}`

### 4. Tracking Pixel Code
JavaScript snippet with:
- Auto-captures FBC, FBP, FBCLID from URL params
- Sends click events to Track AI API
- Requires deployment on customer website

---

## 🎯 Post-Onboarding Steps

### Step 1: Deploy Tracking Pixel

Give customer the `trackingPixelCode` and ask them to:

```html
<!-- Add this to your website header (before </head> tag) -->
<script async>
  (function() {
    window.__trackAI = window.__trackAI || {};
    window.__trackAI.tenantId = '550e8400-e29b-41d4-a716-446655440000';
    // ... rest of pixel code
  })();
</script>
```

### Step 2: Configure Webhook Secret

1. Get the webhook URL from response: `https://api.track-ai.com/api/v1/webhooks/perfectpay/{tenantId}`
2. Store in customer's account with secret key
3. When sending conversions, compute HMAC signature:
   ```javascript
   const crypto = require('crypto');
   const signature = crypto
     .createHmac('sha256', secretKey)
     .update(JSON.stringify(payload))
     .digest('hex');
   ```

### Step 3: Send First Test Conversion

```bash
curl -X POST https://api.track-ai.com/api/v1/webhooks/perfectpay/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-perfectpay-signature: {HMAC_SIGNATURE}" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "test-001",
    "customer": {
      "email": "guilhermesimas542@gmail.com",
      "phone": "+5511999999999"
    },
    "amount": 99.90,
    "currency": "BRL",
    "status": "approved"
  }'
```

### Step 4: Monitor in Dashboard

1. Open dashboard: `https://dashboard.track-ai.com/analytics`
2. Filter by tenant: "MINUTOS PAGOS"
3. Watch for:
   - ✅ Click events appearing (from tracking pixel)
   - ✅ Conversion events appearing (from webhook)
   - ✅ Match logs showing matched conversions
   - ✅ Dispatch events showing Meta CAPI sends

---

## ❌ Error Handling

### Duplicate Tenant
```json
{
  "success": false,
  "message": "Tenant with slug \"minutos-pagos\" already exists"
}
```

**Fix:** Use a different company name or retrieve existing tenant from database.

### Invalid Gateway
```json
{
  "success": false,
  "message": "gateway must be one of: perfectpay, hotmart, kiwify, stripe"
}
```

### Missing Required Field
```json
{
  "success": false,
  "message": "companyName is required"
}
```

---

## 🔄 Batch Onboarding

If you have multiple customers, create a CSV and loop:

```javascript
const csv = require('csv-parse/sync');
const fs = require('fs');
const axios = require('axios');

const data = csv.parse(fs.readFileSync('customers.csv'), {
  columns: true
});

for (const customer of data) {
  try {
    const result = await axios.post(
      'http://localhost:3001/api/v1/admin/onboard-customer',
      {
        companyName: customer.company_name,
        email: customer.email,
        gateway: customer.gateway,
        funnelName: customer.funnel_name
      }
    );
    console.log(`✅ ${customer.company_name}: ${result.data.tenantId}`);
  } catch (error) {
    console.error(`❌ ${customer.company_name}: ${error.message}`);
  }
}
```

---

## 📊 API Metrics

| Metric | Target |
|--------|--------|
| Response Time | < 500ms |
| Success Rate | > 99.9% |
| Duplicates Handled | Gracefully (error message) |
| Max Customers/Batch | No limit |

---

## 🚀 FASE 4 Completion

✅ **Admin Onboarding Endpoint COMPLETE**

**Next Steps:**
1. Test with MINUTOS PAGOS using curl/script above
2. Monitor first conversions in CloudWatch
3. Deploy tracking pixel on customer website
4. Validate end-to-end flow (click → conversion → Meta CAPI)

---

**Ready for production! 🎉**

