# Getting Started

Welcome! This guide will help you get the collaborative editing server up and running.

## 📖 Documentation Index

Choose the guide that fits your needs:

### 🚀 [QUICKSTART.md](./QUICKSTART.md) 
**Start here if you want to get running in 5 minutes**
- Minimal setup steps
- Quick verification
- Common issues

### 🔧 [SETUP.md](./SETUP.md)
**Complete setup guide with troubleshooting**
- Step-by-step instructions
- Detailed explanations
- Comprehensive troubleshooting
- Production deployment

### 📚 [README.md](./README.md)
**Full technical documentation**
- Architecture overview
- API reference
- Configuration options
- Monitoring and scaling
- Security guidelines

## 🎯 What You Need

### Minimal Requirements
- Node.js 18+
- Supabase account (free tier works)
- 10 minutes of time

### Optional (for production)
- Docker & Docker Compose
- Redis (for scaling)
- SSL certificates (for HTTPS/WSS)

## 🏃 Quick Commands

```bash
# First time setup
npm install
cp env.example .env
# Edit .env with your credentials
npm run verify

# Development
npm run dev                # Start both servers
npm run test:connection    # Test connections

# Production
npm run build             # Build TypeScript
docker-compose up -d      # Start with Docker
```

## 📋 What Gets Installed

This server provides two services:

1. **Hocuspocus Server** (`:1234`)
   - Yjs WebSocket collaboration
   - Supabase persistence
   - Document sync

2. **Signaling Server** (`:4445`)
   - WebRTC P2P signaling
   - Room management
   - Peer discovery

## 🗂️ File Overview

```
server/
├── 📄 QUICKSTART.md          ← Start here!
├── 📄 SETUP.md               ← Detailed setup
├── 📄 README.md              ← Full docs
│
├── 🔧 hocuspocus-server.ts   ← Main WebSocket server
├── 🔧 signaling-server.ts    ← P2P signaling
├── 📁 extensions/            ← Supabase integration
│
├── 🐳 docker-compose.yml     ← Docker orchestration
├── 🐳 Dockerfile.*           ← Container configs
│
├── 💾 supabase-schema.sql    ← Database schema
├── ⚙️  env.example            ← Config template
│
└── 🛠️  scripts/               ← Utility scripts
    ├── verify-setup.js       ← Check configuration
    └── test-connection.js    ← Test servers
```

## 🚦 Getting Started Path

### Path 1: Quick Development
1. Read [QUICKSTART.md](./QUICKSTART.md)
2. Run `npm run verify`
3. Run `npm run dev`
4. Connect your client

### Path 2: Detailed Setup
1. Read [SETUP.md](./SETUP.md)
2. Follow step-by-step instructions
3. Verify with scripts
4. Deploy to production

### Path 3: Understanding Everything
1. Read [README.md](./README.md)
2. Explore architecture
3. Customize configuration
4. Scale as needed

## 🆘 Need Help?

### Common Issues

**"Cannot find module"**
```bash
rm -rf node_modules && npm install
```

**"Port in use"**
```bash
lsof -ti:1234 | xargs kill
```

**"Supabase connection failed"**
- Check you're using `service_role` key
- Verify URL format: `https://xxxxx.supabase.co`

### Still Stuck?

1. Check [SETUP.md](./SETUP.md#troubleshooting) troubleshooting section
2. Run `npm run verify` to diagnose issues
3. Check server logs for errors
4. Review [README.md](./README.md) for detailed docs

## 🎉 Next Steps

Once your server is running:

1. ✅ Test with `npm run test:connection`
2. ✅ Monitor logs for activity
3. ✅ Connect your web client
4. ✅ Start collaborating!

## 📚 Learn More

- [Hocuspocus Documentation](https://tiptap.dev/hocuspocus)
- [Yjs Documentation](https://docs.yjs.dev)
- [Socket.IO Documentation](https://socket.io/docs)
- [Supabase Documentation](https://supabase.com/docs)

---

**Ready to start?** → [QUICKSTART.md](./QUICKSTART.md) 🚀

