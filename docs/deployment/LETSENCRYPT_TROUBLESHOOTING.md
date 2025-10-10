# Let's Encrypt Certificate Troubleshooting

## Problem: TRAEFIK DEFAULT CERT Instead of Let's Encrypt

When you see `ERR_CERT_AUTHORITY_INVALID` with "TRAEFIK DEFAULT CERT", it means Let's Encrypt certificate generation **failed** and Traefik fell back to its self-signed certificate.

---

## Quick Fix Steps

### Step 1: Check Port 80 is Accessible

Let's Encrypt uses **HTTP-01 challenge** which requires **port 80** to be open and accessible from the internet.

**SSH into your server and check:**

```bash
# Check if port 80 is listening
sudo netstat -tulpn | grep :80

# Or using ss
sudo ss -tulpn | grep :80

# Check firewall
sudo ufw status

# If ufw is active, ensure port 80 is allowed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

**Test from outside:**
```bash
# From your local machine
curl -I http://89.116.28.108

# Should return HTTP response, not connection refused
```

### Step 2: Check Traefik HTTP Entrypoint

Traefik needs an HTTP entrypoint (port 80) for Let's Encrypt challenges.

**Check Traefik configuration in Dockploy:**

1. Go to Dockploy Dashboard
2. Find Traefik service (usually auto-created by Dockploy)
3. Check it's configured with:
   - **Port 80** → HTTP entrypoint
   - **Port 443** → HTTPS entrypoint

**Or check via Docker:**
```bash
# SSH to server
ssh user@89.116.28.108

# Check Traefik container
docker ps | grep traefik

# Inspect Traefik ports
docker port <traefik-container-id>

# Should show:
# 80/tcp -> 0.0.0.0:80
# 443/tcp -> 0.0.0.0:443
```

### Step 3: Verify Service Configuration in Dockploy

I noticed **Signaling service shows Port 1234** but it should be **4444**.

**Fix each service:**

#### Hocuspocus Service:
1. Go to Hocuspocus service in Dockploy
2. **General Settings:**
   - Container Port: `1234`
   - Target Port: `1234`
3. **Domain Settings:**
   - Domain: `yjs-draw-hocuspocus.evolucia.one`
   - ✅ HTTPS
   - Certificate: Let's Encrypt
   - Path: `/` (root path)
4. **Save & Redeploy**

#### Signaling Service:
1. Go to Signaling service in Dockploy
2. **General Settings:**
   - Container Port: `4444` ← **FIX THIS (currently shows 1234)**
   - Target Port: `4444`
3. **Domain Settings:**
   - Domain: `yjs-draw-signal.evolucia.one`
   - ✅ HTTPS
   - Certificate: Let's Encrypt
   - Path: `/`
4. **Save & Redeploy**

#### Frontend Service:
1. Go to Web service in Dockploy
2. **General Settings:**
   - Container Port: `3000`
   - Target Port: `3000`
3. **Domain Settings:**
   - Domain: `yjs-draw.evolucia.one`
   - ✅ HTTPS
   - Certificate: Let's Encrypt
   - Path: `/`
4. **Save & Redeploy**

### Step 4: Force Certificate Regeneration

**Method 1: Delete Certificate and Restart (Dockploy)**

1. SSH to server:
```bash
ssh user@89.116.28.108

# Find acme.json location (Let's Encrypt certificate storage)
sudo find / -name "acme.json" 2>/dev/null

# Common locations:
# - /var/lib/docker/volumes/dockploy-traefik/_data/acme.json
# - /opt/dockploy/traefik/acme.json
# - /letsencrypt/acme.json

# Backup then delete
sudo cp /path/to/acme.json /path/to/acme.json.backup
sudo rm /path/to/acme.json

# Restart Traefik
docker restart traefik
# or
docker restart <traefik-container-name>
```

**Method 2: Through Dockploy UI**

1. Go to Traefik service in Dockploy
2. Click **Restart**
3. Wait 2-3 minutes
4. Check logs for certificate generation

### Step 5: Check Traefik Logs

**View logs to see why Let's Encrypt is failing:**

```bash
# SSH to server
ssh user@89.116.28.108

# View Traefik logs
docker logs traefik -f

# Or if Traefik has different name
docker ps | grep traefik
docker logs <container-name> -f

# Look for error messages containing:
# - "acme"
# - "letsencrypt"
# - "certificate"
# - "challenge"
```

**Common error messages and fixes:**

#### Error: `acme: error: 400 :: urn:ietf:params:acme:error:connection :: Fetching http://.../.well-known/acme-challenge/... Connection refused`

**Cause:** Port 80 is not accessible from internet

**Fix:**
```bash
# Check firewall
sudo ufw allow 80/tcp

# Check if something else is using port 80
sudo lsof -i :80

# Restart Traefik
docker restart traefik
```

#### Error: `acme: error: 429 :: urn:ietf:params:acme:error:rateLimited :: too many certificates already issued`

**Cause:** Let's Encrypt rate limit (5 certificates per domain per week)

**Fix:**
- Wait 7 days, OR
- Use staging environment for testing:
  
```bash
# In Dockploy, edit Traefik configuration
# Add environment variable:
ACME_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory

# Restart Traefik
# Test with staging, then switch back to production
```

#### Error: `acme: error: 400 :: urn:ietf:params:acme:error:dns :: DNS problem: NXDOMAIN`

**Cause:** DNS not propagated or incorrect

**Fix:**
```bash
# Verify DNS from multiple locations
nslookup yjs-draw-hocuspocus.evolucia.one
nslookup yjs-draw-hocuspocus.evolucia.one 8.8.8.8

# Wait 5-10 more minutes for DNS propagation
# Then restart Traefik
docker restart traefik
```

### Step 6: Verify Certificate After Fix

```bash
# From your local machine
openssl s_client -connect yjs-draw-hocuspocus.evolucia.one:443 -servername yjs-draw-hocuspocus.evolucia.one < /dev/null 2>&1 | grep -A 2 "Verification"

# Should show:
# Verification: OK

# Check issuer
openssl s_client -connect yjs-draw-hocuspocus.evolucia.one:443 -servername yjs-draw-hocuspocus.evolucia.one < /dev/null 2>&1 | grep -i "issuer"

# Should show: Let's Encrypt Authority
```

---

## Complete Troubleshooting Checklist

Run through this checklist:

- [ ] **DNS resolves correctly** 
  ```bash
  nslookup yjs-draw.evolucia.one
  nslookup yjs-draw-hocuspocus.evolucia.one  
  nslookup yjs-draw-signal.evolucia.one
  # All should return: 89.116.28.108
  ```

- [ ] **Port 80 is open and accessible**
  ```bash
  # From local machine
  curl -I http://89.116.28.108
  # Should NOT be "connection refused"
  ```

- [ ] **Port 443 is open**
  ```bash
  curl -I https://89.116.28.108 -k
  # Should connect (even if cert is invalid)
  ```

- [ ] **Traefik is running**
  ```bash
  # SSH to server
  docker ps | grep traefik
  # Should show running container
  ```

- [ ] **Traefik has HTTP entrypoint (port 80)**
  ```bash
  docker port <traefik-container> | grep 80
  # Should show: 80/tcp -> 0.0.0.0:80
  ```

- [ ] **Service ports are correct in Dockploy**
  - Hocuspocus: Port 1234 ✅
  - Signaling: Port 4444 ⚠️ (currently shows 1234)
  - Web: Port 3000 ✅

- [ ] **Services are running**
  ```bash
  docker ps | grep -E "hocuspocus|signaling|web"
  # All should show "Up"
  ```

- [ ] **Certificate regenerated**
  ```bash
  # Delete acme.json and restart Traefik
  sudo rm /path/to/acme.json
  docker restart traefik
  ```

- [ ] **Check Traefik logs for success**
  ```bash
  docker logs traefik 2>&1 | grep -i "certificate"
  # Look for: "Certificate obtained successfully"
  ```

---

## Alternative: Manual Traefik Configuration

If Dockploy's automatic SSL isn't working, you can configure Traefik manually:

### Create Traefik Configuration

**1. Create `traefik.yml`:**
```yaml
# /opt/dockploy/traefik/traefik.yml
api:
  dashboard: true
  insecure: true

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@evolucia.one
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: web

log:
  level: DEBUG
```

**2. Add Traefik labels to your services:**

Edit your `docker-compose.yml` or add in Dockploy:

```yaml
services:
  hocuspocus:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.hocuspocus.rule=Host(`yjs-draw-hocuspocus.evolucia.one`)"
      - "traefik.http.routers.hocuspocus.entrypoints=websecure"
      - "traefik.http.routers.hocuspocus.tls=true"
      - "traefik.http.routers.hocuspocus.tls.certresolver=letsencrypt"
      - "traefik.http.services.hocuspocus.loadbalancer.server.port=1234"
    
  signaling:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.signaling.rule=Host(`yjs-draw-signal.evolucia.one`)"
      - "traefik.http.routers.signaling.entrypoints=websecure"
      - "traefik.http.routers.signaling.tls=true"
      - "traefik.http.routers.signaling.tls.certresolver=letsencrypt"
      - "traefik.http.services.signaling.loadbalancer.server.port=4444"
```

---

## Quick Test Commands

**Run these tests after making changes:**

```bash
# 1. Test DNS
for domain in yjs-draw yjs-draw-hocuspocus yjs-draw-signal; do
  echo "Testing $domain.evolucia.one..."
  nslookup $domain.evolucia.one
done

# 2. Test Port 80
curl -I http://89.116.28.108

# 3. Test HTTPS (ignore cert errors for now)
curl -I https://yjs-draw.evolucia.one -k
curl -I https://yjs-draw-hocuspocus.evolucia.one -k

# 4. Check SSL certificate issuer
echo | openssl s_client -connect yjs-draw-hocuspocus.evolucia.one:443 -servername yjs-draw-hocuspocus.evolucia.one 2>/dev/null | openssl x509 -noout -issuer

# Should show: Let's Encrypt (not TRAEFIK DEFAULT CERT)
```

---

## Expected Output After Fix

**Traefik logs should show:**
```
time="..." level=info msg="Certificate obtained successfully" domain=yjs-draw-hocuspocus.evolucia.one
```

**OpenSSL test should show:**
```
issuer=C = US, O = Let's Encrypt, CN = R3
verify return:1
```

**Browser should show:**
- 🔒 Green padlock
- Valid certificate
- No security warnings

---

## Contact Dockploy Support

If issues persist, check:

1. **Dockploy Docs:** https://docs.dockploy.com/
2. **Dockploy Discord/Forum** for community support
3. **Traefik Docs:** https://doc.traefik.io/traefik/https/acme/

---

## Summary of Your Current Issues

Based on your screenshots:

1. ✅ DNS configured correctly (all pointing to 89.116.28.108)
2. ❌ **Signaling service has wrong port** (shows 1234, should be 4444)
3. ❌ **Let's Encrypt failed** - using Traefik default cert
4. ❌ **Bad Gateway** - services not connecting

**Immediate actions:**
1. Fix signaling port to 4444
2. Ensure port 80 is open on server
3. Delete acme.json and restart Traefik
4. Check Traefik logs for errors
5. Wait 2-3 minutes for certificate generation

