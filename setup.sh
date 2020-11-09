#!/bin/bash

set -e

SIPGATE_API_BASE_URL="https://api.sipgate.com/v2"

function to_lower_case {
  local result=$(echo "$1" | tr '[:upper:]' '[:lower:]')

  echo $result
}

function extract_json_value {
  local value=$(echo "$1" | grep -o "\"$2\":\"[^\"]*" | grep -o '[^"]*$')

  echo "$value"
}

function make_api_request {
  method="$1"
  slug="$2"
  token="$3"
  body="$4"

  response=$(curl -sb --request "$method" "$SIPGATE_API_BASE_URL$slug" \
  --header "Authorization: Basic $token" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  -d "$body")

  # TODO: More error handling :)
  if [ "$response" = "Unauthorized" ]; then
    printf "Got an 'Unauthorized' response from the server. Are your login details correct?\n"
    exit 1
  fi

  stripped_json=$(echo "$response" | sed -e 's/\s\+//g')

  echo $stripped_json
}

script_file="$(readlink -f "$0")"
env_path="$(dirname "$script_file")/.env"

if [ -f "$env_path" ]; then
  read -p ".env file seems to exist. Would you like to overwrite it? (Y/n)" delete_env_prompt

  delete_env_prompt="${delete_env_prompt:=y}"
  if [ 'y' = $(to_lower_case "$delete_env_prompt") ]; then
    rm "$env_path"
  else
    # We might want to start the service instead of exiting later on
    printf "Tschüsseldorf\n"
    exit
  fi
fi

read -p "Please enter your webhook URL (e.g.: https://your.domain:3000): " webhook_url
read -p "Please enter your sipgate email address: " sipgate_email
read -s -p "Please enter your password: " sipgate_password

printf "\n\n"

token=$(echo -n "$sipgate_email:$sipgate_password" | base64)

read -d '' webhook_settings_request << EOF || true
{
  "incomingUrl": "$webhook_url",
  "outgoingUrl": "$webhook_url"
}
EOF

make_api_request "PUT" "/settings/sipgateio" "$token" "$webhook_settings_request"

read -d '' oauth_client_request << EOF || true
{
  "name": "Call statistics service",
  "description": "Generated client for call statistics service ($(date))",
  "redirectUris": [
    "$webhook_url"
  ],
  "webOrigins": [
    "$webhook_url"
  ],
  "privacyUrl": "",
  "termsUrl": ""
}
EOF

oauth_body=$(make_api_request "POST" "/authorization/oauth2/clients" "$token" "$oauth_client_request")

client_id=$(extract_json_value "$oauth_body" "clientId")
client_secret=$(extract_json_value "$oauth_body" "clientSecret")

touch .env
printf "SIPGATE_CLIENT_ID=$client_id\n" >> .env
printf "SIPGATE_CLIENT_SECRET=$client_secret\n" >> .env
printf "SIPGATE_WEBHOOK_URL=$webhook_url\n" >> .env

printf "\nAdded new OAuth client and setup .env file\n"
