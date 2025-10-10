# Quick Start Guide

Get your collaborative editor running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd web
npm install
```

## Step 2: Configure Environment

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```env
# Optional: For Supabase integration (not required for MVP)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Required: Backend server URLs
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:4444
```

## Step 3: Start Backend Servers

Make sure the backend servers are running:

```bash
# In a separate terminal, from the server directory
cd ../server
docker-compose up
```

This will start:
- Hocuspocus WebSocket server on port 1234
- Signaling server for WebRTC on port 4444

## Step 4: Start the Frontend

```bash
npm run dev
```

## Step 5: Test Collaboration

1. Open [http://localhost:3000](http://localhost:3000)
2. Create or open a document
3. Open the same URL in another tab or browser
4. Click to add rectangles and see them sync in real-time!

## Troubleshooting

### Issue: "Failed to connect to server"

**Solution**: Make sure the backend servers are running:
```bash
cd ../server
docker-compose ps
```

If not running:
```bash
docker-compose up -d
```

### Issue: "Module not found" errors

**Solution**: Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Changes not syncing

**Solution**: Check browser console for errors and verify:
1. WebSocket connection to `ws://localhost:1234` is established
2. Signaling server is accessible at `ws://localhost:4444`
3. No CORS errors in the console

### Issue: IndexedDB errors

**Solution**: Clear browser storage:
1. Open DevTools → Application → Storage
2. Click "Clear site data"
3. Refresh the page

## Next Steps

- Add authentication with Supabase Auth
- Implement undo/redo functionality
- Add more shape types (circles, lines, etc.)
- Implement text editing
- Add color picker and styling tools
- Export to SVG/PNG

## Architecture Overview

```
┌─────────────┐
│   Browser   │
│  (React)    │
└─────────────┘
       │
       ├── IndexedDB (local persistence)
       │
       ├── WebRTC (P2P with other browsers)
       │
       └── WebSocket (Hocuspocus server)
              │
              └── Supabase (PostgreSQL)
```

## Key Files

- `app/page.tsx` - Landing page
- `app/document/[id]/page.tsx` - Document editor
- `components/Canvas.tsx` - Main SVG canvas
- `hooks/useYjs.tsx` - Yjs integration
- `lib/yjs-providers.ts` - Provider setup
- `store/document.ts` - Valtio state management

Happy coding! 🚀

