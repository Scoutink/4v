# Performance Optimization Opportunities

## Overview

This document identifies performance bottlenecks and optimization strategies to achieve production-grade performance (60 FPS, <1s load time).

---

## Current Performance Baseline

### Load Time Analysis

**Measured Components** (estimated):
```
CDN Downloads:          800ms  (40%)  - Babylon.js, Havok, GUI
Config Loading:         100ms  (5%)   - engine-config + scene-config
Template Loading:       150ms  (7.5%) - HTML templates
Module Loading:         150ms  (7.5%) - Parallel ES6 imports
Physics Initialization: 200ms  (10%)  - Havok WASM initialization
Demo Object Creation:   50ms   (2.5%)  - Creating 5 objects
Other:                  550ms  (27.5%) - Browser overhead
─────────────────────────────────────
Total:                  2000ms (100%)
```

### Runtime Performance

**FPS**: Currently uncapped, likely 60+ FPS for demo scene
**Memory**: ~80-120 MB (reasonable)
**Physics**: 60 Hz update rate (good)

---

## Optimization #1: Reduce CDN Load Time 💡

### Current Approach
```html
<!-- index.html -->
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
<script src="https://cdn.babylonjs.com/gui/babylon.gui.min.js"></script>
<script src="https://cdn.babylonjs.com/havok/HavokPhysics_umd.js"></script>
```

**Time**: ~800ms (external CDN, sequential loading)

### Optimization A: Local Hosting

**Benefit**: Control over caching, faster initial load from same domain

**Implementation**:
1. Download Babylon.js files to `/libs/`
2. Update index.html:
```html
<script src="./libs/babylon.min.js"></script>
<script src="./libs/babylon.loaders.min.js"></script>
<script src="./libs/babylon.gui.min.js"></script>
<script src="./libs/HavokPhysics.umd.js"></script>
```

**Savings**: ~200ms (same-domain, parallel HTTP/2)

---

### Optimization B: ES6 Module Imports (Modern)

**Benefit**: Tree-shaking, only load what's used

**Implementation**:
```javascript
// Instead of global <script> tags, use:
import * as BABYLON from 'https://cdn.babylonjs.com/babylon.module.js';
import 'https://cdn.babylonjs.com/loaders/babylonjs.loaders.module.js';
import * as GUI from 'https://cdn.babylonjs.com/gui/babylon.gui.module.js';
```

**Challenge**: Requires refactoring all `BABYLON.X` references
**Savings**: ~100ms (smaller bundle), but high effort

**Recommendation**: SKIP for now, revisit in v2.0

---

### Optimization C: Preload Hints

**Benefit**: Browser starts loading critical resources immediately

**Implementation**:
```html
<head>
    <!-- Add preload hints -->
    <link rel="preload" href="https://cdn.babylonjs.com/babylon.js" as="script">
    <link rel="preload" href="https://cdn.babylonjs.com/havok/HavokPhysics_umd.js" as="script">
    <link rel="dns-prefetch" href="https://cdn.babylonjs.com">
</head>
```

**Savings**: ~100ms (parallel loading)
**Effort**: 10 minutes

---

### Optimization D: Service Worker Caching

**Benefit**: Instant load on repeat visits

**Implementation**:
```javascript
// service-worker.js
const CACHE_NAME = 'legozo-v1';
const CDN_CACHE = [
    'https://cdn.babylonjs.com/babylon.js',
    'https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js',
    'https://cdn.babylonjs.com/gui/babylon.gui.min.js',
    'https://cdn.babylonjs.com/havok/HavokPhysics_umd.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CDN_CACHE))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
```

**Savings**: ~800ms on repeat loads (CDN loaded from cache)
**Effort**: 1 hour

---

**Recommended CDN Optimization Stack**:
1. ✅ Add preload hints (10 min, ~100ms savings)
2. ✅ Implement service worker (1 hr, ~800ms savings on repeat)
3. ⏳ Consider local hosting (2 hr, ~200ms savings, but adds maintenance)

**Total Potential Savings**: 300ms first load, 800ms repeat load

---

## Optimization #2: Lazy Load Modules 💡

### Current Approach

All modules loaded immediately in parallel:

```javascript
// In LegozoLoader.loadModules()
const loadPromises = moduleNames.map(async name => {
    const module = await imports[name]();
    return { name, module, loadTime, error: null };
});
await Promise.all(loadPromises);
```

**Time**: ~150ms to load all 16 plugins

### Optimization: Lazy Loading Strategy

**Core Plugins** (load immediately):
- camera, movement, collision, gravity, lighting, ground

**Deferred Plugins** (load on demand):
- gizmo (only when entering edit mode)
- properties (only when clicking an object)
- performance (can load after scene renders)
- asset (only when opening asset panel)

**Implementation**:
```javascript
// In LegozoLoader
const CORE_MODULES = ['camera', 'movement', 'collision', 'gravity', 'lighting', 'ground'];
const DEFERRED_MODULES = ['gizmo', 'properties', 'performance', 'asset'];

async loadModules() {
    // Load core modules first
    await this.loadModuleSet(CORE_MODULES);

    // Defer non-critical modules (load after 1 second or on demand)
    setTimeout(() => {
        this.loadModuleSet(DEFERRED_MODULES);
    }, 1000);
}

async loadModuleOnDemand(moduleName) {
    if (this.modules.has(moduleName)) {
        return this.modules.get(moduleName);
    }
    // Load now
    await this.loadModuleSet([moduleName]);
    return this.modules.get(moduleName);
}
```

**Savings**: ~80ms on initial load (deferred modules load in background)

---

## Optimization #3: Template Loading Optimization 💡

### Current Approach

Templates loaded sequentially:

```javascript
// In TemplateLoader
async loadMultiple(names) {
    for (const name of names) {
        await this.load(name);  // Sequential!
    }
}
```

**Time**: ~150ms for 6 templates

### Optimization: Parallel Template Loading

**Implementation**:
```javascript
async loadMultiple(names) {
    const promises = names.map(name => this.load(name));
    await Promise.all(promises);  // Parallel!
}
```

**Savings**: ~100ms (3x faster)
**Effort**: 5 minutes

---

### Optimization: Inline Critical Templates

**Benefit**: No network request for critical UI

**Implementation**:
```html
<!-- index.html -->
<template id="loading-screen">
    <div id="loadingScreen">
        <div class="loading-container">
            <h2>Loading Legozo 3D CMS</h2>
            <div class="progress-bar">
                <div id="loadingBar"></div>
            </div>
            <div id="loadingText">Initializing...</div>
        </div>
    </div>
</template>
```

**Savings**: ~50ms for loading screen (user sees it immediately)
**Effort**: 30 minutes

---

## Optimization #4: Demo Object Creation Optimization 💡

### Current Approach

Objects created with full physics initialization:

```javascript
// In LegozoLoader.createDemoObjects()
for (const objConfig of objects) {
    // Create mesh
    mesh = BABYLON.MeshBuilder.CreateBox(...);

    // Enable collision
    collisionPlugin.enableSimpleCollision(mesh);

    // Enable physics (SLOW)
    collisionPlugin.enablePhysicsBody(mesh, { mass: 1, ... });

    // Make hoverable (SLOW - adds many event listeners)
    interactionPlugin.makeHoverable(mesh);

    // Make draggable (SLOW - adds drag behavior)
    interactionPlugin.makeDraggable(mesh);
}
```

**Time**: ~50ms for 5 objects (scales linearly)

### Optimization: Deferred Interaction Setup

**Strategy**: Create meshes quickly, defer interaction features until needed

**Implementation**:
```javascript
async createDemoObjects() {
    const objects = this.config.demoObjects || [];

    // PHASE 1: Quick mesh creation (no interaction)
    objects.forEach(objConfig => {
        const mesh = this.createMesh(objConfig);
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.interactionDeferred = true;
    });

    console.log('[Legozo] Demo objects created (interaction deferred)');

    // PHASE 2: Enable interaction after 500ms
    setTimeout(() => {
        this.enableDeferredInteractions();
    }, 500);
}

enableDeferredInteractions() {
    this.scene.meshes.forEach(mesh => {
        if (mesh.metadata?.interactionDeferred) {
            this.enableMeshInteraction(mesh);
            delete mesh.metadata.interactionDeferred;
        }
    });
    console.log('[Legozo] Deferred interactions enabled');
}
```

**Savings**: ~30ms on initial load
**Benefit**: Scene appears faster, interactions load in background

---

## Optimization #5: Configuration Optimization 💡

### Current Approach

Two separate config files loaded sequentially:

```javascript
// In LegozoLoader.loadConfiguration()
const engineConfig = await ConfigLoader.load('./config/engine-config.json');
const sceneConfig = await ConfigLoader.load(configPath);
this.config = { ...engineConfig, ...sceneConfig };
```

**Time**: ~100ms (2 network requests)

### Optimization A: Merge Config Files

**Benefit**: Single request

**Implementation**:
```javascript
// Combine engine-config.json + scene-demo.json into single file
const config = await ConfigLoader.load('./config/scene-full.json');
```

**Savings**: ~50ms
**Trade-off**: Less modular (harder to maintain multiple scenes)

---

### Optimization B: Inline Default Config

**Benefit**: No network request for defaults

**Implementation**:
```javascript
// In LegozoLoader
constructor() {
    this.defaultConfig = {
        // All engine defaults here
        engineOptions: { antialias: true, ... },
        camera: { defaultType: 'universal', ... },
        // etc.
    };
}

async loadConfiguration(scenePath) {
    const sceneConfig = await ConfigLoader.load(scenePath);
    this.config = { ...this.defaultConfig, ...sceneConfig };
}
```

**Savings**: ~50ms (only load scene-specific overrides)
**Effort**: 30 minutes

**Recommendation**: Use Optimization B (inline defaults)

---

## Optimization #6: Physics Initialization Optimization 💡

### Current Approach

Havok WASM loads during CollisionPlugin.start():

```javascript
async initPhysics() {
    const havok = await HavokPhysics();  // SLOW: loads WASM
    const plugin = new BABYLON.HavokPlugin(true, havok);
    this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), plugin);
}
```

**Time**: ~200ms (WASM load + initialization)

### Optimization A: Preload Havok

**Benefit**: Start loading immediately, don't wait for plugin

**Implementation**:
```javascript
// In index.html or Bootstrap.js
// Start loading Havok immediately (before scene creation)
window.havokPromise = HavokPhysics();

// Later, in CollisionPlugin
async initPhysics() {
    const havok = await window.havokPromise;  // Already loaded!
    // ...
}
```

**Savings**: ~100ms (physics initializes faster)
**Effort**: 15 minutes

---

### Optimization B: Conditional Physics Loading

**Benefit**: Skip physics entirely if scene doesn't need it

**Implementation**:
```javascript
// In config
{
    "physics": {
        "enabled": false  // Set to false for simple scenes
    }
}

// In CollisionPlugin
async start() {
    const physicsConfig = this.config.physics || {};
    if (physicsConfig.enabled === false) {
        console.log('[Collision] Physics disabled by config');
        return;
    }
    // Else initialize physics
}
```

**Savings**: ~200ms for non-physics scenes
**Benefit**: Faster load for simple display-only scenes

---

## Optimization #7: Render Loop Optimization 💡

### Current State

Every plugin with `update()` method subscribes to `render:frame`:

```javascript
// In Plugin.js
start() {
    if (typeof this.update === 'function') {
        this.events.on('render:frame', (data) => {
            if (this.enabled && this.started) {
                this.update(data.deltaTime);
            }
        });
    }
}
```

**Issue**: Every frame, EventEmitter iterates all handlers

### Optimization: Direct Update Loop

**Benefit**: Faster frame updates (critical for 60 FPS)

**Implementation**:
```javascript
// In BabylonEngine
start() {
    // Collect all updateable plugins
    this.updateablePlugins = Array.from(this.plugins.values())
        .filter(p => typeof p.update === 'function');

    this.engine.runRenderLoop(() => {
        const deltaTime = this.engine.getDeltaTime();

        // Direct calls (faster than EventEmitter)
        this.updateablePlugins.forEach(plugin => {
            if (plugin.enabled && plugin.started) {
                plugin.update(deltaTime);
            }
        });

        this.scene.render();
    });
}
```

**Savings**: ~0.5ms per frame (small but accumulates over time)
**Benefit**: Smoother 60 FPS

---

## Optimization #8: Memory Management 💡

### Current Issues

**Potential Leaks**:
1. Event listeners not properly cleaned up
2. Physics bodies not disposed with meshes
3. Textures not released when changing ground texture
4. Templates cached indefinitely

### Optimization: Comprehensive Disposal

**Implementation**:
```javascript
// In InteractionPlugin
makeHoverable(mesh, options) {
    // Store observer for later cleanup
    mesh.metadata = mesh.metadata || {};
    mesh.metadata.hoverObserver = this.scene.onPointerObservable.add(...);
}

// When disposing mesh
dispose(mesh) {
    // Clean up observers
    if (mesh.metadata?.hoverObserver) {
        this.scene.onPointerObservable.remove(mesh.metadata.hoverObserver);
    }

    // Clean up physics
    if (mesh.physicsBody) {
        mesh.physicsBody.dispose();
    }

    // Dispose material/textures if not shared
    if (mesh.material && !mesh.material.metadata?.shared) {
        mesh.material.dispose();
    }

    mesh.dispose();
}
```

**Benefit**: Prevents memory leaks over time
**Effort**: 3 hours (audit all resource management)

---

## Optimization Summary Table

| # | Optimization | Complexity | Savings | Effort | Priority |
|---|--------------|------------|---------|--------|----------|
| 1A | Preload hints | Low | ~100ms | 10min | HIGH |
| 1D | Service worker cache | Medium | ~800ms repeat | 1h | HIGH |
| 2 | Lazy load modules | Medium | ~80ms | 2h | MEDIUM |
| 3A | Parallel template loading | Low | ~100ms | 5min | HIGH |
| 3B | Inline critical templates | Low | ~50ms | 30min | MEDIUM |
| 4 | Deferred interaction setup | Medium | ~30ms | 1h | MEDIUM |
| 5B | Inline default config | Low | ~50ms | 30min | MEDIUM |
| 6A | Preload Havok | Low | ~100ms | 15min | HIGH |
| 7 | Direct update loop | Medium | ~0.5ms/frame | 1h | LOW |
| 8 | Memory management audit | High | Stability | 3h | MEDIUM |

**Total Potential Savings**: ~400ms first load, ~800ms repeat load
**Total Effort**: ~10 hours

---

## Prioritized Optimization Plan

### Phase 1: Quick Wins (1 hour, ~300ms savings)
1. Add preload hints (10 min)
2. Parallel template loading (5 min)
3. Preload Havok (15 min)
4. Inline default config (30 min)

### Phase 2: Significant Impact (2 hours, ~100ms + stability)
5. Inline critical templates (30 min)
6. Deferred interaction setup (1 hr)
7. Service worker caching (1 hr) - big win for repeat loads

### Phase 3: Advanced (7 hours)
8. Lazy load modules (2 hr)
9. Memory management audit (3 hr)
10. Direct update loop (1 hr)

---

## Performance Targets

### Before Optimization
- **First Load**: ~2000ms
- **Repeat Load**: ~2000ms (no caching)
- **FPS**: 60+ (already good)

### After Phase 1
- **First Load**: ~1700ms (-300ms)
- **Repeat Load**: ~1700ms
- **FPS**: 60+

### After Phase 2
- **First Load**: ~1600ms (-400ms total)
- **Repeat Load**: ~800ms (-1200ms, service worker)
- **FPS**: 60+

### After Phase 3
- **First Load**: ~1500ms (-500ms total)
- **Repeat Load**: ~700ms
- **FPS**: 60+ (smoother)
- **Memory**: Stable (no leaks)

---

## Advanced Performance Considerations

### 1. WebGL Optimization

**Already Optimized**:
- ✅ Shadows use shadowGenerator (efficient)
- ✅ Physics uses Havok (C++ WASM, very fast)
- ✅ Render loop uses requestAnimationFrame

**Further Optimizations**:
- Implement LOD (Level of Detail) for complex models
- Use instanced meshes for repeated objects
- Implement frustum culling for large scenes

**Recommendation**: Defer until scenes become complex (100+ objects)

---

### 2. Network Optimization

**Current**: CDN delivers ~3 MB total (Babylon + Havok + app code)

**Optimization Ideas**:
- Enable Gzip/Brotli compression (reduces to ~1 MB)
- Use HTTP/2 push for critical resources
- Implement Progressive Web App (PWA) for offline support

**Recommendation**: Work with hosting provider on compression

---

### 3. Build System (Future)

**Current**: No build step, pure ES6 modules

**Future Optimization**:
- Bundle and minify application code with Rollup/Webpack
- Code splitting for modules
- Tree-shaking unused Babylon.js features

**Benefit**: ~500ms additional savings
**Effort**: 8+ hours (new infrastructure)
**Recommendation**: Defer to v2.0

---

## Monitoring & Profiling

### Implement Performance Tracking

**Add to PerformancePlugin**:
```javascript
class PerformancePlugin extends Plugin {
    trackMetric(name, value) {
        this.metrics.push({
            name,
            value,
            timestamp: Date.now()
        });
    }

    reportMetrics() {
        console.table(this.metrics);

        // Send to analytics if configured
        if (window.gtag) {
            this.metrics.forEach(m => {
                gtag('event', 'timing_complete', {
                    name: m.name,
                    value: m.value
                });
            });
        }
    }
}

// Usage throughout app
performance.mark('module-load-start');
await this.loadModules();
performance.mark('module-load-end');
performance.measure('module-load', 'module-load-start', 'module-load-end');
```

---

## Next Steps

See **[05_PRODUCTION_READINESS.md](./05_PRODUCTION_READINESS.md)** for deployment checklist.
