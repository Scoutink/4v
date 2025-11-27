# Implementation Plan

## Overview

This document provides a step-by-step implementation roadmap to transform Legozo 3D CMS from its current state to a production-ready WordPress embeddable 3D scene platform.

---

## Timeline Summary

**Total Estimated Time**: 6-8 weeks (1 developer, full-time)

| Phase | Duration | Focus | Critical? |
|-------|----------|-------|-----------|
| Phase 1 | 1 week | Critical Bug Fixes | YES ✅ |
| Phase 2 | 1 week | Core Feature Completion | YES ✅ |
| Phase 3 | 2 weeks | WordPress Integration | YES ✅ |
| Phase 4 | 1 week | Performance Optimization | MEDIUM |
| Phase 5 | 1 week | Testing & QA | YES ✅ |
| Phase 6 | 1-2 weeks | Advanced Features (Optional) | NO |

---

## Phase 1: Critical Bug Fixes (Week 1) 🎯

**Goal**: Make the application functional

### Day 1: Fix Module System

**Tasks**:
1. ✅ Fix ModuleBase import paths
   - File: `modules/physics/physics.module.js` line 22
   - File: `modules/ground/ground.module.js` line 15
   - Change: `../../core/ModuleBase.js` → `../base/module-base.js`

2. ✅ Test module loading
   - Run application
   - Verify no 404 errors in console
   - Verify modules appear in console logs

**Verification**:
```bash
# Open browser console
# Should see:
[Module] ground v2.0.0 created
[Module] physics v1.0.0 created
```

**Time**: 1 hour

---

### Day 1-2: Fix Physics System

**Task 1**: Fix dependency resolution
- File: `modules/physics/physics.module.js`
- Line 58-60: Change dependencies

```javascript
// BEFORE
getDependencies() {
    return ['collision', 'gravity'];
}

// AFTER
getDependencies() {
    return []; // No module dependencies - plugins accessed directly
}
```

**Task 2**: Add plugin availability check
- File: `modules/physics/physics.module.js`
- Add after line 66:

```javascript
async _onInit() {
    console.log('[PhysicsModule] Initializing...');

    // Wait for plugins to be ready
    await this._waitForPlugins(['collision', 'gravity'], 5000);

    // Get plugin instances from engine
    this.collisionPlugin = this.engine.plugins.get('collision');
    this.gravityPlugin = this.engine.plugins.get('gravity');

    if (!this.collisionPlugin) {
        throw new Error('[PhysicsModule] CollisionPlugin not found!');
    }
    // ... rest of init
}

async _waitForPlugins(pluginNames, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const allAvailable = pluginNames.every(name =>
            this.engine.plugins.has(name)
        );
        if (allAvailable) {
            console.log(`[PhysicsModule] Plugins ready: ${pluginNames.join(', ')}`);
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`[PhysicsModule] Timeout waiting for plugins: ${pluginNames.join(', ')}`);
}
```

**Task 3**: Fix load order
- File: `core/legozo-loader.js`
- Lines 74-96: Reorder initialization

```javascript
// BEFORE
async start() {
    await this.resolveDependencies();
    await this.initializeModules();
    await this.engine.start();          // ⚠️ Plugins start here
    await this.startModules();
}

// AFTER
async start() {
    await this.resolveDependencies();
    await this.engine.start();          // ✅ Start plugins FIRST
    await this.initializeModules();     // ✅ Then init modules
    await this.startModules();
}
```

**Verification**:
```bash
# Open browser console
# Should see:
[PhysicsModule] Plugins ready: collision, gravity
[PhysicsModule] Started - Mode: hybrid, Gravity: earth

# Drop object from height - should fall!
```

**Time**: 4-6 hours

---

### Day 2-3: Add Error Recovery

**Task**: Implement graceful degradation
- File: `core/legozo-loader.js`
- Lines 319-330: Add try/catch with continuation

```javascript
async initializeModules() {
    this.updateLoading(60, 'Initializing modules...');

    const results = {
        success: [],
        failed: [],
        skipped: []
    };

    for (const [name, module] of this.modules.entries()) {
        try {
            await module.init(this.engine, this.config);
            results.success.push(name);
            console.log(`[Legozo] Initialized: ${name}`);
        } catch (error) {
            console.error(`[Legozo] Failed to initialize ${name}:`, error);

            // Mark as failed but CONTINUE
            module._state = 'failed';
            this.failedModules = this.failedModules || new Map();
            this.failedModules.set(name, error);
            results.failed.push({ name, error: error.message });

            // Skip dependent modules
            this.modules.forEach((depModule, depName) => {
                if (depModule.dependencies && depModule.dependencies.includes(name)) {
                    results.skipped.push(depName);
                    console.warn(`[Legozo] Skipping ${depName} (depends on failed ${name})`);
                }
            });
        }
    }

    // Show warning if any modules failed
    if (results.failed.length > 0) {
        this.showModuleFailureWarning(results);
    }

    console.log('[Legozo] Module initialization complete:', results);
}

showModuleFailureWarning(results) {
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
        position: fixed; top: 10px; right: 10px; z-index: 9999;
        background: rgba(255,200,0,0.95); color: #333;
        padding: 15px; border-radius: 5px; max-width: 300px;
        font-family: sans-serif; font-size: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    warningDiv.innerHTML = `
        <strong>⚠️ Some features unavailable</strong><br>
        Failed: ${results.failed.map(f => f.name).join(', ')}<br>
        <button onclick="this.parentElement.remove()" style="margin-top:5px; padding:5px 10px; cursor:pointer;">Dismiss</button>
    `;
    document.body.appendChild(warningDiv);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (warningDiv.parentElement) {
            warningDiv.remove();
        }
    }, 10000);
}
```

**Verification**:
```bash
# Intentionally break a module (e.g., rename physics plugin)
# Application should still load with warning banner
# Other modules should work normally
```

**Time**: 3-4 hours

---

### Day 3-4: Fix Controller Initialization

**Task**: Add DOM ready check
- File: `modules/physics/physics.module.js`
- Lines 112-115: Add wait logic

```javascript
async _onStart() {
    console.log('[PhysicsModule] Starting...');

    // ... existing code ...

    // Initialize UI controller
    this.controller = new PhysicsController(this);

    // CRITICAL: Wait for DOM to be ready
    await this.waitForDOM('.control-panel', 5000);

    // Now safe to initialize controller
    await this.controller.init();

    // ... rest of start
}

async waitForDOM(selector, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (document.querySelector(selector)) {
            console.log(`[PhysicsModule] DOM element ready: ${selector}`);
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`[PhysicsModule] Timeout waiting for DOM: ${selector}`);
}
```

**Verification**:
```bash
# Open browser
# Check that physics controls appear in control panel
# Click "Earth" gravity button - should work
# Toggle camera collision checkbox - should work
```

**Time**: 2-3 hours

---

### Day 4-5: Configuration Cleanup

**Task 1**: Consolidate gravity config
- Remove duplicate gravity configs
- Keep single source in `engine-config.json`

**File**: `config/engine-config.json`
```json
{
  "gravity": {
    "preset": "earth"
  },
  "physics": {
    "enabled": true,
    "engine": "havok"
  }
}
```

**File**: `modules/physics/physics.config.js` (line 30)
```javascript
// REMOVE this (rely on engine config):
gravity: {
    preset: 'earth'
},

// Keep only presets definition (for reference)
```

**Task 2**: Apply config hierarchy
- File: `src/plugins/GravityPlugin.js`
- Ensure it reads from `this.config.gravity.preset`

**Verification**:
```bash
# Change gravity.preset in engine-config.json to "moon"
# Reload page
# Objects should fall slowly (moon gravity)
```

**Time**: 2-3 hours

---

### Phase 1 Checklist

- [ ] ModuleBase imports fixed
- [ ] Physics system functional (objects fall)
- [ ] Error recovery implemented (app doesn't crash)
- [ ] Controllers attach correctly
- [ ] Configuration consolidated
- [ ] All console errors resolved
- [ ] Manual testing passed

**Deliverable**: Functional 3D scene with working physics

---

## Phase 2: Core Feature Completion (Week 2) 🔧

**Goal**: Complete essential features for MVP

### Day 6-7: Scene Serialization

**Task**: Implement save/load system

**File**: `src/plugins/SceneManagerPlugin.js` (NEW)

```javascript
import Plugin from '../core/Plugin.js';

class SceneManagerPlugin extends Plugin {
    constructor() {
        super();
        this.currentSceneData = null;
    }

    start() {
        super.start();
        console.log('[SceneManager] Ready');
    }

    // Serialize entire scene to JSON
    serializeScene() {
        const sceneData = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            camera: this.serializeCamera(),
            objects: this.serializeObjects(),
            lighting: this.serializeLighting(),
            ground: this.serializeGround(),
            physics: this.serializePhysics()
        };

        this.currentSceneData = sceneData;
        return sceneData;
    }

    serializeCamera() {
        const camera = this.scene.activeCamera;
        return {
            type: camera.getClassName(),
            position: camera.position.asArray(),
            rotation: camera.rotation ? camera.rotation.asArray() : null,
            target: camera.target ? camera.target.asArray() : null,
            fov: camera.fov,
            speed: camera.speed
        };
    }

    serializeObjects() {
        return this.scene.meshes
            .filter(m => !m.name.includes('ground') && !m.name.includes('_mat'))
            .map(mesh => ({
                name: mesh.name,
                type: mesh.metadata?.type || 'mesh',
                geometry: this.serializeGeometry(mesh),
                position: mesh.position.asArray(),
                rotation: mesh.rotation.asArray(),
                scaling: mesh.scaling.asArray(),
                material: this.serializeMaterial(mesh.material),
                physics: mesh.physicsBody ? {
                    mass: mesh.metadata?.physicsSettings?.mass || 1,
                    restitution: mesh.metadata?.physicsSettings?.restitution || 0.5,
                    friction: mesh.metadata?.physicsSettings?.friction || 0.5,
                    shape: mesh.metadata?.physicsSettings?.shape || 'box'
                } : null
            }));
    }

    // ... other serialization methods ...

    // Save scene to JSON file
    async saveScene(filename) {
        const sceneData = this.serializeScene();
        const blob = new Blob([JSON.stringify(sceneData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `scene_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        console.log('[SceneManager] Scene saved:', filename);
        this.events.emit('scene:saved', { filename, data: sceneData });
    }

    // Load scene from JSON
    async loadScene(sceneData) {
        console.log('[SceneManager] Loading scene...');

        // Clear current scene
        await this.clearScene();

        // Restore camera
        await this.restoreCamera(sceneData.camera);

        // Recreate objects
        for (const objData of sceneData.objects) {
            await this.createObjectFromData(objData);
        }

        // Restore lighting
        await this.restoreLighting(sceneData.lighting);

        // Restore physics
        await this.restorePhysics(sceneData.physics);

        this.currentSceneData = sceneData;
        console.log('[SceneManager] Scene loaded');
        this.events.emit('scene:loaded', { data: sceneData });
    }

    async clearScene() {
        // Remove all non-ground meshes
        const meshesToRemove = this.scene.meshes.filter(m =>
            !m.name.includes('ground') && !m.name.includes('_mat')
        );

        meshesToRemove.forEach(mesh => {
            if (mesh.physicsBody) {
                mesh.physicsBody.dispose();
            }
            mesh.dispose();
        });
    }

    // ... other restoration methods ...
}

export default SceneManagerPlugin;
```

**Add to config**: `config/scene-demo.json`
```json
{
  "modules": [
    "camera",
    "movement",
    "collision",
    "gravity",
    "physics",
    "sceneManager"  // ADD THIS
    // ...
  ]
}
```

**Add UI buttons**:
```html
<!-- In control panel template -->
<div class="scene-actions">
    <button data-action="scene:save">💾 Save Scene</button>
    <button data-action="scene:load">📁 Load Scene</button>
</div>
```

**Time**: 8 hours

---

### Day 7-8: Physics Material Presets UI

**Task**: Add physics material controls to UI

**File**: `modules/physics/physics.controller.js`

```javascript
// Add to getActions()
getActions() {
    return {
        // ... existing actions ...
        'physics:material:apply': (e, data) => this.applyMaterialPreset(data.value)
    };
}

applyMaterialPreset(presetName) {
    // Get currently selected mesh
    const interactionPlugin = this.engine.plugins.get('interaction');
    const selectedMesh = interactionPlugin?.selectedMesh;

    if (!selectedMesh) {
        this.showError('No object selected');
        return;
    }

    // Apply preset
    this.physicsModule.applyPhysicsPreset(selectedMesh, presetName);
    this.showSuccess(`Applied ${presetName} material`);
}
```

**Add to UI template**: `ui/templates/control-panel.html`

```html
<div class="physics-materials">
    <h4>Physics Materials</h4>
    <p><small>Select an object first</small></p>
    <div class="button-group">
        <button data-action="physics:material:apply" data-value="static">Static</button>
        <button data-action="physics:material:apply" data-value="bouncy">Bouncy</button>
        <button data-action="physics:material:apply" data-value="slippery">Slippery</button>
        <button data-action="physics:material:apply" data-value="heavy">Heavy</button>
    </div>
</div>
```

**Time**: 3 hours

---

### Day 8-9: Object Manipulation

**Task**: Complete gizmo system and object actions

**File**: `src/plugins/GizmoPlugin.js` (enhance existing)

```javascript
// Add methods to existing plugin
setGizmoMode(mode) {
    // Hide all gizmos
    this.hideAllGizmos();

    const mesh = this.selectedMesh;
    if (!mesh) return;

    // Show selected gizmo
    switch (mode) {
        case 'position':
            if (!this.positionGizmo) {
                this.positionGizmo = new BABYLON.PositionGizmo();
            }
            this.positionGizmo.attachedMesh = mesh;
            break;

        case 'rotation':
            if (!this.rotationGizmo) {
                this.rotationGizmo = new BABYLON.RotationGizmo();
            }
            this.rotationGizmo.attachedMesh = mesh;
            break;

        case 'scale':
            if (!this.scaleGizmo) {
                this.scaleGizmo = new BABYLON.ScaleGizmo();
            }
            this.scaleGizmo.attachedMesh = mesh;
            break;
    }

    this.currentMode = mode;
}

enableSnapping(snapDistance = 0.5) {
    if (this.positionGizmo) {
        this.positionGizmo.snapDistance = snapDistance;
    }
    if (this.rotationGizmo) {
        this.rotationGizmo.snapDistance = 15 * Math.PI / 180;
    }
}
```

**Add keyboard shortcuts**: `src/input/contexts/EditModeContext.js`

```javascript
handleKeyDown(action, event) {
    const interactionPlugin = this.inputManager.scene.metadata?.interactionPlugin;
    const selectedMesh = interactionPlugin?.selectedMesh;

    switch (event.code) {
        case 'Delete':
            if (selectedMesh) {
                // Delete selected object
                selectedMesh.dispose();
            }
            break;

        case 'KeyD':
            if (event.ctrlKey && selectedMesh) {
                // Duplicate object
                const clone = selectedMesh.clone(selectedMesh.name + '_copy');
                clone.position.x += 1;
            }
            break;

        case 'KeyG':
            // Activate move gizmo
            this.gizmoPlugin?.setGizmoMode('position');
            break;

        case 'KeyR':
            // Activate rotation gizmo
            this.gizmoPlugin?.setGizmoMode('rotation');
            break;

        case 'KeyS':
            // Activate scale gizmo
            this.gizmoPlugin?.setGizmoMode('scale');
            break;
    }
}
```

**Time**: 4 hours

---

### Day 10: Testing & Bug Fixes

**Task**: Test all Phase 2 features

**Test Cases**:
1. Save scene → Verify JSON file downloads
2. Load scene → Verify objects recreated correctly
3. Apply physics materials → Verify behavior changes
4. Use gizmos (G, R, S keys) → Verify manipulation works
5. Delete object (Delete key) → Verify removal
6. Duplicate object (Ctrl+D) → Verify clone created

**Time**: 8 hours (including bug fixes)

---

### Phase 2 Checklist

- [ ] Scene save/load functional
- [ ] Physics material presets work
- [ ] Gizmo modes (position, rotation, scale) work
- [ ] Keyboard shortcuts functional
- [ ] Object duplication works
- [ ] Object deletion works
- [ ] Manual testing passed

**Deliverable**: Feature-complete 3D editor

---

## Phase 3: WordPress Integration (Weeks 3-4) 🔌

**Goal**: Package as WordPress plugin

### Week 3: Core WordPress Plugin

**Day 11-12**: WordPress plugin structure

**Task**: Create plugin scaffold

**Files to create**:
```
wp-legozo-3d/
├── legozo-3d.php
├── readme.txt
├── includes/
│   ├── shortcode.php
│   ├── block.php
│   ├── rest-api.php
│   └── admin.php
└── assets/ (copy entire 4v directory)
```

(See detailed implementations in `05_PRODUCTION_READINESS.md`)

**Time**: 16 hours

---

### Day 13-14: Shortcode Implementation

**Task**: Implement `[legozo_scene]` shortcode

(See implementation in `05_PRODUCTION_READINESS.md` - Shortcode section)

**Test**: Create WordPress post with:
```
[legozo_scene scene_id="demo" height="600px"]
```

**Time**: 8 hours

---

### Day 15-16: REST API

**Task**: Implement scene save/load API

(See implementation in `05_PRODUCTION_READINESS.md` - REST API section)

**Test endpoints**:
```bash
# Get scene
curl https://yoursite.com/wp-json/legozo/v1/scenes/demo

# Save scene (requires auth)
curl -X POST https://yoursite.com/wp-json/legozo/v1/scenes/my-scene \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"version":"1.0","objects":[...]}'
```

**Time**: 8 hours

---

### Week 4: Gutenberg Block & Polish

**Day 17-18**: Gutenberg block

**Task**: Create Legozo 3D Scene block

(See implementation in `05_PRODUCTION_READINESS.md` - Gutenberg section)

**Test**: Insert block in Gutenberg editor, configure settings, preview

**Time**: 12 hours

---

### Day 19-20**: Admin settings page

**Task**: WordPress admin panel for global settings

**Time**: 8 hours

---

### Phase 3 Checklist

- [ ] WordPress plugin structure complete
- [ ] Shortcode functional in posts/pages
- [ ] REST API endpoints working
- [ ] Gutenberg block appears in inserter
- [ ] Admin settings page functional
- [ ] Multiple scenes on same page work
- [ ] No conflicts with popular plugins
- [ ] Tested with 3+ popular WordPress themes

**Deliverable**: WordPress plugin ready for distribution

---

## Phase 4: Performance Optimization (Week 5) 💡

**Goal**: Achieve <2s load time, 60 FPS

(See detailed optimizations in `04_OPTIMIZATIONS.md`)

### Priority Optimizations

**Day 21**: Quick wins
- Add preload hints (10 min)
- Parallel template loading (5 min)
- Preload Havok (15 min)
- Inline default config (30 min)

**Day 22-23**: Significant impact
- Inline critical templates (30 min)
- Deferred interaction setup (1 hr)
- Service worker caching (1 hr)

**Day 24-25**: Advanced
- Lazy load modules (2 hr)
- Memory management audit (3 hr)

**Time**: 40 hours

---

## Phase 5: Testing & QA (Week 6) ✅

**Goal**: Comprehensive testing before release

### Day 26-27: Functional Testing

**Test Matrix**:
- [ ] Core features (save/load, physics, controls)
- [ ] WordPress integration (shortcode, block, API)
- [ ] Cross-browser (Chrome, Firefox, Safari, Edge)
- [ ] Mobile (iOS Safari, Android Chrome)
- [ ] Performance (load time, FPS, memory)

**Time**: 16 hours

---

### Day 28-29: Bug Fixing

**Time**: 16 hours (allocate for issues found)

---

### Day 30: Release Prep

**Tasks**:
- Update documentation
- Create changelog
- Prepare marketing materials
- Submit to WordPress.org (if applicable)

**Time**: 8 hours

---

## Phase 6: Advanced Features (Optional, Weeks 7-8) 🚀

**Goal**: Nice-to-have features for v1.1+

(See `03_ENHANCEMENTS.md` for details)

**Features**:
- Asset upload panel
- Camera bookmarks
- Heightmap terrain
- Light property inspector
- Physics debug visualizer

**Time**: 80 hours (defer to future releases)

---

## Risk Management

### High-Risk Items

1. **Physics initialization timing** (Phase 1)
   - **Risk**: Race conditions in plugin loading
   - **Mitigation**: Comprehensive wait logic, extensive testing
   - **Backup Plan**: Disable physics if initialization fails

2. **WordPress compatibility** (Phase 3)
   - **Risk**: Conflicts with other plugins/themes
   - **Mitigation**: Test with popular plugins/themes
   - **Backup Plan**: Provide compatibility mode option

3. **Performance on mobile** (Phase 4)
   - **Risk**: Low-end devices struggle with physics
   - **Mitigation**: Adaptive quality settings
   - **Backup Plan**: Disable physics on mobile by default

---

## Resource Requirements

### Developer Skills Needed
- JavaScript (ES6+, async/await)
- Babylon.js fundamentals
- WordPress plugin development (PHP)
- REST API design
- Git version control

### Tools Required
- Code editor (VS Code recommended)
- Local WordPress install (LocalWP, XAMPP)
- Modern browser with DevTools
- Git
- (Optional) Node.js for build tools

---

## Success Criteria

**Phase 1**: ✅ Physics works, no console errors
**Phase 2**: ✅ Save/load functional, complete editor
**Phase 3**: ✅ WordPress plugin approved (if submitting)
**Phase 4**: ✅ Load time <2s, 60 FPS on desktop
**Phase 5**: ✅ Zero critical bugs, <5 known minor bugs
**Phase 6**: ✅ Feature parity with competitors

---

## Post-Launch Roadmap (v1.1 - v2.0)

### v1.1 (1 month after launch)
- Bug fixes from user reports
- Performance improvements
- Documentation updates

### v1.2 (3 months after launch)
- Asset upload panel
- Camera bookmarks
- Physics debug visualizer

### v2.0 (6 months after launch)
- VR support
- Multiplayer collaboration
- Advanced terrain tools
- Animation timeline

---

## Conclusion

This implementation plan provides a structured path from current state to production-ready WordPress plugin in 6-8 weeks. The modular approach allows for:

- **Parallel development**: Multiple developers can work on different phases
- **Iterative release**: Can release after Phase 3 (MVP), add enhancements later
- **Risk mitigation**: Critical fixes first, optional features deferred

**Next Step**: Begin Phase 1, Day 1 - Fix ModuleBase import paths

---

## Appendix: Daily Standup Template

**Yesterday**:
- What was completed?
- What blockers were encountered?

**Today**:
- What will be worked on?
- Expected completion time?

**Blockers**:
- Any blockers or help needed?

**Example**:
```
Date: 2025-11-28
Yesterday: Fixed ModuleBase imports (1h), started physics system fix (3h)
Today: Complete physics fix (3h), start error recovery (3h)
Blockers: None
On Track: Yes
```
