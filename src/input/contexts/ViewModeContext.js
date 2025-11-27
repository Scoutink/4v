/**
 * ViewModeContext - View/Explore mode input bindings
 *
 * @class ViewModeContext
 * @extends InputContext
 *
 * @description
 * Input context for View mode - just looking around and exploring the 3D scene.
 *
 * Features:
 * - Camera movement (WASD, Arrows)
 * - Camera rotation (Mouse move)
 * - Click-to-move (Click ground)
 * - Zoom (Mouse wheel, Pinch)
 * - Touch pan/swipe
 * - Mode toggle (E key)
 *
 * Actions Mapped:
 * - moveForward/Backward/Left/Right/Up/Down - Camera movement
 * - lookAround - Mouse/touch camera rotation
 * - walkTo - Click-to-move on ground
 * - zoom - Mouse wheel / pinch zoom
 * - toggleEditMode - Switch to edit mode
 *
 * @example
 * const viewContext = new ViewModeContext();
 * inputManager.registerContext('view', viewContext);
 * inputManager.setContext('view');
 *
 * @tags [INP.2]
 * @version 1.0.0
 */

import InputContext from './InputContext.js';

export default class ViewModeContext extends InputContext {
    /**
     * [INP.2] Constructor - Setup view mode bindings
     */
    constructor() {
        super('view');

        // [INP.2.1] Define all input bindings for view mode
        this.bindings = [
            // =================================================================
            // Camera Movement (Keyboard)
            // =================================================================

            // WASD Movement
            { input: 'KeyW', action: 'moveForward' },
            { input: 'KeyS', action: 'moveBackward' },
            { input: 'KeyA', action: 'moveLeft' },
            { input: 'KeyD', action: 'moveRight' },

            // Arrow Keys (alternative)
            { input: 'ArrowUp', action: 'moveForward' },
            { input: 'ArrowDown', action: 'moveBackward' },
            { input: 'ArrowLeft', action: 'moveLeft' },
            { input: 'ArrowRight', action: 'moveRight' },

            // Vertical Movement
            { input: 'Space', action: 'moveUp' },
            { input: 'ShiftLeft', action: 'moveDown' },
            { input: 'ShiftRight', action: 'moveDown' },

            // =================================================================
            // Camera Rotation
            // =================================================================

            // Mouse look (LEFT-CLICK + DRAG)
            // User feedback: Simple and intuitive - left-click+drag to rotate camera
            // Distinguishes from single click (select/walk) via 5px drag threshold
            {
                input: 'MouseMove',
                action: 'lookAround',
                condition: 'leftClickHeld',  // Only when left-click is held AND dragging
                filters: {
                    smoothing: 0.3  // Smooth camera rotation
                }
            },

            // Touch pan (single finger)
            {
                input: 'TouchPan',
                action: 'lookAround',
                filters: {
                    smoothing: 0.3
                }
            },

            // =================================================================
            // Click-to-Move
            // =================================================================

            // Click ground to walk there
            {
                input: 'LeftClick',
                action: 'walkTo',
                condition: 'clickGround',
                state: 'clicked'  // Only on actual click, not press or release
            },

            // Tap ground to walk there (mobile)
            {
                input: 'Tap',
                action: 'walkTo',
                condition: 'clickGround',
                state: 'clicked'  // Only on actual tap
            },

            // =================================================================
            // Zoom
            // =================================================================

            // Mouse wheel zoom
            {
                input: 'MouseWheel',
                action: 'zoom',
                filters: {
                    curve: (value) => {
                        // Acceleration curve for smoother zoom
                        const normalized = value / 100;  // Normalize wheel delta
                        return normalized * Math.abs(normalized);  // Quadratic curve
                    }
                }
            },

            // Touch pinch zoom
            {
                input: 'TouchPinch',
                action: 'zoom'
            },

            // =================================================================
            // Mode Switching
            // =================================================================

            // Toggle edit mode
            { input: 'KeyE', action: 'toggleEditMode' },

            // =================================================================
            // Quick Actions
            // =================================================================

            // Reset camera
            { input: 'KeyR', action: 'resetCamera' },

            // Focus on selected (if any)
            {
                input: 'KeyF',
                action: 'focusSelection',
                condition: 'hasSelection'
            }
        ];

        console.log('[INP.2] ViewModeContext initialized with', this.bindings.length, 'bindings');
    }

    /**
     * [INP.2] Activate view mode
     */
    activate() {
        super.activate();

        // [INP.2.1] Custom activation logic for view mode
        // Could hide UI elements, change cursor, etc.

        console.log('[INP.2] View mode active - explore and look around');
    }

    /**
     * [INP.2] Deactivate view mode
     */
    deactivate() {
        super.deactivate();

        // [INP.2.1] Custom deactivation logic
        // Could show UI elements again, etc.

        console.log('[INP.2] View mode deactivated');
    }
}
