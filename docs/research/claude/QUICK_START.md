# Quick Start Guide - Yjs Collaborative Canvas

Get your collaborative graphic editing tool running in **15 minutes**.

---

## 🚀 Setup Instructions

### 1. Initialize Project
```bash
# Create React app
npx create-react-app collaborative-canvas
cd collaborative-canvas

# Install Yjs dependencies
npm install yjs y-websocket y-webrtc y-indexeddb uuid
```

### 2. Start y-websocket Server
```bash
# Install server dependencies
npm install -g y-websocket

# Start server on port 1234
PORT=1234 npx y-websocket
```

Server will run at: `ws://localhost:1234`

### 3. Create Basic Canvas Component

**File: `src/CollaborativeCanvas.jsx`**

```javascript
import React, { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';

export function CollaborativeCanvas() {
  const [doc] = useState(() => new Y.Doc());
  const [rectangles, setRectangles] = useState([]);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    // IndexedDB persistence (offline-first)
    const indexeddb = new IndexeddbPersistence('canvas-doc', doc);
    indexeddb.whenSynced.then(() => setSynced(true));

    // WebSocket provider
    const wsProvider = new WebsocketProvider(
      'ws://localhost:1234',
      'my-canvas',
      doc
    );

    // WebRTC provider (P2P fallback)
    const webrtcProvider = new WebrtcProvider('my-canvas', doc);

    // Get shared rectangles array
    const yRectangles = doc.getArray('rectangles');

    // Listen to changes
    const updateRectangles = () => {
      setRectangles(yRectangles.toArray().map(r => r.toJSON()));
    };
    
    updateRectangles();
    yRectangles.observe(updateRectangles);

    return () => {
      indexeddb.destroy();
      wsProvider.destroy();
      webrtcProvider.destroy();
    };
  }, [doc]);

  // Add rectangle on click
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const yRectangles = doc.getArray('rectangles');
    const yRect = new Y.Map();
    
    yRect.set('id', Math.random().toString(36));
    yRect.set('x', x - 50);
    yRect.set('y', y - 50);
    yRect.set('width', 100);
    yRect.set('height', 100);
    yRect.set('backgroundColor', `hsl(${Math.random() * 360}, 70%, 60%)`);
    
    yRectangles.push([yRect]);
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '10px' }}>
        Status: {synced ? '✅ Synced' : '⏳ Loading...'}
      </div>
      
      <svg
        width="800"
        height="600"
        onClick={handleClick}
        style={{ 
          border: '2px solid #333',
          cursor: 'crosshair',
          backgroundColor: '#f0f0f0'
        }}
      >
        {rectangles.map((rect) => (
          <rect
            key={rect.id}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={rect.backgroundColor}
            stroke="#000"
            strokeWidth="2"
          />
        ))}
      </svg>
      
      <p style={{ marginTop: '10px', color: '#666' }}>
        Click anywhere to add a rectangle. 
        Open in multiple tabs to see real-time sync!
      </p>
    </div>
  );
}
```

### 4. Update App.js

```javascript
import React from 'react';
import { CollaborativeCanvas } from './CollaborativeCanvas';

function App() {
  return (
    <div className="App">
      <h1 style={{ textAlign: 'center' }}>
        Yjs Collaborative Canvas
      </h1>
      <CollaborativeCanvas />
    </div>
  );
}

export default App;
```

### 5. Run the App

```bash
npm start
```

Open http://localhost:3000 in **multiple browser tabs** to see real-time collaboration!

---

## 🧪 Test Scenarios

### Test 1: Real-time Sync
1. Open app in 2 browser tabs
2. Click to add rectangles in one tab
3. Verify they appear instantly in the other tab ✅

### Test 2: Offline Support
1. Open DevTools → Network tab
2. Set to "Offline" mode
3. Add rectangles (they save locally)
4. Go back "Online"
5. Verify rectangles sync to other tabs ✅

### Test 3: Peer-to-Peer
1. Stop the y-websocket server (`Ctrl+C`)
2. Open 2 tabs (they'll connect via WebRTC)
3. Add rectangles
4. Verify they sync via P2P ✅

---

## 📦 Full Package.json

```json
{
  "name": "collaborative-canvas",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "yjs": "^13.6.10",
    "y-websocket": "^1.5.0",
    "y-webrtc": "^10.2.5",
    "y-indexeddb": "^9.0.12",
    "uuid": "^9.0.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "server": "PORT=1234 npx y-websocket"
  }
}
```

---

## 🎯 Next Steps

1. **Add Drag & Drop**: Use `react-draggable` or custom drag handlers
2. **Add Resize**: Implement resize handles on rectangles
3. **Add Color Picker**: Let users change rectangle colors
4. **Add Undo/Redo**: Use `Y.UndoManager`
5. **Add User Cursors**: Use Awareness protocol for presence

See `YJS_REACT_STACK_PROPOSAL.md` for detailed implementation guides!

---

## 🐛 Troubleshooting

**Problem**: Rectangles not syncing
- ✅ Check server is running on port 1234
- ✅ Check console for WebSocket errors
- ✅ Verify firewall allows port 1234

**Problem**: "WebSocket connection failed"
- ✅ Server might be down → WebRTC will still work!
- ✅ Check server URL matches client

**Problem**: Rectangles disappear
- ✅ Check IndexedDB in DevTools → Application → IndexedDB
- ✅ Clear cache if corrupted: `indexedDB.deleteDatabase('canvas-doc')`

---

**That's it!** You now have a working collaborative canvas with:
- ✅ Real-time sync
- ✅ Offline support  
- ✅ P2P fallback
- ✅ Multi-device support

**Time to build:** ~15 minutes ⚡

