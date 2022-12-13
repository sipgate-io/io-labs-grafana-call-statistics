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

  response=$(curl -s --request "$method" "$SIPGATE_API_BASE_URL$slug" \
  --header "Authorization: Basic $token" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  -d "$body" \
  --write-out '\n%{http_code}'
  )
  response_body="$(echo "$response" | head -n -1)"
  status="$(echo "$response" | tail -n 1)"

  if [[ "$status" == "400" ]]; then
    echo "Please provide a valid webhook URL."
    exit 1
  fi
  if [[ "$status" != "2"* ]]; then
    echo "Got an $status response from the server. Are your login details correct?"
    exit 1
  fi

  stripped_json=$(echo "$response_body" | sed -e 's/\s\+//g')

  echo $stripped_json
}

script_file="$(readlink -f "$0")"
env_path="$(dirname "$script_file")/.env"

if [ -f "$env_path" ]; then
  read -p ".env file seems to exist. Would you like to overwrite it? (Y/n) " delete_env_prompt

  delete_env_prompt="${delete_env_prompt:=y}"
  if [ 'y' = $(to_lower_case "$delete_env_prompt") ]; then
    rm "$env_path"
  else
    printf "Aborting setup.\nYour current .env file will be used.\n"
    exit
  fi
fi

read -p "Please enter your sipgate.io Personal Access Token-ID (Required Scopes: authorization:*): " sipgate_email
read -s -p "Please enter your Personal Access Token: " sipgate_password
printf "\n"
read -p "Please enter your webhook URL (e.g.: https://your.domain:3000): " webhook_url
read -p "Please enter your webhook port [8080]: " webhook_port
webhook_port=${webhook_port:-8080}
read -p "Please enter the containers internal port [8080]: " internal_port
internal_port=${internal_port:-8080}

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
    "http://localhost:$webhook_port/auth-code"
  ],
  "webOrigins": [
    "http://localhost:$webhook_port/auth-code"
  ],
  "privacyUrl": "",
  "termsUrl": ""
}
EOF

oauth_body=$(make_api_request "POST" "/authorization/oauth2/clients" "$token" "$oauth_client_request")
client_id=$(extract_json_value "$oauth_body" "clientId")
oauth_body=$(make_api_request "GET" "/authorization/oauth2/clients/$client_id" "$token")
client_secret=$(extract_json_value "$oauth_body" "clientSecret")

read -p "mySQL host [db]: " mysql_host
mysql_host=${mysql_host:-db}
read -p "mySQL database [call_statistics]: " mysql_database
mysql_database=${mysql_database:-call_statistics}
read -p "mySQL user [user]: " mysql_user
mysql_user=${mysql_user:-user}
read -p "mySQL password [supersecret]: " mysql_password
mysql_password=${mysql_password:-supersecret}

touch .env
printf "SIPGATE_CLIENT_ID=$client_id\n" >> .env
printf "SIPGATE_CLIENT_SECRET=$client_secret\n" >> .env
printf "SIPGATE_WEBHOOK_URL=$webhook_url\n" >> .env
printf "SIPGATE_WEBHOOK_PORT=$webhook_port\n" >> .env
printf "INTERNAL_PORT=$internal_port\n" >> .env
printf "\n" >> .env

printf "MYSQL_HOST=$mysql_host\n" >> .env
printf "MYSQL_DATABASE=$mysql_database\n" >> .env
printf "MYSQL_USER=$mysql_user\n" >> .env
printf "MYSQL_PASSWORD=$mysql_password\n" >> .env

printf "\nAdded new OAuth client and setup .env file\n"
