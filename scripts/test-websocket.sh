#!/bin/bash

# WebSocket Connection Test Script
# Tests both ws:// and wss:// connections to your Dockploy services

echo "🔍 WebSocket Connection Test"
echo "=============================="
echo ""

# Read from .env.local if exists, otherwise from env.example
if [ -f "web/.env.local" ]; then
    source web/.env.local
    echo "📄 Using web/.env.local"
elif [ -f "web/env.example" ]; then
    source web/env.example
    echo "📄 Using web/env.example"
else
    echo "❌ No environment file found!"
    exit 1
fi

echo ""
echo "🔗 Testing Hocuspocus Server..."
echo "URL: $NEXT_PUBLIC_HOCUSPOCUS_URL"
echo ""

# Extract domain and protocol
HOCUS_DOMAIN=$(echo "$NEXT_PUBLIC_HOCUSPOCUS_URL" | sed -E 's|^wss?://||')
SIGNAL_DOMAIN=$(echo "$NEXT_PUBLIC_SIGNALING_URL" | sed -E 's|^wss?://||')

# Test 1: HTTP/HTTPS connectivity
echo "1️⃣  Testing HTTP(S) connectivity..."
if curl -s -o /dev/null -w "%{http_code}" "http://$HOCUS_DOMAIN" | grep -q "200\|301\|302\|400"; then
    echo "   ✅ HTTP: Server is reachable"
else
    echo "   ❌ HTTP: Server not reachable"
fi

# Test 2: SSL Certificate (if using wss://)
if [[ "$NEXT_PUBLIC_HOCUSPOCUS_URL" == wss://* ]]; then
    echo ""
    echo "2️⃣  Testing SSL certificate..."
    if curl -s "https://$HOCUS_DOMAIN" > /dev/null 2>&1; then
        echo "   ✅ SSL: Certificate is valid"
    else
        echo "   ❌ SSL: Certificate error (ERR_CERT_AUTHORITY_INVALID)"
        echo "   💡 Solution: Use ws:// instead of wss:// or fix SSL in Dockploy"
        echo "   📚 See: docs/deployment/DOCKPLOY_SSL_TROUBLESHOOTING.md"
    fi
else
    echo ""
    echo "2️⃣  Using unencrypted WebSocket (ws://)"
    echo "   ⚠️  This is OK for development but use wss:// for production"
fi

echo ""
echo "3️⃣  DNS Resolution..."
RESOLVED_IP=$(dig +short "$HOCUS_DOMAIN" | head -1)
if [ -n "$RESOLVED_IP" ]; then
    echo "   ✅ DNS: $HOCUS_DOMAIN → $RESOLVED_IP"
else
    echo "   ❌ DNS: Could not resolve $HOCUS_DOMAIN"
fi

echo ""
echo "=============================="
echo "📋 Summary"
echo "=============================="
echo ""
echo "Hocuspocus URL: $NEXT_PUBLIC_HOCUSPOCUS_URL"
echo "Signaling URL:  $NEXT_PUBLIC_SIGNALING_URL"
echo ""

if [[ "$NEXT_PUBLIC_HOCUSPOCUS_URL" == wss://* ]]; then
    echo "🔒 Using SSL (wss://)"
    echo ""
    echo "If you see certificate errors:"
    echo "1. Check Dockploy → Service → Domains → Enable SSL"
    echo "2. Wait 1-5 minutes for Let's Encrypt"
    echo "3. Or temporarily use ws:// instead"
else
    echo "🔓 Using unencrypted WebSocket (ws://)"
    echo ""
    echo "To enable SSL:"
    echo "1. Configure Let's Encrypt in Dockploy"
    echo "2. Change ws:// to wss:// in .env.local"
    echo "3. Restart dev server"
fi

echo ""
echo "📚 Full guide: docs/deployment/DOCKPLOY_SSL_TROUBLESHOOTING.md"
echo ""

