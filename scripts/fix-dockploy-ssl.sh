#!/bin/bash

# Dockploy SSL Certificate Fix Script
# Run this ON YOUR SERVER (not locally)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 Dockploy Let's Encrypt SSL Fix${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Find Traefik container
echo -e "${BLUE}1️⃣  Finding Traefik container...${NC}"
echo ""

TRAEFIK_CONTAINER=$(docker ps --format "{{.Names}}" | grep -i traefik | head -1 || echo "")

if [ -z "$TRAEFIK_CONTAINER" ]; then
    echo -e "${YELLOW}⚠️  No container with 'traefik' in name found${NC}"
    echo -e "${YELLOW}   Trying 'dokploy'...${NC}"
    
    TRAEFIK_CONTAINER=$(docker ps --format "{{.Names}}" | grep -i dokploy | head -1 || echo "")
    
    if [ -z "$TRAEFIK_CONTAINER" ]; then
        echo -e "${RED}❌ Cannot find Traefik or Dockploy container${NC}"
        echo ""
        echo -e "${YELLOW}Available containers:${NC}"
        docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
        echo ""
        echo -e "${YELLOW}Please identify the Traefik container and run:${NC}"
        echo -e "   ${BLUE}docker restart <container-name>${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Found Traefik container: ${TRAEFIK_CONTAINER}${NC}"
echo ""

# Step 2: Check acme.json
echo -e "${BLUE}2️⃣  Checking acme.json...${NC}"
echo ""

ACME_PATH="/etc/dokploy/dynamic/acme.json"

if [ -f "$ACME_PATH" ]; then
    echo -e "${GREEN}✅ Found acme.json at: $ACME_PATH${NC}"
    
    # Backup
    cp "$ACME_PATH" "${ACME_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✅ Created backup${NC}"
    
    # Delete
    rm "$ACME_PATH"
    echo -e "${GREEN}✅ Deleted acme.json (will regenerate with Let's Encrypt)${NC}"
else
    echo -e "${YELLOW}⚠️  acme.json not found at $ACME_PATH${NC}"
    echo -e "${YELLOW}   Will try to restart Traefik anyway${NC}"
fi
echo ""

# Step 3: Restart Traefik
echo -e "${BLUE}3️⃣  Restarting Traefik container...${NC}"
echo ""

docker restart "$TRAEFIK_CONTAINER"
echo -e "${GREEN}✅ Restarted $TRAEFIK_CONTAINER${NC}"
echo ""

# Step 4: Watch logs
echo -e "${BLUE}4️⃣  Watching logs for certificate generation...${NC}"
echo -e "${YELLOW}   (Will watch for 30 seconds, press Ctrl+C to stop)${NC}"
echo ""

timeout 30 docker logs -f "$TRAEFIK_CONTAINER" 2>&1 | grep --line-buffered -i "certificate\|acme\|letsencrypt" || true

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}✅ Traefik restarted!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo ""
echo -e "1. Wait ${GREEN}2-3 minutes${NC} for Let's Encrypt certificate generation"
echo ""
echo -e "2. Check logs for success:"
echo -e "   ${BLUE}docker logs $TRAEFIK_CONTAINER 2>&1 | grep -i 'certificate obtained'${NC}"
echo ""
echo -e "3. Verify certificate from your local machine:"
echo -e "   ${BLUE}./scripts/diagnose-letsencrypt.sh${NC}"
echo ""
echo -e "4. Test in browser:"
echo -e "   ${BLUE}https://yjs-draw.evolucia.one${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

