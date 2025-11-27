/**
 * @file PropertiesPlugin.js
 * @description Simple properties panel for editing object transforms
 *
 * @tags [PROPS.*] Properties panel
 * @primary-tags [PROPS] Properties plugin
 *
 * @dependencies
 *   - [PROPS -> PLG] Extends Plugin base class
 *   - [PROPS -> EVT] Listens to interaction events
 *   - [PROPS -> INT] Works with InteractionPlugin selection
 *
 * @features
 *   - Auto-show panel when object selected
 *   - Edit Position X/Y/Z with number inputs
 *   - Edit Rotation X/Y/Z in degrees
 *   - Edit Scale X/Y/Z
 *   - Real-time sync with object transforms
 *   - Bidirectional updates (panel ↔ object)
 *
 * @user-requirements
 *   1. Simple numeric inputs (not confusing gizmo buttons)
 *   2. Panel appears automatically on object selection
 *   3. Clear labels (Position/Rotation/Scale)
 *   4. Real-time sync with visual transforms
 *
 * @author Development Team
 * @created 2025-01-21
 */

import Plugin from '../core/Plugin.js';

// [PROPS] Properties panel plugin
// USER REQUIREMENT: Simple property editing without confusing UI
class PropertiesPlugin extends Plugin {
    constructor() {
        super('properties');

        // [PROPS.1] State
        this.selectedObject = null;
        this.panelElement = null;
        this.isVisible = false;

        // [PROPS.2] Input elements (cached for performance)
        this.inputs = {
            name: null,
            posX: null, posY: null, posZ: null,
            rotX: null, rotY: null, rotZ: null,
            scaleX: null, scaleY: null, scaleZ: null,
            // Physics
            mass: null, friction: null, restitution: null,
            glue: null
        };

        // [PROPS.3] Update interval
        this.syncInterval = null;

        console.log('[PROPS] PropertiesPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load properties configuration
        const propsConfig = config.properties || {};
        this.updateInterval = propsConfig.updateInterval || 100; // 100ms default

        console.log('[PROPS] PropertiesPlugin configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        super.start();

        // [PROPS.1] Find panel element
        this.panelElement = document.getElementById('propertiesPanel');

        if (!this.panelElement) {
            console.error('[PROPS] Properties panel element not found! Add #propertiesPanel to HTML.');
            return;
        }

        // [PROPS.2] Cache input elements
        this.cacheInputElements();

        // [PROPS.3] Setup event listeners
        this.setupEventListeners();

        // [PROPS.4] Start sync interval
        this.startSyncInterval();

        console.log('[PROPS] PropertiesPlugin started');
    }

    // [PROPS.2] Cache input element references
    cacheInputElements() {
        this.inputs.name = document.getElementById('propObjectName');
        this.inputs.posX = document.getElementById('propPosX');
        this.inputs.posY = document.getElementById('propPosY');
        this.inputs.posZ = document.getElementById('propPosZ');
        this.inputs.rotX = document.getElementById('propRotX');
        this.inputs.rotY = document.getElementById('propRotY');
        this.inputs.rotZ = document.getElementById('propRotZ');
        this.inputs.scaleX = document.getElementById('propScaleX');
        this.inputs.scaleY = document.getElementById('propScaleY');
        this.inputs.scaleZ = document.getElementById('propScaleZ');

        // Physics inputs
        this.inputs.mass = document.getElementById('propMass');
        this.inputs.friction = document.getElementById('propFriction');
        this.inputs.restitution = document.getElementById('propRestitution');
        this.inputs.glue = document.getElementById('propGlue');

        // Setup input change handlers
        if (this.inputs.posX) this.inputs.posX.addEventListener('change', () => this.onInputChange('position', 'x'));
        if (this.inputs.posY) this.inputs.posY.addEventListener('change', () => this.onInputChange('position', 'y'));
        if (this.inputs.posZ) this.inputs.posZ.addEventListener('change', () => this.onInputChange('position', 'z'));

        if (this.inputs.rotX) this.inputs.rotX.addEventListener('change', () => this.onInputChange('rotation', 'x'));
        if (this.inputs.rotY) this.inputs.rotY.addEventListener('change', () => this.onInputChange('rotation', 'y'));
        if (this.inputs.rotZ) this.inputs.rotZ.addEventListener('change', () => this.onInputChange('rotation', 'z'));

        if (this.inputs.scaleX) this.inputs.scaleX.addEventListener('change', () => this.onInputChange('scale', 'x'));
        if (this.inputs.scaleY) this.inputs.scaleY.addEventListener('change', () => this.onInputChange('scale', 'y'));
        if (this.inputs.scaleZ) this.inputs.scaleZ.addEventListener('change', () => this.onInputChange('scale', 'z'));

        // Physics handlers
        if (this.inputs.mass) this.inputs.mass.addEventListener('change', () => this.onPhysicsChange('mass'));
        if (this.inputs.friction) this.inputs.friction.addEventListener('change', () => this.onPhysicsChange('friction'));
        if (this.inputs.restitution) this.inputs.restitution.addEventListener('change', () => this.onPhysicsChange('restitution'));

        // Glue handler
        if (this.inputs.glue) this.inputs.glue.addEventListener('change', () => this.onGlueChange());

        // Setup increment/decrement button handlers
        this.setupIncrementButtons();

        // Setup material button handlers
        this.setupMaterialButtons();

        console.log('[PROPS.2] Input elements cached');
    }

    // [PROPS.2.1] Setup spinner button handlers
    setupIncrementButtons() {
        const spinnerButtons = this.panelElement.querySelectorAll('.spinner-btn');

        spinnerButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const inputId = button.getAttribute('data-input');
                const step = parseFloat(button.getAttribute('data-step'));
                const input = document.getElementById(inputId);

                if (input && !isNaN(step)) {
                    const currentValue = parseFloat(input.value) || 0;
                    const newValue = currentValue + step;

                    // Format based on step size
                    const decimalPlaces = Math.abs(step) < 1 ? 2 : 0;
                    input.value = newValue.toFixed(decimalPlaces);

                    // Trigger change event to update mesh
                    input.dispatchEvent(new Event('change'));
                }
            });
        });

        console.log('[PROPS.2.1] Spinner buttons setup complete');
    }

    // [PROPS.2.2] Setup material button handlers
    setupMaterialButtons() {
        // Find all material buttons with onclick attribute
        const materialButtons = this.panelElement.querySelectorAll('button[onclick^="applyMaterial"]');

        materialButtons.forEach(button => {
            // Extract material name from onclick attribute
            const onclickAttr = button.getAttribute('onclick');
            const match = onclickAttr.match(/applyMaterial\('(\w+)'\)/);

            if (match) {
                const materialName = match[1];

                // Remove onclick attribute
                button.removeAttribute('onclick');

                // Add click handler
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyMaterialToSelected(materialName);
                });
            }
        });

        console.log('[PROPS.2.2] Material buttons setup complete');
    }

    // [PROPS.2.3] Apply material to selected object
    applyMaterialToSelected(presetName) {
        if (!this.selectedObject) {
            console.warn('[PROPS.2.3] No object selected');
            return;
        }

        // Get MaterialPlugin
        const materialPlugin = this.scene.metadata?.materialPlugin ||
            window.engine?.plugins?.get('material');

        if (!materialPlugin) {
            console.error('[PROPS.2.3] MaterialPlugin not found');
            return;
        }

        // Create material from preset
        const material = materialPlugin.usePreset(presetName);

        if (material) {
            // Apply to selected object
            materialPlugin.applyMaterial(this.selectedObject, material);
            console.log(`[PROPS.2.3] Applied material "${presetName}" to ${this.selectedObject.name}`);
        }
    }

    // [PROPS.3] Setup event listeners
    setupEventListeners() {
        // Listen to selection events
        this.events.on('interaction:selected', (data) => {
            console.log('[PROPS.3] 📡 Received "interaction:selected" event:', data.name);
            this.showPanel(data.mesh);
        });

        this.events.on('interaction:deselected', (data) => {
            console.log('[PROPS.3] 📡 Received "interaction:deselected" event:', data.name);
            // Hide panel if no objects selected
            // Note: We need to check if there are other selected objects
            setTimeout(() => {
                const interactionPlugin = this.scene.metadata?.interactionPlugin;
                if (interactionPlugin && interactionPlugin.getSelected().length === 0) {
                    this.hidePanel();
                }
            }, 10); // Small delay to let selection state update
        });

        // Update panel when gizmo finishes dragging
        this.events.on('gizmo:drag:end', () => {
            console.log('[PROPS.3] 📡 Received "gizmo:drag:end" event');
            this.updatePanelValues();
        });

        console.log('[PROPS.3] ✓ Event listeners registered');
    }

    // [PROPS.4] Start real-time sync interval
    startSyncInterval() {
        this.syncInterval = setInterval(() => {
            if (this.isVisible && this.selectedObject) {
                this.updatePanelValues();
            }
        }, this.updateInterval);

        console.log('[PROPS.4] Sync interval started');
    }

    // [PROPS.5] Show properties panel
    showPanel(mesh) {
        console.log('[PROPS.5] ▶ showPanel() called for:', mesh?.name);

        if (!mesh) {
            console.log('[PROPS.5] ❌ No mesh provided');
            return;
        }

        if (!this.panelElement) {
            console.log('[PROPS.5] ❌ Panel element not found in DOM');
            return;
        }

        // Don't show for ground, skybox, or terrain chunks
        if (mesh.name === 'ground' || mesh.name === 'skybox' || mesh.name.startsWith('chunk_')) {
            console.log('[PROPS.5] ⚠ Skipping panel (ground/skybox/chunk)');
            return;
        }

        this.selectedObject = mesh;
        this.isVisible = true;

        // Show panel
        console.log('[PROPS.5] Adding "visible" class to panel element');
        this.panelElement.classList.add('visible');

        // Update values
        this.updatePanelValues();

        console.log(`[PROPS.5] ✅ Panel shown for: ${mesh.name}`);
    }

    // [PROPS.6] Hide properties panel
    hidePanel() {
        if (!this.panelElement) return;

        this.selectedObject = null;
        this.isVisible = false;

        // Hide panel
        this.panelElement.classList.remove('visible');

        console.log('[PROPS.6] Panel hidden');
    }

    // [PROPS.7] Update panel with object values
    updatePanelValues() {
        if (!this.selectedObject) return;

        const mesh = this.selectedObject;

        // Object name
        if (this.inputs.name) {
            this.inputs.name.value = mesh.name;
        }

        // Position
        if (this.inputs.posX) this.inputs.posX.value = mesh.position.x.toFixed(2);
        if (this.inputs.posY) this.inputs.posY.value = mesh.position.y.toFixed(2);
        if (this.inputs.posZ) this.inputs.posZ.value = mesh.position.z.toFixed(2);

        // Rotation (convert radians to degrees)
        if (this.inputs.rotX) this.inputs.rotX.value = (mesh.rotation.x * 180 / Math.PI).toFixed(0);
        if (this.inputs.rotY) this.inputs.rotY.value = (mesh.rotation.y * 180 / Math.PI).toFixed(0);
        if (this.inputs.rotZ) this.inputs.rotZ.value = (mesh.rotation.z * 180 / Math.PI).toFixed(0);

        // Scale
        if (this.inputs.scaleX) this.inputs.scaleX.value = mesh.scaling.x.toFixed(2);
        if (this.inputs.scaleY) this.inputs.scaleY.value = mesh.scaling.y.toFixed(2);
        if (this.inputs.scaleZ) this.inputs.scaleZ.value = mesh.scaling.z.toFixed(2);

        // Physics
        if (mesh.physicsBody) {
            const massProps = mesh.physicsBody.getMassProperties();
            if (this.inputs.mass) this.inputs.mass.value = massProps.mass.toFixed(2);
            // Note: Friction/Restitution are on the shape/material, harder to get directly from Havok body without metadata
            // We rely on metadata if available
            if (mesh.metadata?.physicsSettings) {
                if (this.inputs.friction) this.inputs.friction.value = mesh.metadata.physicsSettings.friction || 0.5;
                if (this.inputs.restitution) this.inputs.restitution.value = mesh.metadata.physicsSettings.restitution || 0.5;
            }
        }

        // Glue
        if (this.inputs.glue) {
            this.inputs.glue.checked = !!mesh.metadata?.isGlued;
        }
    }

    // [PROPS.8.1] Handle physics changes
    onPhysicsChange(property) {
        if (!this.selectedObject || !this.inputs[property]) return;

        const value = parseFloat(this.inputs[property].value);
        if (isNaN(value)) return;

        const mesh = this.selectedObject;
        const collisionPlugin = this.scene.metadata?.collisionPlugin || window.engine?.plugins?.get('collision');

        if (collisionPlugin && collisionPlugin.setPhysicsProperties) {
            collisionPlugin.setPhysicsProperties(mesh, { [property]: value });
        }
    }

    // [PROPS.8.2] Handle glue changes
    onGlueChange() {
        if (!this.selectedObject || !this.inputs.glue) return;

        const isGlued = this.inputs.glue.checked;
        const mesh = this.selectedObject;
        const groundPlugin = window.engine?.plugins?.get('ground');

        if (isGlued) {
            groundPlugin.glueObject(mesh);
        } else {
            groundPlugin.unglueObject(mesh);
        }
    }


    // [PROPS.8] Handle input changes
    onInputChange(type, axis) {
        if (!this.selectedObject) return;

        const mesh = this.selectedObject;
        let value;

        switch (type) {
            case 'position':
                value = parseFloat(this.inputs[`pos${axis.toUpperCase()}`].value);
                if (!isNaN(value)) {
                    mesh.position[axis] = value;
                }
                break;

            case 'rotation':
                value = parseFloat(this.inputs[`rot${axis.toUpperCase()}`].value);
                if (!isNaN(value)) {
                    // Convert degrees to radians
                    const radians = value * Math.PI / 180;

                    // [FIX] If physics body exists, we must rotate the body, not just the mesh
                    if (mesh.physicsBody) {
                        // Create quaternion from Euler angles
                        const currentRotation = mesh.rotationQuaternion ? mesh.rotationQuaternion.toEulerAngles() : mesh.rotation;
                        const newRotation = currentRotation.clone();
                        newRotation[axis] = radians;

                        const quaternion = BABYLON.Quaternion.FromEulerVector(newRotation);

                        // Set body transform
                        mesh.physicsBody.setTargetTransform(mesh.position, quaternion);

                        // Also update mesh rotation for immediate visual feedback (though physics will overwrite)
                        if (!mesh.rotationQuaternion) {
                            mesh.rotation = newRotation;
                        } else {
                            mesh.rotationQuaternion = quaternion;
                        }
                    } else {
                        mesh.rotation[axis] = radians;
                    }
                }
                break;

            case 'scale':
                value = parseFloat(this.inputs[`scale${axis.toUpperCase()}`].value);
                if (!isNaN(value)) {
                    mesh.scaling[axis] = value;
                }
                break;
        }

        console.log(`[PROPS.8] Updated ${mesh.name} ${type}.${axis} = ${value}`);

        // Emit event for other systems (e.g., undo/redo)
        this.events.emit('properties:changed', {
            mesh: mesh,
            type: type,
            axis: axis,
            value: value
        });
    }

    // [PROPS.9] Get currently selected object
    getSelectedObject() {
        return this.selectedObject;
    }

    // [PROPS.10] Check if panel is visible
    isShowing() {
        return this.isVisible;
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Clear sync interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Hide panel
        this.hidePanel();

        // Clear references
        this.selectedObject = null;
        this.panelElement = null;
        this.inputs = {};

        super.dispose();

        console.log('[PROPS] PropertiesPlugin disposed');
    }
}

export default PropertiesPlugin;
