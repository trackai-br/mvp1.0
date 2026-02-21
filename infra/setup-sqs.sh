#!/bin/bash
# Story 009 Phase 2 — SQS Infrastructure Setup
# This script creates SQS queues and AWS Secrets Manager for Meta CAPI dispatch

set -e  # Exit on error

echo "🚀 Starting SQS Infrastructure Setup for Story 009 Phase 2..."
echo ""

# Configuration
REGION="us-east-1"
ACCOUNT_ID="571944667101"
PRIMARY_QUEUE="capi-dispatch"
DLQ_QUEUE="capi-dispatch-dlq"
SECRET_NAME="meta-capi-credentials"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper function to extract URL from AWS response
extract_queue_url() {
    grep -o '"QueueUrl": "[^"]*"' | cut -d'"' -f4
}

# Step 1: Create DLQ (must exist before primary queue references it)
echo -e "${YELLOW}Step 1: Creating Dead Letter Queue (DLQ)...${NC}"
DLQ_RESPONSE=$(aws sqs create-queue \
  --queue-name "$DLQ_QUEUE" \
  --region "$REGION" \
  --attributes "MessageRetentionPeriod=1209600" 2>&1)

DLQ_URL=$(echo "$DLQ_RESPONSE" | extract_queue_url)
DLQ_ARN="arn:aws:sqs:$REGION:$ACCOUNT_ID:$DLQ_QUEUE"

if [ -z "$DLQ_URL" ]; then
    echo -e "${RED}❌ Failed to create DLQ${NC}"
    echo "Response: $DLQ_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ DLQ created: $DLQ_URL${NC}"
echo ""

# Step 2: Create Primary Queue
echo -e "${YELLOW}Step 2: Creating Primary Queue...${NC}"
QUEUE_RESPONSE=$(aws sqs create-queue \
  --queue-name "$PRIMARY_QUEUE" \
  --region "$REGION" \
  --attributes \
    "VisibilityTimeout=30" \
    "MessageRetentionPeriod=1209600" 2>&1)

QUEUE_URL=$(echo "$QUEUE_RESPONSE" | extract_queue_url)
QUEUE_ARN="arn:aws:sqs:$REGION:$ACCOUNT_ID:$PRIMARY_QUEUE"

if [ -z "$QUEUE_URL" ]; then
    echo -e "${RED}❌ Failed to create queue${NC}"
    echo "Response: $QUEUE_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Queue created: $QUEUE_URL${NC}"
echo ""

# Step 3: Set RedrivePolicy (link queue to DLQ, max 5 retries)
echo -e "${YELLOW}Step 3: Linking Queue to DLQ (maxReceiveCount=5)...${NC}"
REDRIVE_POLICY="{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":5}"

aws sqs set-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attributes "RedrivePolicy=$REDRIVE_POLICY" \
  --region "$REGION"

echo -e "${GREEN}✓ RedrivePolicy configured${NC}"
echo ""

# Step 4: Create AWS Secrets Manager Secret
echo -e "${YELLOW}Step 4: Creating AWS Secrets Manager Secret...${NC}"

SECRET_RESPONSE=$(aws secretsmanager create-secret \
  --name "$SECRET_NAME" \
  --region "$REGION" \
  --secret-string '{"appId":"PLACEHOLDER","accessToken":"PLACEHOLDER","pixelId":"PLACEHOLDER"}' 2>&1)

# Check if secret was created (may already exist)
if echo "$SECRET_RESPONSE" | grep -q "ResourceExistsException\|already exists"; then
    echo -e "${GREEN}✓ Secret already exists: $SECRET_NAME${NC}"
else
    echo -e "${GREEN}✓ Secret created: $SECRET_NAME${NC}"
fi

echo ""

# Step 5: Summary and Output
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Infrastructure Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📋 Queue Details:"
echo "   Primary Queue URL: $QUEUE_URL"
echo "   DLQ URL:          $DLQ_URL"
echo "   Max Retries:      5"
echo ""
echo "🔐 Secrets Details:"
echo "   Secret Name:      $SECRET_NAME"
echo "   Region:           $REGION"
echo ""
echo "📝 Next Steps:"
echo "   1. Update the secret with real Meta CAPI credentials:"
echo ""
echo "      aws secretsmanager update-secret \\"
echo "        --secret-id $SECRET_NAME \\"
echo "        --region $REGION \\"
echo "        --secret-string '{\"appId\":\"YOUR_APP_ID\",\"accessToken\":\"YOUR_TOKEN\",\"pixelId\":\"YOUR_PIXEL_ID\"}'"
echo ""
echo "   2. Update infra/secrets/.env.local with:"
echo ""
echo "      SQS_QUEUE_URL=$QUEUE_URL"
echo "      SQS_DLQ_URL=$DLQ_URL"
echo "      META_CAPI_SECRET_NAME=$SECRET_NAME"
echo ""
echo "   3. Commit changes and notify @dev"
echo ""
echo "✅ Ready for Phase 2! @dev can now implement the SQS Worker."
echo ""
