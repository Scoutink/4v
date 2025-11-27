/**
 * InputManager - Central coordinator for all user input
 *
 * @class InputManager
 * @extends EventEmitter
 *
 * @description
 * Single source of truth for all input handling. Routes hardware input
 * through contexts to generate abstract actions that applications respond to.
 *
 * Key Features:
 * - Unified input handling (keyboard, mouse, touch, gamepad, VR)
 * - Context-aware (different modes have different controls)
 * - Priority-based (UI blocks 3D, modals block everything)
 * - Conflict-free (automatic conflict prevention)
 * - Query API (check action state, get values)
 *
 * Architecture:
 * Hardware → InputSource → InputManager → InputContext → Action → Application
 *
 * @example
 * const inputManager = new InputManager(scene, canvas);
 * inputManager.registerContext('view', new ViewModeContext());
 * inputManager.setContext('view');
 * inputManager.on('action:moveForward', () => camera.position.z += 0.1);
 *
 * @tags [INP.1]
 * @version 1.0.0
 * @author 3D CMS Input Team
 */

import EventEmitter from '../core/EventEmitter.js';

export default class InputManager extends EventEmitter {
    /**
     * [INP.1] Constructor - Initialize InputManager
     *
     * @param {BABYLON.Scene} scene - Babylon.js scene
     * @param {HTMLCanvasElement} canvas - Render canvas
     */
    constructor(scene, canvas) {
        super();

        // [INP.1.1] Core references
        this.scene = scene;
        this.canvas = canvas;

        // [INP.1.2] Input sources (hardware listeners)
        // Map<string, InputSource>
        this.sources = new Map();

        // [INP.1.3] Contexts (modes)
        // Map<string, InputContext>
        this.contexts = new Map();
        this.activeContext = null;

        // [INP.1.4] Priority layers (high to low priority)
        this.layers = [
            {
                name: 'modal',
                active: false,
                blocking: true,
                priority: 100,
                description: 'Modal dialogs block all input'
            },
            {
                name: 'ui',
                active: false,
                blocking: true,
                priority: 50,
                description: 'UI elements block 3D input'
            },
            {
                name: '3d',
                active: true,
                blocking: false,
                priority: 0,
                description: '3D scene input (default)'
            }
        ];

        // [INP.1.5] Action states (for queries)
        // Map<string, ActionState>
        this.actionStates = new Map();

        // [INP.1.6] Filters configuration
        this.filters = {
            deadZone: 0.1,      // Ignore inputs below this threshold
            smoothing: 0.2,     // Smoothing factor for analog inputs (0-1)
            enabled: true       // Enable/disable filtering
        };

        // [INP.1.7] Debug mode
        this.debug = true;  // FORENSIC INVESTIGATION MODE

        // [INP.1.8] Statistics
        this.stats = {
            inputsProcessed: 0,
            actionsTriggered: 0,
            inputsBlocked: 0,
            contextSwitches: 0
        };

        console.log('[INP.1] InputManager initialized');
    }

    // =========================================================================
    // Context Management
    // =========================================================================

    /**
     * [INP.1] Register a context (mode)
     *
     * @param {string} name - Context name (e.g., 'view', 'edit', 'vr')
     * @param {InputContext} context - Context instance
     *
     * @example
     * inputManager.registerContext('view', new ViewModeContext());
     */
    registerContext(name, context) {
        if (this.contexts.has(name)) {
            console.warn(`[INP.1] Context '${name}' already registered, replacing`);
        }

        // Give context reference to this manager
        context.inputManager = this;

        this.contexts.set(name, context);

        console.log(`[INP.1] Context registered: ${name}`);
    }

    /**
     * [INP.1] Switch to different context
     *
     * @param {string} contextName - Name of context to activate
     * @returns {boolean} Success
     *
     * @example
     * inputManager.setContext('edit'); // Switch to edit mode
     */
    setContext(contextName) {
        const newContext = this.contexts.get(contextName);

        if (!newContext) {
            console.error(`[INP.1] Context not found: ${contextName}`);
            return false;
        }

        // [INP.1.1] Deactivate old context
        if (this.activeContext) {
            this.activeContext.deactivate();

            if (this.debug) {
                console.log(`[INP.1] Deactivated context: ${this.activeContext.name}`);
            }
        }

        // [INP.1.2] Activate new context
        const previousContext = this.activeContext;
        this.activeContext = newContext;
        this.activeContext.activate();

        // [INP.1.3] Update statistics
        this.stats.contextSwitches++;

        // [INP.1.4] Emit context change event
        this.emit('context:changed', {
            from: previousContext?.name || null,
            to: contextName,
            timestamp: Date.now()
        });

        console.log(`[INP.1] Context switched to: ${contextName}`);
        return true;
    }

    /**
     * [INP.1] Get active context
     *
     * @returns {InputContext|null}
     */
    getActiveContext() {
        return this.activeContext;
    }

    /**
     * [INP.1] Get context by name
     *
     * @param {string} name - Context name
     * @returns {InputContext|null}
     */
    getContext(name) {
        return this.contexts.get(name) || null;
    }

    // =========================================================================
    // Input Handling
    // =========================================================================

    /**
     * [INP.1] Handle raw input from source
     *
     * Called by InputSource when hardware input detected.
     * Routes input through context to generate actions.
     *
     * @param {string} sourceName - Source that generated input
     * @param {Object} event - Raw input event
     * @param {string} event.source - Source name
     * @param {string} event.input - Input identifier (e.g., 'KeyW', 'LeftClick')
     * @param {string} event.state - Input state ('pressed', 'released', 'moved', etc.)
     * @param {*} [event.value] - Optional value (analog inputs)
     * @param {Object} [event.modifiers] - Modifier keys (Ctrl, Shift, Alt)
     * @param {Object} [event.hitInfo] - Raycast hit information (mouse/touch)
     *
     * @example
     * inputManager.handleInput('keyboard', {
     *     source: 'keyboard',
     *     input: 'KeyW',
     *     state: 'pressed',
     *     modifiers: { Ctrl: false, Shift: false, Alt: false }
     * });
     */
    handleInput(sourceName, event) {
        // [INP.1.1] Update statistics
        this.stats.inputsProcessed++;

        // [INP.1.2] Debug logging
        if (this.debug) {
            console.log(`[INP.1] Input from ${sourceName}:`, event.input, event.state);
        }

        // [INP.1.3] Check if input blocked by higher priority layer
        if (this.isBlocked(event)) {
            this.stats.inputsBlocked++;

            if (this.debug) {
                console.log(`[INP.1] Input blocked by priority layer`);
            }
            return;
        }

        // [INP.1.4] Route to active context
        if (!this.activeContext) {
            console.warn('[INP.1] No active context, input ignored');
            return;
        }

        const action = this.activeContext.mapInputToAction(event);

        if (action) {
            this.triggerAction(action);
        } else {
            if (this.debug) {
                console.log(`[INP.1] No action mapped for input: ${event.input}`);
            }
        }
    }

    /**
     * [INP.1] Check if input is blocked by priority layer
     *
     * @param {Object} event - Input event
     * @returns {boolean} True if blocked
     */
    isBlocked(event) {
        // [INP.1.1] UI elements block 3D input
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
        )) {
            if (this.debug) {
                console.log('[INP.1] Input blocked by UI element:', activeElement.tagName);
            }
            return true;
        }

        // [INP.1.2] Check priority layers (sorted high to low)
        const sortedLayers = [...this.layers].sort((a, b) => b.priority - a.priority);

        for (const layer of sortedLayers) {
            if (layer.active && layer.blocking) {
                // This layer is active and blocking lower layers
                if (this.debug) {
                    console.log(`[INP.1] Input blocked by layer: ${layer.name}`);
                }
                return true;
            }
        }

        return false;
    }

    /**
     * [INP.1] Trigger an abstract action
     *
     * Processes action value through filters, updates state,
     * and emits events for application to respond.
     *
     * @param {Object} action - Action to trigger
     * @param {string} action.name - Action name (e.g., 'moveForward')
     * @param {string} action.state - Action state ('pressed', 'released', etc.)
     * @param {*} [action.value] - Action value (for analog inputs)
     * @param {string} action.source - Source that generated action
     * @param {Object} [action.hitInfo] - Hit information (for picking actions)
     */
    triggerAction(action) {
        // [FORENSIC] Log all actions, especially lookAround
        if (action.name === 'lookAround') {
            console.log(`[FORENSIC-ACTION] 🎯 lookAround triggered! | delta: (${action.delta?.x}, ${action.delta?.y}) | state: ${action.state}`);
        }

        // [INP.1.1] Apply filters (dead zone, smoothing, etc.)
        if (action.value !== undefined && this.filters.enabled) {
            action.value = this.applyFilters(action);
        }

        // [INP.1.2] Update action state
        this.actionStates.set(action.name, {
            ...action,
            timestamp: Date.now()
        });

        // [INP.1.3] Update statistics
        this.stats.actionsTriggered++;

        // [INP.1.4] Emit specific action event
        this.emit(`action:${action.name}`, action);

        // [INP.1.5] Emit general action event
        this.emit('action', action);

        // [INP.1.6] Debug logging
        if (this.debug) {
            console.log(`[INP.1] Action triggered: ${action.name}`, action);
        }
    }

    /**
     * [INP.1] Apply processing filters to action value
     *
     * @param {Object} action - Action with value to filter
     * @returns {*} Filtered value
     */
    applyFilters(action) {
        let value = action.value;

        // [INP.1.1] Dead zone (ignore small inputs)
        if (typeof value === 'number') {
            if (Math.abs(value) < this.filters.deadZone) {
                if (this.debug) {
                    console.log(`[INP.1] Value ${value} below dead zone ${this.filters.deadZone}, zeroed`);
                }
                return 0;
            }
        }

        // [INP.1.2] Smoothing (for analog inputs)
        if (action.filters?.smoothing !== undefined) {
            const prevState = this.actionStates.get(action.name);
            if (prevState && prevState.value !== undefined) {
                const prev = prevState.value;
                const smoothFactor = action.filters.smoothing;
                value = prev + (value - prev) * smoothFactor;

                if (this.debug) {
                    console.log(`[INP.1] Smoothing applied: ${prev} → ${value}`);
                }
            }
        }

        // [INP.1.3] Custom curve (acceleration/deceleration)
        if (action.filters?.curve && typeof action.filters.curve === 'function') {
            const originalValue = value;
            value = action.filters.curve(value);

            if (this.debug) {
                console.log(`[INP.1] Curve applied: ${originalValue} → ${value}`);
            }
        }

        return value;
    }

    // =========================================================================
    // Query API
    // =========================================================================

    /**
     * [INP.1] Query if action is currently pressed/active
     *
     * @param {string} actionName - Name of action
     * @returns {boolean}
     *
     * @example
     * if (inputManager.isActionPressed('jump')) {
     *     // Handle jump
     * }
     */
    isActionPressed(actionName) {
        const action = this.actionStates.get(actionName);

        if (!action) {
            return false;
        }

        // Check if action is pressed or held
        return action.state === 'pressed' || action.state === 'held';
    }

    /**
     * [INP.1] Get current value of action (for analog inputs)
     *
     * @param {string} actionName - Name of action
     * @returns {*} Action value or null
     *
     * @example
     * const moveVector = inputManager.getActionValue('move');
     * if (moveVector) {
     *     camera.position.x += moveVector.x;
     *     camera.position.z += moveVector.z;
     * }
     */
    getActionValue(actionName) {
        const action = this.actionStates.get(actionName);
        return action?.value ?? null;
    }

    /**
     * [INP.1] Get full action state
     *
     * @param {string} actionName - Name of action
     * @returns {Object|null} Full action state
     */
    getActionState(actionName) {
        return this.actionStates.get(actionName) || null;
    }

    /**
     * [INP.1] Clear action state (force action to inactive)
     *
     * @param {string} actionName - Name of action
     */
    clearActionState(actionName) {
        this.actionStates.delete(actionName);

        if (this.debug) {
            console.log(`[INP.1] Action state cleared: ${actionName}`);
        }
    }

    /**
     * [INP.1] Clear all action states
     */
    clearAllActionStates() {
        this.actionStates.clear();

        if (this.debug) {
            console.log('[INP.1] All action states cleared');
        }
    }

    // =========================================================================
    // Layer Management
    // =========================================================================

    /**
     * [INP.1] Set priority layer active/inactive
     *
     * @param {string} layerName - Layer name ('modal', 'ui', '3d')
     * @param {boolean} active - Active state
     *
     * @example
     * inputManager.setLayerActive('ui', true);  // UI blocks 3D input
     * inputManager.setLayerActive('ui', false); // UI no longer blocks
     */
    setLayerActive(layerName, active) {
        const layer = this.layers.find(l => l.name === layerName);

        if (!layer) {
            console.error(`[INP.1] Layer not found: ${layerName}`);
            return;
        }

        layer.active = active;

        this.emit('layer:changed', {
            layer: layerName,
            active: active,
            timestamp: Date.now()
        });

        console.log(`[INP.1] Layer '${layerName}' set to: ${active}`);
    }

    /**
     * [INP.1] Get layer state
     *
     * @param {string} layerName - Layer name
     * @returns {Object|null} Layer configuration
     */
    getLayer(layerName) {
        return this.layers.find(l => l.name === layerName) || null;
    }

    /**
     * [INP.1] Get all layers
     *
     * @returns {Array} All layers
     */
    getLayers() {
        return [...this.layers];
    }

    // =========================================================================
    // Source Management
    // =========================================================================

    /**
     * [INP.1] Register input source
     *
     * @param {string} name - Source name
     * @param {InputSource} source - Source instance
     */
    registerSource(name, source) {
        if (this.sources.has(name)) {
            console.warn(`[INP.1] Source '${name}' already registered, replacing`);
        }

        this.sources.set(name, source);

        console.log(`[INP.1] Source registered: ${name}`);
    }

    /**
     * [INP.1] Get source by name
     *
     * @param {string} name - Source name
     * @returns {InputSource|null}
     */
    getSource(name) {
        return this.sources.get(name) || null;
    }

    /**
     * [INP.1] Enable source
     *
     * @param {string} name - Source name
     */
    enableSource(name) {
        const source = this.sources.get(name);
        if (source && source.enable) {
            source.enable();
        }
    }

    /**
     * [INP.1] Disable source
     *
     * @param {string} name - Source name
     */
    disableSource(name) {
        const source = this.sources.get(name);
        if (source && source.disable) {
            source.disable();
        }
    }

    // =========================================================================
    // Debug & Statistics
    // =========================================================================

    /**
     * [INP.1] Enable debug mode
     */
    enableDebug() {
        this.debug = true;
        console.log('[INP.1] Debug mode enabled');
    }

    /**
     * [INP.1] Disable debug mode
     */
    disableDebug() {
        this.debug = false;
        console.log('[INP.1] Debug mode disabled');
    }

    /**
     * [INP.1] Get statistics
     *
     * @returns {Object} Statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * [INP.1] Reset statistics
     */
    resetStats() {
        this.stats = {
            inputsProcessed: 0,
            actionsTriggered: 0,
            inputsBlocked: 0,
            contextSwitches: 0
        };

        console.log('[INP.1] Statistics reset');
    }

    // =========================================================================
    // Filter Configuration
    // =========================================================================

    /**
     * [INP.1] Set filter configuration
     *
     * @param {Object} config - Filter configuration
     * @param {number} [config.deadZone] - Dead zone threshold
     * @param {number} [config.smoothing] - Smoothing factor
     * @param {boolean} [config.enabled] - Enable/disable filtering
     */
    setFilters(config) {
        this.filters = { ...this.filters, ...config };

        console.log('[INP.1] Filters updated:', this.filters);
    }

    /**
     * [INP.1] Get filter configuration
     *
     * @returns {Object} Filter configuration
     */
    getFilters() {
        return { ...this.filters };
    }

    // =========================================================================
    // Disposal
    // =========================================================================

    /**
     * [INP.1] Cleanup and dispose
     *
     * Removes all event listeners, disposes sources, clears state.
     * Call when InputManager is no longer needed.
     */
    dispose() {
        // [INP.1.1] Dispose all sources
        for (const [name, source] of this.sources.entries()) {
            if (source.dispose) {
                source.dispose();
                console.log(`[INP.1] Disposed source: ${name}`);
            }
        }
        this.sources.clear();

        // [INP.1.2] Deactivate context
        if (this.activeContext) {
            this.activeContext.deactivate();
            this.activeContext = null;
        }

        // [INP.1.3] Clear contexts
        this.contexts.clear();

        // [INP.1.4] Clear action states
        this.actionStates.clear();

        // [INP.1.5] Remove all event listeners
        this.removeAllListeners();

        // [INP.1.6] Clear statistics
        this.resetStats();

        console.log('[INP.1] InputManager disposed');
    }
}
