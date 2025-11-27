# Architecture Analysis

## Overview

Legozo 3D CMS employs a sophisticated multi-tier architecture combining:
- **Legacy Plugin System**: Mature, feature-complete plugins
- **Modern Module System**: New modular architecture (Phase 2)
- **Hybrid Integration**: Transition strategy from plugins to modules

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         index.html                           │
│                    (Entry Point + CDN)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Bootstrap.js                              │
│              (Initialization Orchestrator)                   │
│  - Global error handling                                     │
│  - ActionDispatcher setup                                    │
│  - Legacy handler bridges                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  LegozoLoader (Core)                         │
│              (Module/Plugin Orchestrator)                    │
│  - Config loading (engine + scene)                           │
│  - Style/template loading                                    │
│  - Module resolution (DependencyResolver)                    │
│  - Lifecycle management                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                              ▼
┌──────────────────┐          ┌──────────────────┐
│  BabylonEngine   │          │  InputManager    │
│   (Core Engine)  │          │  (Input System)  │
│                  │          │                  │
│ - Scene creation │          │ - Input sources  │
│ - Plugin mgmt    │          │ - Input contexts │
│ - Event system   │          │ - Action mapping │
│ - Render loop    │          └──────────────────┘
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    PLUGIN LAYER (Legacy)                     │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Camera     │  Movement    │  Collision   │   Gravity      │
│   Lighting   │  Shadow      │  Material    │   Sky          │
│   Asset      │  Interaction │  UI          │   Performance  │
│   Gizmo      │  Properties  │  Ground*     │   ...          │
└──────────────┴──────────────┴──────────────┴────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    MODULE LAYER (Modern)                     │
├──────────────┬──────────────────────────────────────────────┤
│ GroundModule │  Wraps GroundPlugin                          │
│              │  + UI Controller                             │
│              │  + State management                          │
├──────────────┼──────────────────────────────────────────────┤
│ PhysicsModule│  Integrates CollisionPlugin + GravityPlugin │
│              │  + UI Controller                             │
│              │  + Unified physics API                       │
└──────────────┴──────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   CONTROLLER LAYER (UI)                      │
├──────────────┬──────────────────────────────────────────────┤
│Ground Control│  UI for ground textures, rotation, edges    │
├──────────────┼──────────────────────────────────────────────┤
│Physics Control│ UI for gravity, collision, camera physics  │
└──────────────┴──────────────────────────────────────────────┘
```

---

## Component Analysis

### 1. Bootstrap Layer

**File**: `src/core/Bootstrap.js`
**Responsibility**: Application initialization and global setup

#### Strengths ✅
- Clean initialization sequence
- Global error handling (window.error, unhandledrejection)
- ActionDispatcher integration for modern event handling
- Legacy handler bridge maintains backward compatibility

#### Weaknesses ⚠️
- Error display is intrusive (full-page overlay)
- No retry mechanism for initialization failures
- Global scope pollution (`window.legozo`, `window.__actionDispatcher`)

#### Design Pattern
- **Facade Pattern**: Simplifies complex initialization
- **Bridge Pattern**: Connects old onclick handlers to new dispatcher

---

### 2. Core Engine (LegozoLoader)

**File**: `core/legozo-loader.js`
**Responsibility**: Module/plugin loading, dependency resolution, lifecycle orchestration

#### Strengths ✅
- **Parallel module loading**: Uses `Promise.all()` for fast startup
- **Dependency resolution**: Topological sort via `DependencyResolver`
- **Hybrid system**: Seamlessly integrates old plugins and new modules
- **Phased initialization**: Config → Styles → Templates → Engine → Modules
- **Loading progress**: Visual feedback via progress bar
- **Comprehensive logging**: Tracks timing for performance analysis

#### Weaknesses ⚠️
- **Module detection heuristic**: Uses `_onInit` presence to identify new modules (brittle)
- **No rollback**: Partial initialization failures leave system in inconsistent state
- **Collision diagnostic**: Verbose logging function adds code complexity
- **Demo object creation**: Hardcoded physics logic (mass, shape) should use presets

#### Critical Code Paths

**Module Loading** (lines 196-277):
```javascript
// OPTIMIZATION: Parallel loading
const loadPromises = moduleNames
    .filter(name => imports[name])
    .map(async name => {
        const module = await imports[name]();
        return { name, module, loadTime, error: null };
    });

const results = await Promise.all(loadPromises);
```
✅ **Excellent**: Minimizes startup time

**Module Detection** (line 254):
```javascript
if (ModuleClass.prototype && ModuleClass.prototype._onInit !== undefined) {
    // New module system
} else {
    // Old plugin system
}
```
⚠️ **Brittle**: Should use explicit marker (e.g., `ModuleClass.isModule`)

---

### 3. Babylon Engine Wrapper

**File**: `src/core/BabylonEngine.js`
**Responsibility**: Scene management, plugin registry, render loop

#### Strengths ✅
- **Collision enabled**: `scene.collisionsEnabled = true` (line 76) - CRITICAL FIX
- **Gravity presets**: Built-in presets for scene gravity (lines 83-94)
- **InputManager integration**: Centralized input handling
- **Event-driven**: EventEmitter for inter-plugin communication
- **Comprehensive logging**: Tagged log messages with [ENG.X] references

#### Weaknesses ⚠️
- **Global pollution**: Exposes `window.__babylonScene`, `window.__inputManager`
- **Mixed concerns**: Engine manages both plugins AND input system
- **No plugin validation**: Only checks `init()` and `start()` methods exist

#### Critical Configuration

**Scene Gravity** (lines 82-94):
```javascript
const gravityPresets = {
    earth: new BABYLON.Vector3(0, -0.5, 0),    // Scaled for camera
    arcade: new BABYLON.Vector3(0, -0.2, 0),   // Default
    // ...
};
this.scene.gravity = gravityPresets[gravityPreset] || gravityPresets.arcade;
```
✅ **Good**: Provides sensible defaults for camera.applyGravity

**Collision System** (line 76):
```javascript
this.scene.collisionsEnabled = true;
```
✅ **CRITICAL**: Without this, camera collision doesn't work

---

### 4. Plugin Architecture

**Base**: `src/core/Plugin.js`
**Pattern**: Template Method + Observer

#### Lifecycle Hooks
1. `init(scene, events, config, inputManager)` - Setup phase
2. `start()` - Activation phase (render loop begins after this)
3. `update(deltaTime)` - Per-frame updates (optional, auto-subscribed)
4. `enable()` / `disable()` - Runtime control
5. `dispose()` - Cleanup phase

#### Strengths ✅
- **Event subscription**: Declarative subscriptions via `this.subscriptions` object
- **Auto-update**: Plugins with `update()` automatically subscribe to `render:frame`
- **Consistent lifecycle**: All plugins follow same initialization pattern

#### Weaknesses ⚠️
- **No dependency declaration**: Plugins can't declare dependencies
- **No version checking**: No compatibility validation
- **Manual event cleanup**: Must unbind in dispose() (error-prone)

---

### 5. Module Architecture (Modern)

**Base**: `modules/base/module-base.js`
**Pattern**: Template Method + State Machine

#### State Machine
```
uninitialized → initializing → initialized → starting → started
                                                ↓
                                            stopping → stopped
                                                ↓
                                            disposed
```

#### Strengths ✅
- **Dependency declaration**: `get dependencies()` for explicit deps
- **State management**: Structured state transitions
- **Error tracking**: Stores errors with timestamps
- **Performance metrics**: Tracks init and start time
- **Event system**: Built-in event emitter
- **Config management**: Default config + override + dot-notation access

#### Weaknesses ⚠️
- **No circular dependency detection**: Could cause deadlocks
- **State validation manual**: Must check state before operations
- **No async dispose**: `dispose()` is synchronous (could leak resources)

---

### 6. Physics System Architecture

**Components**:
- `CollisionPlugin` - Havok physics + Babylon collision
- `GravityPlugin` - Scene gravity + physics engine gravity
- `PhysicsModule` - Unified interface wrapping both plugins

#### Critical Issue ⚠️ PHYSICS NOT WORKING

**Root Cause**: Module dependency resolution failing

**Problem Chain**:
```
PhysicsModule.getDependencies() returns ['collision', 'gravity']
    ↓
LegozoLoader looks for modules, but 'collision' and 'gravity' are PLUGINS
    ↓
Dependency validation fails silently
    ↓
PhysicsModule._onInit() throws: "CollisionPlugin not found"
    ↓
Physics initialization aborts
```

**Evidence**:
- `physics.module.js` line 59: `getDependencies() { return ['collision', 'gravity']; }`
- `physics.module.js` lines 70-71: `this.collisionPlugin = this.engine.plugins.get('collision');`
- Plugins are registered in `BabylonEngine`, not in module system

**Fix Required**: PhysicsModule must check `engine.plugins` not module dependencies

---

### 7. Input Management System

**File**: `src/input/InputManager.js`
**Pattern**: Strategy Pattern (Input Contexts) + Source/Sink

#### Architecture
```
InputManager (Central Hub)
    ├── InputSources (Data Collectors)
    │   ├── KeyboardSource
    │   ├── MouseSource
    │   └── TouchSource
    └── InputContexts (Action Mappers)
        ├── ViewModeContext
        └── EditModeContext
```

#### Strengths ✅
- **Context switching**: Different input mappings per mode
- **Multi-source**: Keyboard, mouse, touch unified
- **Action-based**: High-level actions instead of raw input

#### Weaknesses ⚠️
- **No documentation**: No examples of how plugins use it
- **Incomplete**: Contexts reference actions but don't define them fully

---

## Dependency Graph Analysis

### Current Dependencies (Modules Only)

```
GroundModule: [] (no dependencies)
PhysicsModule: ['collision', 'gravity'] ⚠️ BROKEN (these are plugins!)
```

### Plugin Load Order (No Dependencies)

Plugins load in config order, which works because they're largely independent. However:
- `CollisionPlugin` depends on Havok being initialized
- `GravityPlugin` depends on CollisionPlugin for physics engine reference
- No enforcement of this order

### Recommended Dependency Graph

```
Camera (no deps)
    ↓
Movement (needs: camera)
    ↓
Collision (needs: camera for ellipsoid setup)
    ↓
Gravity (needs: collision for physics engine)
    ↓
Ground (needs: collision for physics body)
    ↓
Physics Module (needs: collision, gravity) - FIXED
    ↓
Interaction (needs: camera for raycasting)
    ↓
Properties (needs: interaction)
    ↓
Gizmo (needs: camera, interaction)
```

**Issue**: Current system loads plugins in parallel, which works by luck (physics engine loads fast enough). Under load or slow network, could fail.

---

## Integration Patterns

### Pattern 1: Plugin → Module Wrapper

Used by: `GroundModule`, `PhysicsModule`

```javascript
class GroundModule extends ModuleBase {
    async _onInit() {
        this.plugin = new GroundPlugin();
        this._engine.registerPlugin('ground', this.plugin);
    }
}
```

**Purpose**: Add module-level features (state, events, controllers) to existing plugins

**Problem**: Dual registration (as module AND plugin) causes confusion

---

### Pattern 2: Module Aggregator

Used by: `PhysicsModule`

```javascript
class PhysicsModule extends ModuleBase {
    async _onInit() {
        this.collisionPlugin = this.engine.plugins.get('collision');
        this.gravityPlugin = this.engine.plugins.get('gravity');
        // Expose unified API
    }
}
```

**Purpose**: Combine multiple related plugins under single API

**Problem**: Dependency resolution broken (see Physics issue above)

---

### Pattern 3: ActionDispatcher Bridge

Used by: `Bootstrap.js`, Controllers

```javascript
window.toggleMode = () => {
    this.dispatcher.dispatch('mode:toggle');
};
```

**Purpose**: Bridge legacy onclick handlers to modern event system

**Evaluation**: ✅ Good transitional pattern, but legacy handlers should be phased out

---

## Configuration Management

### Configuration Layers

1. **Engine Config**: `config/engine-config.json` (defaults)
2. **Scene Config**: `config/scene-demo.json` (scene-specific)
3. **Module Defaults**: Each module's `getDefaultConfig()`
4. **Runtime Config**: Set via API calls

### Merge Strategy

```javascript
this.config = {
    ...engineConfig,        // Layer 1
    ...sceneConfig,         // Layer 2 (overrides)
    ...moduleDefaults      // Layer 3 (in module.init())
};
```

### Issues ⚠️

1. **Conflicts**: Physics gravity in 3 places:
   - `engine-config.json`: `gravity.preset = "arcade"`
   - `engine-config.json`: `physics.gravity.y = -9.81`
   - `physics.config.js`: `gravity.preset = "earth"`

2. **No validation**: Invalid config values not caught

3. **No schema**: No JSON schema validation

---

## Performance Characteristics

### Load Time Breakdown (Estimated)

```
CDN Resource Loading:    800ms (Babylon.js, Havok WASM)
Config/Template Loading: 100ms
Module Loading:          150ms (parallel)
Physics Initialization:  200ms (Havok WASM)
Demo Object Creation:    50ms
Total:                   ~1300ms
```

### Runtime Performance

- **FPS**: Babylon.js can easily handle 60 FPS with this scene
- **Memory**: <100MB for current demo scene
- **Physics**: Havok is highly optimized (C++ WASM)

### Bottlenecks 💡

1. **CDN Loading**: 800ms is unavoidable, but can be reduced with:
   - Local hosting of Babylon.js
   - Bundle optimization
   - HTTP/2 push

2. **Serial Initialization**: Some phases must be serial (config before engine)

3. **No Code Splitting**: All modules load even if unused

---

## Security Analysis

### Concerns ⚠️

1. **Global Scope Pollution**: `window.legozo`, `window.__babylonScene`, etc.
   - **Risk**: Name collisions, XSS attack surface

2. **Inline Event Handlers**: Legacy `onclick="toggleMode()"` in HTML
   - **Risk**: CSP violations

3. **No Input Sanitization**: Config files trusted implicitly
   - **Risk**: Malicious config could inject code

### Recommendations

1. Use ES6 modules exclusively (no globals)
2. Remove all inline event handlers (use data-action)
3. Validate all config with JSON schema
4. Implement Content Security Policy

---

## Architectural Strengths Summary

1. ✅ **Clean Separation of Concerns**: Plugins, modules, controllers clearly defined
2. ✅ **Event-Driven**: Loose coupling via EventEmitter
3. ✅ **Extensible**: Easy to add new plugins/modules
4. ✅ **Performance-Conscious**: Parallel loading, efficient render loop
5. ✅ **Well-Documented Code**: Extensive inline comments

---

## Architectural Weaknesses Summary

1. ⚠️ **Hybrid System Complexity**: Two plugin systems increases cognitive load
2. ⚠️ **Broken Dependencies**: Module→Plugin dependency resolution failing
3. ⚠️ **No Error Recovery**: Failures cause complete system halt
4. ⚠️ **Global Pollution**: Too many globals for debugging
5. ⚠️ **Configuration Conflicts**: Multiple sources of truth for settings

---

## Recommended Architectural Improvements

### Priority 1: Fix Module→Plugin Dependencies

**Change**: Allow modules to depend on plugins OR modules

```javascript
// In ModuleBase._validateDependencies()
for (const dep of deps) {
    const depModule = this._engine.getPlugin(dep) ||
                     this._loader.getModule(dep);
    if (!depModule) {
        missing.push(dep);
    }
}
```

### Priority 2: Implement Error Recovery

**Add**: Graceful degradation for failed modules

```javascript
// In LegozoLoader.initializeModules()
try {
    await module.init(this.engine, this.config);
} catch (error) {
    console.error(`Module ${name} failed, marking as failed`);
    module._state = 'failed';
    this.failedModules.set(name, error);
    // Continue with other modules instead of throw
}
```

### Priority 3: Consolidate Configuration

**Create**: Single source of truth with schema validation

```javascript
// Use Zod or JSON Schema to validate config
const configSchema = z.object({
    gravity: z.object({
        preset: z.enum(['earth', 'moon', 'arcade', ...])
    })
});

this.config = configSchema.parse(mergedConfig);
```

---

## Next Steps

See **[02_CRITICAL_ISSUES.md](./02_CRITICAL_ISSUES.md)** for detailed issue analysis and fixes.
