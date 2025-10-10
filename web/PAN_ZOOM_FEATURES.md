# Pan & Zoom Features

## Overview

The canvas now supports advanced pan and zoom functionality using the `react-zoom-pan-pinch` library, which provides excellent support for desktop, Mac trackpad, and mobile gestures.

## Features Implemented

### ✅ Desktop Controls

1. **Mouse Wheel Zoom**
   - Scroll up to zoom in
   - Scroll down to zoom out
   - Smooth scrolling supported
   - Zoom range: 10% - 1000%

2. **Space + Drag to Pan**
   - Press and hold `Space` key
   - Click and drag to pan around the canvas
   - Cursor changes to grab/grabbing to indicate pan mode
   - Release space to return to normal mode

3. **Zoom Control Buttons**
   - Zoom In button (top-right corner)
   - Zoom Out button
   - Reset View button (returns to 100% zoom and center)
   - Live zoom percentage display

### ✅ Mac Trackpad Gestures

1. **Pinch to Zoom**
   - Two-finger pinch gesture to zoom in/out
   - Smooth and responsive
   - Works exactly like Maps and other native apps

2. **Two-Finger Scroll to Pan** (when Space is pressed)
   - Hold Space and use two-finger scroll to pan
   - Natural scrolling supported

### ✅ Mobile Touch Gestures

1. **Pinch to Zoom**
   - Two-finger pinch gesture
   - Smooth zooming animation
   - Touch-optimized

2. **Touch Pan** (when enabled)
   - Pan is disabled by default to allow shape interaction
   - Can be enabled by holding Space (requires external keyboard)
   - Alternative: Could add a pan mode toggle button for mobile

### ✅ Smart Coordinate Handling

- Rectangle creation accounts for zoom and pan
- Click positions are correctly transformed to SVG coordinates
- Drag and resize operations work correctly at any zoom level
- Resize handles scale inversely to maintain visual consistency

## Configuration

The zoom/pan behavior is configured in `Canvas.tsx`:

```typescript
<TransformWrapper
  initialScale={1}        // Start at 100% zoom
  minScale={0.1}         // Min 10% zoom
  maxScale={10}          // Max 1000% zoom
  limitToBounds={false}  // Allow panning beyond canvas
  wheel={{
    step: 0.1,           // Zoom step per wheel tick
    smoothStep: 0.005    // Smooth scroll sensitivity
  }}
  pinch={{
    step: 5              // Pinch gesture sensitivity
  }}
  panning={{
    disabled: !isSpacePressed  // Only pan when Space is pressed
  }}
>
```

## Usage Guide

### For Desktop Users

1. **Zoom**: Use mouse wheel or zoom buttons
2. **Pan**: Press Space + drag with mouse
3. **Add Shape**: Click on canvas (not while Space is pressed)
4. **Select Shape**: Click on a rectangle
5. **Delete Shape**: Select shape, then press Delete/Backspace
6. **Reset View**: Click the reset button (expand/contract icon)

### For Mac Trackpad Users

1. **Zoom**: Pinch gesture (two fingers)
2. **Pan**: Press Space + two-finger scroll
3. **Smooth Zoom**: Use scroll gesture for precise zoom control
4. **All other controls**: Same as desktop

### For Mobile/Tablet Users

1. **Zoom**: Pinch gesture
2. **Pan**: Currently requires Space key (external keyboard)
3. **Future**: Could add a pan mode toggle button for touch-only devices

## Technical Details

### Library: `react-zoom-pan-pinch`

- **Version**: 3.7.0
- **Bundle Size**: ~15KB gzipped
- **Performance**: Hardware-accelerated transforms
- **Browser Support**: All modern browsers, iOS Safari, Android Chrome

### Key Features

- CSS transforms for smooth 60fps animations
- Passive event listeners for better scroll performance  
- `touchAction: 'none'` on SVG prevents default touch behaviors
- Coordinate transformation using `getScreenCTM()` for precision
- Inverse scaling on resize handles for consistent visual size

### Coordinate Transformation

When a user clicks on the canvas, coordinates are transformed:

```typescript
const x = (e.clientX - rect.left - positionX) / scale
const y = (e.clientY - rect.top - positionY) / scale
```

Where:
- `positionX/Y`: Current pan offset
- `scale`: Current zoom level
- Result: Precise SVG coordinates regardless of zoom/pan

## Future Enhancements

### Potential Additions

1. **Mobile Pan Toggle Button**
   ```typescript
   // Add a floating button to enable/disable pan mode on mobile
   const [mobileePanMode, setMobilePanMode] = useState(false)
   ```

2. **Keyboard Zoom Shortcuts**
   - `Cmd/Ctrl + Plus`: Zoom in
   - `Cmd/Ctrl + Minus`: Zoom out
   - `Cmd/Ctrl + 0`: Reset zoom

3. **Zoom to Fit**
   - Automatically zoom to fit all shapes on canvas
   - Center view on selected shape

4. **Mini Map**
   - Small overview map in corner
   - Shows current viewport location
   - Click to jump to location

5. **Touch Gestures Enhancement**
   - Three-finger swipe to pan (no Space key needed)
   - Double-tap to zoom in
   - Two-finger double-tap to zoom out

## Troubleshooting

### Issue: Pan doesn't work
- **Solution**: Make sure Space key is pressed while dragging

### Issue: Zoom is too sensitive
- **Solution**: Adjust `wheel.step` and `wheel.smoothStep` values in TransformWrapper config

### Issue: Can't click shapes after zooming
- **Solution**: This shouldn't happen - coordinates are automatically transformed. If it does, check browser console for errors.

### Issue: Resize handles are too small when zoomed out
- **Solution**: Already handled - handles scale inversely with zoom level

### Issue: Mobile pinch doesn't work
- **Solution**: Make sure `touchAction: 'none'` is set on the SVG element

## Performance Optimization

The implementation includes several optimizations:

1. **CSS Transform-based**: Uses GPU-accelerated transforms
2. **Debounced Updates**: Pan/zoom callbacks are optimized
3. **Inverse Scaling**: UI elements scale appropriately
4. **Smart Re-renders**: Only affected components re-render on zoom/pan

## Browser Compatibility

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ | ✅ |
| Firefox | ✅ | ✅ |
| Safari | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Mobile Safari | - | ✅ |
| Chrome Mobile | - | ✅ |

All gestures work on all platforms that support them.

