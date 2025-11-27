/**
 * @file GizmoPlugin.js
 * @description Transform gizmo system for object manipulation in Edit mode
 *
 * @tags [GIZ.*] Gizmo system
 * @primary-tags [GIZ] Gizmo plugin
 *
 * @dependencies
 *   - [GIZ -> PLG] Extends Plugin base class
 *   - [GIZ -> CFG] Uses configuration
 *   - [GIZ -> EVT] Listens to interaction events
 *   - [GIZ -> INT] Works with InteractionPlugin selection
 *
 * @affects
 *   - [GIZ -> MESH] Attaches gizmos to selected meshes
 *   - [GIZ -> CAM] Gizmos are camera-facing
 *
 * @features
 *   - Position gizmo (W key) - Move objects in 3D space
 *   - Rotation gizmo (E key) - Rotate objects on X/Y/Z axes
 *   - Scale gizmo (R key) - Scale objects uniformly or per-axis
 *   - Gizmo mode switching (keyboard shortcuts + UI)
 *   - Multi-mesh support (gizmo attached to last selected)
 *   - Auto-show/hide based on selection
 *
 * @user-requirements
 *   1. Visual transform controls in Edit mode
 *   2. Intuitive keyboard shortcuts (W/E/R like Blender)
 *   3. Precise object manipulation
 *   4. Works with existing selection system
 *
 * @author Development Team
 * @created 2025-01-21
 */

import Plugin from '../core/Plugin.js';

// [GIZ] Gizmo plugin
// USER REQUIREMENT: Transform gizmos for Edit mode
class GizmoPlugin extends Plugin {
    constructor() {
        super('gizmo');

        // [GIZ.1] Gizmo infrastructure
        this.utilityLayer = null;  // Separate rendering layer for gizmos
        this.gizmoManager = null;  // Babylon.js GizmoManager

        // [GIZ.2] Individual gizmos
        this.positionGizmo = null; // Move/Translate
        this.rotationGizmo = null; // Rotate
        this.scaleGizmo = null;    // Scale

        // [GIZ.3] Gizmo state
        this.currentMode = 'position'; // 'position', 'rotation', 'scale', 'none'
        this.enabled = true;
        this.attachedMesh = null;  // Currently attached mesh

        // [GIZ.4] Configuration
        this.gizmoSize = 1.0;      // Scale of gizmo visuals
        this.snapEnabled = false;  // Snapping for precision
        this.snapDistance = 0.5;   // Position snap distance
        this.snapAngle = 15;       // Rotation snap angle (degrees)

        // [GIZ.5] Event listeners
        this.selectionListener = null;
        this.deselectionListener = null;

        console.log('[GIZ] GizmoPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load gizmo configuration
        const gizmoConfig = config.gizmo || {};

        this.currentMode = gizmoConfig.defaultMode || 'position';
        this.enabled = gizmoConfig.enabled !== false;
        this.gizmoSize = gizmoConfig.size || 1.0;
        this.snapEnabled = gizmoConfig.snap?.enabled || false;
        this.snapDistance = gizmoConfig.snap?.distance || 0.5;
        this.snapAngle = gizmoConfig.snap?.angle || 15;

        console.log('[GIZ] Gizmo configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        super.start();

        // [GIZ.1] Create utility layer (separate rendering for gizmos)
        this.utilityLayer = new BABYLON.UtilityLayerRenderer(this.scene);
        this.utilityLayer.utilityLayerScene.autoClearDepthAndStencil = true;

        // [GIZ.2] Create gizmo manager
        this.gizmoManager = new BABYLON.GizmoManager(this.scene);
        this.gizmoManager.usePointerToAttachGizmos = false; // Manual attachment
        this.gizmoManager.attachableMeshes = null; // We'll manage attachment

        // [GIZ.3] Create individual gizmos
        this.createGizmos();

        // [GIZ.4] Set initial mode
        this.setMode(this.currentMode);

        // [GIZ.5] Listen to selection events
        this.setupSelectionListeners();

        console.log('[GIZ] GizmoPlugin started');
    }

    // [GIZ.2] Create all gizmo types
    createGizmos() {
        // [GIZ.2.1] Position Gizmo (translate/move)
        this.positionGizmo = new BABYLON.PositionGizmo(this.utilityLayer);
        this.positionGizmo.scaleRatio = this.gizmoSize;
        this.positionGizmo.updateGizmoRotationToMatchAttachedMesh = false; // World-aligned axes

        // Enable snapping if configured
        if (this.snapEnabled) {
            this.positionGizmo.snapDistance = this.snapDistance;
        }

        // [GIZ.2.2] Rotation Gizmo
        this.rotationGizmo = new BABYLON.RotationGizmo(this.utilityLayer);
        this.rotationGizmo.scaleRatio = this.gizmoSize;
        this.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;

        // Enable angle snapping if configured
        if (this.snapEnabled) {
            this.rotationGizmo.snapDistance = (this.snapAngle * Math.PI) / 180; // Convert to radians
        }

        // [GIZ.2.3] Scale Gizmo
        this.scaleGizmo = new BABYLON.ScaleGizmo(this.utilityLayer);
        this.scaleGizmo.scaleRatio = this.gizmoSize;
        this.scaleGizmo.updateGizmoRotationToMatchAttachedMesh = false;

        // Scale snapping
        if (this.snapEnabled) {
            this.scaleGizmo.snapDistance = 0.1; // 10% increments
        }

        // [GIZ.2.4] Setup gizmo event listeners
        this.setupGizmoEventListeners();

        console.log('[GIZ.2] All gizmos created');
    }

    // [GIZ.3] Setup gizmo event listeners
    setupGizmoEventListeners() {
        // Position gizmo events
        this.positionGizmo.onDragStartObservable.add(() => {
            this.events.emit('gizmo:drag:start', {
                mode: 'position',
                mesh: this.attachedMesh
            });
        });

        this.positionGizmo.onDragEndObservable.add(() => {
            this.events.emit('gizmo:drag:end', {
                mode: 'position',
                mesh: this.attachedMesh,
                position: this.attachedMesh?.position.clone()
            });
        });

        // Rotation gizmo events
        this.rotationGizmo.onDragStartObservable.add(() => {
            this.events.emit('gizmo:drag:start', {
                mode: 'rotation',
                mesh: this.attachedMesh
            });
        });

        this.rotationGizmo.onDragEndObservable.add(() => {
            this.events.emit('gizmo:drag:end', {
                mode: 'rotation',
                mesh: this.attachedMesh,
                rotation: this.attachedMesh?.rotation.clone()
            });
        });

        // Scale gizmo events
        this.scaleGizmo.onDragStartObservable.add(() => {
            this.events.emit('gizmo:drag:start', {
                mode: 'scale',
                mesh: this.attachedMesh
            });
        });

        this.scaleGizmo.onDragEndObservable.add(() => {
            this.events.emit('gizmo:drag:end', {
                mode: 'scale',
                mesh: this.attachedMesh,
                scale: this.attachedMesh?.scaling.clone()
            });
        });

        console.log('[GIZ.3] Gizmo event listeners setup');
    }

    // [GIZ.4] Setup selection listeners
    setupSelectionListeners() {
        // Listen to interaction plugin selection events
        this.selectionListener = this.events.on('interaction:selected', (data) => {
            console.log('[GIZ.4] 📡 Received "interaction:selected" event:', data.name);
            this.handleSelection(data.mesh);
        });

        this.deselectionListener = this.events.on('interaction:deselected', (data) => {
            console.log('[GIZ.4] 📡 Received "interaction:deselected" event:', data.name);
            this.handleDeselection(data.mesh);
        });

        console.log('[GIZ.4] ✓ Selection listeners registered');
    }

    // [GIZ.5] Handle mesh selection
    handleSelection(mesh) {
        console.log('[GIZ.5] ▶ handleSelection() called for:', mesh.name);

        // Don't attach gizmos to ground or skybox
        if (mesh.name === 'ground' || mesh.name === 'skybox' || mesh.name.startsWith('chunk_')) {
            console.log('[GIZ.5] ⚠ Skipping gizmo attach (ground/skybox/chunk)');
            return;
        }

        // Attach gizmo to newly selected mesh
        console.log('[GIZ.5] Attaching gizmo to mesh...');
        this.attachToMesh(mesh);

        console.log(`[GIZ.5] ✅ Gizmo attached to: ${mesh.name}`);
    }

    // [GIZ.6] Handle mesh deselection
    handleDeselection(mesh) {
        // If this was our attached mesh, detach
        if (this.attachedMesh === mesh) {
            this.detachFromMesh();
        }

        console.log(`[GIZ.6] Gizmo detached from: ${mesh.name}`);
    }

    // [GIZ.7] Attach gizmo to mesh
    attachToMesh(mesh) {
        if (!this.enabled) return;

        this.attachedMesh = mesh;

        // Attach current gizmo mode to mesh
        switch (this.currentMode) {
            case 'position':
                this.positionGizmo.attachedMesh = mesh;
                break;
            case 'rotation':
                this.rotationGizmo.attachedMesh = mesh;
                break;
            case 'scale':
                this.scaleGizmo.attachedMesh = mesh;
                break;
            case 'none':
                // No gizmo attached
                break;
        }

        // Emit event
        this.events.emit('gizmo:attached', {
            mesh: mesh,
            mode: this.currentMode
        });
    }

    // [GIZ.8] Detach gizmo from mesh
    detachFromMesh() {
        // Detach all gizmos
        this.positionGizmo.attachedMesh = null;
        this.rotationGizmo.attachedMesh = null;
        this.scaleGizmo.attachedMesh = null;

        const previousMesh = this.attachedMesh;
        this.attachedMesh = null;

        // Emit event
        this.events.emit('gizmo:detached', {
            mesh: previousMesh
        });
    }

    // [GIZ.9] Set gizmo mode (position/rotation/scale/none)
    setMode(mode) {
        const validModes = ['position', 'rotation', 'scale', 'none'];

        if (!validModes.includes(mode)) {
            console.warn(`[GIZ.9] Invalid mode: ${mode}. Using 'position'.`);
            mode = 'position';
        }

        const previousMode = this.currentMode;
        this.currentMode = mode;

        // Detach all gizmos first
        this.positionGizmo.attachedMesh = null;
        this.rotationGizmo.attachedMesh = null;
        this.scaleGizmo.attachedMesh = null;

        // Attach the selected gizmo mode to current mesh
        if (this.attachedMesh && mode !== 'none') {
            switch (mode) {
                case 'position':
                    this.positionGizmo.attachedMesh = this.attachedMesh;
                    break;
                case 'rotation':
                    this.rotationGizmo.attachedMesh = this.attachedMesh;
                    break;
                case 'scale':
                    this.scaleGizmo.attachedMesh = this.attachedMesh;
                    break;
            }
        }

        // Emit event
        this.events.emit('gizmo:mode-changed', {
            previousMode,
            newMode: mode,
            mesh: this.attachedMesh
        });

        console.log(`[GIZ.9] Gizmo mode: ${previousMode} → ${mode}`);

        return this;
    }

    // [GIZ.10] Cycle through gizmo modes
    cycleMode() {
        const modes = ['position', 'rotation', 'scale'];
        const currentIndex = modes.indexOf(this.currentMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setMode(modes[nextIndex]);

        return this;
    }

    // [GIZ.11] Get current mode
    getMode() {
        return this.currentMode;
    }

    // [GIZ.12] Enable/disable gizmos
    setEnabled(enabled) {
        this.enabled = enabled;

        if (!enabled) {
            this.detachFromMesh();
        } else if (this.attachedMesh) {
            this.attachToMesh(this.attachedMesh);
        }

        console.log(`[GIZ.12] Gizmos ${enabled ? 'enabled' : 'disabled'}`);

        return this;
    }

    // [GIZ.13] Enable/disable snapping
    setSnapping(enabled) {
        this.snapEnabled = enabled;

        // Update all gizmos
        if (enabled) {
            this.positionGizmo.snapDistance = this.snapDistance;
            this.rotationGizmo.snapDistance = (this.snapAngle * Math.PI) / 180;
            this.scaleGizmo.snapDistance = 0.1;
        } else {
            this.positionGizmo.snapDistance = 0;
            this.rotationGizmo.snapDistance = 0;
            this.scaleGizmo.snapDistance = 0;
        }

        console.log(`[GIZ.13] Snapping ${enabled ? 'enabled' : 'disabled'}`);

        return this;
    }

    // [GIZ.14] Set gizmo size
    setSize(size) {
        this.gizmoSize = size;

        this.positionGizmo.scaleRatio = size;
        this.rotationGizmo.scaleRatio = size;
        this.scaleGizmo.scaleRatio = size;

        console.log(`[GIZ.14] Gizmo size: ${size}`);

        return this;
    }

    // [GIZ.15] Get attached mesh
    getAttachedMesh() {
        return this.attachedMesh;
    }

    // [GIZ.16] Check if gizmo is attached
    isAttached() {
        return this.attachedMesh !== null;
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Remove event listeners
        if (this.selectionListener) {
            this.events.off('interaction:selected', this.selectionListener);
        }
        if (this.deselectionListener) {
            this.events.off('interaction:deselected', this.deselectionListener);
        }

        // Detach gizmos
        this.detachFromMesh();

        // Dispose gizmos
        if (this.positionGizmo) {
            this.positionGizmo.dispose();
            this.positionGizmo = null;
        }
        if (this.rotationGizmo) {
            this.rotationGizmo.dispose();
            this.rotationGizmo = null;
        }
        if (this.scaleGizmo) {
            this.scaleGizmo.dispose();
            this.scaleGizmo = null;
        }

        // Dispose gizmo manager
        if (this.gizmoManager) {
            this.gizmoManager.dispose();
            this.gizmoManager = null;
        }

        // Dispose utility layer
        if (this.utilityLayer) {
            this.utilityLayer.dispose();
            this.utilityLayer = null;
        }

        super.dispose();

        console.log('[GIZ] GizmoPlugin disposed');
    }
}

export default GizmoPlugin;
