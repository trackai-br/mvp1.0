#!/usr/bin/env bash
set -euo pipefail

SRC="infra/secrets/.env.local"
DST=".env"

if [[ ! -f $SRC ]]; then
  echo "Source file $SRC not found"
  exit 1
fi

declare -a KEYS=(
  "DB_URL"
  "SUPABASE_API_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "REDIS_URL"
  "GTM_ACCOUNT_ID"
  "GTM_CONTAINER_ID"
  "GTM_CREDENTIALS_PATH"
  "CF_ACCOUNT_ID"
  "CF_ZONE_ID"
  "CF_API_TOKEN"
  "CF_BASE_DOMAIN"
  "PERFECTPAY_WEBHOOK_SECRET"
  "PERFECTPAY_API_KEY"
  "KIWIFY_WEBHOOK_SECRET"
  "HOTMART_WEBHOOK_TOKEN"
  "STRIPE_WEBHOOK_SECRET"
  "AWS_REGION"
  "AWS_ACCOUNT_ID"
  "AWS_SECRET_NAME_FOR_DB"
  "SQS_URL"
  "SENTRY_DSN"
  "NEXT_PUBLIC_TRACK_DOMAIN"
  "STAPE_API_KEY"
  "SUPABASE_PROJECT_URL"
  "SUPABASE_PUBLISHABLE_KEY"
  "SUPABASE_ANON_KEY"
)

declare -A VALUES
while IFS='=' read -r key value; do
  key="${key%% }"
  key="${key## }"
  if [[ ${#key} -eq 0 || "$key" == \#* ]]; then
    continue
  fi
  VALUES["$key"]="$value"
done < "$SRC"

[[ -f $DST ]] || touch "$DST"

tmp=$(mktemp)

declare -A seen
while IFS= read -r line || [[ -n $line ]]; do
  if [[ "$line" =~ ^([A-Z0-9_]+)=(.*) ]]; then
    key="${BASH_REMATCH[1]}"
    if [[ -v VALUES[$key] ]]; then
      echo "$key=${VALUES[$key]}" >> "$tmp"
      seen["$key"]=1
      continue
    fi
  fi
  echo "$line" >> "$tmp"
done < "$DST"

for key in "${KEYS[@]}"; do
  if [[ -v VALUES[$key] && -z "${seen[$key]:-}" ]]; then
    echo "$key=${VALUES[$key]}" >> "$tmp"
  fi
done

mv "$tmp" "$DST"
