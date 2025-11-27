/**
 * EditModeContext - Edit/Authoring mode input bindings
 *
 * @class EditModeContext
 * @extends InputContext
 *
 * @description
 * Input context for Edit mode - full editing controls for authoring 3D scenes.
 *
 * Features:
 * - All View mode controls (camera movement)
 * - Object selection (click objects)
 * - Multi-select (Ctrl+click)
 * - Object manipulation (grab, rotate, scale)
 * - Deletion (Delete key)
 * - Duplication (Ctrl+D)
 * - Undo/Redo (Ctrl+Z, Ctrl+Y)
 * - Deselect (click ground)
 * - Mode toggle (E key)
 *
 * Actions Mapped:
 * - All View mode actions (moveForward, lookAround, etc.)
 * - selectObject - Click object to select
 * - deselectAll - Click ground to deselect
 * - multiSelect - Ctrl+click for multi-select
 * - grabObject - G to grab selected
 * - rotateObject - R to rotate selected
 * - scaleObject - S to scale selected
 * - deleteObject - Delete key
 * - duplicateObject - Ctrl+D
 * - undo - Ctrl+Z
 * - redo - Ctrl+Y
 *
 * @example
 * const editContext = new EditModeContext();
 * inputManager.registerContext('edit', editContext);
 * inputManager.setContext('edit');
 *
 * @tags [INP.2]
 * @version 1.0.0
 */

import InputContext from './InputContext.js';

export default class EditModeContext extends InputContext {
    /**
     * [INP.2] Constructor - Setup edit mode bindings
     */
    constructor() {
        super('edit');

        // [INP.2.1] Define all input bindings for edit mode
        this.bindings = [
            // =================================================================
            // Camera Movement (Same as View Mode)
            // =================================================================

            // WASD Movement
            { input: 'KeyW', action: 'moveForward' },
            { input: 'KeyS', action: 'moveBackward' },
            { input: 'KeyA', action: 'moveLeft' },
            { input: 'KeyD', action: 'moveRight' },

            // Arrow Keys
            { input: 'ArrowUp', action: 'moveForward' },
            { input: 'ArrowDown', action: 'moveBackward' },
            { input: 'ArrowLeft', action: 'moveLeft' },
            { input: 'ArrowRight', action: 'moveRight' },

            // Vertical Movement
            { input: 'Space', action: 'moveUp' },
            { input: 'ShiftLeft', action: 'moveDown' },
            { input: 'ShiftRight', action: 'moveDown' },

            // Mouse look (LEFT-CLICK + DRAG)
            // User feedback: Simple and intuitive - left-click+drag to rotate camera
            // Distinguishes from single click (select) via 5px drag threshold
            {
                input: 'MouseMove',
                action: 'lookAround',
                condition: 'leftClickHeld',  // Only when left-click is held AND dragging
                filters: { smoothing: 0.3 }
            },

            // Zoom
            { input: 'MouseWheel', action: 'zoom' },

            // =================================================================
            // Object Selection
            // =================================================================

            // Click object to select (single select)
            {
                input: 'LeftClick',
                action: 'selectObject',
                condition: 'clickMesh',
                state: 'clicked'  // Only on actual click, not press or release
            },

            // Ctrl+Click for multi-select
            {
                input: 'LeftClick',
                action: 'multiSelect',
                condition: 'clickMesh',
                modifier: 'Ctrl',
                state: 'clicked'  // Only on actual click
            },

            // Click ground to deselect all
            {
                input: 'LeftClick',
                action: 'deselectAll',
                condition: 'clickGround',
                state: 'clicked'  // Only on actual click
            },

            // Tap object to select (mobile)
            {
                input: 'Tap',
                action: 'selectObject',
                condition: 'clickMesh',
                state: 'clicked'  // Only on actual tap
            },

            // Tap ground to deselect (mobile)
            {
                input: 'Tap',
                action: 'deselectAll',
                condition: 'clickGround',
                state: 'clicked'  // Only on actual tap
            },

            // =================================================================
            // Object Manipulation
            // =================================================================

            // Grab (move) selected object
            {
                input: 'KeyG',
                action: 'grabObject',
                condition: 'hasSelection'
            },

            // Rotate selected object
            {
                input: 'KeyR',
                action: 'rotateObject',
                condition: 'hasSelection'
            },

            // Scale selected object
            {
                input: 'KeyS',
                action: 'scaleObject',
                condition: 'hasSelection'
            },

            // Confirm manipulation (Enter)
            { input: 'Enter', action: 'confirmManipulation' },

            // Cancel manipulation (Escape)
            { input: 'Escape', action: 'cancelManipulation' },

            // =================================================================
            // Object Operations
            // =================================================================

            // Delete selected object(s)
            {
                input: 'Delete',
                action: 'deleteObject',
                condition: 'hasSelection'
            },

            // Duplicate selected object(s)
            {
                input: 'KeyD',
                action: 'duplicateObject',
                condition: 'hasSelection',
                modifier: 'Ctrl'
            },

            // Select all
            {
                input: 'KeyA',
                action: 'selectAll',
                modifier: 'Ctrl'
            },

            // =================================================================
            // Edit History
            // =================================================================

            // Undo
            {
                input: 'KeyZ',
                action: 'undo',
                modifier: 'Ctrl'
            },

            // Redo (Ctrl+Y)
            {
                input: 'KeyY',
                action: 'redo',
                modifier: 'Ctrl'
            },

            // Redo (Ctrl+Shift+Z - common alternative)
            {
                input: 'KeyZ',
                action: 'redo',
                modifier: ['Ctrl', 'Shift']
            },

            // =================================================================
            // Gizmo Control (Transform Tools)
            // =================================================================

            // Toggle gizmo position mode
            { input: 'Digit1', action: 'gizmoPosition' },

            // Toggle gizmo rotation mode
            { input: 'Digit2', action: 'gizmoRotation' },

            // Toggle gizmo scale mode
            { input: 'Digit3', action: 'gizmoScale' },

            // Toggle gizmo on/off
            { input: 'KeyT', action: 'toggleGizmo' },

            // =================================================================
            // View Controls
            // =================================================================

            // Focus on selection
            {
                input: 'KeyF',
                action: 'focusSelection',
                condition: 'hasSelection'
            },

            // Reset camera
            { input: 'KeyH', action: 'resetCamera' },

            // Frame all objects
            {
                input: 'KeyF',
                action: 'frameAll',
                modifier: 'Shift'
            },

            // =================================================================
            // Snapping (Common in 3D editors)
            // =================================================================

            // Toggle grid snapping
            { input: 'KeyG', action: 'toggleGridSnap', modifier: 'Shift' },

            // Toggle angle snapping
            { input: 'KeyA', action: 'toggleAngleSnap', modifier: 'Shift' },

            // =================================================================
            // Context Menu
            // =================================================================

            // Right-click for context menu
            {
                input: 'RightClick',
                action: 'showContextMenu',
                condition: 'clickMesh',
                state: 'clicked'  // Only on actual click
            },

            // Long press for context menu (mobile)
            {
                input: 'LongPress',
                action: 'showContextMenu',
                condition: 'clickMesh',
                state: 'held'  // Long press uses 'held' state
            },

            // =================================================================
            // Mode Switching
            // =================================================================

            // Toggle back to view mode
            { input: 'KeyE', action: 'toggleEditMode' },

            // =================================================================
            // Quick Save
            // =================================================================

            // Save scene
            {
                input: 'KeyS',
                action: 'saveScene',
                modifier: 'Ctrl'
            },

            // Save as
            {
                input: 'KeyS',
                action: 'saveSceneAs',
                modifier: ['Ctrl', 'Shift']
            }
        ];

        console.log('[INP.2] EditModeContext initialized with', this.bindings.length, 'bindings');
    }

    /**
     * [INP.2] Activate edit mode
     */
    activate() {
        super.activate();

        // [INP.2.1] Custom activation logic for edit mode
        // Could show gizmos, enable grid, show UI panels, etc.

        console.log('[INP.2] Edit mode active - full editing controls enabled');
    }

    /**
     * [INP.2] Deactivate edit mode
     */
    deactivate() {
        super.deactivate();

        // [INP.2.1] Custom deactivation logic
        // Could hide gizmos, disable grid, hide UI panels, etc.

        console.log('[INP.2] Edit mode deactivated');
    }
}
