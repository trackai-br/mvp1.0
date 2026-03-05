#!/bin/bash

##############################################################################
# PHASE 0 — LOCAL VALIDATION SUITE
# Hub Server-Side Tracking MVP
#
# Protocolo: PENSAR → PLANEJAR → REVISAR → EXECUTAR → DOCUMENTAR
#
# Este script valida que o sistema está 100% funcional localmente
# antes de qualquer deploy.
##############################################################################

set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TENANT_ID="fcfe64b0-6e3d-498d-a1f2-377626c85b40"
API_URL="http://localhost:3001"
WEB_URL="http://localhost:3000"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║       PHASE 0 — LOCAL VALIDATION SUITE                     ║"
echo "║       Hub Server-Side Tracking MVP Go-Live                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Configuração:"
echo "  API URL:    $API_URL"
echo "  Web URL:    $WEB_URL"
echo "  Tenant ID:  $TENANT_ID"
echo ""

# TEST 1: Health Check
echo -e "${BLUE}[TEST 1] Health Check${NC}"
echo "Command: curl -s $API_URL/api/v1/health"
HEALTH=$(curl -s "$API_URL/api/v1/health")
echo "Response: $HEALTH"

if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ PASSED${NC}: API responding + database connected"
else
    echo -e "${RED}❌ FAILED${NC}: Health check failed"
    exit 1
fi
echo ""

# TEST 2: Web Frontend
echo -e "${BLUE}[TEST 2] Web Frontend Loading${NC}"
echo "Command: curl -s -I $WEB_URL | head -5"
WEB_STATUS=$(curl -s -I "$WEB_URL" | head -1)
echo "Response: $WEB_STATUS"

if echo "$WEB_STATUS" | grep -q "200"; then
    echo -e "${GREEN}✅ PASSED${NC}: Frontend loads successfully"
else
    echo -e "${RED}❌ FAILED${NC}: Frontend not responding"
    exit 1
fi
echo ""

# TEST 3: Click Ingestion
echo -e "${BLUE}[TEST 3] Click Ingestion${NC}"
echo "Command: POST $API_URL/api/v1/track/click"
echo "Payload:"
cat <<EOF
{
  "fbclid": "test-click-001",
  "fbc": "fb.1.1234567890.test",
  "fbp": "fb.1.1234567890.test",
  "url": "https://example.com/checkout"
}
EOF
echo ""

CLICK_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/track/click" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "fbclid": "test-click-001",
    "fbc": "fb.1.1234567890.test",
    "fbp": "fb.1.1234567890.test",
    "url": "https://example.com/checkout"
  }')

echo "Response: $CLICK_RESPONSE"

if echo "$CLICK_RESPONSE" | grep -q '"id"'; then
    CLICK_ID=$(echo "$CLICK_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)
    echo -e "${GREEN}✅ PASSED${NC}: Click created with ID: $CLICK_ID"
else
    echo -e "${RED}❌ FAILED${NC}: Click ingestion failed"
    echo "Response: $CLICK_RESPONSE"
    exit 1
fi
echo ""

# TEST 4: Setup Session Creation
echo -e "${BLUE}[TEST 4] Setup Session Creation${NC}"
echo "Command: POST $API_URL/api/v1/setup/sessions"
echo "Payload:"
cat <<EOF
{
  "tenantId": "$TENANT_ID",
  "projectName": "Test Project"
}
EOF
echo ""

SESSION_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/setup/sessions" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"projectName\": \"Test Project\",
    \"trackingEnvironment\": \"lp\",
    \"landingUrl\": \"https://example.com\",
    \"meta\": {\"accountId\": \"123\", \"token\": \"test-token\"},
    \"gateway\": {\"name\": \"perfectpay\", \"apiKey\": \"test-key\"}
  }")

echo "Response: $SESSION_RESPONSE"

if echo "$SESSION_RESPONSE" | grep -q '"id"'; then
    SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)
    echo -e "${GREEN}✅ PASSED${NC}: Setup session created with ID: $SESSION_ID"
else
    echo -e "${RED}❌ FAILED${NC}: Setup session creation failed"
    echo "Response: $SESSION_RESPONSE"
    exit 1
fi
echo ""

# TEST 5: Database Query
echo -e "${BLUE}[TEST 5] Database Verification${NC}"
echo "Checking: Click record exists in database"
echo "(Visual inspection needed in Supabase Studio)"
echo -e "${YELLOW}⚠️  MANUAL CHECK${NC}: Open Supabase Studio → Table 'Click' → Verify test-click-001 exists"
echo ""

# TEST 6: Logs Check
echo -e "${BLUE}[TEST 6] Application Logs${NC}"
echo "Check npm run dev terminal for:"
echo "  ✓ No ERROR messages"
echo "  ✓ No WARN messages (except normal startup warnings)"
echo "  ✓ Request logs show successful responses"
echo -e "${YELLOW}⚠️  MANUAL CHECK${NC}: Look at your 'npm run dev' terminal"
echo ""

# SUMMARY
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              PHASE 0 VALIDATION COMPLETE                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ AUTOMATED TESTS: 4/4 PASSED${NC}"
echo -e "${YELLOW}⚠️  MANUAL CHECKS: 2 (see above)${NC}"
echo ""
echo "Next Steps:"
echo "  1. Verify manual checks above"
echo "  2. Run: npm run test (to validate unit tests)"
echo "  3. Check PROGRESS.md and mark Phase 0 COMPLETE"
echo "  4. Then proceed to Phase 1 (Staging Deploy)"
echo ""
