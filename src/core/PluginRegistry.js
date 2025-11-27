/**
 * @file PluginRegistry.js
 * @description Plugin Registry for managing external and internal plugins
 * 
 * This registry provides a unified interface for:
 * - Registering plugins (internal and external)
 * - Plugin lifecycle management
 * - Plugin dependency injection
 * - Plugin communication via events
 * - Plugin hooks system
 * 
 * Future plugin architecture support:
 * - External plugins can be loaded from URLs
 * - Plugins can extend core functionality
 * - Plugins have access to defined APIs
 * - Plugins can hook into system events
 * 
 * @example
 * // Creating an external plugin
 * class MyPlugin extends PluginBase {
 *     static get manifest() {
 *         return {
 *             name: 'my-plugin',
 *             version: '1.0.0',
 *             description: 'My custom plugin',
 *             author: 'Developer',
 *             dependencies: ['camera', 'ground'],
 *             hooks: ['object:created', 'scene:loaded']
 *         };
 *     }
 * 
 *     onObjectCreated(mesh) {
 *         // Hook into object creation
 *     }
 * }
 * 
 * // Registering external plugin
 * registry.registerExternal(MyPlugin);
 * 
 * @author Development Team
 * @created 2025-11-25
 */

export class PluginRegistry {
    constructor(engine) {
        this.engine = engine;
        
        // Plugin storage
        this.internal = new Map();   // Built-in plugins
        this.external = new Map();   // External/third-party plugins
        this.pending = new Map();    // Plugins waiting for dependencies
        
        // Hook system
        this.hooks = new Map();      // hookName → [handler1, handler2, ...]
        
        // Plugin APIs exposed to external plugins
        this.apis = new Map();
        
        // Plugin lifecycle states
        this.states = new Map();     // pluginName → state
        
        console.log('[PluginRegistry] Initialized');
    }

    /**
     * Initialize the registry
     * Exposes core APIs to plugins
     */
    init() {
        this.exposeAPIs();
        this.setupCoreHooks();
        console.log('[PluginRegistry] Ready');
    }

    /**
     * Expose core APIs for plugins to use
     */
    exposeAPIs() {
        // Scene API
        this.apis.set('scene', {
            get: () => this.engine.scene,
            getMeshByName: (name) => this.engine.scene.getMeshByName(name),
            getMeshes: () => this.engine.scene.meshes,
            createMesh: (type, name, options) => this.createMesh(type, name, options)
        });

        // Camera API
        this.apis.set('camera', {
            get: () => this.engine.scene.activeCamera,
            setPosition: (pos) => {
                const cam = this.engine.scene.activeCamera;
                if (cam) cam.position.set(pos.x, pos.y, pos.z);
            },
            getPosition: () => {
                const cam = this.engine.scene.activeCamera;
                return cam ? { x: cam.position.x, y: cam.position.y, z: cam.position.z } : null;
            }
        });

        // Events API
        this.apis.set('events', {
            on: (event, handler) => this.engine.events.on(event, handler),
            off: (event, handler) => this.engine.events.off(event, handler),
            emit: (event, data) => this.engine.events.emit(event, data),
            once: (event, handler) => this.engine.events.once(event, handler)
        });

        // UI API
        this.apis.set('ui', {
            addPanel: (config) => this.addUIPanel(config),
            removePanel: (id) => this.removeUIPanel(id),
            showNotification: (message, type) => this.showNotification(message, type)
        });

        // Storage API (for plugin settings)
        this.apis.set('storage', {
            get: (key) => this.getPluginStorage(key),
            set: (key, value) => this.setPluginStorage(key, value),
            remove: (key) => this.removePluginStorage(key)
        });

        // Ground API
        this.apis.set('ground', {
            getPlugin: () => this.engine.plugins.get('ground'),
            setTexture: (url) => this.engine.plugins.get('ground')?.setTexture(url),
            setRotation: (x, y, z) => this.engine.plugins.get('ground')?.setRotation(x, y, z)
        });

        // Physics API
        this.apis.set('physics', {
            getPlugin: () => this.engine.plugins.get('collision'),
            enableCollision: (mesh, options) => this.engine.plugins.get('collision')?.enableSimpleCollision(mesh, options),
            enablePhysics: (mesh, options) => this.engine.plugins.get('collision')?.enablePhysicsBody(mesh, options),
            setGravity: (preset) => this.engine.plugins.get('gravity')?.setPreset(preset)
        });

        console.log(`[PluginRegistry] Exposed ${this.apis.size} APIs`);
    }

    /**
     * Setup core hooks that plugins can listen to
     */
    setupCoreHooks() {
        const coreHooks = [
            'engine:initialized',
            'engine:started',
            'engine:disposed',
            'scene:loaded',
            'scene:cleared',
            'object:created',
            'object:deleted',
            'object:selected',
            'object:deselected',
            'mode:changed',
            'camera:moved',
            'ground:rotated',
            'ground:textureChanged',
            'gravity:changed',
            'render:frame'
        ];

        for (const hook of coreHooks) {
            this.hooks.set(hook, []);
            
            // Subscribe to engine events and forward to plugin hooks
            this.engine.events.on(hook, (data) => {
                this.triggerHook(hook, data);
            });
        }

        console.log(`[PluginRegistry] Registered ${coreHooks.length} core hooks`);
    }

    /**
     * Get an API by name
     * @param {string} name - API name
     * @returns {Object|null} API object
     */
    getAPI(name) {
        return this.apis.get(name) || null;
    }

    /**
     * Register an internal (built-in) plugin
     * @param {string} name - Plugin name
     * @param {Object} plugin - Plugin instance
     */
    registerInternal(name, plugin) {
        this.internal.set(name, plugin);
        this.states.set(name, 'registered');
        console.log(`[PluginRegistry] Internal plugin registered: ${name}`);
    }

    /**
     * Register an external plugin
     * @param {Function} PluginClass - Plugin class (must extend PluginBase)
     * @returns {boolean} Success
     */
    registerExternal(PluginClass) {
        // Validate plugin has manifest
        if (!PluginClass.manifest) {
            console.error('[PluginRegistry] External plugin must have static manifest property');
            return false;
        }

        const manifest = PluginClass.manifest;
        const { name, version, dependencies = [] } = manifest;

        if (!name || !version) {
            console.error('[PluginRegistry] Plugin manifest must have name and version');
            return false;
        }

        // Check if already registered
        if (this.external.has(name)) {
            console.warn(`[PluginRegistry] Plugin '${name}' already registered`);
            return false;
        }

        // Check dependencies
        const missingDeps = dependencies.filter(dep => 
            !this.internal.has(dep) && !this.external.has(dep)
        );

        if (missingDeps.length > 0) {
            console.warn(`[PluginRegistry] Plugin '${name}' has missing dependencies: ${missingDeps.join(', ')}`);
            this.pending.set(name, { PluginClass, missingDeps });
            this.states.set(name, 'pending');
            return false;
        }

        // Create and initialize plugin
        try {
            const plugin = new PluginClass();
            
            // Inject APIs
            plugin.$apis = {};
            for (const [apiName, api] of this.apis) {
                plugin.$apis[apiName] = api;
            }

            // Initialize plugin
            if (plugin.init) {
                plugin.init(this.engine.scene, this.engine.events, this.engine.config);
            }

            // Register hooks
            if (manifest.hooks) {
                for (const hookName of manifest.hooks) {
                    const handlerName = 'on' + hookName.split(':').map(s => 
                        s.charAt(0).toUpperCase() + s.slice(1)
                    ).join('');
                    
                    if (typeof plugin[handlerName] === 'function') {
                        this.registerHook(hookName, plugin[handlerName].bind(plugin));
                    }
                }
            }

            // Store plugin
            this.external.set(name, plugin);
            this.states.set(name, 'active');

            // Try to activate pending plugins
            this.checkPending();

            console.log(`[PluginRegistry] ✓ External plugin loaded: ${name} v${version}`);
            
            // Emit plugin loaded event
            this.engine.events.emit('plugin:loaded', { name, version, type: 'external' });

            return true;
        } catch (error) {
            console.error(`[PluginRegistry] Failed to initialize plugin '${name}':`, error);
            this.states.set(name, 'error');
            return false;
        }
    }

    /**
     * Register a hook handler
     * @param {string} hookName - Hook name
     * @param {Function} handler - Handler function
     */
    registerHook(hookName, handler) {
        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }
        this.hooks.get(hookName).push(handler);
    }

    /**
     * Trigger a hook
     * @param {string} hookName - Hook name
     * @param {*} data - Data to pass to handlers
     */
    triggerHook(hookName, data) {
        const handlers = this.hooks.get(hookName);
        if (!handlers || handlers.length === 0) return;

        for (const handler of handlers) {
            try {
                handler(data);
            } catch (error) {
                console.error(`[PluginRegistry] Error in hook '${hookName}':`, error);
            }
        }
    }

    /**
     * Check pending plugins for resolved dependencies
     */
    checkPending() {
        for (const [name, { PluginClass }] of this.pending) {
            const manifest = PluginClass.manifest;
            const dependencies = manifest.dependencies || [];
            
            const missingDeps = dependencies.filter(dep => 
                !this.internal.has(dep) && !this.external.has(dep)
            );

            if (missingDeps.length === 0) {
                this.pending.delete(name);
                this.registerExternal(PluginClass);
            }
        }
    }

    /**
     * Load external plugin from URL
     * @param {string} url - Plugin script URL
     * @returns {Promise<boolean>} Success
     */
    async loadFromURL(url) {
        try {
            console.log(`[PluginRegistry] Loading plugin from: ${url}`);
            
            const module = await import(url);
            const PluginClass = module.default;
            
            if (!PluginClass) {
                console.error('[PluginRegistry] Plugin module must have default export');
                return false;
            }

            return this.registerExternal(PluginClass);
        } catch (error) {
            console.error(`[PluginRegistry] Failed to load plugin from URL:`, error);
            return false;
        }
    }

    /**
     * Unload an external plugin
     * @param {string} name - Plugin name
     * @returns {boolean} Success
     */
    unload(name) {
        const plugin = this.external.get(name);
        if (!plugin) {
            console.warn(`[PluginRegistry] Plugin '${name}' not found`);
            return false;
        }

        // Call dispose if available
        if (plugin.dispose) {
            try {
                plugin.dispose();
            } catch (error) {
                console.error(`[PluginRegistry] Error disposing plugin '${name}':`, error);
            }
        }

        // Remove from registry
        this.external.delete(name);
        this.states.set(name, 'unloaded');

        // Emit plugin unloaded event
        this.engine.events.emit('plugin:unloaded', { name });

        console.log(`[PluginRegistry] Plugin unloaded: ${name}`);
        return true;
    }

    /**
     * Get plugin by name (internal or external)
     * @param {string} name - Plugin name
     * @returns {Object|null} Plugin instance
     */
    get(name) {
        return this.internal.get(name) || this.external.get(name) || null;
    }

    /**
     * Get plugin state
     * @param {string} name - Plugin name
     * @returns {string|null} State
     */
    getState(name) {
        return this.states.get(name) || null;
    }

    /**
     * List all plugins
     * @returns {Object} { internal: [], external: [], pending: [] }
     */
    list() {
        return {
            internal: Array.from(this.internal.keys()),
            external: Array.from(this.external.keys()),
            pending: Array.from(this.pending.keys())
        };
    }

    // ==================== Helper Methods ====================

    createMesh(type, name, options = {}) {
        const scene = this.engine.scene;
        let mesh;

        switch (type) {
            case 'box':
                mesh = BABYLON.MeshBuilder.CreateBox(name, options, scene);
                break;
            case 'sphere':
                mesh = BABYLON.MeshBuilder.CreateSphere(name, options, scene);
                break;
            case 'cylinder':
                mesh = BABYLON.MeshBuilder.CreateCylinder(name, options, scene);
                break;
            case 'plane':
                mesh = BABYLON.MeshBuilder.CreatePlane(name, options, scene);
                break;
            default:
                console.warn(`[PluginRegistry] Unknown mesh type: ${type}`);
                return null;
        }

        // Emit object created hook
        this.triggerHook('object:created', { mesh, type });

        return mesh;
    }

    addUIPanel(config) {
        // TODO: Implement UI panel creation for plugins
        console.log('[PluginRegistry] UI panel creation:', config);
        return `panel_${Date.now()}`;
    }

    removeUIPanel(id) {
        // TODO: Implement UI panel removal
        console.log('[PluginRegistry] UI panel removal:', id);
    }

    showNotification(message, type = 'info') {
        console.log(`[PluginRegistry] Notification (${type}): ${message}`);
        // Could emit event for UI to display
        this.engine.events.emit('ui:notification', { message, type });
    }

    getPluginStorage(key) {
        try {
            const data = localStorage.getItem(`legozo_plugin_${key}`);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    setPluginStorage(key, value) {
        try {
            localStorage.setItem(`legozo_plugin_${key}`, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }

    removePluginStorage(key) {
        try {
            localStorage.removeItem(`legozo_plugin_${key}`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Dispose registry
     */
    dispose() {
        // Unload all external plugins
        for (const name of this.external.keys()) {
            this.unload(name);
        }

        // Clear storage
        this.internal.clear();
        this.external.clear();
        this.pending.clear();
        this.hooks.clear();
        this.apis.clear();
        this.states.clear();

        console.log('[PluginRegistry] Disposed');
    }
}

export default PluginRegistry;

