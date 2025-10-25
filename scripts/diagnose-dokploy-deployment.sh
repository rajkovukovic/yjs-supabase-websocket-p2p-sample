#!/bin/bash

# Dokploy Deployment Diagnostic Script
# This script helps diagnose deployment issues with the YJS collaborative editor

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Dokploy Deployment Diagnostic${NC}"
echo "=================================="
echo ""

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check if we're in the right directory
if [ ! -f "server/docker-compose.yaml" ]; then
    print_status "ERROR" "Please run this script from the project root directory"
    exit 1
fi

print_status "INFO" "Checking project structure..."

# Check if required files exist
required_files=(
    "server/docker-compose.yaml"
    "server/Dockerfile.hocuspocus"
    "server/Dockerfile.y-webrtc"
    "server/config.ts"
    "server/y-webrtc-signaling.ts"
    "server/hocuspocus-server.ts"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_status "SUCCESS" "Found: $file"
    else
        print_status "ERROR" "Missing: $file"
        exit 1
    fi
done

echo ""
print_status "INFO" "Checking Docker Compose configuration..."

# Check docker-compose.yaml syntax
if docker-compose -f server/docker-compose.yaml config > /dev/null 2>&1; then
    print_status "SUCCESS" "Docker Compose configuration is valid"
else
    print_status "ERROR" "Docker Compose configuration has errors"
    echo "Run: docker-compose -f server/docker-compose.yaml config"
    exit 1
fi

echo ""
print_status "INFO" "Checking port configurations..."

# Check for port conflicts
check_port() {
    local port=$1
    local service=$2
    
    if lsof -i :$port > /dev/null 2>&1; then
        print_status "WARNING" "Port $port is already in use (required for $service)"
        echo "  Current processes using port $port:"
        lsof -i :$port | tail -n +2 | while read line; do
            echo "    $line"
        done
        echo ""
        echo "  To fix this:"
        echo "  1. Stop the conflicting service: sudo systemctl stop <service-name>"
        echo "  2. Or kill the process: sudo kill -9 \$(lsof -ti :$port)"
        echo "  3. Or use a different port in your Dokploy configuration"
        return 1
    else
        print_status "SUCCESS" "Port $port is available for $service"
        return 0
    fi
}

# Check required ports
check_port 1234 "Hocuspocus"
check_port 4445 "Y-WebRTC Signaling"

echo ""
print_status "INFO" "Checking environment variable consistency..."

# Check for environment variable inconsistencies
echo "Checking for SIGNALING_PORT vs Y_WEBRTC_SIGNALING_PORT conflicts..."

if grep -r "SIGNALING_PORT" server/ --exclude-dir=node_modules > /dev/null 2>&1; then
    print_status "WARNING" "Found SIGNALING_PORT references in server code"
    echo "  These should be changed to Y_WEBRTC_SIGNALING_PORT for consistency"
    echo "  Files with SIGNALING_PORT:"
    grep -r "SIGNALING_PORT" server/ --exclude-dir=node_modules | cut -d: -f1 | sort -u
else
    print_status "SUCCESS" "No SIGNALING_PORT references found in server code"
fi

echo ""
print_status "INFO" "Dokploy Configuration Checklist..."

echo "When configuring in Dokploy, ensure:"
echo ""
echo "1. Service Type: Docker Compose"
echo "2. Docker Compose File: server/docker-compose.yaml"
echo "3. Context Path: server"
echo "4. Environment Variables:"
echo "   - SUPABASE_URL=https://xxxxx.supabase.co"
echo "   - SUPABASE_SERVICE_KEY=your-service-role-key"
echo "   - HOCUSPOCUS_PORT=1234"
echo "   - Y_WEBRTC_SIGNALING_PORT=4445"
echo "   - NODE_ENV=production"
echo "   - CORS_ORIGIN=*"
echo ""
echo "5. Port Mappings:"
echo "   - Hocuspocus: Container Port 1234 → Public Port 1234"
echo "   - Y-WebRTC: Container Port 4445 → Public Port 4445"
echo "   - Enable WebSocket support for both services"
echo ""

print_status "INFO" "Common Dokploy Issues and Solutions..."

echo "❌ Error: 'port is already allocated'"
echo "   Solution: Check if another service is using the same port"
echo "   - SSH to your server: ssh user@your-server"
echo "   - Check ports: sudo netstat -tulpn | grep :4445"
echo "   - Kill conflicting process: sudo kill -9 \$(lsof -ti :4445)"
echo ""

echo "❌ Error: 'environment variable not found'"
echo "   Solution: Ensure all required env vars are set in Dokploy"
echo "   - Go to your service in Dokploy"
echo "   - Check Environment Variables section"
echo "   - Add missing variables with correct names"
echo ""

echo "❌ Error: 'Dockerfile not found'"
echo "   Solution: Check Dockerfile paths in Dokploy"
echo "   - Dockerfile Path: server/Dockerfile.hocuspocus (for hocuspocus service)"
echo "   - Dockerfile Path: server/Dockerfile.y-webrtc (for signaling service)"
echo "   - Context Path: server"
echo ""

print_status "INFO" "Testing local build..."

# Test if the services can build locally
echo "Testing Docker builds..."

if docker build -f server/Dockerfile.hocuspocus -t test-hocuspocus server/ > /dev/null 2>&1; then
    print_status "SUCCESS" "Hocuspocus Dockerfile builds successfully"
    docker rmi test-hocuspocus > /dev/null 2>&1 || true
else
    print_status "ERROR" "Hocuspocus Dockerfile build failed"
    echo "Run: docker build -f server/Dockerfile.hocuspocus -t test-hocuspocus server/"
fi

if docker build -f server/Dockerfile.y-webrtc -t test-y-webrtc server/ > /dev/null 2>&1; then
    print_status "SUCCESS" "Y-WebRTC Dockerfile builds successfully"
    docker rmi test-y-webrtc > /dev/null 2>&1 || true
else
    print_status "ERROR" "Y-WebRTC Dockerfile build failed"
    echo "Run: docker build -f server/Dockerfile.y-webrtc -t test-y-webrtc server/"
fi

echo ""
print_status "INFO" "Diagnostic complete!"

echo ""
echo "Next steps:"
echo "1. Fix any issues identified above"
echo "2. Ensure no services are using ports 1234 or 4445"
echo "3. Configure Dokploy with the correct environment variables"
echo "4. Deploy and monitor the logs for any remaining issues"
echo ""
echo "For more help, check the deployment documentation:"
echo "- docs/deployment/DOCKPLOY_DEPLOYMENT_GUIDE.md"
echo "- docs/deployment/DOCKPLOY_COMPOSE_GUIDE.md"
