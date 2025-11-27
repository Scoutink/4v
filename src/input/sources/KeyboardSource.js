/**
 * KeyboardSource - Keyboard input handler
 *
 * @class KeyboardSource
 * @extends InputSource
 *
 * @description
 * Listens to keyboard events and converts them to standardized input format.
 *
 * Features:
 * - Key press/release detection
 * - Modifier key tracking (Ctrl, Shift, Alt)
 * - Key repeat handling
 * - UI element detection (don't block typing in text fields)
 * - Pressed key tracking for held state
 *
 * Input Format:
 * {
 *     source: 'keyboard',
 *     input: 'KeyW',                  // event.code (physical key)
 *     state: 'pressed' | 'released',
 *     modifiers: { Ctrl, Shift, Alt },
 *     originalEvent: KeyboardEvent
 * }
 *
 * @example
 * const keyboardSource = new KeyboardSource(inputManager);
 * // Automatically starts listening to keyboard events
 *
 * @tags [INP.3]
 * @version 1.0.0
 */

import InputSource from './InputSource.js';

export default class KeyboardSource extends InputSource {
    /**
     * [INP.3] Constructor - Initialize keyboard listeners
     *
     * @param {InputManager} inputManager - Reference to InputManager
     */
    constructor(inputManager) {
        super(inputManager, 'keyboard');

        // [INP.3.1] Track pressed keys (for held state)
        this.pressedKeys = new Set();

        // [INP.3.2] Bind event handlers
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);

        // [INP.3.3] Register event listeners
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        console.log('[INP.3] KeyboardSource ready');
    }

    /**
     * [INP.3] Handle key down event
     *
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {
        // [INP.3.1] Check if we should block this event
        if (this.shouldBlockEvent(e)) {
            return;
        }

        // [INP.3.2] Prevent default for game controls (not UI elements)
        if (!this.isUIElement(e.target)) {
            // Only prevent default for keys we care about
            if (this.isGameKey(e.code)) {
                e.preventDefault();
            }
        }

        // [INP.3.3] Track key repeat (held keys)
        const isRepeat = this.pressedKeys.has(e.code);

        // [INP.3.4] Add to pressed keys
        this.pressedKeys.add(e.code);

        // [INP.3.5] Send to InputManager
        this.sendInput({
            source: 'keyboard',
            input: e.code,          // Physical key (e.g., 'KeyW')
            key: e.key,             // Logical key (e.g., 'w' or 'W')
            state: isRepeat ? 'held' : 'pressed',
            modifiers: {
                Ctrl: e.ctrlKey,
                Shift: e.shiftKey,
                Alt: e.altKey,
                Meta: e.metaKey
            },
            repeat: e.repeat,
            originalEvent: e
        });
    }

    /**
     * [INP.3] Handle key up event
     *
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyUp(e) {
        // [INP.3.1] Remove from pressed keys
        this.pressedKeys.delete(e.code);

        // [INP.3.2] Send to InputManager
        this.sendInput({
            source: 'keyboard',
            input: e.code,
            key: e.key,
            state: 'released',
            modifiers: {
                Ctrl: e.ctrlKey,
                Shift: e.shiftKey,
                Alt: e.altKey,
                Meta: e.metaKey
            },
            originalEvent: e
        });
    }

    /**
     * [INP.3] Check if event should be blocked
     *
     * @param {KeyboardEvent} e - Keyboard event
     * @returns {boolean}
     */
    shouldBlockEvent(e) {
        // Don't send input if typing in UI elements
        if (this.isUIElement(e.target)) {
            return true;
        }

        return false;
    }

    /**
     * [INP.3] Check if element is a UI input element
     *
     * @param {HTMLElement} element - DOM element
     * @returns {boolean}
     */
    isUIElement(element) {
        if (!element) return false;

        const uiTags = ['INPUT', 'TEXTAREA', 'SELECT'];
        return uiTags.includes(element.tagName) ||
               element.contentEditable === 'true';
    }

    /**
     * [INP.3] Check if key is a game control key
     *
     * Game keys should have preventDefault() called to avoid
     * browser shortcuts (like Space = scroll down).
     *
     * @param {string} code - Key code
     * @returns {boolean}
     */
    isGameKey(code) {
        const gameKeys = [
            // Movement
            'KeyW', 'KeyA', 'KeyS', 'KeyD',
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',

            // Actions
            'Space', 'ShiftLeft', 'ShiftRight',
            'KeyE', 'KeyR', 'KeyF', 'KeyG', 'KeyQ',
            'KeyC', 'KeyV', 'KeyX', 'KeyZ',

            // Numbers
            'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
            'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',

            // Special
            'Tab', 'Escape', 'Backquote',
            'Delete', 'Backspace'
        ];

        return gameKeys.includes(code);
    }

    /**
     * [INP.3] Check if a key is currently pressed
     *
     * @param {string} code - Key code
     * @returns {boolean}
     */
    isKeyPressed(code) {
        return this.pressedKeys.has(code);
    }

    /**
     * [INP.3] Get all currently pressed keys
     *
     * @returns {Set<string>}
     */
    getPressedKeys() {
        return new Set(this.pressedKeys);
    }

    /**
     * [INP.3] Dispose and cleanup
     */
    dispose() {
        // [INP.3.1] Remove event listeners
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);

        // [INP.3.2] Clear pressed keys
        this.pressedKeys.clear();

        // [INP.3.3] Call parent dispose
        super.dispose();

        console.log('[INP.3] KeyboardSource disposed');
    }
}
