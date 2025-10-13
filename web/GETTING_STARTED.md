# Getting Started with Rectangles Editor

Welcome! This guide will get you up and running in **5 minutes**.

## 🚀 Super Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start backend (in another terminal)
cd ../server && docker-compose up

# 3. Run the app
npm run dev

# 4. Open browser
open http://localhost:3000
```

## 🎯 What You'll See

### Landing Page
- Clean, modern interface
- Create/open documents
- Quick start instructions

### Document Editor
- SVG canvas with grid background
- Status bar showing sync state
- Click to add colorful rectangles
- Drag to move, resize handles
- Pan with Cmd+Click, zoom with scroll

### Collaboration in Action
1. Open document in **two browser tabs**
2. Add/move rectangles in one tab
3. See them **instantly sync** in the other!
4. Watch **live cursors** of other users

## 📋 Prerequisites

### Required
- Node.js 18+ installed
- Backend servers running (see below)

### Optional
- Supabase account (for production)
- Multiple browsers/devices for testing

## 🔧 Setup Steps

### Step 1: Install Dependencies

```bash
cd web
npm install
```

This installs:
- Next.js & React
- Yjs collaboration stack
- Valtio state management
- Tailwind CSS
- All necessary providers

### Step 2: Configure Environment

The app works out of the box with default settings!

**Optional:** Create `.env.local` to customize:

```env
# Backend servers (defaults to localhost)
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:4445

# Supabase (optional, for production)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Step 3: Start Backend Servers

**Option A: Docker (Recommended)**
```bash
cd ../server
docker-compose up
```

**Option B: Manual (for development)**
```bash
# Terminal 1: Hocuspocus server
cd ../server
npm run dev

# Terminal 2: Signaling server
cd ../server
npm run signaling
```

### Step 4: Run the Frontend

```bash
npm run dev
```

The app will start at: **http://localhost:3000**

## 🧪 Testing Collaboration

### Local Testing (Same Computer)

1. **Open the app**: http://localhost:3000
2. **Create a document**: Enter name or use auto-generated
3. **Copy the URL**: e.g., `http://localhost:3000/document/my-doc`
4. **Open in new tab**: Paste the URL
5. **Test collaboration**:
   - Click to add rectangles
   - Drag rectangles around
   - Resize using corner handles
   - Watch changes sync in real-time!

### Network Testing (Multiple Computers)

1. **Find your IP address**:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

2. **Update .env.local** with your IP:
   ```env
   NEXT_PUBLIC_HOCUSPOCUS_URL=ws://192.168.1.x:1234
   NEXT_PUBLIC_SIGNALING_URL=ws://192.168.1.x:4445
   ```

3. **Share URL** with others on same network:
   ```
   http://192.168.1.x:3000/document/shared-doc
   ```

### Offline Testing

1. Open a document
2. Open DevTools (F12)
3. Go to Network tab → Check "Offline"
4. Add/modify rectangles
5. Uncheck "Offline"
6. Watch changes sync automatically!

## 🎨 How to Use

### Basic Controls

| Action | How To |
|--------|--------|
| Add rectangle | Click anywhere on canvas |
| Move rectangle | Click and drag |
| Resize rectangle | Drag the white circle handle |
| Pan canvas | Cmd+Click (Mac) or Ctrl+Click (Win) + Drag |

### Advanced Features

- **Random colors**: Each rectangle gets a random HSL color
- **Live cursors**: See other users' mouse pointers
- **Peer count**: Status bar shows connected users
- **Auto-sync**: All changes sync automatically

## 📊 Architecture Overview

```
┌─────────────────────────────────────────┐
│           React Application             │
│  ┌─────────────────────────────────┐   │
│  │     Canvas Component (SVG)      │   │
│  │  ┌─────────────────────────┐    │   │
│  │  │  Rectangle Components   │    │   │
│  │  └─────────────────────────┘    │   │
│  └─────────────────────────────────┘   │
│               ↕                         │
│  ┌─────────────────────────────────┐   │
│  │      Valtio State Store         │   │
│  └─────────────────────────────────┘   │
│               ↕                         │
│  ┌─────────────────────────────────┐   │
│  │      Yjs Document (CRDT)        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
         ↕           ↕           ↕
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │IndexedDB│  │ WebRTC  │  │Hocuspocus│
   │ (Local) │  │  (P2P)  │  │ (Server) │
   └─────────┘  └─────────┘  └─────────┘
                                  ↓
                            ┌──────────┐
                            │ Supabase │
                            │(Database)│
                            └──────────┘
```

## 🔍 Project Structure

```
web/
├── app/                    # Next.js pages
│   ├── page.tsx           # 🏠 Landing page
│   ├── document/[id]/     
│   │   └── page.tsx       # 📝 Editor page
│   └── layout.tsx         # 🎨 Root layout
│
├── components/            # React components
│   ├── Canvas.tsx         # 🖼️ SVG canvas
│   ├── Rectangle.tsx      # 🟦 Shape component
│   ├── StatusBar.tsx      # 📊 Status display
│   └── Cursors.tsx        # 👆 Live cursors
│
├── hooks/                 # React hooks
│   └── useYjs.tsx         # 🔌 Yjs integration
│
├── lib/                   # Utilities
│   ├── yjs-providers.ts   # ⚙️ Provider setup
│   └── supabase.ts        # 🗄️ DB client
│
├── store/                 # State management
│   └── document.ts        # 📦 Valtio store
│
└── types.ts               # 📘 TypeScript types
```

## ❓ Troubleshooting

### Issue: "Failed to connect"

**Symptoms**: Yellow "syncing" indicator, no collaboration

**Solution**:
```bash
# Check if backend is running
cd ../server
docker-compose ps

# If not running
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Issue: "Module not found"

**Symptoms**: Import errors, missing packages

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Issue: Changes not syncing

**Symptoms**: Changes don't appear in other tabs

**Solution**:
1. Check browser console for errors (F12)
2. Verify WebSocket connections are active
3. Make sure all tabs use the same document ID
4. Clear IndexedDB: DevTools → Application → Storage → Clear

### Issue: Slow performance

**Symptoms**: Lag when dragging, choppy animations

**Solution**:
1. Close other browser tabs
2. Check for console errors
3. Reduce number of rectangles (MVP limitation)
4. Restart browser

## 📚 Learn More

### Documentation
- [README.md](./README.md) - Project overview
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Technical details
- [QUICKSTART.md](./QUICKSTART.md) - Quick reference

### External Resources
- [Yjs Documentation](https://docs.yjs.dev/)
- [Next.js Docs](https://nextjs.org/docs)
- [Valtio Guide](https://github.com/pmndrs/valtio)
- [Hocuspocus Docs](https://tiptap.dev/hocuspocus)

## 🎯 What's Next?

### Immediate Tasks
- ✅ Get the app running
- ✅ Test collaboration
- ✅ Explore the code

### Short-term Goals
- Add delete functionality (Delete key)
- Implement undo/redo (Cmd+Z)
- Add more shapes (circles, lines, text)
- Add selection/multi-select

### Medium-term Goals
- Authentication with Supabase
- Color picker UI
- Layer management
- Export to SVG/PNG

### Long-term Vision
- Comments & annotations
- Version history
- Real-time chat
- Mobile app
- AI features

## 💡 Tips & Tricks

### Development Tips
- Use React DevTools to inspect component state
- Use browser DevTools to inspect Yjs document
- Check Network tab for WebSocket connections
- Monitor IndexedDB in Application tab

### Testing Tips
- Use incognito/private windows for different "users"
- Use browser profiles for persistent testing
- Test on mobile devices for responsive design
- Test offline mode frequently

### Performance Tips
- Keep rectangle count < 100 for smooth performance
- Use virtualization for large documents (future feature)
- Monitor network usage in DevTools
- Clear IndexedDB periodically during development

## 🎉 Success!

If you see:
- ✅ App running at http://localhost:3000
- ✅ Status bar showing "connected"
- ✅ Green "synced" indicator
- ✅ Rectangles appearing when you click
- ✅ Changes syncing across tabs

**You're ready to collaborate! 🚀**

---

**Need help?** Check the documentation or open an issue!

**Happy coding!** 🎨✨

