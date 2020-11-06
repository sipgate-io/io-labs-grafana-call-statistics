#!/bin/bash

set -e

SIPGATE_API_BASE_URL="https://api.sipgate.com/v2"
REDIRECT_URI="http://localhost:8080"

function to_lower_case {
  local result=$(echo "$1" | tr '[:upper:]' '[:lower:]')

  echo $result
}

function extract_json_value {
  local value=$(echo "$1" | grep -o "\"$2\":\"[^\"]*" | grep -o '[^"]*$')

  echo "$value"
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

read -p "Please enter your sipgate email address: " sipgate_email
read -s -p "Please enter your password: " sipgate_password

read -d '' request_body << EOF || true
{
  "name": "Call statistics service",
  "description": "Generated client for call statistics service ($(date))",
  "redirectUris": [
    "$REDIRECT_URI"
  ],
  "webOrigins": [
    "$REDIRECT_URI"
  ],
  "privacyUrl": "",
  "termsUrl": ""
}
EOF

token=$(echo -n "$sipgate_email:$sipgate_password" | base64)

json_result=$(curl -sb --request POST https://api.sipgate.com/v2/authorization/oauth2/clients \
  --header "Authorization: Basic $token" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  -d "$request_body")

stripped_json=$(echo "$json_result" | sed -e 's/\s\+//g')

client_id=$(extract_json_value "$stripped_json" "clientId")
client_secret=$(extract_json_value "$stripped_json" "clientSecret")

touch .env
printf "SIPGATE_CLIENT_ID=$client_id\n" >> .env
printf "SIPGATE_CLIENT_SECRET=$client_secret\n" >> .env

printf "\nAdded new OAuth client and setup .env file\n"
