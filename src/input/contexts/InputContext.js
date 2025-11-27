/**
 * InputContext - Base class for input contexts (modes)
 *
 * @class InputContext
 * @abstract
 *
 * @description
 * Base class for all input contexts. A context defines what hardware inputs
 * mean in a specific mode (View, Edit, VR, etc.).
 *
 * Responsibilities:
 * - Map hardware inputs to abstract actions
 * - Define bindings for the mode
 * - Check conditions for actions
 * - Activate/deactivate mode
 *
 * Input Binding Format:
 * {
 *     input: 'KeyW',                    // Hardware input identifier
 *     action: 'moveForward',            // Abstract action name
 *     condition: 'optional',            // Optional condition check
 *     modifier: 'Ctrl',                 // Optional required modifier
 *     filters: {                        // Optional processing filters
 *         deadZone: 0.1,
 *         smoothing: 0.2,
 *         curve: (v) => v * v          // Acceleration curve
 *     }
 * }
 *
 * @example
 * class ViewModeContext extends InputContext {
 *     constructor() {
 *         super('view');
 *         this.bindings = [
 *             { input: 'KeyW', action: 'moveForward' },
 *             { input: 'LeftClick', action: 'walkTo', condition: 'clickGround' }
 *         ];
 *     }
 * }
 *
 * @tags [INP.2]
 * @version 1.0.0
 */

export default class InputContext {
    /**
     * [INP.2] Constructor
     *
     * @param {string} name - Context name (e.g., 'view', 'edit')
     */
    constructor(name) {
        // [INP.2.1] Core properties
        this.name = name;
        this.inputManager = null;  // Set by InputManager when registered
        this.active = false;

        // [INP.2.2] Input bindings
        // Array of { input, action, condition, modifier, filters }
        this.bindings = [];

        // [INP.2.3] Observers (for cleanup)
        this.observers = [];

        console.log(`[INP.2] ${this.name} context initialized`);
    }

    /**
     * [INP.2] Activate this context
     *
     * Called when InputManager switches to this context.
     * Override in subclasses to add custom activation logic.
     */
    activate() {
        this.active = true;
        console.log(`[INP.2] ${this.name} context activated`);
    }

    /**
     * [INP.2] Deactivate this context
     *
     * Called when InputManager switches away from this context.
     * Override in subclasses to add custom deactivation logic.
     */
    deactivate() {
        this.active = false;
        console.log(`[INP.2] ${this.name} context deactivated`);
    }

    /**
     * [INP.2] Map hardware input to abstract action
     *
     * Finds matching binding and returns action if conditions met.
     *
     * @param {Object} event - Standardized input event from source
     * @returns {Object|null} Action object or null
     */
    mapInputToAction(event) {
        // [INP.2.1] Find matching bindings
        for (const binding of this.bindings) {
            if (this.matchesBinding(event, binding)) {
                // [INP.2.2] Create action from binding
                return {
                    name: binding.action,
                    value: event.value,
                    state: event.state,
                    source: event.source,
                    input: event.input,
                    position: event.position,
                    delta: event.delta,
                    hitInfo: event.hitInfo,
                    modifiers: event.modifiers,
                    filters: binding.filters,
                    originalEvent: event.originalEvent
                };
            }
        }

        return null;
    }

    /**
     * [INP.2] Check if event matches binding
     *
     * @param {Object} event - Input event
     * @param {Object} binding - Binding configuration
     * @returns {boolean}
     */
    matchesBinding(event, binding) {
        // [INP.2.1] Check input matches
        if (event.input !== binding.input) {
            return false;
        }

        // [INP.2.2] Check state matches (if binding specifies a state)
        // This prevents actions from triggering multiple times on press/clicked/released
        if (binding.state && event.state !== binding.state) {
            return false;
        }

        // [INP.2.3] Check required modifier
        if (binding.modifier) {
            // Modifier can be single string or array
            const requiredModifiers = Array.isArray(binding.modifier)
                ? binding.modifier
                : [binding.modifier];

            for (const mod of requiredModifiers) {
                if (!event.modifiers || !event.modifiers[mod]) {
                    return false;
                }
            }
        }

        // [INP.2.4] Check condition
        if (binding.condition) {
            const conditionMet = this.checkCondition(binding.condition, event);
            if (!conditionMet) {
                return false;
            }
        }

        return true;
    }

    /**
     * [INP.2] Check if condition is met
     *
     * Override in subclasses to add custom conditions.
     *
     * @param {string} condition - Condition name
     * @param {Object} event - Input event
     * @returns {boolean}
     */
    checkCondition(condition, event) {
        switch (condition) {
            // Common conditions

            case 'clickGround':
                // Click on ground mesh
                return event.hitInfo?.pickedMesh?.name === 'ground';

            case 'clickMesh':
                // Click on any mesh except ground
                return event.hitInfo?.pickedMesh &&
                       event.hitInfo.pickedMesh.name !== 'ground';

            case 'clickEmpty':
                // Click on nothing
                return !event.hitInfo?.hit;

            case 'hasSelection':
                // Has selected objects (check global state)
                return window.selectedObjects?.length > 0;

            case 'noSelection':
                // No selected objects
                return !window.selectedObjects || window.selectedObjects.length === 0;

            // Mouse button conditions (for drag operations)

            case 'rightClickHeld':
                // Right mouse button is held during movement AND dragging has started
                return event.heldButton === 'RightClick' && event.isDragging === true;

            case 'leftClickHeld':
                // Left mouse button is held during movement AND dragging has started
                // This ensures camera only rotates AFTER the 5px drag threshold is exceeded
                return event.heldButton === 'LeftClick' && event.isDragging === true;

            case 'middleClickHeld':
                // Middle mouse button is held during movement AND dragging has started
                return event.heldButton === 'MiddleClick' && event.isDragging === true;

            default:
                console.warn(`[INP.2] Unknown condition: ${condition}`);
                return true;
        }
    }

    /**
     * [INP.2] Add input binding
     *
     * @param {Object} binding - Binding configuration
     */
    addBinding(binding) {
        this.bindings.push(binding);
    }

    /**
     * [INP.2] Remove input binding
     *
     * @param {string} input - Input identifier
     * @param {string} action - Action name
     */
    removeBinding(input, action) {
        this.bindings = this.bindings.filter(
            b => !(b.input === input && b.action === action)
        );
    }

    /**
     * [INP.2] Get all bindings
     *
     * @returns {Array} Bindings
     */
    getBindings() {
        return [...this.bindings];
    }

    /**
     * [INP.2] Get binding for action
     *
     * @param {string} actionName - Action name
     * @returns {Object|null} Binding or null
     */
    getBindingForAction(actionName) {
        return this.bindings.find(b => b.action === actionName) || null;
    }

    /**
     * [INP.2] Check if context is active
     *
     * @returns {boolean}
     */
    isActive() {
        return this.active;
    }

    /**
     * [INP.2] Dispose and cleanup
     */
    dispose() {
        this.active = false;
        this.bindings = [];
        this.observers = [];

        console.log(`[INP.2] ${this.name} context disposed`);
    }
}
