# Yjs Rectangles Editor - Real-time Graphic Editing

A production-ready collaborative graphic editor built with Yjs, React, and Supabase. Features real-time synchronization, offline support, and peer-to-peer connectivity.

## ✨ Features

- 🔐 **Google OAuth Authentication** - Secure sign-in with Google accounts
- 🎨 **Real-time Collaboration** - Multiple users editing simultaneously
- 📡 **Offline Support** - Works without internet using IndexedDB
- 🚀 **Low Latency** - Sub-50ms updates via WebRTC P2P
- 💾 **Persistent Storage** - Supabase PostgreSQL backend
- 🔄 **Conflict Resolution** - Automatic CRDT-based merging
- 👥 **Live Cursors** - See other users' mouse positions
- 🎯 **Native SVG** - Crisp vector graphics at any zoom level

## 🏗️ Architecture

```
┌─────────────┐                    ┌─────────────┐
│   Client A  │◄──────WebRTC──────►│   Client B  │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │        ┌──────────────┐          │
       └───────►│  Hocuspocus  │◄─────────┘
                │  (WebSocket) │
                └──────┬───────┘
                       │
                ┌──────▼───────┐
                │   Supabase   │
                │  (Database)  │
                └──────────────┘
```

### Components

1. **Frontend (Next.js)** - React app with Valtio state management
2. **Hocuspocus Server** - WebSocket collaboration server
3. **Signaling Server** - WebRTC peer discovery
4. **Supabase** - PostgreSQL database for persistence

## 🚀 Deployment Options

### Option 1: Dockploy with Docker Compose (Recommended - Fastest!)

**⚡ Quick Start**: Deploy with just **2 services** in ~20 minutes using Docker Compose

🎯 **[Simplified Deployment Guide](./DOCKPLOY_SIMPLIFIED.md)** - Docker Compose (2 services)

📦 **[Docker Compose Guide](./DOCKPLOY_COMPOSE_GUIDE.md)** - Detailed Docker Compose setup

**Services to Deploy:**
1. Backend Services (Hocuspocus + Signaling via Docker Compose)
2. Web App (Next.js)

### Option 2: Dockploy with Separate Services

**Classic Approach**: Deploy 3 separate services in ~40 minutes

📚 **[Complete Deployment Guide](./DOCKPLOY_DEPLOYMENT_GUIDE.md)** - Step-by-step instructions

⚡ **[Quick Reference](./DOCKPLOY_QUICKSTART.md)** - Copy-paste configurations

**Services to Deploy:**
1. Hocuspocus Server (`server/Dockerfile.hocuspocus`)
2. Signaling Server (`server/Dockerfile.y-webrtc`)
3. Web App (`web/Dockerfile`)

### Option 3: Docker Compose (Local Development)

```bash
# Start all services locally
cd server
docker-compose up -d

# Start web app
cd ../web
npm install
npm run dev
```

### Option 4: Manual Setup

See individual READMEs:
- [Server Setup](./server/README.md)
- [Web App Setup](./web/README.md)

## 📦 Project Structure

```
.
├── web/                          # Next.js frontend
│   ├── app/                      # Next.js 14 app directory
│   ├── components/               # React components
│   ├── hooks/                    # Custom hooks (Yjs provider)
│   ├── lib/                      # Utilities (Supabase, providers)
│   ├── store/                    # Valtio state management
│   ├── Dockerfile                # Production build
│   └── package.json
│
├── server/                       # Backend services
│   ├── hocuspocus-server.ts     # WebSocket collaboration
│   ├── y-webrtc-signaling.ts    # WebRTC signaling
│   ├── extensions/              # Hocuspocus extensions
│   ├── Dockerfile.hocuspocus    # Hocuspocus production build
│   ├── Dockerfile.y-webrtc      # Signaling production build
│   ├── docker-compose.yml       # Local orchestration
│   └── package.json
│
├── DOCKPLOY_DEPLOYMENT_GUIDE.md # Full deployment guide
├── DOCKPLOY_QUICKSTART.md       # Quick reference
└── README.md                     # This file
```

## 🎯 Quick Start (Local Development)

### Prerequisites

- Node.js 18+ 
- pnpm (or npm)
- Supabase account

### 1. Clone & Install

```bash
git clone <your-repo>
cd g_zero_yjs_sample

# Install server dependencies
cd server
pnpm install

# Install web dependencies
cd ../web
pnpm install
```

### 2. Setup Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Run SQL from `server/supabase-schema.sql`
3. Get API keys from Settings → API

### 3. Configure Environment

**Server** (`server/.env`):
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
HOCUSPOCUS_PORT=1234
SIGNALING_PORT=4445
Y_WEBRTC_PASSWORD=your-secret-password # Optional: Password for signaling server
```

**Web** (`web/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:4445
NEXT_PUBLIC_WEBRTC_PASSWORD=your-secret-password # Optional: Must match server password
```

### 4. Start Development

```bash
# Terminal 1: Start servers
cd server
pnpm run dev

# Terminal 2: Start web app
cd web
pnpm run dev
```

Visit `http://localhost:3000/document/test`

## 🧪 Testing Collaboration

1. Open `http://localhost:3000/document/test` in multiple browsers
2. Create rectangles, move them around
3. Changes appear in real-time across all windows
4. Try disconnecting internet - changes sync when reconnected

## 📚 Technology Stack

### Frontend
- **Next.js 14** - React framework
- **Valtio** - Reactive state management
- **Yjs** - CRDT for real-time sync
- **Tailwind CSS** - Styling

### Backend
- **Hocuspocus** - Yjs WebSocket server
- **ws** - y-webrtc signaling server
- **Supabase** - Database & storage

### Persistence
- **IndexedDB** - Local offline storage
- **PostgreSQL** - Server-side persistence
- **WebRTC** - Peer-to-peer sync

## 🔐 Authentication & Security

**Implemented:**
- ✅ Google OAuth authentication via Supabase Auth
- ✅ Protected routes - all pages require sign-in
- ✅ User session management
- ✅ Service keys in environment variables

**Setup Required:**
- Configure Google OAuth credentials in Google Cloud Console
- Enable Google provider in Supabase dashboard
- See [Authentication Setup Guide](./web/AUTH_SETUP.md) for detailed instructions

**Production Recommendations:**
- [ ] Add Row Level Security (RLS) to Supabase tables
- [ ] Restrict CORS to specific domains
- [ ] Add rate limiting
- [ ] Implement document-level permissions
- [ ] Use secrets management

See [Authentication Setup](./web/AUTH_SETUP.md) for configuration details.

## 📊 Performance

Expected metrics:

| Metric | Target | Notes |
|--------|--------|-------|
| Initial load | < 2s | With 100 shapes |
| Local updates | < 16ms | 60 FPS |
| P2P sync | < 50ms | WebRTC direct |
| Server sync | < 200ms | WebSocket roundtrip |
| Offline storage | Unlimited | IndexedDB quota |

## 🐛 Troubleshooting

### WebSocket Connection Failed
```
✗ Check SSL/TLS enabled (wss:// not ws://)
✓ Verify backend URLs in environment variables
✓ Check CORS settings
```

### Build Errors
```
✗ Ensure pnpm-lock.yaml is committed
✓ Clear node_modules and reinstall
✓ Check Node.js version (18+)
```

### Database Errors
```
✗ Verify SUPABASE_SERVICE_KEY (not anon key)
✓ Check database schema is created
✓ Test connection from server
```

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for more.

## 📖 Documentation

- [Authentication Setup](./web/AUTH_SETUP.md) - **NEW!** Google OAuth configuration
- [Deployment Guide](./DOCKPLOY_DEPLOYMENT_GUIDE.md) - Full Dockploy setup
- [Quick Start](./DOCKPLOY_QUICKSTART.md) - Copy-paste configs
- [Server Setup](./server/README.md) - Backend configuration
- [Web Setup](./web/README.md) - Frontend configuration
- [Implementation Notes](./IMPLEMENTATION_SUMMARY.md) - Technical details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

## 🙏 Acknowledgments

Built with:
- [Yjs](https://yjs.dev) - CRDT framework
- [Hocuspocus](https://tiptap.dev/hocuspocus) - Collaboration backend
- [Next.js](https://nextjs.org) - React framework
- [Supabase](https://supabase.com) - Database platform
- [Valtio](https://github.com/pmndrs/valtio) - State management

## 🚀 What's Next?

**Post-MVP Features:**
- [x] User authentication (Supabase Auth with Google OAuth)
- [ ] Permission system (view/edit/admin)
- [ ] Row Level Security for user-owned documents
- [ ] Document templates
- [ ] Export to PNG/SVG
- [ ] Undo/Redo with history
- [ ] Comments & annotations
- [ ] Version history
- [ ] Team workspaces

## 📬 Support

- 📧 Email: support@yourapp.com
- 💬 Discord: [Join Server](#)
- 🐛 Issues: [GitHub Issues](https://github.com/yourrepo/issues)
- 📖 Docs: [Documentation](#)

---

**Built with ❤️ using Yjs and React**

Deploy to production in 40 minutes → [Start Here](./DOCKPLOY_QUICKSTART.md)

