#!/bin/sh
# Reset the demo company and issue fresh team-pot keys. Usage: BASE=https://teampot.vercel.app RESET_TOKEN=... sh scripts/demo-reset.sh
B=${BASE:-http://localhost:8787}
curl -s -X POST "$B/api/reset" -H "x-reset-token: $RESET_TOKEN" && echo && curl -s -X POST "$B/api/setup" -o /dev/null -w "setup %{http_code}\n"
