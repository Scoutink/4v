/**
 * InputSource - Base class for all input sources
 *
 * @class InputSource
 * @abstract
 *
 * @description
 * Base class that all input sources extend. Provides common interface
 * for enabling/disabling input and sending standardized events to InputManager.
 *
 * Responsibilities:
 * - Listen to hardware events (keyboard, mouse, touch, etc.)
 * - Convert to standardized format
 * - Send to InputManager via sendInput()
 * - Handle enable/disable state
 * - Cleanup on disposal
 *
 * Input Event Format:
 * {
 *     source: 'keyboard' | 'mouse' | 'touch' | 'gamepad' | 'vr',
 *     input: string,           // Input identifier (e.g., 'KeyW', 'LeftClick')
 *     state: string,           // 'pressed' | 'released' | 'moved' | 'scrolled'
 *     value: any,              // Optional value (analog inputs, delta, etc.)
 *     modifiers: Object,       // { Ctrl, Shift, Alt } (keyboard/mouse)
 *     hitInfo: Object,         // Raycast results (mouse/touch)
 *     originalEvent: Event     // Original DOM/Babylon event
 * }
 *
 * @example
 * class KeyboardSource extends InputSource {
 *     constructor(inputManager) {
 *         super(inputManager, 'keyboard');
 *         window.addEventListener('keydown', this.handleKeyDown.bind(this));
 *     }
 *
 *     handleKeyDown(e) {
 *         this.sendInput({
 *             source: this.name,
 *             input: e.code,
 *             state: 'pressed',
 *             modifiers: { Ctrl: e.ctrlKey, Shift: e.shiftKey, Alt: e.altKey }
 *         });
 *     }
 * }
 *
 * @tags [INP.3]
 * @version 1.0.0
 */

export default class InputSource {
    /**
     * [INP.3] Constructor
     *
     * @param {InputManager} inputManager - Reference to InputManager
     * @param {string} name - Source name (e.g., 'keyboard', 'mouse')
     */
    constructor(inputManager, name = 'base') {
        // [INP.3.1] Core properties
        this.inputManager = inputManager;
        this.name = name;
        this.enabled = true;

        console.log(`[INP.3] ${this.name} source initialized`);
    }

    /**
     * [INP.3] Enable this input source
     *
     * When enabled, input events are sent to InputManager.
     */
    enable() {
        if (this.enabled) {
            console.warn(`[INP.3] ${this.name} already enabled`);
            return;
        }

        this.enabled = true;
        console.log(`[INP.3] ${this.name} enabled`);
    }

    /**
     * [INP.3] Disable this input source
     *
     * When disabled, input events are ignored.
     */
    disable() {
        if (!this.enabled) {
            console.warn(`[INP.3] ${this.name} already disabled`);
            return;
        }

        this.enabled = false;
        console.log(`[INP.3] ${this.name} disabled`);
    }

    /**
     * [INP.3] Send input event to InputManager
     *
     * Standardized method for all sources to communicate with manager.
     * Checks enabled state before sending.
     *
     * @param {Object} event - Standardized input event
     * @param {string} event.source - Source name
     * @param {string} event.input - Input identifier
     * @param {string} event.state - Input state
     * @param {*} [event.value] - Optional value
     * @param {Object} [event.modifiers] - Modifier keys
     * @param {Object} [event.hitInfo] - Raycast hit info
     * @param {Event} [event.originalEvent] - Original event
     */
    sendInput(event) {
        if (!this.enabled) {
            return;
        }

        if (!event.source) {
            event.source = this.name;
        }

        this.inputManager.handleInput(this.name, event);
    }

    /**
     * [INP.3] Dispose and cleanup
     *
     * Override in subclasses to remove event listeners.
     * Always call super.dispose() at the end.
     */
    dispose() {
        this.enabled = false;
        console.log(`[INP.3] ${this.name} source disposed`);
    }
}
