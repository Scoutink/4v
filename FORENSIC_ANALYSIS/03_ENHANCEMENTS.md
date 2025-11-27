# Enhancement Opportunities

## Overview

This document outlines feature enhancements, API improvements, and developer experience upgrades to elevate the Legozo 3D CMS to production-grade quality.

---

## Enhancement #1: Complete Physics API 🔧

### Current State
- ✅ Basic physics bodies (box, sphere, cylinder)
- ✅ Gravity presets
- ⚠️ No physics material presets UI
- ⚠️ No per-object physics control
- ⚠️ No physics debug visualization

### Proposed Enhancements

#### 1.1 Physics Material Presets UI

**Location**: Control panel physics section

**Features**:
- Dropdown/buttons for material presets (static, bouncy, slippery, heavy)
- Apply to selected object via PropertiesPanel
- Visual feedback showing current material

**Implementation**:
```javascript
// In PhysicsController
applyMaterialPreset(mesh, presetName) {
    const preset = this.config.materialPresets[presetName];
    this.physicsModule.applyPhysicsPreset(mesh, presetName);
    this.showSuccess(`Applied ${presetName} material to ${mesh.name}`);
}
```

**UI Mock**:
```html
<div class="physics-materials">
    <label>Physics Material</label>
    <div class="button-group">
        <button data-action="physics:material:apply" data-value="static">Static</button>
        <button data-action="physics:material:apply" data-value="bouncy">Bouncy</button>
        <button data-action="physics:material:apply" data-value="slippery">Slippery</button>
        <button data-action="physics:material:apply" data-value="heavy">Heavy</button>
    </div>
</div>
```

**Benefit**: User can quickly prototype different physics behaviors

---

#### 1.2 Physics Debug Visualizer

**Feature**: Show collision shapes, velocity vectors, contact points

**Implementation**:
```javascript
// In PhysicsModule
enableDebugVisualization(options = {}) {
    const { showColliders, showVelocity, showContacts } = options;

    if (showColliders) {
        // Use Babylon's built-in physics viewer
        this.physicsViewer = new BABYLON.Debug.PhysicsViewer(this.scene);

        // Show collider for all physics bodies
        this.scene.meshes.forEach(mesh => {
            if (mesh.physicsBody) {
                this.physicsViewer.showBody(mesh.physicsBody);
            }
        });
    }

    if (showVelocity) {
        // Show velocity arrows (custom implementation)
        this.velocityVisualization = new VelocityVisualizer(this.scene);
    }

    if (showContacts) {
        // Show collision contact points
        this.contactVisualization = new ContactVisualizer(this.scene);
    }
}
```

**UI Toggle**:
```html
<div class="physics-debug">
    <label><input type="checkbox" data-action="physics:debug:colliders"> Show Collision Shapes</label>
    <label><input type="checkbox" data-action="physics:debug:velocity"> Show Velocity</label>
    <label><input type="checkbox" data-action="physics:debug:contacts"> Show Contacts</label>
</div>
```

**Benefit**: Essential for debugging physics issues, professional tool

---

#### 1.3 Object Physics Inspector

**Feature**: Show physics properties in PropertiesPanel

**Add to PropertiesPanel**:
```html
<div class="property-section" id="physicsProperties" style="display: none;">
    <h4>Physics</h4>
    <div class="property-row">
        <span>Has Physics Body:</span>
        <span id="hasPhysicsBody">No</span>
    </div>
    <div class="property-row">
        <span>Mass:</span>
        <input type="number" id="physicsMass" step="0.1" min="0">
    </div>
    <div class="property-row">
        <span>Restitution:</span>
        <input type="range" id="physicsRestitution" min="0" max="1" step="0.1">
        <span id="restitutionValue">0.5</span>
    </div>
    <div class="property-row">
        <span>Friction:</span>
        <input type="range" id="physicsFriction" min="0" max="1" step="0.1">
        <span id="frictionValue">0.5</span>
    </div>
    <div class="property-row">
        <button data-action="physics:enable" id="enablePhysics">Enable Physics</button>
        <button data-action="physics:disable" id="disablePhysics" style="display:none;">Disable Physics</button>
    </div>
</div>
```

**Benefit**: Full control over per-object physics properties

---

## Enhancement #2: Advanced Camera Controls 🔧

### Current State
- ✅ Universal camera with keyboard/mouse
- ✅ Collision detection
- ⚠️ No camera presets (FPS, Orbit, Arc, Free)
- ⚠️ No smooth transitions
- ⚠️ No camera bookmarks

### Proposed Enhancements

#### 2.1 Camera Mode Presets

**Modes**:
1. **FPS Mode**: First-person with gravity, collision
2. **Orbit Mode**: Rotate around target point
3. **Arc Mode**: Auto-rotate around object
4. **Free Mode**: Fly-through (no collision, no gravity)
5. **Top-Down Mode**: Orthographic 2D view

**Implementation**:
```javascript
// In CameraPlugin
setCameraMode(mode) {
    switch (mode) {
        case 'fps':
            this.camera.applyGravity = true;
            this.camera.checkCollisions = true;
            this.camera.speed = 0.3;
            break;
        case 'orbit':
            // Switch to ArcRotateCamera
            break;
        case 'free':
            this.camera.applyGravity = false;
            this.camera.checkCollisions = false;
            this.camera.speed = 1.0;
            break;
    }
}
```

**UI**:
```html
<div class="camera-modes">
    <button data-action="camera:mode" data-value="fps">FPS</button>
    <button data-action="camera:mode" data-value="orbit">Orbit</button>
    <button data-action="camera:mode" data-value="free">Free Fly</button>
</div>
```

**Benefit**: Quick switching for different editing tasks

---

#### 2.2 Camera Bookmarks

**Feature**: Save and restore camera positions

**Implementation**:
```javascript
// In CameraPlugin
bookmarks = new Map();

saveBookmark(name) {
    this.bookmarks.set(name, {
        position: this.camera.position.clone(),
        rotation: this.camera.rotation.clone(),
        target: this.camera.target.clone()
    });
    this.events.emit('camera:bookmark:saved', { name });
}

loadBookmark(name, smoothTransition = true) {
    const bookmark = this.bookmarks.get(name);
    if (!bookmark) return;

    if (smoothTransition) {
        this.animateToPosition(bookmark);
    } else {
        this.camera.position = bookmark.position.clone();
        this.camera.rotation = bookmark.rotation.clone();
    }
}
```

**UI**:
```html
<div class="camera-bookmarks">
    <button data-action="camera:bookmark:save">💾 Save View</button>
    <div id="bookmarkList">
        <button data-action="camera:bookmark:load" data-value="view1">View 1</button>
        <button data-action="camera:bookmark:load" data-value="view2">View 2</button>
    </div>
</div>
```

**Benefit**: Rapid navigation to key viewpoints

---

## Enhancement #3: Asset Management System 🔧

### Current State
- ⚠️ No file upload UI
- ⚠️ No asset library
- ⚠️ No 3D model loading UI
- ✅ AssetPlugin exists but minimal

### Proposed Enhancements

#### 3.1 Asset Upload Panel

**Feature**: Drag-and-drop upload for textures, models

**Implementation**:
```javascript
// In AssetPlugin
enableDragDrop() {
    const dropZone = document.getElementById('renderCanvas');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);

        for (const file of files) {
            if (file.name.match(/\.(gltf|glb)$/i)) {
                await this.loadModel(file);
            } else if (file.name.match(/\.(jpg|png)$/i)) {
                await this.loadTexture(file);
            }
        }
    });
}
```

**UI**:
```html
<div class="asset-panel">
    <div class="upload-zone">
        <p>Drop 3D models (.glb, .gltf) or textures (.jpg, .png) here</p>
    </div>
    <div class="asset-library" id="assetLibrary">
        <!-- Assets appear here -->
    </div>
</div>
```

**Benefit**: Essential for content creation workflows

---

#### 3.2 Asset Library Browser

**Feature**: Visual gallery of uploaded assets

**Implementation**:
```javascript
class AssetLibrary {
    constructor() {
        this.assets = [];
    }

    addAsset(asset) {
        this.assets.push(asset);
        this.renderAssetThumbnail(asset);
    }

    renderAssetThumbnail(asset) {
        const thumb = document.createElement('div');
        thumb.className = 'asset-thumbnail';
        thumb.innerHTML = `
            <img src="${asset.thumbnail}">
            <span>${asset.name}</span>
        `;
        thumb.onclick = () => this.placeAsset(asset);
        document.getElementById('assetLibrary').appendChild(thumb);
    }

    placeAsset(asset) {
        // Place asset in scene at camera position
        const position = this.scene.activeCamera.position.clone();
        position.z += 5;
        this.loadAssetAtPosition(asset, position);
    }
}
```

**Benefit**: Visual asset management, drag-and-place workflow

---

## Enhancement #4: Ground Enhancements 🔧

### Current State
- ✅ Ground creation with textures
- ✅ Rotation presets
- ✅ Edge behaviors
- ⚠️ No infinite terrain UI
- ⚠️ No heightmap editor
- ⚠️ No terrain painting

### Proposed Enhancements

#### 4.1 Infinite Terrain Controls

**Feature**: Enable/disable infinite terrain with UI

**Implementation**:
```javascript
// In GroundController
toggleInfiniteTerrain(enabled) {
    if (enabled) {
        const infiniteGroundPlugin = this.engine.getPlugin('infiniteGround');
        if (infiniteGroundPlugin) {
            infiniteGroundPlugin.enable();
        }
    } else {
        // Disable infinite terrain
    }
}
```

**UI**:
```html
<div class="ground-infinite">
    <label><input type="checkbox" data-action="ground:infinite:toggle"> Enable Infinite Terrain</label>
    <div class="infinite-settings" id="infiniteSettings" style="display: none;">
        <label>Chunk Size: <input type="number" value="50" data-action="ground:infinite:chunksize"></label>
        <label>View Distance: <input type="number" value="3" data-action="ground:infinite:viewdistance"></label>
    </div>
</div>
```

**Benefit**: Large open-world scenes

---

#### 4.2 Heightmap Terrain Generator

**Feature**: Generate terrain from heightmap image

**Implementation**:
```javascript
// In GroundPlugin
async createHeightmapTerrain(heightmapUrl, options = {}) {
    this.ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
        'ground',
        heightmapUrl,
        {
            width: options.width || 100,
            height: options.height || 100,
            subdivisions: options.subdivisions || 100,
            minHeight: options.minHeight || 0,
            maxHeight: options.maxHeight || 10
        },
        this.scene
    );

    // Apply material
    this.applyMaterial(options.material);
}
```

**UI**:
```html
<div class="ground-heightmap">
    <button data-action="ground:heightmap:upload">Upload Heightmap</button>
    <input type="file" id="heightmapFile" accept=".png,.jpg" style="display:none;">
</div>
```

**Benefit**: Realistic terrain generation

---

## Enhancement #5: Lighting & Shadow System 🔧

### Current State
- ✅ Lighting presets (day, night, sunset)
- ✅ Shadow quality settings
- ⚠️ No dynamic light controls
- ⚠️ No per-light adjustment
- ⚠️ No light gizmos

### Proposed Enhancements

#### 5.1 Light Property Inspector

**Feature**: Adjust light intensity, color, position in real-time

**Implementation**:
```javascript
// In LightingPlugin
updateLightProperty(lightName, property, value) {
    const light = this.lights.get(lightName);
    if (!light) return;

    switch (property) {
        case 'intensity':
            light.intensity = value;
            break;
        case 'color':
            light.diffuse = BABYLON.Color3.FromHexString(value);
            break;
        case 'position':
            light.position = new BABYLON.Vector3(value.x, value.y, value.z);
            break;
    }

    this.events.emit('lighting:changed', { lightName, property, value });
}
```

**UI**:
```html
<div class="light-controls">
    <div class="light-item" data-light="mainLight">
        <h5>Main Light</h5>
        <label>Intensity: <input type="range" min="0" max="2" step="0.1" value="1"></label>
        <label>Color: <input type="color" value="#ffffff"></label>
    </div>
</div>
```

**Benefit**: Fine-tuned lighting control

---

#### 5.2 Light Gizmos

**Feature**: Visual handles to move/rotate lights

**Implementation**:
```javascript
// In LightingPlugin
enableLightGizmo(light) {
    const gizmo = new BABYLON.PositionGizmo();
    gizmo.attachedMesh = light; // Works for lights with position
    this.lightGizmos.set(light.name, gizmo);
}
```

**Benefit**: Intuitive light positioning

---

## Enhancement #6: Save/Load System 🔧

### Current State
- ⚠️ No save functionality
- ⚠️ No load functionality
- ⚠️ No export to file
- ⚠️ No scene persistence

### Proposed Enhancements

#### 6.1 Scene Serialization

**Feature**: Save entire scene to JSON

**Implementation**:
```javascript
// New plugin: SceneManagerPlugin
class SceneManagerPlugin extends Plugin {
    serializeScene() {
        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            camera: this.serializeCamera(),
            objects: this.serializeObjects(),
            lighting: this.serializeLighting(),
            ground: this.serializeGround(),
            config: this.scene.metadata.sceneConfig
        };
    }

    serializeObjects() {
        return this.scene.meshes
            .filter(m => !m.name.includes('ground'))
            .map(mesh => ({
                type: mesh.metadata?.type || 'mesh',
                name: mesh.name,
                position: mesh.position.asArray(),
                rotation: mesh.rotation.asArray(),
                scaling: mesh.scaling.asArray(),
                material: this.serializeMaterial(mesh.material),
                physics: mesh.physicsBody ? {
                    mass: mesh.physicsBody.getMass(),
                    // ...
                } : null
            }));
    }

    async saveScene() {
        const sceneData = this.serializeScene();
        const blob = new Blob([JSON.stringify(sceneData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scene_${Date.now()}.json`;
        a.click();
    }

    async loadScene(sceneData) {
        // Clear current scene
        this.clearScene();

        // Recreate objects
        for (const objData of sceneData.objects) {
            await this.createObjectFromData(objData);
        }

        // Restore camera
        this.restoreCamera(sceneData.camera);

        // Apply lighting
        this.restoreLighting(sceneData.lighting);
    }
}
```

**UI**:
```html
<div class="scene-manager">
    <button data-action="scene:save">💾 Save Scene</button>
    <button data-action="scene:load">📁 Load Scene</button>
    <input type="file" id="sceneFile" accept=".json" style="display:none;">
</div>
```

**Benefit**: CRITICAL for any CMS, allows users to persist work

---

#### 6.2 WordPress Integration - Shortcode Loader

**Feature**: Load saved scene via WordPress shortcode

**Implementation**:
```javascript
// Add to Bootstrap.js
async function initFromShortcode() {
    const params = new URLSearchParams(window.location.search);
    const sceneId = params.get('scene_id');

    if (sceneId) {
        const sceneData = await fetch(`/wp-json/legozo/v1/scenes/${sceneId}`).then(r => r.json());
        await legozo.loadScene(sceneData);
    } else {
        // Load default demo scene
        await legozo.init('./config/scene-demo.json');
    }
}
```

**WordPress Shortcode**:
```php
// In WordPress plugin
function legozo_3d_scene_shortcode($atts) {
    $atts = shortcode_atts([
        'scene_id' => 'default',
        'width' => '100%',
        'height' => '600px'
    ], $atts);

    return "<iframe src='/legozo/?scene_id={$atts['scene_id']}'
                    width='{$atts['width']}'
                    height='{$atts['height']}'
                    frameborder='0'></iframe>";
}
add_shortcode('legozo_scene', 'legozo_3d_scene_shortcode');
```

**Usage in WordPress**:
```
[legozo_scene scene_id="my-awesome-scene" width="100%" height="600px"]
```

**Benefit**: CRITICAL for WordPress embedding goal

---

## Enhancement #7: Object Manipulation Tools 🔧

### Current State
- ✅ Position gizmo (partial)
- ⚠️ No rotation gizmo
- ⚠️ No scale gizmo
- ⚠️ No snapping
- ⚠️ No duplication
- ⚠️ No delete

### Proposed Enhancements

#### 7.1 Complete Gizmo System

**Feature**: Position, Rotation, Scale gizmos with snapping

**Already exists**: `GizmoPlugin.js` - enhance it!

**Add**:
```javascript
// In GizmoPlugin
enableSnapping(snapDistance = 0.5, snapAngle = 15) {
    if (this.positionGizmo) {
        this.positionGizmo.snapDistance = snapDistance;
    }
    if (this.rotationGizmo) {
        this.rotationGizmo.snapDistance = snapAngle * Math.PI / 180;
    }
}

setGizmoMode(mode) {
    // Hide all gizmos
    this.hideAllGizmos();

    // Show selected gizmo
    switch (mode) {
        case 'position':
            this.positionGizmo.attachedMesh = this.selectedMesh;
            break;
        case 'rotation':
            this.rotationGizmo.attachedMesh = this.selectedMesh;
            break;
        case 'scale':
            this.scaleGizmo.attachedMesh = this.selectedMesh;
            break;
    }
}
```

**UI**:
```html
<div class="gizmo-toolbar">
    <button data-action="gizmo:mode" data-value="position" title="Move">🔀</button>
    <button data-action="gizmo:mode" data-value="rotation" title="Rotate">🔄</button>
    <button data-action="gizmo:mode" data-value="scale" title="Scale">↔️</button>
    <label><input type="checkbox" data-action="gizmo:snap"> Snap to Grid</label>
</div>
```

---

#### 7.2 Object Actions

**Feature**: Duplicate, delete, group objects

**Implementation**:
```javascript
// In InteractionPlugin or new ObjectManagerPlugin
duplicateObject(mesh) {
    const clone = mesh.clone(mesh.name + '_copy');
    clone.position.x += 1; // Offset slightly

    // Copy physics if exists
    if (mesh.physicsBody) {
        const settings = mesh.metadata.physicsSettings;
        this.collisionPlugin.enablePhysicsBody(clone, settings);
    }

    this.events.emit('object:duplicated', { original: mesh, clone });
    return clone;
}

deleteObject(mesh) {
    // Remove physics
    if (mesh.physicsBody) {
        mesh.physicsBody.dispose();
    }

    // Remove mesh
    mesh.dispose();

    this.events.emit('object:deleted', { mesh });
}
```

**UI** (Keyboard Shortcuts):
- Ctrl+D: Duplicate selected
- Delete: Delete selected
- Ctrl+G: Group selected

**Benefit**: Essential editing operations

---

## Enhancement Summary Table

| # | Enhancement | Priority | Complexity | Impact | Estimated Time |
|---|-------------|----------|------------|--------|----------------|
| 1.1 | Physics Material Presets UI | HIGH | Low | High | 2h |
| 1.2 | Physics Debug Visualizer | MEDIUM | Medium | High | 4h |
| 1.3 | Object Physics Inspector | HIGH | Low | High | 2h |
| 2.1 | Camera Mode Presets | MEDIUM | Medium | Medium | 3h |
| 2.2 | Camera Bookmarks | LOW | Low | Medium | 2h |
| 3.1 | Asset Upload Panel | HIGH | High | Critical | 6h |
| 3.2 | Asset Library Browser | HIGH | High | Critical | 8h |
| 4.1 | Infinite Terrain Controls | LOW | Low | Low | 2h |
| 4.2 | Heightmap Terrain | MEDIUM | Medium | Medium | 4h |
| 5.1 | Light Property Inspector | LOW | Low | Low | 2h |
| 5.2 | Light Gizmos | LOW | Medium | Low | 3h |
| 6.1 | Scene Serialization | CRITICAL | High | Critical | 8h |
| 6.2 | WordPress Integration | CRITICAL | High | Critical | 12h |
| 7.1 | Complete Gizmo System | HIGH | Low | High | 2h |
| 7.2 | Object Actions | HIGH | Low | High | 2h |

**Total Estimated Time**: 62 hours (1.5 weeks of focused development)

---

## Prioritization Strategy

### Phase 1: Critical for Production (24h)
1. Scene Serialization (6.1)
2. WordPress Integration (6.2)
3. Asset Upload Panel (3.1)

### Phase 2: Essential UX (14h)
4. Asset Library Browser (3.2)
5. Physics Material Presets (1.1)
6. Object Physics Inspector (1.3)
7. Complete Gizmo System (7.1)
8. Object Actions (7.2)

### Phase 3: Advanced Features (12h)
9. Physics Debug Visualizer (1.2)
10. Camera Mode Presets (2.1)
11. Heightmap Terrain (4.2)

### Phase 4: Polish (12h)
12. Camera Bookmarks (2.2)
13. Infinite Terrain Controls (4.1)
14. Light Property Inspector (5.1)
15. Light Gizmos (5.2)

---

## Next Steps

See **[04_OPTIMIZATIONS.md](./04_OPTIMIZATIONS.md)** for performance improvements.
