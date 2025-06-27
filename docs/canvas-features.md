# Canvas Features Documentation

This document describes the canvas-based design interface and video overlay system in Jaaz.

## Overview

Jaaz features a sophisticated canvas-based design interface that combines traditional drawing tools with AI-generated content, including images and videos. The canvas system is built on top of Excalidraw and includes a custom video overlay system for interactive media elements.

## Architecture Components

### Canvas System
- **Primary Canvas**: Built with Excalidraw for drawing and design elements
- **Video Overlay**: Custom React component system for video elements
- **State Management**: Synchronized between Excalidraw and video overlay systems
- **Real-time Updates**: WebSocket-based synchronization for collaborative features

### Video Overlay System

The video overlay system (`VideoCanvasOverlay.tsx`) provides interactive video elements that can be positioned, resized, and managed independently from the main canvas drawing elements.

#### Key Features

1. **Video Positioning**
   - Videos are positioned using canvas coordinates
   - Transform calculations account for canvas zoom and scroll
   - Automatic positioning fallbacks for edge cases

2. **Interactive Controls**
   - **Selection**: Click to select videos with visual feedback
   - **Dragging**: Click and drag to reposition videos
   - **Resizing**: Drag resize handle to change video dimensions
   - **Deletion**: Remove button when video is selected

3. **State Persistence**
   - Video positions and sizes are saved to canvas metadata
   - Persistent across canvas loads and saves
   - Synchronized with Excalidraw app state

4. **Real-time Synchronization**
   - Changes are immediately reflected in the UI
   - WebSocket updates for collaborative editing
   - Optimized updates to prevent performance issues

## Video Management

### Video Data Structure
```typescript
interface VideoElement {
  id: string           // Unique identifier
  src: string         // Video source URL or data URL
  x: number           // Canvas X coordinate
  y: number           // Canvas Y coordinate
  width: number       // Video width in pixels
  height: number      // Video height in pixels
  duration?: number   // Video duration in seconds
  canvasId: string    // Associated canvas ID
}
```

### Video Lifecycle

1. **Generation**: Videos are generated through AI providers
2. **Addition**: Added to canvas via `addVideo` method
3. **Interaction**: Users can drag, resize, and select videos
4. **Persistence**: Video metadata saved to canvas state
5. **Removal**: Videos can be deleted by user action

### Event Handling

#### Drag Operations
- **Start**: `handleDragStart` - Captures initial position and offsets
- **Move**: `handleDragMove` - Updates video position during drag
- **End**: `handleDragEnd` - Finalizes position and saves state

#### Resize Operations
- **Start**: `handleResizeStart` - Captures initial dimensions
- **Move**: `handleResizeMove` - Updates video size during resize
- **End**: `handleResizeEnd` - Finalizes dimensions and saves state

#### Selection Management
- **Select**: `handleVideoSelect` - Activates video controls
- **Deselect**: Click outside video to remove selection
- **Visual Feedback**: Border color changes and control visibility

## Canvas Transform System

### Coordinate Transformation
Videos must be positioned correctly relative to the canvas zoom and scroll state:

```typescript
const getCanvasTransform = () => {
  const appState = excalidrawAPI.getAppState()
  return {
    zoom: appState.zoom?.value || 1,
    scrollX: appState.scrollX || 0,
    scrollY: appState.scrollY || 0
  }
}
```

### Position Calculation
```typescript
const transformedX = videoX * zoom + scrollX
const transformedY = videoY * zoom + scrollY
const transformedWidth = videoWidth * zoom
const transformedHeight = videoHeight * zoom
```

### Bounds Checking
- Videos are kept within reasonable viewport bounds
- Automatic fallback positioning for edge cases
- Minimum size constraints to maintain usability

## State Management

### Video State Storage
- **Component State**: `useState` for immediate UI updates
- **Canvas State**: Excalidraw app state for persistence
- **Server State**: Canvas data saved to backend API

### State Synchronization Flow
1. User interaction triggers state change
2. Component state updated immediately
3. Canvas app state updated for persistence
4. Backend API called to save changes
5. WebSocket broadcasts changes to other clients

### Conflict Resolution
- User interactions take priority during active manipulation
- Automatic restoration of videos if lost from app state
- Debounced updates to prevent excessive API calls

## Performance Considerations

### Optimization Strategies
1. **Throttled Updates**: Limit frequency of state updates during drag/resize
2. **Conditional Rendering**: Only show controls for selected videos
3. **Event Delegation**: Efficient event handling with proper cleanup
4. **Memory Management**: Proper cleanup of event listeners

### Debug Features
- Console logging for video state changes
- Transform calculation debugging
- Performance monitoring for video count changes

## Integration Points

### With Excalidraw Canvas
- Videos are stored in Excalidraw app state for persistence
- Transform calculations use Excalidraw's zoom/scroll values
- Video overlay positioned above Excalidraw canvas

### With Backend API
- Video generation through `/api/video` endpoints
- Canvas state persistence through `/api/canvas` endpoints
- Real-time updates via WebSocket connections

### With AI Providers
- Videos generated through various AI providers (FAL, Replicate, etc.)
- Provider-specific configuration and parameters
- Error handling and fallback mechanisms

## User Experience

### Interaction Patterns
1. **Video Generation**: Request video through chat interface
2. **Video Placement**: Video automatically appears on canvas
3. **Video Selection**: Click to select and show controls
4. **Video Manipulation**: Drag to move, resize handle to scale
5. **Video Management**: Delete button to remove

### Visual Design
- **Selection Border**: Blue border indicates selected video
- **Control Handles**: Visual indicators for drag and resize
- **Transparency**: Semi-transparent overlay for better integration
- **Shadows**: Drop shadows for depth and visual separation

### Accessibility
- **Keyboard Navigation**: Tab navigation between video controls
- **Screen Reader Support**: ARIA labels for control elements
- **High Contrast**: Visible controls in various theme modes
- **Touch Support**: Mobile-friendly touch interactions

## Development Guidelines

### Adding New Video Features
1. Extend the `VideoElement` interface for new properties
2. Update state management to handle new properties
3. Add UI controls for new features
4. Implement persistence for new data
5. Add appropriate event handling

### Testing Video Features
1. Test video generation and placement
2. Verify drag and resize functionality
3. Test state persistence across sessions
4. Check performance with multiple videos
5. Validate cross-browser compatibility

### Common Issues and Solutions

#### Video Positioning Issues
- **Problem**: Videos appear outside viewport
- **Solution**: Check transform calculations and add bounds checking

#### State Synchronization Problems
- **Problem**: Videos disappear after interactions
- **Solution**: Verify app state updates and restoration logic

#### Performance Degradation
- **Problem**: Lag during video manipulation
- **Solution**: Optimize update frequency and event handling

## Future Enhancements

### Planned Features
- **Aspect Ratio Locking**: Maintain video proportions during resize
- **Video Playback Controls**: Play/pause, seeking, volume control
- **Video Editing**: Basic trimming and effects
- **Group Operations**: Select and manipulate multiple videos
- **Layer Management**: Z-index control for video stacking

### Technical Improvements
- **Virtual Rendering**: Optimize rendering for large numbers of videos
- **Lazy Loading**: Load video content on demand
- **Progressive Enhancement**: Graceful degradation for older devices
- **WebRTC Integration**: Real-time video streaming capabilities

This documentation should be updated as new video features are added and the canvas system evolves.