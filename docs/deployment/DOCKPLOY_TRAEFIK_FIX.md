# Dockploy Traefik SSL Fix

## Issue Found

Based on your diagnostics:
- ✅ DNS is configured correctly
- ✅ Ports are OPEN (firewall inactive means no blocking)
- ✅ acme.json exists at `/etc/dokploy/dynamic/acme.json`
- ❌ Let's Encrypt using default Traefik certificate
- ❌ Traefik container has different name (not "traefik")

---

## Step-by-Step Fix

### Step 1: Find Traefik Container Name

SSH to your server and run:

```bash
ssh root@89.116.28.108

# List all containers
docker ps

# Find Traefik (look for dokploy or traefik in name)
docker ps | grep -i traefik
docker ps | grep -i dokploy

# Or show all container names
docker ps --format "table {{.Names}}\t{{.Image}}"
```

**Common Dockploy Traefik names:**
- `dokploy-traefik`
- `dokploy_traefik_1`
- `dokploy-traefik-1`
- Or it might be embedded in Dockploy's main container

### Step 2: Delete acme.json to Force Regeneration

```bash
# Backup the current acme.json
sudo cp /etc/dokploy/dynamic/acme.json /etc/dokploy/dynamic/acme.json.backup

# Delete to force regeneration
sudo rm /etc/dokploy/dynamic/acme.json

# Verify it's deleted
ls -la /etc/dokploy/dynamic/
```

### Step 3: Restart Traefik Container

Once you find the container name:

```bash
# Replace <container-name> with actual name from Step 1
docker restart <container-name>

# Examples (try the one that exists):
docker restart dokploy-traefik
# or
docker restart dokploy_traefik_1
# or
docker restart dokploy
```

**If Traefik is embedded in Dockploy:**
```bash
# Restart the main Dockploy container
docker ps | grep dokploy
docker restart <dokploy-container-name>
```

### Step 4: Watch Logs for Certificate Generation

```bash
# Replace <container-name> with actual name
docker logs -f <container-name>

# Or specifically for Traefik logs
docker logs -f <container-name> 2>&1 | grep -i "certificate\|acme\|letsencrypt"
```

**Look for these messages:**
```
✅ GOOD: "Certificate obtained successfully for yjs-draw-hocuspocus.evolucia.one"
✅ GOOD: "Serving default certificate"
❌ BAD: "acme: error: 400" (means HTTP-01 challenge failed)
```

### Step 5: Verify After 2-3 Minutes

From your local machine:

```bash
# Run diagnostic again
cd /Users/ralph/Work/TribeOne/g_zero_yjs_sample
./scripts/diagnose-letsencrypt.sh

# Or test manually
openssl s_client -connect yjs-draw-hocuspocus.evolucia.one:443 -servername yjs-draw-hocuspocus.evolucia.one < /dev/null 2>&1 | grep -i "issuer"

# Should show: Let's Encrypt (not TRAEFIK DEFAULT CERT)
```

---

## Alternative: Configure in Dockploy UI

If deleting acme.json doesn't work, configure SSL through Dockploy:

### Option 1: Check Traefik Configuration

1. **Dockploy Dashboard** → **Traefik File System** (you're already here!)
2. Click on **`traefik.yml`**
3. Verify it has:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@evolucia.one  # ← Make sure email is set
      storage: /etc/dokploy/dynamic/acme.json
      httpChallenge:
        entryPoint: web
```

4. If email is missing or wrong, update it
5. Save and restart

### Option 2: Re-configure Service Domains

For **each service** (Web, Hocuspocus, Signaling):

1. Go to service in Dockploy
2. **Domains** tab
3. **Delete** existing domain
4. **Add new domain**:
   - Domain: `yjs-draw-hocuspocus.evolucia.one`
   - ✅ HTTPS/SSL
   - ✅ Generate Let's Encrypt Certificate
   - Certificate Resolver: `letsencrypt`
   - Email: `your-email@evolucia.one`
5. **Save**
6. Wait 2-3 minutes

---

## Port Configuration Check

While you're in Dockploy, verify service ports:

### Hocuspocus Service
- Container Port: **1234** ✅
- Protocol: HTTP or WebSocket

### Signaling Service  
- Container Port: **4445** ⚠️ (Check this - might show 1234)
- Protocol: HTTP or WebSocket

### Web Service
- Container Port: **3000** ✅
- Protocol: HTTP

---

## Firewall Note

Your firewall is **inactive**, which means:
- ✅ All ports are OPEN by default
- ✅ No blocking of port 80/443
- ✅ Let's Encrypt can reach your server

**You can leave it inactive** OR **enable it with rules**:

```bash
# If you want to enable firewall (optional)
sudo ufw allow 22/tcp    # SSH (IMPORTANT - don't lock yourself out!)
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 1234/tcp  # Hocuspocus
sudo ufw allow 4445/tcp  # Signaling
sudo ufw allow 3000/tcp  # Web (if accessed directly)

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

**For now, you can leave it inactive** - it's not the problem.

---

## Troubleshooting

### If Container Not Found

```bash
# List all running containers
docker ps -a

# Search in logs
docker ps --format "{{.Names}}" | xargs -I {} sh -c 'echo "=== {} ===" && docker logs {} 2>&1 | head -5'

# Check Docker Compose
cd /opt/dokploy  # or wherever Dockploy is installed
ls -la
cat docker-compose.yml | grep -A 5 traefik
```

### If Still Using Default Certificate

**Check if HTTP-01 challenge is accessible:**

```bash
# From your local machine
curl -I http://yjs-draw-hocuspocus.evolucia.one/.well-known/acme-challenge/test

# Should return 404 (server responds) not connection refused
```

**Check Traefik configuration:**

```bash
# On server
cat /etc/dokploy/traefik.yml
cat /etc/dokploy/dynamic/dokploy.yml
```

### If 502 Bad Gateway Persists

```bash
# Check if services are running
docker ps | grep -E "hocuspocus|signaling|yjs"

# Check service logs
docker logs <service-container-name>

# Common issues:
# 1. Service crashed on startup
# 2. Wrong port in Dockploy configuration
# 3. Service not bound to 0.0.0.0
```

---

## Quick Command Reference

```bash
# Find Traefik container
docker ps | grep -i traefik

# Delete acme.json
sudo rm /etc/dokploy/dynamic/acme.json

# Restart Traefik
docker restart <traefik-container-name>

# Watch logs
docker logs -f <traefik-container-name>

# Check certificate
openssl s_client -connect yjs-draw-hocuspocus.evolucia.one:443 -servername yjs-draw-hocuspocus.evolucia.one

# List all containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## Expected Result

After fixing, you should see:

**Traefik logs:**
```
Certificate obtained successfully for yjs-draw-hocuspocus.evolucia.one
Certificate obtained successfully for yjs-draw-signal.evolucia.one
Certificate obtained successfully for yjs-draw.evolucia.one
```

**Browser:**
- 🔒 Green padlock
- Valid Let's Encrypt certificate
- No ERR_CERT_AUTHORITY_INVALID

**Diagnostic script:**
```bash
./scripts/diagnose-letsencrypt.sh

# Should show:
# ✅ Valid Let's Encrypt certificate
# ✅ No TRAEFIK DEFAULT CERT
```

---

## Next Steps

1. **Find Traefik container name:**
   ```bash
   docker ps | grep -i traefik
   ```

2. **Delete acme.json:**
   ```bash
   sudo rm /etc/dokploy/dynamic/acme.json
   ```

3. **Restart Traefik**

4. **Wait 2-3 minutes**

5. **Run diagnostic:**
   ```bash
   ./scripts/diagnose-letsencrypt.sh
   ```

Let me know the container name and I'll help you with the exact commands! 🚀

