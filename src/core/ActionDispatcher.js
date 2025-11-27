/**
 * @file ActionDispatcher.js
 * @description Centralized action routing system for decoupling Bootstrap from plugin logic
 * 
 * This dispatcher routes UI actions (data-action attributes) to their respective
 * plugins/modules, keeping Bootstrap.js light and the architecture modular.
 * 
 * Architecture:
 *   UI Event → Bootstrap → ActionDispatcher → Plugin/Module
 * 
 * Benefits:
 *   - Bootstrap.js stays light (just loads and wires things up)
 *   - Actions are handled by the plugins that own them
 *   - Easy to add new actions without modifying Bootstrap
 *   - Plugin isolation - each plugin defines its own actions
 *   - Future-ready for plugin architecture
 * 
 * @author Development Team
 * @created 2025-11-25
 */

export class ActionDispatcher {
    constructor(engine) {
        this.engine = engine;
        this.handlers = new Map();
        this.middlewares = [];

        console.log('[ActionDispatcher] Initialized');
    }

    /**
     * Initialize the dispatcher with engine plugins
     * Registers default handlers from plugins
     */
    init() {
        // Register handlers from plugins
        this.registerPluginActions();

        // Setup DOM event delegation
        this.setupEventDelegation();

        console.log(`[ActionDispatcher] Ready - ${this.handlers.size} handlers registered`);
    }

    /**
     * Register actions from all plugins
     * Each plugin can define getActions() to expose its action handlers
     */
    registerPluginActions() {
        // Core plugin actions
        this.registerGroundActions();
        this.registerPhysicsActions();
        this.registerSkyActions();
        this.registerLightingActions();
        this.registerShadowActions();
        this.registerCameraActions();
        this.registerObjectActions(); // [NEW] Object creation and glue
        this.registerModeActions();
    }

    // ==================== GROUND ACTIONS ====================

    registerGroundActions() {
        const groundPlugin = this.engine.plugins.get('ground');
        if (!groundPlugin) return;

        // Texture presets
        this.register('ground:texture', (value) => {
            if (groundPlugin.useTexturePreset) {
                groundPlugin.useTexturePreset(value);
            } else if (groundPlugin.setTexture) {
                groundPlugin.setTexture(value);
            }
        });

        // Texture tiling
        this.register('ground:tiling', (value) => {
            if (groundPlugin.setTextureTiling) {
                const scale = parseFloat(value);
                groundPlugin.setTextureTiling(scale, scale);
            }
        });

        // Rotation presets
        this.register('ground:preset:horizontal', () => groundPlugin.useRotationPreset?.('horizontal'));
        this.register('ground:preset:vertical', () => groundPlugin.useRotationPreset?.('vertical'));
        this.register('ground:preset:diagonal45', () => groundPlugin.useRotationPreset?.('diagonal45'));

        // Rotation sliders
        this.register('ground:rotate:x', (value) => this.updateGroundRotation('x', value));
        this.register('ground:rotate:y', (value) => this.updateGroundRotation('y', value));
        this.register('ground:rotate:z', (value) => this.updateGroundRotation('z', value));

        // Full scene rotation toggle
        this.register('ground:rotate:fullscene', (value) => {
            groundPlugin.setRotateFullScene?.(value);
        });

        // Edge behaviors
        ['stop', 'teleport', 'wrap', 'none'].forEach(behavior => {
            this.register(`ground:edge:${behavior}`, () => {
                groundPlugin.setEdgeBehavior?.(behavior);
            });
        });

        // Infinite terrain
        this.register('ground:infinite:toggle', (_, target) => {
            this.toggleInfiniteTerrain(target);
        });

        this.register('ground:infinite:viewdistance', (value) => {
            const plugin = this.engine.plugins.get('infiniteGround');
            plugin?.setViewDistance?.(parseInt(value));
        });

        this.register('ground:infinite:height', (value) => {
            const plugin = this.engine.plugins.get('infiniteGround');
            plugin?.setHeightVariation?.(value);
        });
    }

    updateGroundRotation(axis, degrees) {
        const groundPlugin = this.engine.plugins.get('ground');
        if (!groundPlugin) return;

        const radians = (parseFloat(degrees) || 0) * Math.PI / 180;
        const rotation = groundPlugin.getRotation();
        rotation[axis] = radians;
        groundPlugin.setRotation(rotation.x, rotation.y, rotation.z);
    }

    toggleInfiniteTerrain(button) {
        const infinitePlugin = this.engine.plugins.get('infiniteGround');
        if (!infinitePlugin) {
            console.warn('[ActionDispatcher] InfiniteGroundPlugin not loaded');
            return;
        }

        if (window.infiniteTerrainEnabled) {
            infinitePlugin.disable();
            window.infiniteTerrainEnabled = false;
            if (button) button.textContent = '🌍 Enable Infinite Terrain';
            document.getElementById('infiniteControls')?.style.setProperty('display', 'none');
        } else {
            infinitePlugin.enable();
            window.infiniteTerrainEnabled = true;
            if (button) button.textContent = '🛑 Disable Infinite Terrain';
            document.getElementById('infiniteControls')?.style.setProperty('display', 'block');
        }
    }

    // ==================== PHYSICS ACTIONS ====================

    registerPhysicsActions() {
        const gravityPlugin = this.engine.plugins.get('gravity');
        const collisionPlugin = this.engine.plugins.get('collision');

        // Gravity presets
        this.register('physics:gravity:preset', (value, target) => {
            if (gravityPlugin?.setPreset) {
                gravityPlugin.setPreset(value);
                this.highlightActiveButton(target);

                // Show/hide custom gravity controls
                const customControls = document.getElementById('customGravityControls');
                if (customControls) {
                    customControls.style.display = value === 'custom' ? 'block' : 'none';
                }
            }
        });

        // Custom gravity Y adjustment
        this.register('physics:gravity:y:increase', (_, target) => this.adjustGravityY(target, 1));
        this.register('physics:gravity:y:decrease', (_, target) => this.adjustGravityY(target, -1));

        // Collision mode
        this.register('physics:collision:mode', (value) => {
            collisionPlugin?.setCollisionMode?.(value);
        });

        // Camera collision
        this.register('physics:camera:collision', (value) => {
            const camera = this.engine.scene.activeCamera;
            if (camera) {
                camera.checkCollisions = value;
                console.log(`[ActionDispatcher] Camera collision: ${value}`);
            }
        });

        // Camera gravity
        this.register('physics:camera:gravity', (value) => {
            const camera = this.engine.scene.activeCamera;
            if (camera) camera.applyGravity = value;
        });

        // Camera height
        this.register('physics:camera:height', (value) => {
            const camera = this.engine.scene.activeCamera;
            if (camera?.ellipsoid) {
                camera.ellipsoid.y = parseFloat(value) || 1.0;
            }
        });

        // Debug visualization
        this.register('physics:debug:colliders', (value) => {
            console.log(`[ActionDispatcher] Debug colliders: ${value}`);
            // TODO: Implement debug visualization
        });

        this.register('physics:debug:forces', (value) => {
            console.log(`[ActionDispatcher] Debug forces: ${value}`);
            // TODO: Implement debug visualization
        });

        // Physics toggle
        this.register('physics:toggle:enabled', (value) => {
            console.log(`[ActionDispatcher] Physics toggle: ${value} (requires reload)`);
        });
    }

    adjustGravityY(target, direction) {
        const gravityPlugin = this.engine.plugins.get('gravity');
        if (!gravityPlugin) return;

        const input = document.getElementById('gravityYValue');
        if (input) {
            const step = parseFloat(target?.getAttribute('data-step')) || 1;
            const currentValue = parseFloat(input.value) || -9.81;
            const newValue = currentValue + (step * direction);
            input.value = newValue.toFixed(2);
            gravityPlugin.setGravity({ x: 0, y: newValue, z: 0 });
        }
    }

    // ==================== SKY ACTIONS ====================

    registerSkyActions() {
        const skyPlugin = this.engine.plugins.get('sky');
        if (!skyPlugin) return;

        this.register('sky:preset', (value) => {
            skyPlugin.usePreset?.(value);
        });
    }

    // ==================== LIGHTING ACTIONS ====================

    registerLightingActions() {
        const lightingPlugin = this.engine.plugins.get('lighting');
        if (!lightingPlugin) return;

        this.register('lighting:preset', (value) => {
            lightingPlugin.usePreset?.(value);
        });
    }

    // ==================== SHADOW ACTIONS ====================

    registerShadowActions() {
        const shadowPlugin = this.engine.plugins.get('shadow');
        if (!shadowPlugin) return;

        this.register('shadow:quality', (value) => {
            shadowPlugin.setQuality?.(value);
        });
    }

    // ==================== CAMERA ACTIONS ====================

    registerCameraActions() {
        const cameraPlugin = this.engine.plugins.get('camera');

        this.register('camera:type', (value) => {
            // Switch camera type
            cameraPlugin?.createCamera?.(value, 'main', this.engine.config.camera);
            cameraPlugin?.setActiveCamera?.('main');
        });

        this.register('camera:speed', (value) => {
            const camera = this.engine.scene.activeCamera;
            if (camera) camera.speed = parseFloat(value);
        });
    }

    // ==================== OBJECT ACTIONS ====================

    registerObjectActions() {
        // [OBJ.1] Add Object (Box, Sphere, etc.)
        this.register('object:add', (type) => {
            const scene = this.engine.scene;
            const collisionPlugin = this.engine.plugins.get('collision');
            const interactionPlugin = this.engine.plugins.get('interaction');

            // Random position above ground
            const x = (Math.random() - 0.5) * 10;
            const z = (Math.random() - 0.5) * 10;
            const y = 5 + Math.random() * 5;

            let mesh;
            const name = `${type}_${Date.now()}`;

            // Create mesh based on type
            switch (type) {
                case 'box':
                    mesh = BABYLON.MeshBuilder.CreateBox(name, { size: 2 }, scene);
                    break;
                case 'sphere':
                    mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 2 }, scene);
                    break;
                case 'cylinder':
                    mesh = BABYLON.MeshBuilder.CreateCylinder(name, { height: 2, diameter: 1 }, scene);
                    break;
                default:
                    console.warn(`[ActionDispatcher] Unknown object type: ${type}`);
                    return;
            }

            mesh.position.set(x, y, z);

            // [OBJ.1.5] CRITICAL: Create material BEFORE physics
            // This matches New3d's working implementation
            const material = new BABYLON.StandardMaterial(`mat_${name}`, scene);
            material.diffuseColor = new BABYLON.Color3(
                Math.random(),
                Math.random(),
                Math.random()
            );
            mesh.material = material;

            // [OBJ.2] Enable Physics & Collision
            if (collisionPlugin) {
                // Determine shape
                let shape = BABYLON.PhysicsShapeType.BOX;
                if (type === 'sphere') shape = BABYLON.PhysicsShapeType.SPHERE;
                if (type === 'cylinder') shape = BABYLON.PhysicsShapeType.CYLINDER;

                // Enable physics (Dynamic)
                collisionPlugin.enablePhysicsBody(mesh, {
                    mass: 1,
                    restitution: 0.6,
                    friction: 0.6,
                    shape: shape
                });

                // CRITICAL: Ensure camera collision is enabled (handled by CollisionPlugin fix, but good to be explicit)
                mesh.checkCollisions = true;
            }

            // [OBJ.3] Enable Interaction
            if (interactionPlugin) {
                interactionPlugin.makeHoverable(mesh);
                interactionPlugin.makeSelectable(mesh);
                interactionPlugin.makeDraggable(mesh);
            }

            console.log(`[ActionDispatcher] Created object: ${name}`);
        });

        // [OBJ.4] Glue All Objects
        this.register('object:glue:all', () => {
            const groundPlugin = this.engine.plugins.get('ground');
            if (groundPlugin) {
                groundPlugin.parentObjectsToGround();
            }
        });

        // [OBJ.5] Clear Objects
        this.register('object:clear', () => {
            const scene = this.engine.scene;
            // Filter for dynamic objects (exclude ground, skybox, camera)
            const objectsToRemove = scene.meshes.filter(m =>
                m.name !== 'ground' &&
                m.name !== 'skybox' &&
                m.name !== 'camera' &&
                !m.name.startsWith('chunk_') && // Don't delete terrain chunks
                m.physicsBody &&
                m.physicsBody.getMotionType() !== BABYLON.PhysicsMotionType.STATIC
            );

            objectsToRemove.forEach(m => m.dispose());
            console.log(`[ActionDispatcher] Cleared ${objectsToRemove.length} objects`);
        });
    }

    // ==================== MODE ACTIONS ====================

    registerModeActions() {
        this.register('mode:toggle', () => {
            const currentMode = this.engine.scene.metadata?.mode || 'edit';
            const newMode = currentMode === 'edit' ? 'view' : 'edit';
            this.setMode(newMode);
        });

        this.register('mode:edit', () => this.setMode('edit'));
        this.register('mode:view', () => this.setMode('view'));
    }

    setMode(newMode) {
        const scene = this.engine.scene;

        // Update metadata
        scene.metadata = scene.metadata || {};
        scene.metadata.mode = newMode;

        // Emit event
        this.engine.events?.emit('mode:changed', { mode: newMode });

        // Update UI
        const btn = document.getElementById('modeToggleBtn');
        const controlPanel = document.querySelector('.control-panel');
        const propertiesPanel = document.querySelector('.properties-panel');

        if (newMode === 'view') {
            controlPanel?.classList.add('hidden');
            propertiesPanel?.classList.add('hidden');
            document.body.classList.add('view-mode');
            document.body.classList.remove('edit-mode');
            if (btn) btn.innerHTML = '✏️ Switch to Edit Mode (Tab)';
        } else {
            controlPanel?.classList.remove('hidden');
            propertiesPanel?.classList.remove('hidden');
            document.body.classList.add('edit-mode');
            document.body.classList.remove('view-mode');
            if (btn) btn.innerHTML = '👁️ Switch to View Mode (Tab)';
        }

        // Update InputManager context
        this.engine.inputManager?.setContext(newMode);

        console.log(`[ActionDispatcher] Mode switched to: ${newMode}`);
    }

    // ==================== CORE DISPATCHER METHODS ====================

    /**
     * Register an action handler
     * @param {string} action - Action name (e.g., 'ground:texture')
     * @param {Function} handler - Handler function (value, target, event) => void
     */
    register(action, handler) {
        this.handlers.set(action, handler);
    }

    /**
     * Unregister an action handler
     * @param {string} action - Action name
     */
    unregister(action) {
        this.handlers.delete(action);
    }

    /**
     * Dispatch an action
     * @param {string} action - Action name
     * @param {*} value - Action value
     * @param {HTMLElement} target - Target element
     * @param {Event} event - Original event
     */
    dispatch(action, value, target, event) {
        // Run middlewares
        for (const middleware of this.middlewares) {
            const result = middleware(action, value, target, event);
            if (result === false) {
                console.log(`[ActionDispatcher] Action blocked by middleware: ${action}`);
                return;
            }
        }

        // Find and execute handler
        const handler = this.handlers.get(action);
        if (handler) {
            try {
                handler(value, target, event);
                console.log(`[ActionDispatcher] ✓ ${action} = ${value}`);
            } catch (error) {
                console.error(`[ActionDispatcher] Error in ${action}:`, error);
            }
        } else {
            console.warn(`[ActionDispatcher] No handler for action: ${action}`);
        }
    }

    /**
     * Add middleware (runs before handlers)
     * @param {Function} middleware - (action, value, target, event) => boolean
     */
    use(middleware) {
        this.middlewares.push(middleware);
    }

    /**
     * Setup DOM event delegation
     */
    setupEventDelegation() {
        // Click events
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');
            const value = target.getAttribute('data-value');
            this.dispatch(action, value, target, e);
        });

        // Change events (checkboxes, selects)
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (!target.hasAttribute('data-action')) return;

            const action = target.getAttribute('data-action');
            const value = target.type === 'checkbox'
                ? target.checked
                : (target.value || target.getAttribute('data-value'));
            this.dispatch(action, value, target, e);
        });

        // Input events (sliders, text inputs)
        document.addEventListener('input', (e) => {
            const target = e.target;
            if (!target.hasAttribute('data-action')) return;

            const action = target.getAttribute('data-action');
            const value = target.value;
            this.dispatch(action, value, target, e);
        });
    }

    /**
     * Highlight active button in a group
     * @param {HTMLElement} button
     */
    highlightActiveButton(button) {
        if (!button?.parentElement) return;

        const siblings = button.parentElement.querySelectorAll('button');
        siblings.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    }

    /**
     * Dispose dispatcher
     */
    dispose() {
        this.handlers.clear();
        this.middlewares = [];
        console.log('[ActionDispatcher] Disposed');
    }
}

export default ActionDispatcher;

