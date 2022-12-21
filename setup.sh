#!/bin/bash

set -e

SIPGATE_API_BASE_URL="https://api.sipgate.com/v2"

function to_lower_case {
  local result=$(echo "$1" | tr '[:upper:]' '[:lower:]')

  echo $result
}

function extract_json_value {
  local value=$(echo "$1" | grep -o "\"${2}\"\s*:\s*\"[^\"]*" | grep -o '[^"]*$')
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
  response_body="$(echo "$response" | tac | tail -n +2 | tac)" # remove last line, compatible with Mac and Linux
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

read -p "Your sipgate.io Personal-Access-Token needs the following scopes:
authorization:oauth2:clients:read
authorization:oauth2:clients:write
settings:sipgateio:write
Please enter your Personal-Access-Token-ID: " sipgate_token_id

read -p "Please enter your Personal-Access-Token: " sipgate_token
printf "\n"
read -p "Please enter your webhook URL without port (e.g.: https://b99b-99-999-999-99.eu.ngrok.io): " webhook_url
read -p "Please enter your webhook port [8080]: " webhook_port
webhook_port=${webhook_port:-8080}
read -p "Please enter the containers internal port
(This value does not have to be changed in most cases)
internal port [8080]: " internal_port
internal_port=${internal_port:-8080}
read -p "Authenticate on an external system instead of this one? [y/N]: " external_base_url
external_base_url=${external_base_url:=n}

printf "\n\n"

token=$(echo -n "$sipgate_token_id:$sipgate_token" | base64)


read -d '' webhook_settings_request << EOF || true
{
  "incomingUrl": "$webhook_url",
  "outgoingUrl": "$webhook_url"
}
EOF

make_api_request "PUT" "/settings/sipgateio" "$token" "$webhook_settings_request"

if ! [ 'n' = "$(to_lower_case "$external_base_url")" ]; then
  base_url="$webhook_url"
  else
  base_url="http://localhost:$webhook_port"
fi

read -d '' oauth_client_request << EOF || true
{
  "name": "Call statistics service",
  "description": "Generated client for call statistics service ($(date))",
  "redirectUris": [
    "$base_url/auth-code"
  ],
  "webOrigins": [
    "$base_url/auth-code"
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
