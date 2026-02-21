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

# Step 1: Create DLQ (must exist before primary queue references it)
echo -e "${YELLOW}Step 1: Creating Dead Letter Queue (DLQ)...${NC}"
DLQ_RESPONSE=$(aws sqs create-queue \
  --queue-name "$DLQ_QUEUE" \
  --region "$REGION" \
  --attributes "MessageRetentionPeriod=1209600" \
  --output json)

DLQ_URL=$(echo "$DLQ_RESPONSE" | jq -r '.QueueUrl')
DLQ_ARN="arn:aws:sqs:$REGION:$ACCOUNT_ID:$DLQ_QUEUE"

echo -e "${GREEN}✓ DLQ created: $DLQ_URL${NC}"
echo ""

# Step 2: Create Primary Queue
echo -e "${YELLOW}Step 2: Creating Primary Queue...${NC}"
QUEUE_RESPONSE=$(aws sqs create-queue \
  --queue-name "$PRIMARY_QUEUE" \
  --region "$REGION" \
  --attributes \
    "VisibilityTimeout=30" \
    "MessageRetentionPeriod=1209600" \
  --output json)

QUEUE_URL=$(echo "$QUEUE_RESPONSE" | jq -r '.QueueUrl')
QUEUE_ARN="arn:aws:sqs:$REGION:$ACCOUNT_ID:$PRIMARY_QUEUE"

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
echo "⚠️  IMPORTANT: You must provide the following Meta CAPI credentials:"
echo "   - META_CAPI_APP_ID (Facebook App ID)"
echo "   - META_CAPI_TOKEN (Meta Access Token)"
echo "   - META_FACEBOOK_PIXEL_ID (Facebook Pixel ID)"
echo ""
echo "After running this script, update the secret with real values:"
echo "aws secretsmanager update-secret --secret-id $SECRET_NAME --secret-string '{...}'"
echo ""

# Create placeholder secret (user will update with real values)
SECRET_RESPONSE=$(aws secretsmanager create-secret \
  --name "$SECRET_NAME" \
  --region "$REGION" \
  --secret-string '{"appId":"PLACEHOLDER","accessToken":"PLACEHOLDER","pixelId":"PLACEHOLDER"}' \
  --output json 2>/dev/null || echo '{"ARN":"exists"}')

SECRET_ARN=$(echo "$SECRET_RESPONSE" | jq -r '.ARN // .SecretId' 2>/dev/null || echo "$SECRET_NAME")

echo -e "${GREEN}✓ Secret created/exists: $SECRET_NAME${NC}"
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
echo "   3. Commit .env.local changes (after removing secrets from version control)"
echo ""
echo "✅ Ready for Phase 2! @dev can now implement the SQS Worker."
echo ""
