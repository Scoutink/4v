/**
 * @file BabylonEngine.js
 * @description Core engine orchestrator - manages plugins, scene, render loop
 *
 * @tags [ENG.*] All engine tags
 * @primary-tags [!ENG.1] Engine initialization (CRITICAL)
 * @critical-tags [!ENG.1.3] Scene creation - all plugins depend on this
 *
 * @dependencies
 *   - [ENG -> EVT] EventEmitter for plugin communication
 *   - [ENG -> PLG] Plugin base class
 *   - [ENG -> CFG] ConfigLoader for configuration
 *   - Babylon.js library (external)
 *
 * @affects All plugins (provides scene, events, config)
 *
 * @events
 *   - Emits: engine:initialized, engine:started, engine:stopped, plugin:registered
 *   - Also emits: render:frame (every frame), window:resize
 *
 * @author Development Team
 * @created 2025-10-31
 */

import EventEmitter from './EventEmitter.js';
import InputManager from '../input/InputManager.js';
import KeyboardSource from '../input/sources/KeyboardSource.js';
import MouseSource from '../input/sources/MouseSource.js';
import TouchSource from '../input/sources/TouchSource.js';
import ViewModeContext from '../input/contexts/ViewModeContext.js';
import EditModeContext from '../input/contexts/EditModeContext.js';

// [ENG] Core Babylon engine wrapper and plugin orchestrator
// [!ENG.1] CRITICAL: All plugins depend on this for scene access
class BabylonEngine {
    // [ENG.1] Engine initialization
    // [ENG.1.1] Canvas setup
    // [ENG.1.2] Babylon.js engine creation
    // [!ENG.1.3] Scene creation (all plugins need this)
    constructor(canvas, config = {}) {
        // [ENG.1.1] Store canvas reference
        // [ENG.1.1 -> CAM.3.2] Camera needs canvas for attachControl
        if (!canvas) {
            throw new Error('[ENG.1.1] Canvas element required');
        }
        this.canvas = canvas;

        // [ENG.1] Store configuration
        // [CFG.1] Configuration from ConfigLoader or direct object
        this.config = config;

        // [!EVT.1] Create event emitter for plugin communication
        // [EVT.1] All plugins use this for inter-plugin events
        this.events = new EventEmitter();

        // [ENG.2] Plugin storage
        // Format: Map { 'pluginName' => pluginInstance }
        this.plugins = new Map();

        // [ENG.1.2] Create Babylon.js engine
        // [ENG.1.2] Anti-aliasing enabled for better visual quality
        const engineOptions = config.engineOptions || {
            antialias: true,
            preserveDrawingBuffer: true
        };

        this.engine = new BABYLON.Engine(canvas, true, engineOptions);

        // [!ENG.1.3] CRITICAL: Create scene
        // [ENG.1.3 -> PLG.1.2] All plugins receive this scene reference
        // [ENG.1.3] Scene is foundation for all 3D objects
        this.scene = new BABYLON.Scene(this.engine);

        // [CRITICAL FIX] Enable collision system - REQUIRED for camera collision
        // Without this, camera.checkCollisions and mesh.checkCollisions don't work
        this.scene.collisionsEnabled = true;

        // [GRAVITY] Set initial scene gravity from config or use default
        // This is separate from physics engine gravity (Havok)
        // Camera.applyGravity uses scene.gravity, physics bodies use physics engine gravity
        const gravityConfig = config.gravity || {};
        const gravityPreset = gravityConfig.preset || 'arcade';
        
        // Gravity presets for scene (used by camera.applyGravity)
        const gravityPresets = {
            earth: new BABYLON.Vector3(0, -0.5, 0),    // Strong gravity (scaled for camera movement)
            moon: new BABYLON.Vector3(0, -0.08, 0),   // Low gravity
            mars: new BABYLON.Vector3(0, -0.19, 0),   // Medium gravity
            zeroG: new BABYLON.Vector3(0, 0, 0),      // No gravity
            arcade: new BABYLON.Vector3(0, -0.2, 0),  // Light arcade gravity (default)
            custom: new BABYLON.Vector3(0, -0.3, 0)   // Custom default
        };
        
        this.scene.gravity = gravityPresets[gravityPreset] || gravityPresets.arcade;

        console.log(`[ENG.1.3] ✅ Scene created - collisions enabled, gravity: ${gravityPreset} (${this.scene.gravity.y})`);

        // [ENG.1.3] Expose scene globally for debugging and external access
        // WARNING: Global scope pollution, but useful for development
        if (typeof window !== 'undefined') {
            window.__babylonScene = this.scene;
        }

        // [INP.1] Initialize InputManager
        // [INP.1 -> ENG.2.2] InputManager will be passed to plugins
        // [INP.1] Centralized input handling for all modes (View, Edit, VR, AR, etc.)
        this.inputManager = new InputManager(this.scene, this.canvas);

        // [INP.3] Register input sources
        // [INP.3.1] Keyboard - key press/release, modifiers, repeat detection
        const keyboardSource = new KeyboardSource(this.inputManager);
        this.inputManager.registerSource('keyboard', keyboardSource);

        // [INP.3.2] Mouse - clicks, movement, wheel, 3D raycasting
        const mouseSource = new MouseSource(this.inputManager, this.scene, this.canvas);
        this.inputManager.registerSource('mouse', mouseSource);

        // [INP.3.3] Touch - gestures (tap, swipe, pinch, long-press), multi-touch
        const touchSource = new TouchSource(this.inputManager, this.canvas);
        this.inputManager.registerSource('touch', touchSource);

        // [INP.2] Register input contexts
        // [INP.2.1] View mode - camera controls, click-to-move, zoom
        const viewContext = new ViewModeContext();
        this.inputManager.registerContext('view', viewContext);

        // [INP.2.2] Edit mode - all view controls + object manipulation
        const editContext = new EditModeContext();
        this.inputManager.registerContext('edit', editContext);

        // [INP.1] Set default context to view mode
        this.inputManager.setContext('view');

        // [INP.1] Expose InputManager globally for debugging
        if (typeof window !== 'undefined') {
            window.__inputManager = this.inputManager;
        }

        console.log('[INP.1] InputManager initialized with keyboard, mouse, touch sources');
        console.log('[INP.2] Registered contexts: view, edit');

        // [ENG.1] Engine state
        this.running = false;
        this.initialized = true;

        // [EVT.2] Emit engine initialized
        this.events.emit('engine:initialized', {
            engine: this,
            scene: this.scene
        });

        console.log(`[ENG.1] Babylon Engine initialized - Version: ${BABYLON.Engine.Version}`);
    }

    // [ENG.2] Register a plugin
    // [ENG.2.1] Validate plugin
    // [ENG.2.2] Initialize plugin with scene, events, config
    // [PLG.2] Manages plugin lifecycle
    registerPlugin(name, plugin) {
        // [ENG.2.1] Validate plugin name
        if (!name || typeof name !== 'string') {
            throw new Error('[ENG.2.1] Plugin name must be a non-empty string');
        }

        // [ENG.2.1] Check for duplicate registration
        if (this.plugins.has(name)) {
            throw new Error(`[ENG.2.1] Plugin '${name}' already registered`);
        }

        // [ENG.2.1] Validate plugin has required methods
        if (typeof plugin.init !== 'function' || typeof plugin.start !== 'function') {
            throw new Error(`[ENG.2.1] Plugin '${name}' must have init() and start() methods`);
        }

        // [ENG.2] Store plugin
        this.plugins.set(name, plugin);

        // [!ENG.2.2] Initialize plugin
        // [ENG.2.2 -> PLG.1.2] Pass scene, events, config, inputManager to plugin
        // [PLG.1.2] Plugin stores these references
        // [INP.1 -> PLG.1.2] Plugins can access InputManager for listening to actions
        plugin.init(this.scene, this.events, this.config, this.inputManager);

        // [EVT.2] Emit plugin registered event
        this.events.emit('plugin:registered', {
            name,
            plugin
        });

        console.log(`[ENG.2] Plugin registered: ${name}`);

        return this; // Allow chaining
    }

    // [ENG.2.1] Get plugin by name
    // [ENG.2.1] Allows plugins to access other plugins
    getPlugin(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            console.warn(`[ENG.2.1] Plugin '${name}' not found`);
        }
        return plugin;
    }

    // [ENG.2.1] Check if plugin is registered
    hasPlugin(name) {
        return this.plugins.has(name);
    }

    // [ENG.3] Start the engine
    // [ENG.3.1] Start render loop
    // [ENG.3.2] Setup window resize handling
    // [PLG.1.3] Calls start() on all plugins
    start() {
        if (this.running) {
            console.warn('[ENG.3] Engine already running');
            return;
        }

        // [PLG.1.3] Start all plugins in registration order
        // [PLG.1.3] Each plugin's start() called before render loop
        for (const [name, plugin] of this.plugins) {
            if (plugin.start && typeof plugin.start === 'function') {
                try {
                    plugin.start();
                    console.log(`[ENG.3] Plugin started: ${name}`);
                } catch (error) {
                    console.error(`[ENG.3] Error starting plugin '${name}':`, error);
                }
            }
        }

        // [!ENG.3.1] Start render loop
        // [ENG.3.1 -> PRF.1] Performance monitoring watches this
        // PERFORMANCE: Runs at monitor refresh rate (typically 60 FPS)
        this.engine.runRenderLoop(() => {
            // [ENG.3.1] Render scene every frame
            this.scene.render();

            // [EVT.2] Emit frame event for plugins
            // [MOV.3 -> EVT.2] MovementPlugin listens for this
            // [PRF.1 -> EVT.2] PerformancePlugin monitors this
            this.events.emit('render:frame', {
                fps: this.engine.getFps(),
                deltaTime: this.engine.getDeltaTime()
            });
        });

        // [ENG.3.2] Handle window resize
        // [ENG.3.2 -> CAM.2] Camera may need viewport update
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', () => {
                this.engine.resize();

                // [EVT.2] Emit resize event
                this.events.emit('window:resize', {
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            });
        }

        this.running = true;

        // [EVT.2] Emit engine started event
        this.events.emit('engine:started', {
            engine: this
        });

        console.log('[ENG.3] Engine started - render loop active');
    }

    // [ENG.3] Stop the engine
    // [ENG.3] Stops render loop but doesn't dispose resources
    stop() {
        if (!this.running) {
            console.warn('[ENG.3] Engine not running');
            return;
        }

        // [ENG.3] Stop render loop
        this.engine.stopRenderLoop();
        this.running = false;

        // [EVT.2] Emit engine stopped event
        this.events.emit('engine:stopped', {
            engine: this
        });

        console.log('[ENG.3] Engine stopped');
    }

    // [ENG.4] Dispose engine and cleanup
    // [ENG.4 -> PLG.1.5] Dispose all plugins
    // [ENG.4] Cleanup all resources
    dispose() {
        console.log('[ENG.4] Disposing engine...');

        // [ENG.4] Stop render loop if running
        if (this.running) {
            this.stop();
        }

        // [PLG.1.5] Dispose all plugins
        for (const [name, plugin] of this.plugins) {
            if (plugin.dispose && typeof plugin.dispose === 'function') {
                try {
                    plugin.dispose();
                    console.log(`[ENG.4] Plugin disposed: ${name}`);
                } catch (error) {
                    console.error(`[ENG.4] Error disposing plugin '${name}':`, error);
                }
            }
        }

        // [ENG.4] Clear plugin map
        this.plugins.clear();

        // [INP.1] Dispose InputManager
        // [INP.1] Removes all event listeners and cleans up input sources
        if (this.inputManager) {
            this.inputManager.dispose();
            this.inputManager = null;
        }

        // [ENG.4] Dispose Babylon scene and engine
        if (this.scene) {
            this.scene.dispose();
        }
        if (this.engine) {
            this.engine.dispose();
        }

        // [ENG.4] Clear references
        this.scene = null;
        this.engine = null;
        this.canvas = null;
        this.initialized = false;

        // [EVT.1.3] Clear all event listeners
        this.events.clear();

        console.log('[ENG.4] Engine disposed');
    }

    // [ENG.1] Get current scene
    getScene() {
        return this.scene;
    }

    // [ENG.1] Get Babylon engine
    getEngine() {
        return this.engine;
    }

    // [ENG.1] Get event emitter
    getEvents() {
        return this.events;
    }

    // [INP.1] Get InputManager
    // [INP.1 -> PLG.*] Plugins can access InputManager for listening to actions
    getInputManager() {
        return this.inputManager;
    }

    // [ENG.1] Check if engine is running
    isRunning() {
        return this.running;
    }

    // [ENG.1] Get current FPS
    getFps() {
        return this.engine ? this.engine.getFps() : 0;
    }
}

// [ENG.1] Export for use in applications
export default BabylonEngine;
