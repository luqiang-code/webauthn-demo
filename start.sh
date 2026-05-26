#!/bin/bash
set -e

echo "=== Starting ngrok ==="
ngrok http 5173 --log stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to be ready and get the public URL
echo "Waiting for ngrok tunnel..."
for i in $(seq 1 15); do
  sleep 1
  URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d['tunnels'][0]['public_url'])
except: pass
" 2>/dev/null) || true
  if [ -n "$URL" ]; then
    # Extract domain from URL
    DOMAIN=$(echo "$URL" | sed 's|https://||')
    echo "ngrok domain: $DOMAIN"
    break
  fi
done

if [ -z "$URL" ]; then
  echo "ERROR: ngrok failed to start"
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

export RP_ID="$DOMAIN"
export ORIGIN="$URL"

echo "=== Starting dev servers ==="
echo "  RP_ID=$RP_ID"
echo "  ORIGIN=$ORIGIN"
echo "  URL: $URL"
echo ""

npm run dev

# Cleanup on exit
kill $NGROK_PID 2>/dev/null
