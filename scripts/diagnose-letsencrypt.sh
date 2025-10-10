#!/bin/bash

# Let's Encrypt SSL Diagnostic Script
# Diagnoses why Let's Encrypt certificate generation is failing

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Your domains
FRONTEND="yjs-draw.evolucia.one"
HOCUSPOCUS="yjs-draw-hocuspocus.evolucia.one"
SIGNALING="yjs-draw-signal.evolucia.one"
SERVER_IP="89.116.28.108"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 Let's Encrypt SSL Diagnostics${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1: DNS Resolution
echo -e "${BLUE}1️⃣  Testing DNS Resolution...${NC}"
echo ""

for domain in "$FRONTEND" "$HOCUSPOCUS" "$SIGNALING"; do
    if nslookup "$domain" > /dev/null 2>&1; then
        IP=$(nslookup "$domain" | grep -A 1 "Name:" | tail -n 1 | awk '{print $2}')
        if [ "$IP" == "$SERVER_IP" ]; then
            echo -e "${GREEN}✅ $domain → $IP${NC}"
        else
            echo -e "${RED}❌ $domain → $IP (expected $SERVER_IP)${NC}"
        fi
    else
        echo -e "${RED}❌ $domain - DNS resolution failed${NC}"
    fi
done
echo ""

# Test 2: Port 80 Accessibility (Critical for Let's Encrypt)
echo -e "${BLUE}2️⃣  Testing Port 80 (Required for Let's Encrypt HTTP-01 Challenge)...${NC}"
echo ""

if timeout 5 bash -c "echo > /dev/tcp/$SERVER_IP/80" 2>/dev/null; then
    echo -e "${GREEN}✅ Port 80 is OPEN and accessible${NC}"
    
    # Try HTTP request
    HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP 2>/dev/null || echo "000")
    if [ "$HTTP_RESPONSE" != "000" ]; then
        echo -e "${GREEN}✅ Port 80 responds with HTTP $HTTP_RESPONSE${NC}"
    else
        echo -e "${YELLOW}⚠️  Port 80 open but no HTTP response${NC}"
    fi
else
    echo -e "${RED}❌ Port 80 is CLOSED or BLOCKED${NC}"
    echo -e "${RED}   This is the main reason Let's Encrypt is failing!${NC}"
    echo ""
    echo -e "${YELLOW}   Quick Fix:${NC}"
    echo -e "${YELLOW}   SSH to your server and run:${NC}"
    echo -e "${YELLOW}   sudo ufw allow 80/tcp${NC}"
    echo -e "${YELLOW}   sudo ufw allow 443/tcp${NC}"
fi
echo ""

# Test 3: Port 443 Accessibility
echo -e "${BLUE}3️⃣  Testing Port 443 (HTTPS)...${NC}"
echo ""

if timeout 5 bash -c "echo > /dev/tcp/$SERVER_IP/443" 2>/dev/null; then
    echo -e "${GREEN}✅ Port 443 is OPEN${NC}"
else
    echo -e "${RED}❌ Port 443 is CLOSED or BLOCKED${NC}"
    echo -e "${YELLOW}   Run: sudo ufw allow 443/tcp${NC}"
fi
echo ""

# Test 4: Check Current Certificates
echo -e "${BLUE}4️⃣  Checking Current SSL Certificates...${NC}"
echo ""

for domain in "$HOCUSPOCUS" "$SIGNALING"; do
    echo -e "Testing ${YELLOW}$domain${NC}..."
    
    # Get certificate info
    CERT_INFO=$(echo | openssl s_client -connect $domain:443 -servername $domain 2>/dev/null || echo "")
    
    if [ -n "$CERT_INFO" ]; then
        # Check issuer
        ISSUER=$(echo "$CERT_INFO" | openssl x509 -noout -issuer 2>/dev/null || echo "")
        
        if echo "$ISSUER" | grep -qi "traefik"; then
            echo -e "${RED}   ❌ Using TRAEFIK DEFAULT CERT (self-signed)${NC}"
            echo -e "${RED}   Let's Encrypt generation FAILED${NC}"
        elif echo "$ISSUER" | grep -qi "let's encrypt"; then
            echo -e "${GREEN}   ✅ Valid Let's Encrypt certificate${NC}"
            
            # Check expiration
            EXPIRY=$(echo "$CERT_INFO" | openssl x509 -noout -dates 2>/dev/null | grep "notAfter" | cut -d'=' -f2)
            echo -e "${GREEN}   Expires: $EXPIRY${NC}"
        else
            echo -e "${YELLOW}   ⚠️  Unknown issuer: $ISSUER${NC}"
        fi
    else
        echo -e "${RED}   ❌ Cannot connect to $domain:443${NC}"
    fi
    echo ""
done

# Test 5: Check if services are reachable
echo -e "${BLUE}5️⃣  Testing Service Endpoints...${NC}"
echo ""

# Frontend
echo -e "Frontend: ${YELLOW}https://$FRONTEND${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$FRONTEND -k 2>/dev/null || echo "000")
if [ "$STATUS" == "502" ]; then
    echo -e "${RED}   ❌ 502 Bad Gateway - Service not running or misconfigured${NC}"
elif [ "$STATUS" == "000" ]; then
    echo -e "${RED}   ❌ Cannot connect${NC}"
elif [ "$STATUS" -ge 200 ] && [ "$STATUS" -lt 400 ]; then
    echo -e "${GREEN}   ✅ Responds with HTTP $STATUS${NC}"
else
    echo -e "${YELLOW}   ⚠️  HTTP $STATUS${NC}"
fi
echo ""

# Hocuspocus
echo -e "Hocuspocus: ${YELLOW}https://$HOCUSPOCUS${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$HOCUSPOCUS -k 2>/dev/null || echo "000")
if [ "$STATUS" == "502" ]; then
    echo -e "${RED}   ❌ 502 Bad Gateway${NC}"
elif [ "$STATUS" == "000" ]; then
    echo -e "${RED}   ❌ Cannot connect${NC}"
else
    echo -e "${GREEN}   ✅ HTTP $STATUS${NC}"
fi
echo ""

# Signaling  
echo -e "Signaling: ${YELLOW}https://$SIGNALING${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$SIGNALING -k 2>/dev/null || echo "000")
if [ "$STATUS" == "502" ]; then
    echo -e "${RED}   ❌ 502 Bad Gateway${NC}"
elif [ "$STATUS" == "000" ]; then
    echo -e "${RED}   ❌ Cannot connect${NC}"
else
    echo -e "${GREEN}   ✅ HTTP $STATUS${NC}"
fi
echo ""

# Summary and recommendations
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Diagnostic Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if main issue is port 80
if ! timeout 5 bash -c "echo > /dev/tcp/$SERVER_IP/80" 2>/dev/null; then
    echo -e "${RED}🚨 CRITICAL ISSUE: Port 80 is blocked!${NC}"
    echo ""
    echo -e "${YELLOW}This is why Let's Encrypt is failing.${NC}"
    echo ""
    echo -e "${YELLOW}SOLUTION:${NC}"
    echo -e "${YELLOW}1. SSH to your server:${NC}"
    echo -e "   ${BLUE}ssh user@$SERVER_IP${NC}"
    echo ""
    echo -e "${YELLOW}2. Open port 80:${NC}"
    echo -e "   ${BLUE}sudo ufw allow 80/tcp${NC}"
    echo -e "   ${BLUE}sudo ufw allow 443/tcp${NC}"
    echo ""
    echo -e "${YELLOW}3. Verify firewall:${NC}"
    echo -e "   ${BLUE}sudo ufw status${NC}"
    echo ""
    echo -e "${YELLOW}4. Restart Traefik:${NC}"
    echo -e "   ${BLUE}docker restart traefik${NC}"
    echo ""
    echo -e "${YELLOW}5. Wait 2-3 minutes and run this script again${NC}"
    echo ""
else
    # Port 80 is open, check for other issues
    echo -e "${GREEN}✅ Port 80 is accessible${NC}"
    echo ""
    
    # Check if using default cert
    USING_DEFAULT_CERT=false
    for domain in "$HOCUSPOCUS" "$SIGNALING"; do
        CERT_INFO=$(echo | openssl s_client -connect $domain:443 -servername $domain 2>/dev/null || echo "")
        if echo "$CERT_INFO" | openssl x509 -noout -issuer 2>/dev/null | grep -qi "traefik"; then
            USING_DEFAULT_CERT=true
            break
        fi
    done
    
    if [ "$USING_DEFAULT_CERT" = true ]; then
        echo -e "${YELLOW}⚠️  Services are using Traefik default certificate${NC}"
        echo ""
        echo -e "${YELLOW}SOLUTION:${NC}"
        echo -e "${YELLOW}1. SSH to your server:${NC}"
        echo -e "   ${BLUE}ssh user@$SERVER_IP${NC}"
        echo ""
        echo -e "${YELLOW}2. Find and delete acme.json:${NC}"
        echo -e "   ${BLUE}sudo find / -name 'acme.json' 2>/dev/null${NC}"
        echo -e "   ${BLUE}sudo rm /path/to/acme.json${NC}"
        echo ""
        echo -e "${YELLOW}3. Restart Traefik:${NC}"
        echo -e "   ${BLUE}docker restart traefik${NC}"
        echo ""
        echo -e "${YELLOW}4. Watch Traefik logs:${NC}"
        echo -e "   ${BLUE}docker logs traefik -f${NC}"
        echo -e "   Look for: 'Certificate obtained successfully'"
        echo ""
        echo -e "${YELLOW}5. Alternative - Check Dockploy:${NC}"
        echo -e "   - Ensure each service has correct port configured"
        echo -e "   - Hocuspocus: Port 1234"
        echo -e "   - Signaling: Port 4444 ${RED}(currently shows 1234 - FIX THIS!)${NC}"
        echo -e "   - Web: Port 3000"
        echo ""
    else
        echo -e "${GREEN}✅ SSL certificates are correctly configured${NC}"
        
        # Check for bad gateway
        if [ "$STATUS" == "502" ]; then
            echo ""
            echo -e "${YELLOW}⚠️  Getting 502 Bad Gateway error${NC}"
            echo ""
            echo -e "${YELLOW}SOLUTION:${NC}"
            echo -e "${YELLOW}1. Check if services are running:${NC}"
            echo -e "   ${BLUE}ssh user@$SERVER_IP${NC}"
            echo -e "   ${BLUE}docker ps | grep -E 'hocuspocus|signaling|web'${NC}"
            echo ""
            echo -e "${YELLOW}2. Check service logs:${NC}"
            echo -e "   ${BLUE}docker logs <service-container-name>${NC}"
            echo ""
            echo -e "${YELLOW}3. Verify port configuration in Dockploy${NC}"
        fi
    fi
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📚 Full troubleshooting guide:${NC}"
echo -e "   ${YELLOW}docs/deployment/LETSENCRYPT_TROUBLESHOOTING.md${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

