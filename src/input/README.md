# Input Management System

**Purpose:** Unified input handling for all user interactions across Desktop, Mobile, VR, and AR.

## Architecture

```
InputManager (coordinator)
  ├── sources/         Hardware input listeners
  │   ├── KeyboardSource.js
  │   ├── MouseSource.js
  │   ├── TouchSource.js
  │   ├── GamepadSource.js
  │   └── VRSource.js
  │
  ├── contexts/        Mode-specific input mappings
  │   ├── ViewModeContext.js
  │   ├── EditModeContext.js
  │   ├── VRModeContext.js
  │   └── ARModeContext.js
  │
  ├── gestures/        Gesture recognition
  │   └── GestureManager.js
  │
  └── utils/           Helper classes
      ├── InputEvent.js
      └── InputAction.js
```

## Core Concepts

**Input Flow:**
1. Hardware generates input (keyboard, mouse, touch, VR controller)
2. InputSource detects and standardizes the input
3. InputManager routes to active InputContext
4. InputContext maps input to abstract action
5. InputManager triggers action event
6. Application/plugins respond to action

**Example:**
```
User presses W key
  → KeyboardSource detects "KeyW"
  → InputManager routes to ViewModeContext
  → ViewModeContext maps "KeyW" → "moveForward" action
  → InputManager emits "action:moveForward"
  → MovementPlugin moves camera forward
```

## Usage

```javascript
import InputManager from './InputManager.js';
import ViewModeContext from './contexts/ViewModeContext.js';

// Initialize
const inputManager = new InputManager(scene, canvas);

// Register contexts
inputManager.registerContext('view', new ViewModeContext());

// Activate context
inputManager.setContext('view');

// Listen for actions
inputManager.on('action:moveForward', (action) => {
    camera.position.z += 0.1;
});

// Query action state
if (inputManager.isActionPressed('jump')) {
    // Handle jump
}
```

## Design Principles

1. **Single Source of Truth** - InputManager coordinates ALL input
2. **Context-Aware** - Different modes have different controls
3. **Priority-Based** - UI blocks 3D, modals block everything
4. **Abstract Actions** - Platform-independent action names
5. **Conflict-Free** - System prevents input conflicts automatically

## Tags

- `[INP]` - Input System General
- `[INP.1]` - InputManager
- `[INP.2]` - InputContext
- `[INP.3]` - InputSource
- `[INP.4]` - InputAction
- `[INP.5]` - InputBinding
- `[INP.6]` - GestureRecognizer
- `[INP.7]` - Accessibility
