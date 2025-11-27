/**
 * @file InteractionPlugin.js
 * @description Advanced object interaction system
 *
 * @tags [INT.*] All interaction tags
 * @primary-tags [INT.1] Hover, [INT.2] Click, [INT.3] Drag, [INT.4] Select
 * @critical-tags [!INT.5] Performance critical with many objects
 *
 * @dependencies
 *   - [INT -> BABYLON] Requires scene pointer observables
 *   - [INT -> EVT] Emits interaction events
 *
 * @affects
 *   - Mesh highlighting (hover effects)
 *   - Mesh positions (drag & drop)
 *   - Selection state (multi-select)
 *
 * @events
 *   - Emits: interaction:hover:enter/exit, interaction:click, interaction:drag:*
 *
 * @features
 *   - Hover detection with enter/exit callbacks
 *   - Single/double/right click support
 *   - Drag & drop with plane constraints
 *   - Selection system with multi-select
 *   - Performance optimized for 100+ objects
 *
 * @author Development Team
 * @created 2025-11-20
 */

import Plugin from '../core/Plugin.js';

// [INT] Interaction plugin
// [INT] USER REQUIREMENT: Advanced object interactions
class InteractionPlugin extends Plugin {
    constructor() {
        super('interaction');

        // [INT.1] Hover state
        this.hoveredMesh = null;
        this.hoverableMeshes = new Map(); // mesh -> callbacks

        // [INT.2] Click state
        this.clickableMeshes = new Map(); // mesh -> callback
        this.doubleClickMeshes = new Map(); // mesh -> callback
        this.rightClickMeshes = new Map(); // mesh -> callback
        this.lastClickTime = 0;
        this.doubleClickWindow = 300; // ms

        // [INT.3] Drag state
        this.draggableMeshes = new Map(); // mesh -> options
        this.isDragging = false;
        this.draggedMesh = null;
        this.dragStartPosition = null;
        this.dragPlaneNormal = new BABYLON.Vector3(0, 1, 0); // Default: Y-up
        this.dragCandidate = null; // Mesh that might be dragged
        this.pointerDownPosition = null; // Screen position where pointer went down
        this.dragThreshold = 5; // Pixels to move before drag starts

        // [INT.4] Selection state
        this.selectableMeshes = new Set();
        this.selectedMeshes = new Set();
        this.multiSelectEnabled = true; // Ctrl+click for multi-select
        this.selectionColor = new BABYLON.Color3(0, 1, 0); // Green outline
        this.selectionThickness = 0.1;

        // [INT.1] Highlight layers for visual feedback
        this.hoverHighlightLayer = null;
        this.hoverColor = new BABYLON.Color3(0.3, 0.7, 1.0); // Blue for hover

        // [INT.5] Observers
        this.pointerMoveObserver = null;
        this.pointerDownObserver = null;
        this.pointerUpObserver = null;

        // [FIX #2] Track current mode (edit/view)
        this.currentMode = 'edit'; // Default to edit mode

        console.log('[INT] InteractionPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load interaction configuration
        const intConfig = config.interaction || {};

        this.doubleClickWindow = intConfig.doubleClickWindow || 300;
        this.multiSelectEnabled = intConfig.multiSelect !== false;
        this.dragPlaneNormal = intConfig.dragPlaneNormal || new BABYLON.Vector3(0, 1, 0);

        console.log('[INT] InteractionPlugin configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        super.start();

        // [INT.1] Create highlight layer for hover effects
        this.hoverHighlightLayer = new BABYLON.HighlightLayer('hoverHighlight', this.scene, {
            isStroke: false,
            blurHorizontalSize: 1.0,
            blurVerticalSize: 1.0
        });

        // [INT.5] Setup pointer observers
        this.setupPointerObservers();

        // [FIX #2] Listen for mode changes
        this.events.on('mode:changed', (data) => {
            this.setMode(data.mode);
        });

        console.log('[INT] InteractionPlugin started');
    }

    // [FIX #2] Set interaction mode
    setMode(mode) {
        this.currentMode = mode;
        console.log(`[INT] Mode changed to: ${mode}`);

        // If switching to view mode, clear any active drag
        if (mode === 'view' && this.isDragging) {
            this.endDrag();
        }

        // If switching to view mode, deselect all objects
        if (mode === 'view') {
            this.deselectAll();
        }
    }

    // [INT.5] Setup pointer event observers
    setupPointerObservers() {
        // [INT.5.1] Pointer move - for hover detection
        this.pointerMoveObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                this.handlePointerMove(pointerInfo);
            }
        });

        // [INT.5.2] Pointer down - for click and drag start
        this.pointerDownObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                this.handlePointerDown(pointerInfo);
            }
        });

        // [INT.5.3] Pointer up - for click and drag end
        this.pointerUpObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
                this.handlePointerUp(pointerInfo);
            }
        });

        console.log('[INT.5] Pointer observers registered');
    }

    // [INT.1] Make mesh hoverable
    // USER REQUIREMENT: Highlight objects on hover
    makeHoverable(mesh, callbacks = {}) {
        this.hoverableMeshes.set(mesh, {
            onHoverEnter: callbacks.onHoverEnter || null,
            onHoverExit: callbacks.onHoverExit || null
        });

        console.log(`[INT.1] Mesh ${mesh.name} is now hoverable`);
    }

    // [INT.1] Remove hoverable
    removeHoverable(mesh) {
        this.hoverableMeshes.delete(mesh);
        if (this.hoveredMesh === mesh) {
            this.handleHoverExit();
        }
        console.log(`[INT.1] Mesh ${mesh.name} is no longer hoverable`);
    }

    // [INT.1] Handle pointer move (hover detection)
    handlePointerMove(pointerInfo) {
        const pickInfo = pointerInfo.pickInfo;

        // [INT.3] Check if we should start dragging (distance threshold)
        if (this.dragCandidate && !this.isDragging && this.pointerDownPosition) {
            const currentX = this.scene.pointerX;
            const currentY = this.scene.pointerY;
            const deltaX = currentX - this.pointerDownPosition.x;
            const deltaY = currentY - this.pointerDownPosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance > this.dragThreshold) {
                console.log('[INT.3] Drag threshold exceeded:', distance, '> threshold:', this.dragThreshold);
                // Start dragging
                this.startDrag(this.dragCandidate, pickInfo);
                this.dragCandidate = null;
                this.pointerDownPosition = null;
            }
        }

        // [INT.1.1] Check if we hit a hoverable mesh
        if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
            const mesh = pickInfo.pickedMesh;

            if (this.hoverableMeshes.has(mesh)) {
                // [INT.1.2] Entering hover
                if (this.hoveredMesh !== mesh) {
                    // Exit previous hover
                    if (this.hoveredMesh) {
                        this.handleHoverExit();
                    }

                    // Enter new hover
                    this.hoveredMesh = mesh;
                    this.handleHoverEnter(mesh);
                }
            } else {
                // Not hoverable, exit if we were hovering
                if (this.hoveredMesh) {
                    this.handleHoverExit();
                }
            }
        } else {
            // No hit, exit hover if active
            if (this.hoveredMesh) {
                this.handleHoverExit();
            }
        }

        // [INT.3] Handle drag move
        if (this.isDragging && this.draggedMesh) {
            this.handleDragMove(pointerInfo);
        }
    }

    // [INT.1] Handle hover enter
    handleHoverEnter(mesh) {
        const callbacks = this.hoverableMeshes.get(mesh);

        if (callbacks && callbacks.onHoverEnter) {
            callbacks.onHoverEnter(mesh);
        }

        // [INT.1.1] Apply hover highlight visual
        if (this.hoverHighlightLayer) {
            this.hoverHighlightLayer.addMesh(mesh, this.hoverColor);
        }

        // [EVT.2] Emit hover enter event
        this.events.emit('interaction:hover:enter', {
            mesh: mesh,
            name: mesh.name
        });

        console.log(`[INT.1] Hover enter: ${mesh.name} (highlight applied)`);
    }

    // [INT.1] Handle hover exit
    handleHoverExit() {
        if (!this.hoveredMesh) return;

        const mesh = this.hoveredMesh;
        const callbacks = this.hoverableMeshes.get(mesh);

        if (callbacks && callbacks.onHoverExit) {
            callbacks.onHoverExit(mesh);
        }

        // [INT.1.2] Remove hover highlight visual
        if (this.hoverHighlightLayer) {
            this.hoverHighlightLayer.removeMesh(mesh);
        }

        // [EVT.2] Emit hover exit event
        this.events.emit('interaction:hover:exit', {
            mesh: mesh,
            name: mesh.name
        });

        console.log(`[INT.1] Hover exit: ${mesh.name} (highlight removed)`);

        this.hoveredMesh = null;
    }

    // [INT.2] Register click handler
    // USER REQUIREMENT: Handle object clicks
    onClick(mesh, callback) {
        this.clickableMeshes.set(mesh, callback);
        console.log(`[INT.2] Click handler registered for ${mesh.name}`);
    }

    // [INT.2] Register double-click handler
    onDoubleClick(mesh, callback) {
        this.doubleClickMeshes.set(mesh, callback);
        console.log(`[INT.2] Double-click handler registered for ${mesh.name}`);
    }

    // [INT.2] Register right-click handler
    onRightClick(mesh, callback) {
        this.rightClickMeshes.set(mesh, callback);
        console.log(`[INT.2] Right-click handler registered for ${mesh.name}`);
    }

    // [INT.2] Handle pointer down (click start, drag start)
    handlePointerDown(pointerInfo) {
        const pickInfo = pointerInfo.pickInfo;
        const event = pointerInfo.event;

        // [FIX #2] In view mode, only allow deselection, no drag or new selection
        if (this.currentMode === 'view') {
            if (!pickInfo || !pickInfo.hit || !pickInfo.pickedMesh) {
                // Clicked empty space in view mode - deselect all
                this.deselectAll();
            }
            return; // Block all other interactions in view mode
        }

        if (!pickInfo || !pickInfo.hit || !pickInfo.pickedMesh) {
            // Clicked empty space - deselect all if not holding Ctrl
            if (!event.ctrlKey && !event.metaKey) {
                this.deselectAll();
            }
            return;
        }

        const mesh = pickInfo.pickedMesh;

        // [INT.3] Store as drag candidate (don't start drag yet - wait for movement threshold)
        if (this.draggableMeshes.has(mesh) && event.button === 0) {
            this.dragCandidate = mesh;
            this.pointerDownPosition = { x: this.scene.pointerX, y: this.scene.pointerY };
            console.log('[INT.3] Drag candidate registered:', mesh.name, 'at', this.pointerDownPosition);
        }
    }

    // [INT.2] Handle pointer up (click end, drag end)
    handlePointerUp(pointerInfo) {
        const pickInfo = pointerInfo.pickInfo;
        const event = pointerInfo.event;

        console.log('[INT.2] ▶ Pointer UP event received', {
            hit: pickInfo?.hit,
            mesh: pickInfo?.pickedMesh?.name,
            isDragging: this.isDragging,
            dragCandidate: this.dragCandidate?.name
        });

        // [INT.3] End drag if dragging
        if (this.isDragging) {
            this.endDrag();
            return; // Don't process click if we were dragging
        }

        // [INT.3] Clear drag candidate if pointer up without drag
        if (this.dragCandidate) {
            console.log('[INT.3] Pointer up without drag - clearing candidate, processing click');
            this.dragCandidate = null;
            this.pointerDownPosition = null;
            // Continue to process as regular click/selection
        }

        // [FIX #2] Block all click interactions in view mode (no selection allowed)
        if (this.currentMode === 'view') {
            console.log('[INT.2] View mode - blocking selection');
            return;
        }

        if (!pickInfo || !pickInfo.hit || !pickInfo.pickedMesh) {
            console.log('[INT.2] ❌ No mesh picked (clicked empty space)');
            return;
        }

        const mesh = pickInfo.pickedMesh;
        console.log('[INT.2] ✓ Mesh picked:', mesh.name);

        // [INT.2] Handle right-click
        if (event.button === 2) {
            if (this.rightClickMeshes.has(mesh)) {
                const callback = this.rightClickMeshes.get(mesh);
                callback(mesh, event);

                // [EVT.2] Emit right-click event
                this.events.emit('interaction:rightclick', {
                    mesh: mesh,
                    name: mesh.name,
                    event
                });
            }
            return;
        }

        // [INT.2] Handle left-click
        if (event.button === 0) {
            // [INT.2] Double-click detection
            const now = performance.now();
            const isDoubleClick = (now - this.lastClickTime) < this.doubleClickWindow;

            if (isDoubleClick && this.doubleClickMeshes.has(mesh)) {
                // Double-click
                const callback = this.doubleClickMeshes.get(mesh);
                callback(mesh, event);

                // [EVT.2] Emit double-click event
                this.events.emit('interaction:doubleclick', {
                    mesh: mesh,
                    name: mesh.name,
                    event
                });

                this.lastClickTime = 0; // Reset
            } else {
                // Single click
                if (this.clickableMeshes.has(mesh)) {
                    const callback = this.clickableMeshes.get(mesh);
                    callback(mesh, event);

                    // [EVT.2] Emit click event
                    this.events.emit('interaction:click', {
                        mesh: mesh,
                        name: mesh.name,
                        event
                    });
                }

                this.lastClickTime = now;
            }

            // [INT.4] Handle selection
            console.log('[INT.4] 🔍 Checking if mesh is selectable:', {
                meshName: mesh.name,
                isSelectable: this.selectableMeshes.has(mesh),
                totalSelectableMeshes: this.selectableMeshes.size
            });

            if (this.selectableMeshes.has(mesh)) {
                console.log('[INT.4] ✓ Mesh IS selectable, processing selection...');
                if (event.ctrlKey || event.metaKey) {
                    // Multi-select toggle
                    console.log('[INT.4] Multi-select mode (Ctrl held)');
                    if (this.selectedMeshes.has(mesh)) {
                        this.deselect(mesh);
                    } else {
                        this.select(mesh);
                    }
                } else {
                    // Single select (deselect others)
                    console.log('[INT.4] Single-select mode');
                    this.deselectAll();
                    this.select(mesh);
                }
            } else {
                console.log('[INT.4] ❌ Mesh is NOT selectable');
            }
        }
    }

    // [INT.3] Make mesh draggable
    // USER REQUIREMENT: Drag & drop objects
    makeDraggable(mesh, options = {}) {
        this.draggableMeshes.set(mesh, {
            dragPlane: options.dragPlane || 'ground', // 'ground', 'custom'
            dragPlaneNormal: options.dragPlaneNormal || new BABYLON.Vector3(0, 1, 0),
            onDragStart: options.onDragStart || null,
            onDrag: options.onDrag || null,
            onDragEnd: options.onDragEnd || null
        });

        console.log(`[INT.3] Mesh ${mesh.name} is now draggable`);
    }

    // [INT.3] Remove draggable
    removeDraggable(mesh) {
        this.draggableMeshes.delete(mesh);
        console.log(`[INT.3] Mesh ${mesh.name} is no longer draggable`);
    }

    // [INT.3] Start drag
    startDrag(mesh, pickInfo) {
        this.isDragging = true;
        this.draggedMesh = mesh;
        this.dragStartPosition = mesh.position.clone();

        const options = this.draggableMeshes.get(mesh);

        // [INT.3.1] Call onDragStart callback
        if (options.onDragStart) {
            options.onDragStart(mesh);
        }

        // [EVT.2] Emit drag start event
        this.events.emit('interaction:drag:start', {
            mesh: mesh,
            name: mesh.name,
            startPosition: this.dragStartPosition
        });

        console.log(`[INT.3] Drag started: ${mesh.name}`);
    }

    // [INT.3] Handle drag move
    handleDragMove(pointerInfo) {
        if (!this.isDragging || !this.draggedMesh) return;

        const options = this.draggableMeshes.get(this.draggedMesh);
        const scene = this.scene;

        // [INT.3.2] Create drag plane
        const dragPlane = BABYLON.Plane.FromPositionAndNormal(
            this.draggedMesh.position,
            options.dragPlaneNormal
        );

        // [INT.3.3] Ray from camera through pointer
        const ray = scene.createPickingRay(
            scene.pointerX,
            scene.pointerY,
            null,
            scene.activeCamera
        );

        // [INT.3.4] Find intersection with drag plane
        const distance = ray.intersectsPlane(dragPlane);

        if (distance !== null) {
            const pickPosition = ray.origin.add(ray.direction.scale(distance));

            // [INT.3.5] Update mesh position
            this.draggedMesh.position.x = pickPosition.x;
            this.draggedMesh.position.z = pickPosition.z;
            // Keep Y position (dragging on horizontal plane)

            // [INT.3.6] Call onDrag callback
            if (options.onDrag) {
                options.onDrag(this.draggedMesh.position.clone());
            }

            // [EVT.2] Emit drag move event
            this.events.emit('interaction:drag:move', {
                mesh: this.draggedMesh,
                name: this.draggedMesh.name,
                position: this.draggedMesh.position.clone()
            });
        }
    }

    // [INT.3] End drag
    endDrag() {
        if (!this.isDragging || !this.draggedMesh) return;

        const mesh = this.draggedMesh;
        const options = this.draggableMeshes.get(mesh);
        const endPosition = mesh.position.clone();

        // [INT.3.7] Call onDragEnd callback
        if (options.onDragEnd) {
            options.onDragEnd(endPosition);
        }

        // [EVT.2] Emit drag end event
        this.events.emit('interaction:drag:end', {
            mesh: mesh,
            name: mesh.name,
            startPosition: this.dragStartPosition,
            endPosition: endPosition
        });

        console.log(`[INT.3] Drag ended: ${mesh.name}`);

        this.isDragging = false;
        this.draggedMesh = null;
        this.dragStartPosition = null;
    }

    // [INT.4] Make mesh selectable
    // USER REQUIREMENT: Selection system with multi-select
    makeSelectable(mesh) {
        this.selectableMeshes.add(mesh);
        console.log(`[INT.4] ✅ Mesh "${mesh.name}" is now selectable (Total: ${this.selectableMeshes.size})`);
    }

    // [INT.4] Remove selectable
    removeSelectable(mesh) {
        this.selectableMeshes.delete(mesh);
        if (this.selectedMeshes.has(mesh)) {
            this.deselect(mesh);
        }
        console.log(`[INT.4] Mesh ${mesh.name} is no longer selectable`);
    }

    // [INT.4] Select mesh
    select(mesh) {
        console.log('[INT.4] ▶ select() called for:', mesh.name);

        if (!this.selectableMeshes.has(mesh)) {
            console.warn(`[INT.4] ❌ Mesh ${mesh.name} is not selectable`);
            return;
        }

        if (this.selectedMeshes.has(mesh)) {
            console.log(`[INT.4] ⚠ Mesh ${mesh.name} already selected`);
            return; // Already selected
        }

        this.selectedMeshes.add(mesh);
        console.log('[INT.4] ✓ Added to selectedMeshes Set');

        // [INT.4.1] Visual feedback (outline or highlight)
        this.applySelectionVisual(mesh);
        console.log('[INT.4] ✓ Applied selection visual (green glow)');

        // [EVT.2] Emit selected event
        const listenerCount = this.events.listenerCount('interaction:selected');
        console.log(`[INT.4] 📡 Emitting 'interaction:selected' event (${listenerCount} listeners)`);

        this.events.emit('interaction:selected', {
            mesh: mesh,
            name: mesh.name,
            selectedCount: this.selectedMeshes.size
        });

        console.log(`[INT.4] ✅ Selected: ${mesh.name}`);
    }

    // [INT.4] Deselect mesh
    deselect(mesh) {
        if (!this.selectedMeshes.has(mesh)) {
            return; // Not selected
        }

        this.selectedMeshes.delete(mesh);

        // [INT.4.2] Remove visual feedback
        this.removeSelectionVisual(mesh);

        // [EVT.2] Emit deselected event
        this.events.emit('interaction:deselected', {
            mesh: mesh,
            name: mesh.name,
            selectedCount: this.selectedMeshes.size
        });

        console.log(`[INT.4] Deselected: ${mesh.name}`);
    }

    // [INT.4] Deselect all
    deselectAll() {
        const selectedMeshes = Array.from(this.selectedMeshes);

        for (const mesh of selectedMeshes) {
            this.deselect(mesh);
        }

        console.log('[INT.4] All deselected');
    }

    // [INT.4] Get selected meshes
    getSelected() {
        return Array.from(this.selectedMeshes);
    }

    // [INT.4] Get selected meshes (alias for compatibility)
    getSelectedMeshes() {
        return this.getSelected();
    }

    // [INT.4] Check if mesh is selected
    isSelected(mesh) {
        return this.selectedMeshes.has(mesh);
    }

    // [INT.4] Enable/disable multi-select
    enableMultiSelect(enabled) {
        this.multiSelectEnabled = enabled;
        console.log(`[INT.4] Multi-select: ${enabled ? 'enabled' : 'disabled'}`);
    }

    // [INT.4.1] Apply selection visual
    applySelectionVisual(mesh) {
        // Store original material
        if (!mesh.metadata) {
            mesh.metadata = {};
        }
        mesh.metadata.originalMaterial = mesh.material;

        // Apply highlight (simple emissive glow)
        if (mesh.material) {
            mesh.material.emissiveColor = this.selectionColor;
        }

        // Alternative: Use outline (requires rendering pipeline)
        // TODO: Implement outline renderer for better selection visual
    }

    // [INT.4.2] Remove selection visual
    removeSelectionVisual(mesh) {
        // Restore original material
        if (mesh.metadata && mesh.metadata.originalMaterial) {
            // Remove emissive glow
            if (mesh.material) {
                mesh.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
            }
        }
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Remove observers
        if (this.pointerMoveObserver) {
            this.scene.onPointerObservable.remove(this.pointerMoveObserver);
        }
        if (this.pointerDownObserver) {
            this.scene.onPointerObservable.remove(this.pointerDownObserver);
        }
        if (this.pointerUpObserver) {
            this.scene.onPointerObservable.remove(this.pointerUpObserver);
        }

        // Dispose highlight layer
        if (this.hoverHighlightLayer) {
            this.hoverHighlightLayer.dispose();
            this.hoverHighlightLayer = null;
        }

        // Clear all interactions
        this.hoverableMeshes.clear();
        this.clickableMeshes.clear();
        this.doubleClickMeshes.clear();
        this.rightClickMeshes.clear();
        this.draggableMeshes.clear();
        this.selectableMeshes.clear();
        this.deselectAll();

        super.dispose();

        console.log('[INT] InteractionPlugin disposed');
    }
}

// [INT] Export for registration with engine
export default InteractionPlugin;
