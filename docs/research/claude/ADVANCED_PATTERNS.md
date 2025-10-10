# Advanced Patterns & Production Guide

Deep dive into production-ready patterns for Yjs + React collaborative apps.

---

## 🎨 Advanced Rectangle Operations

### 1. Drag & Drop Implementation

```javascript
// hooks/useDraggableRectangle.js
import { useState, useCallback } from 'react';

export function useDraggableRectangle(doc, rectId) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.stopPropagation();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    const yRectangles = doc.getArray('rectangles');
    const yRect = yRectangles.toArray().find(r => r.get('id') === rectId);
    
    if (yRect) {
      const currentX = yRect.get('x');
      const currentY = yRect.get('y');
      
      // Batch updates in a transaction for better performance
      doc.transact(() => {
        yRect.set('x', currentX + deltaX);
        yRect.set('y', currentY + deltaY);
      }, 'drag-move'); // Origin for undo/redo
    }

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, doc, rectId]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    isDragging,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp
    }
  };
}
```

### 2. Resize Handles Implementation

```javascript
// components/ResizableRectangle.jsx
import React from 'react';

export function ResizableRectangle({ rect, doc }) {
  const handleSize = 8;

  const handleResize = (corner, deltaX, deltaY) => {
    const yRectangles = doc.getArray('rectangles');
    const yRect = yRectangles.toArray().find(r => r.get('id') === rect.id);
    
    if (!yRect) return;

    doc.transact(() => {
      switch (corner) {
        case 'se': // Bottom-right
          yRect.set('width', Math.max(20, rect.width + deltaX));
          yRect.set('height', Math.max(20, rect.height + deltaY));
          break;
        case 'sw': // Bottom-left
          yRect.set('x', rect.x + deltaX);
          yRect.set('width', Math.max(20, rect.width - deltaX));
          yRect.set('height', Math.max(20, rect.height + deltaY));
          break;
        case 'ne': // Top-right
          yRect.set('y', rect.y + deltaY);
          yRect.set('width', Math.max(20, rect.width + deltaX));
          yRect.set('height', Math.max(20, rect.height - deltaY));
          break;
        case 'nw': // Top-left
          yRect.set('x', rect.x + deltaX);
          yRect.set('y', rect.y + deltaY);
          yRect.set('width', Math.max(20, rect.width - deltaX));
          yRect.set('height', Math.max(20, rect.height - deltaY));
          break;
      }
    }, 'resize');
  };

  return (
    <g>
      {/* Main rectangle */}
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={rect.backgroundColor}
        stroke="#333"
        strokeWidth="2"
      />
      
      {/* Resize handles */}
      {['nw', 'ne', 'sw', 'se'].map(corner => {
        const x = corner.includes('w') ? rect.x : rect.x + rect.width;
        const y = corner.includes('n') ? rect.y : rect.y + rect.height;
        
        return (
          <rect
            key={corner}
            x={x - handleSize / 2}
            y={y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke="#333"
            strokeWidth="1"
            style={{ cursor: `${corner}-resize` }}
            // Add drag handlers here
          />
        );
      })}
    </g>
  );
}
```

### 3. Multi-Select & Bulk Operations

```javascript
// hooks/useSelection.js
import { useState, useCallback } from 'react';

export function useSelection(doc) {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = useCallback((id, isMulti = false) => {
    setSelectedIds(prev => {
      const next = new Set(isMulti ? prev : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const deleteSelected = useCallback(() => {
    const yRectangles = doc.getArray('rectangles');
    
    doc.transact(() => {
      // Delete in reverse order to maintain indices
      const indices = Array.from(selectedIds)
        .map(id => yRectangles.toArray().findIndex(r => r.get('id') === id))
        .filter(idx => idx !== -1)
        .sort((a, b) => b - a);
      
      indices.forEach(idx => yRectangles.delete(idx, 1));
    }, 'bulk-delete');
    
    clearSelection();
  }, [doc, selectedIds, clearSelection]);

  const changeColorSelected = useCallback((color) => {
    const yRectangles = doc.getArray('rectangles');
    
    doc.transact(() => {
      selectedIds.forEach(id => {
        const yRect = yRectangles.toArray().find(r => r.get('id') === id);
        if (yRect) {
          yRect.set('backgroundColor', color);
        }
      });
    }, 'bulk-color-change');
  }, [doc, selectedIds]);

  return {
    selectedIds,
    toggleSelect,
    clearSelection,
    deleteSelected,
    changeColorSelected
  };
}
```

---

## 🔐 Authentication & Authorization

### Server-Side Auth Middleware

```javascript
// server/authMiddleware.js
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'your-secret-key';

function authenticateWebSocket(req, callback) {
  const url = new URL(req.url, 'ws://localhost');
  const token = url.searchParams.get('token');
  const docName = url.pathname.slice(1);

  if (!token) {
    return callback(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    
    // Check if user has access to this document
    if (!canAccessDocument(decoded.userId, docName)) {
      return callback(new Error('Access denied'));
    }

    // Attach user info to request
    req.user = decoded;
    callback();
  } catch (err) {
    callback(new Error('Invalid token'));
  }
}

function canAccessDocument(userId, docName) {
  // Query your database to check permissions
  // Example: SELECT * FROM document_permissions WHERE user_id = ? AND doc_name = ?
  return true; // Implement your logic here
}

module.exports = { authenticateWebSocket };
```

### Enhanced Server with Auth

```javascript
// server/server-with-auth.js
const http = require('http');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');
const { authenticateWebSocket } = require('./authMiddleware');

const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

// Upgrade HTTP to WebSocket with auth
server.on('upgrade', (req, socket, head) => {
  authenticateWebSocket(req, (err) => {
    if (err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });
});

wss.on('connection', (conn, req) => {
  console.log(`User ${req.user.userId} connected`);
  setupWSConnection(conn, req);
});

server.listen(1234, () => {
  console.log('✅ Secure WebSocket server running on port 1234');
});
```

### Client-Side Token Passing

```javascript
// Client authentication
const token = getUserToken(); // Get from login flow

const wsProvider = new WebsocketProvider(
  `ws://localhost:1234`,
  documentId,
  ydoc,
  {
    params: { token },
    connect: true
  }
);

wsProvider.on('connection-error', (error) => {
  if (error.message.includes('401')) {
    // Redirect to login
    window.location.href = '/login';
  }
});
```

---

## 👥 User Awareness (Cursors & Presence)

### Implementing User Cursors

```javascript
// hooks/useAwareness.js
import { useEffect, useState } from 'react';

export function useAwareness(provider, userId, userName) {
  const [awarenessStates, setAwarenessStates] = useState([]);

  useEffect(() => {
    if (!provider) return;

    const awareness = provider.awareness;

    // Set local user info
    awareness.setLocalStateField('user', {
      id: userId,
      name: userName,
      color: generateUserColor(userId)
    });

    // Listen to awareness changes
    const updateAwareness = () => {
      const states = Array.from(awareness.getStates().entries())
        .filter(([clientId, state]) => clientId !== awareness.clientID)
        .map(([clientId, state]) => ({
          clientId,
          ...state
        }));
      
      setAwarenessStates(states);
    };

    awareness.on('change', updateAwareness);
    updateAwareness();

    return () => {
      awareness.off('change', updateAwareness);
    };
  }, [provider, userId, userName]);

  return awarenessStates;
}

function generateUserColor(userId) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
  ];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
```

### User Cursor Component

```javascript
// components/UserCursors.jsx
import React from 'react';
import { useAwareness } from '../hooks/useAwareness';

export function UserCursors({ wsProvider }) {
  const users = useAwareness(wsProvider);

  return (
    <>
      {users.map(user => (
        user.cursor && (
          <g key={user.clientId}>
            {/* Cursor pointer */}
            <path
              d={`M ${user.cursor.x} ${user.cursor.y} 
                  L ${user.cursor.x + 12} ${user.cursor.y + 16} 
                  L ${user.cursor.x + 8} ${user.cursor.y + 12} 
                  L ${user.cursor.x + 16} ${user.cursor.y + 20} Z`}
              fill={user.user.color}
              stroke="white"
              strokeWidth="1"
            />
            
            {/* User name label */}
            <text
              x={user.cursor.x + 18}
              y={user.cursor.y + 5}
              fill={user.user.color}
              fontSize="12"
              fontWeight="bold"
            >
              {user.user.name}
            </text>
          </g>
        )
      ))}
    </>
  );
}
```

### Track Mouse Position

```javascript
// Update awareness with cursor position
const handleMouseMove = (e) => {
  if (!wsProvider) return;
  
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  wsProvider.awareness.setLocalStateField('cursor', { x, y });
};
```

---

## ⏮️ Undo/Redo Implementation

```javascript
// hooks/useUndoManager.js
import { useEffect, useState } from 'react';
import * as Y from 'yjs';

export function useUndoManager(doc, scope) {
  const [undoManager, setUndoManager] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!doc || !scope) return;

    const um = new Y.UndoManager(scope, {
      trackedOrigins: new Set([null, 'drag-move', 'resize', 'color-change']),
      captureTimeout: 500 // Merge rapid changes within 500ms
    });

    const updateStacks = () => {
      setCanUndo(um.undoStack.length > 0);
      setCanRedo(um.redoStack.length > 0);
    };

    um.on('stack-item-added', updateStacks);
    um.on('stack-item-popped', updateStacks);
    
    setUndoManager(um);
    updateStacks();

    return () => {
      um.destroy();
    };
  }, [doc, scope]);

  const undo = () => undoManager?.undo();
  const redo = () => undoManager?.redo();

  return { undo, redo, canUndo, canRedo };
}
```

### Undo/Redo UI

```javascript
// components/UndoRedoToolbar.jsx
import React from 'react';
import { useUndoManager } from '../hooks/useUndoManager';

export function UndoRedoToolbar({ doc }) {
  const yRectangles = doc?.getArray('rectangles');
  const { undo, redo, canUndo, canRedo } = useUndoManager(doc, yRectangles);

  return (
    <div style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
      <button onClick={undo} disabled={!canUndo}>
        ↶ Undo (Ctrl+Z)
      </button>
      <button onClick={redo} disabled={!canRedo}>
        ↷ Redo (Ctrl+Shift+Z)
      </button>
    </div>
  );
}
```

### Keyboard Shortcuts

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [undo, redo]);
```

---

## 📊 Performance Optimization

### 1. Debounce Updates

```javascript
// utils/debounce.js
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Usage: Debounce expensive render updates
const debouncedUpdate = debounce(() => {
  setRectangles(yRectangles.toArray().map(r => r.toJSON()));
}, 16); // ~60fps
```

### 2. Virtualization for Large Documents

```javascript
// Only render rectangles in viewport
function useVisibleRectangles(rectangles, viewport) {
  return rectangles.filter(rect => 
    rect.x + rect.width > viewport.x &&
    rect.x < viewport.x + viewport.width &&
    rect.y + rect.height > viewport.y &&
    rect.y < viewport.y + viewport.height
  );
}
```

### 3. Batch Transactions

```javascript
// ❌ BAD: Multiple transactions (slow)
yRect.set('x', 100);
yRect.set('y', 200);
yRect.set('width', 300);

// ✅ GOOD: Single transaction (fast)
doc.transact(() => {
  yRect.set('x', 100);
  yRect.set('y', 200);
  yRect.set('width', 300);
}, 'bulk-update');
```

---

## 🔍 Debugging Tools

### 1. Document Inspector

```javascript
// utils/debugYjs.js
export function inspectDocument(doc) {
  console.log('=== Yjs Document Inspector ===');
  console.log('Client ID:', doc.clientID);
  console.log('Document Size:', Y.encodeStateAsUpdate(doc).length, 'bytes');
  
  const yRectangles = doc.getArray('rectangles');
  console.log('Total Rectangles:', yRectangles.length);
  
  yRectangles.forEach((yRect, index) => {
    console.log(`Rectangle ${index}:`, yRect.toJSON());
  });
}

// Call from browser console:
// window.inspectDoc()
window.inspectDoc = () => inspectDocument(globalDocRef);
```

### 2. Connection Monitor

```javascript
// components/ConnectionMonitor.jsx
import React, { useEffect, useState } from 'react';

export function ConnectionMonitor({ wsProvider, webrtcProvider }) {
  const [status, setStatus] = useState({
    ws: 'disconnected',
    webrtc: 'disconnected',
    synced: false
  });

  useEffect(() => {
    if (!wsProvider || !webrtcProvider) return;

    const updateStatus = () => {
      setStatus({
        ws: wsProvider.wsconnected ? 'connected' : 'disconnected',
        webrtc: webrtcProvider.connected ? 'connected' : 'disconnected',
        synced: wsProvider.synced || webrtcProvider.synced
      });
    };

    wsProvider.on('status', updateStatus);
    webrtcProvider.on('synced', updateStatus);
    
    updateStatus();

    return () => {
      wsProvider.off('status', updateStatus);
      webrtcProvider.off('synced', updateStatus);
    };
  }, [wsProvider, webrtcProvider]);

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 10, 
      right: 10, 
      padding: '10px',
      background: 'white',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '12px'
    }}>
      <div>WebSocket: <strong>{status.ws}</strong></div>
      <div>WebRTC: <strong>{status.webrtc}</strong></div>
      <div>Synced: <strong>{status.synced ? '✅' : '⏳'}</strong></div>
    </div>
  );
}
```

---

## 🚨 Error Handling

### Comprehensive Error Boundary

```javascript
// components/ErrorBoundary.jsx
import React from 'react';

class YjsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Yjs Error:', error, errorInfo);
    
    // Log to error tracking service (e.g., Sentry)
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: { react: errorInfo }
      });
    }
  }

  handleReset = () => {
    // Clear corrupted IndexedDB
    if (confirm('Reset local document cache?')) {
      indexedDB.deleteDatabase('canvas-doc').then(() => {
        window.location.reload();
      });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h1>❌ Something went wrong</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleReset}>
            Reset Document Cache
          </button>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default YjsErrorBoundary;
```

---

## 📈 Monitoring & Analytics

### Track Document Metrics

```javascript
// utils/analytics.js
export class YjsAnalytics {
  constructor(doc, docName) {
    this.doc = doc;
    this.docName = docName;
    this.metrics = {
      totalUpdates: 0,
      bytesTransferred: 0,
      syncTime: 0
    };

    this.setupListeners();
  }

  setupListeners() {
    this.doc.on('update', (update) => {
      this.metrics.totalUpdates++;
      this.metrics.bytesTransferred += update.length;
      
      // Send to analytics service
      this.sendMetric('yjs_update', {
        docName: this.docName,
        updateSize: update.length
      });
    });
  }

  sendMetric(eventName, data) {
    // Example: Google Analytics
    if (window.gtag) {
      window.gtag('event', eventName, data);
    }
    
    // Example: Custom analytics endpoint
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventName, ...data })
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      documentSize: Y.encodeStateAsUpdate(this.doc).length
    };
  }
}
```

---

## 🎯 Production Checklist

### Pre-Launch Checklist

- [ ] **Authentication** implemented on WebSocket server
- [ ] **Authorization** checks for document access
- [ ] **Rate limiting** to prevent abuse
- [ ] **Error tracking** (Sentry, LogRocket, etc.)
- [ ] **Analytics** for usage metrics
- [ ] **Backup strategy** for database
- [ ] **Monitoring** (Uptime, performance)
- [ ] **SSL/TLS** enabled (wss:// not ws://)
- [ ] **CORS** configured correctly
- [ ] **Stress testing** with 50+ concurrent users
- [ ] **Offline mode** tested thoroughly
- [ ] **Mobile responsiveness** verified
- [ ] **Browser compatibility** (Chrome, Firefox, Safari, Edge)
- [ ] **Documentation** for API endpoints
- [ ] **Rollback plan** in case of issues

---

## 📚 Additional Resources

- **Yjs Community Discord**: https://discord.gg/T3nqMT6qbM
- **Discuss Forum**: https://discuss.yjs.dev/
- **GitHub Issues**: https://github.com/yjs/yjs/issues
- **CRDT Papers**: https://crdt.tech/papers

---

**Last Updated:** October 10, 2025

