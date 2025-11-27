/**
 * ModuleBase - Base class for all Legozo modules
 *
 * Provides:
 * - Lifecycle hooks (init, start, stop, dispose)
 * - Dependency declaration and management
 * - Event system integration
 * - Configuration management
 * - State management
 * - Error handling
 *
 * All modules should extend this class and implement required methods.
 *
 * @example
 * class GroundModule extends ModuleBase {
 *     constructor() {
 *         super('ground', '1.0.0');
 *     }
 *
 *     get dependencies() {
 *         return ['camera', 'lighting'];
 *     }
 *
 *     async init(engine, config) {
 *         await super.init(engine, config);
 *         // Module-specific initialization
 *     }
 * }
 */

export class ModuleBase {
    /**
     * Create a module
     * @param {string} name - Module name (must be unique)
     * @param {string} version - Module version (semver format)
     * @param {Object} options - Module options
     */
    constructor(name, version = '1.0.0', options = {}) {
        if (!name) {
            throw new Error('[ModuleBase] Module name is required');
        }

        this._name = name;
        this._version = version;
        this._options = options;

        // State
        this._state = 'uninitialized'; // uninitialized → initializing → initialized → starting → started → stopping → stopped → disposed
        this._engine = null;
        this._config = null;
        this._moduleState = {};
        this._errors = [];

        // Event system
        this._eventHandlers = new Map();

        // Performance tracking
        this._metrics = {
            initTime: 0,
            startTime: 0,
            lastUpdateTime: 0
        };

        console.log(`[Module] ${this._name} v${this._version} created`);
    }

    // ==================== GETTERS ====================

    /**
     * Get module name
     * @returns {string}
     */
    get name() {
        return this._name;
    }

    /**
     * Get module version
     * @returns {string}
     */
    get version() {
        return this._version;
    }

    /**
     * Get module dependencies (override in subclass)
     * @returns {string[]} Array of module names this module depends on
     */
    get dependencies() {
        return [];
    }

    /**
     * Get module state
     * @returns {string} Current state
     */
    get state() {
        return this._state;
    }

    /**
     * Check if module is initialized
     * @returns {boolean}
     */
    get isInitialized() {
        return this._state === 'initialized' || this._state === 'starting' || this._state === 'started';
    }

    /**
     * Check if module is started
     * @returns {boolean}
     */
    get isStarted() {
        return this._state === 'started';
    }

    /**
     * Check if module is disposed
     * @returns {boolean}
     */
    get isDisposed() {
        return this._state === 'disposed';
    }

    /**
     * Get module errors
     * @returns {Array}
     */
    get errors() {
        return this._errors;
    }

    /**
     * Get module metrics
     * @returns {Object}
     */
    get metrics() {
        return this._metrics;
    }

    // ==================== LIFECYCLE HOOKS ====================

    /**
     * Initialize module
     * Called after dependencies are loaded
     * @param {Object} engine - Babylon engine instance
     * @param {Object} config - Module configuration
     * @returns {Promise<void>}
     */
    async init(engine, config = {}) {
        if (this._state !== 'uninitialized') {
            throw new Error(`[${this._name}] Cannot init: already ${this._state}`);
        }

        this._setState('initializing');
        const startTime = performance.now();

        try {
            console.log(`[${this._name}] Initializing...`);

            // Store references
            this._engine = engine;
            this._config = { ...this.getDefaultConfig(), ...config };

            // Emit init event
            this.emit('module:init:start', { module: this._name });

            // Validate dependencies
            await this._validateDependencies();

            // Allow subclass to initialize
            await this._onInit();

            // Mark as initialized
            this._setState('initialized');
            this._metrics.initTime = performance.now() - startTime;

            console.log(`[${this._name}] Initialized in ${this._metrics.initTime.toFixed(2)}ms`);
            this.emit('module:init:complete', { module: this._name, time: this._metrics.initTime });

        } catch (error) {
            this._handleError('init', error);
            this._setState('uninitialized');
            throw error;
        }
    }

    /**
     * Start module
     * Called when module should begin operating
     * @returns {Promise<void>}
     */
    async start() {
        if (this._state !== 'initialized') {
            throw new Error(`[${this._name}] Cannot start: must be initialized (currently ${this._state})`);
        }

        this._setState('starting');
        const startTime = performance.now();

        try {
            console.log(`[${this._name}] Starting...`);

            this.emit('module:start:start', { module: this._name });

            // Allow subclass to start
            await this._onStart();

            this._setState('started');
            this._metrics.startTime = performance.now() - startTime;

            console.log(`[${this._name}] Started in ${this._metrics.startTime.toFixed(2)}ms`);
            this.emit('module:start:complete', { module: this._name, time: this._metrics.startTime });

        } catch (error) {
            this._handleError('start', error);
            this._setState('initialized');
            throw error;
        }
    }

    /**
     * Stop module
     * Pause module operation (can be restarted)
     * @returns {Promise<void>}
     */
    async stop() {
        if (this._state !== 'started') {
            console.warn(`[${this._name}] Stop called but not started (currently ${this._state})`);
            return;
        }

        this._setState('stopping');

        try {
            console.log(`[${this._name}] Stopping...`);

            this.emit('module:stop:start', { module: this._name });

            // Allow subclass to stop
            await this._onStop();

            this._setState('stopped');

            console.log(`[${this._name}] Stopped`);
            this.emit('module:stop:complete', { module: this._name });

        } catch (error) {
            this._handleError('stop', error);
            throw error;
        }
    }

    /**
     * Dispose module
     * Cleanup and destroy (cannot be restarted)
     * @returns {void}
     */
    dispose() {
        if (this._state === 'disposed') {
            console.warn(`[${this._name}] Already disposed`);
            return;
        }

        try {
            console.log(`[${this._name}] Disposing...`);

            this.emit('module:dispose:start', { module: this._name });

            // Allow subclass to cleanup
            this._onDispose();

            // Clear event handlers
            this._eventHandlers.clear();

            // Clear references
            this._engine = null;
            this._config = null;
            this._moduleState = null;

            this._setState('disposed');

            console.log(`[${this._name}] Disposed`);

        } catch (error) {
            this._handleError('dispose', error);
            throw error;
        }
    }

    // ==================== LIFECYCLE OVERRIDES (Protected) ====================

    /**
     * Override in subclass: Module-specific initialization
     * @protected
     * @returns {Promise<void>}
     */
    async _onInit() {
        // Override in subclass
    }

    /**
     * Override in subclass: Module-specific start
     * @protected
     * @returns {Promise<void>}
     */
    async _onStart() {
        // Override in subclass
    }

    /**
     * Override in subclass: Module-specific stop
     * @protected
     * @returns {Promise<void>}
     */
    async _onStop() {
        // Override in subclass
    }

    /**
     * Override in subclass: Module-specific disposal
     * @protected
     * @returns {void}
     */
    _onDispose() {
        // Override in subclass
    }

    // ==================== CONFIGURATION ====================

    /**
     * Get default configuration (override in subclass)
     * @returns {Object}
     */
    getDefaultConfig() {
        return {};
    }

    /**
     * Get configuration value
     * @param {string} key - Config key (supports dot notation)
     * @param {*} defaultValue - Default value if not found
     * @returns {*}
     */
    getConfig(key, defaultValue = null) {
        if (!this._config) return defaultValue;

        const keys = key.split('.');
        let value = this._config;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * Update configuration
     * @param {string} key - Config key
     * @param {*} value - New value
     */
    setConfig(key, value) {
        if (!this._config) {
            this._config = {};
        }

        const keys = key.split('.');
        let obj = this._config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in obj)) {
                obj[k] = {};
            }
            obj = obj[k];
        }

        obj[keys[keys.length - 1]] = value;

        this.emit('module:config:changed', { key, value });
    }

    // ==================== STATE MANAGEMENT ====================

    /**
     * Get module state data
     * @returns {Object}
     */
    getState() {
        return { ...this._moduleState };
    }

    /**
     * Set module state data
     * @param {Object} state - State object
     */
    setState(state) {
        this._moduleState = { ...this._moduleState, ...state };
        this.emit('module:state:changed', { state: this._moduleState });
    }

    /**
     * Clear module state
     */
    clearState() {
        this._moduleState = {};
        this.emit('module:state:cleared');
    }

    // ==================== EVENT SYSTEM ====================

    /**
     * Subscribe to event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @returns {Function} Unsubscribe function
     */
    on(event, handler) {
        if (!this._eventHandlers.has(event)) {
            this._eventHandlers.set(event, []);
        }

        this._eventHandlers.get(event).push(handler);

        // Return unsubscribe function
        return () => this.off(event, handler);
    }

    /**
     * Unsubscribe from event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler to remove
     */
    off(event, handler) {
        if (!this._eventHandlers.has(event)) return;

        const handlers = this._eventHandlers.get(event);
        const index = handlers.indexOf(handler);

        if (index !== -1) {
            handlers.splice(index, 1);
        }

        if (handlers.length === 0) {
            this._eventHandlers.delete(event);
        }
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data = {}) {
        // Emit to module's own handlers
        if (this._eventHandlers.has(event)) {
            const handlers = this._eventHandlers.get(event);
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`[${this._name}] Error in event handler for ${event}:`, error);
                }
            });
        }

        // Emit to global event bus (if engine available)
        if (this._engine && this._engine.events) {
            this._engine.events.emit(event, { ...data, source: this._name });
        }
    }

    // ==================== UTILITIES (Protected) ====================

    /**
     * Set module lifecycle state
     * @protected
     * @param {string} state - New state
     */
    _setState(state) {
        const oldState = this._state;
        this._state = state;

        console.log(`[${this._name}] State: ${oldState} → ${state}`);
        this.emit('module:state:transition', { from: oldState, to: state });
    }

    /**
     * Validate module dependencies
     * @protected
     * @returns {Promise<void>}
     */
    async _validateDependencies() {
        const deps = this.dependencies;

        if (!deps || deps.length === 0) {
            return; // No dependencies
        }

        const missing = [];

        for (const dep of deps) {
            const depModule = this._engine.getPlugin(dep);
            if (!depModule) {
                missing.push(dep);
            }
        }

        if (missing.length > 0) {
            throw new Error(`[${this._name}] Missing dependencies: ${missing.join(', ')}`);
        }

        console.log(`[${this._name}] Dependencies validated: ${deps.join(', ')}`);
    }

    /**
     * Handle module error
     * @protected
     * @param {string} phase - Lifecycle phase where error occurred
     * @param {Error} error - Error object
     */
    _handleError(phase, error) {
        const errorInfo = {
            phase,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        this._errors.push(errorInfo);

        console.error(`[${this._name}] Error in ${phase}:`, error);
        this.emit('module:error', errorInfo);
    }

    /**
     * Get module dependency
     * @protected
     * @param {string} name - Dependency module name
     * @returns {Object|null}
     */
    _getDependency(name) {
        if (!this._engine) return null;
        return this._engine.getPlugin(name);
    }

    // ==================== DEBUG ====================

    /**
     * Get debug info
     * @returns {Object}
     */
    getDebugInfo() {
        return {
            name: this._name,
            version: this._version,
            state: this._state,
            dependencies: this.dependencies,
            isInitialized: this.isInitialized,
            isStarted: this.isStarted,
            metrics: this._metrics,
            errorCount: this._errors.length,
            eventHandlerCount: this._eventHandlers.size
        };
    }

    /**
     * Print debug info to console
     */
    debug() {
        console.table(this.getDebugInfo());
    }
}

export default ModuleBase;
