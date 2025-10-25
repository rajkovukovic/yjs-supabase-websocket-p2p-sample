# Dokploy Port 4445 Already Allocated - Fix Guide

## 🚨 Problem: Port 4445 Already Allocated

**Error Message:**
```
Error response from daemon: failed to set up container networking: 
container 13c0670941d80c0ef1b6a8a0545f7fb424481824a5bfba4224d23286e77216fa: 
endpoint join on GW Network failed: driver failed programming external connectivity 
on endpoint gateway_b47b6c1f25a2 (8b3c366e649c28bba86d8a6e0dba42f22072129962441e39838855086f5ebcb8): 
Bind for 0.0.0.0:4445 failed: port is already allocated
```

## 🔍 Root Causes

1. **Environment Variable Not Set**: `Y_WEBRTC_SIGNALING_PORT` not configured in Dokploy
2. **Port Conflict**: Another service is using port 4445
3. **Previous Deployment**: Old containers still running

## ✅ Solution Steps

### Step 1: Check for Port Conflicts

**SSH into your server:**
```bash
ssh user@your-server-ip

# Check what's using port 4445
sudo netstat -tulpn | grep :4445
# OR
sudo lsof -i :4445

# Check all Docker containers
docker ps -a | grep 4445
```

**If port 4445 is in use:**
```bash
# Kill the process using port 4445
sudo kill -9 $(lsof -ti :4445)

# Or stop Docker containers using the port
docker stop $(docker ps -q --filter "publish=4445")
```

### Step 2: Fix Dokploy Configuration

**Go to your Dokploy service and check:**

#### A. Environment Variables
Ensure these are set in Dokploy:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
HOCUSPOCUS_PORT=1234
Y_WEBRTC_SIGNALING_PORT=4445
NODE_ENV=production
CORS_ORIGIN=*
```

**⚠️ CRITICAL**: Make sure `Y_WEBRTC_SIGNALING_PORT=4445` is set (not `SIGNALING_PORT`)

#### B. Port Mappings
In Dokploy service configuration:
- **Hocuspocus Service**: Container Port `1234` → Public Port `1234`
- **Y-WebRTC Service**: Container Port `4445` → Public Port `4445`
- **Enable WebSocket Support** for both services

#### C. Docker Compose Configuration
- **Docker Compose File**: `server/docker-compose.yaml`
- **Context Path**: `server`
- **Build Context**: `server`

### Step 3: Clean Up Previous Deployments

**Remove old containers:**
```bash
# SSH to server
ssh user@your-server-ip

# Stop and remove old containers
docker stop $(docker ps -q --filter "name=yjs")
docker rm $(docker ps -aq --filter "name=yjs")

# Remove old images
docker rmi $(docker images -q --filter "reference=*yjs*")

# Clean up networks
docker network prune -f
```

### Step 4: Redeploy

1. **In Dokploy Dashboard:**
   - Go to your service
   - Click **"Redeploy"** or **"Deploy"**
   - Watch the build logs

2. **Monitor the deployment:**
   ```bash
   # SSH to server and watch logs
   docker logs -f <container-name>
   ```

### Step 5: Verify Deployment

**Check if services are running:**
```bash
# SSH to server
ssh user@your-server-ip

# Check running containers
docker ps | grep yjs

# Test ports
curl http://localhost:1234/health  # Hocuspocus
curl http://localhost:4445/health  # Y-WebRTC Signaling
```

**Expected output:**
```
✅ Hocuspocus server running on port 1234
✅ Y-WebRTC signaling server running on port 4445
```

## 🔧 Alternative: Use Different Ports

If port 4445 is permanently blocked, you can use different ports:

### Option A: Change to Port 4446
1. **Update environment variables in Dokploy:**
   ```env
   Y_WEBRTC_SIGNALING_PORT=4446
   ```

2. **Update your web app configuration:**
   ```env
   NEXT_PUBLIC_Y_WEBRTC_SIGNALING_URL=wss://your-domain:4446
   ```

### Option B: Use Port 3001
1. **Update environment variables in Dokploy:**
   ```env
   Y_WEBRTC_SIGNALING_PORT=3001
   ```

2. **Update your web app configuration:**
   ```env
   NEXT_PUBLIC_Y_WEBRTC_SIGNALING_URL=wss://your-domain:3001
   ```

## 🚨 Common Mistakes

### ❌ Wrong Environment Variable Name
```env
# WRONG (old documentation)
SIGNALING_PORT=4445

# CORRECT (current code)
Y_WEBRTC_SIGNALING_PORT=4445
```

### ❌ Missing WebSocket Support
- Make sure **WebSocket Support** is enabled in Dokploy
- Required for both Hocuspocus (port 1234) and Y-WebRTC (port 4445)

### ❌ Wrong Docker Compose File Path
- **Correct**: `server/docker-compose.yaml`
- **Wrong**: `docker-compose.yaml` or `server/docker-compose.yml`

## 📋 Checklist

- [ ] Port 4445 is not in use by other services
- [ ] Environment variable `Y_WEBRTC_SIGNALING_PORT=4445` is set in Dokploy
- [ ] WebSocket support is enabled for both services
- [ ] Docker Compose file path is correct: `server/docker-compose.yaml`
- [ ] Context path is set to: `server`
- [ ] Old containers have been removed
- [ ] Service is redeployed successfully

## 🆘 Still Having Issues?

1. **Run the diagnostic script:**
   ```bash
   ./scripts/diagnose-dokploy-deployment.sh
   ```

2. **Check Dokploy logs:**
   - Go to your service in Dokploy
   - Click on "Logs" tab
   - Look for error messages

3. **Verify environment variables:**
   - Go to service → Environment Variables
   - Ensure all required variables are present
   - Check for typos in variable names

4. **Test locally first:**
   ```bash
   cd server
   docker-compose up --build
   ```

## 📞 Support

If you're still having issues:
1. Check the main deployment guide: `docs/deployment/DOCKPLOY_DEPLOYMENT_GUIDE.md`
2. Run the diagnostic script: `./scripts/diagnose-dokploy-deployment.sh`
3. Check the troubleshooting guide: `docs/deployment/LETSENCRYPT_TROUBLESHOOTING.md`
