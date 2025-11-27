/**
 * @file physics.controller.js
 * @description Physics UI Controller - Handles physics panel interactions
 *
 * This controller manages the physics control section in the main control panel.
 * Follows the modular architecture pattern with UIControllerBase.
 *
 * @author Development Team
 * @created 2025-11-25
 * @fixed 2025-11-25 - Corrected import path, constructor, and container handling
 */

import UIControllerBase from '../base/ui-controller-base.js';

export class PhysicsController extends UIControllerBase {
    constructor(physicsModule) {
        // CRITICAL: Pass module and container to parent
        // Container is '.control-panel' since physics controls are integrated there
        super(physicsModule, '.control-panel');

        this.physicsModule = physicsModule;
        // Access scene and config from private properties
        this.scene = physicsModule._engine.scene;
        this.config = physicsModule._config;

        // UI state
        this.customGravityVisible = false;
        this.debugColliders = false;
        this.debugForces = false;

        console.log('[PhysicsController] Created');
    }

    /**
     * Define action handlers for data-action attributes
     * @returns {Object} Action handlers
     */
    getActions() {
        return {
            // Gravity presets
            'physics:gravity:preset': (e, data) => this.setGravityPreset(data.value),

            // Camera physics
            'physics:camera:collision': (e) => this.toggleCameraCollision(e.target.checked),
            'physics:camera:gravity': (e) => this.toggleCameraGravity(e.target.checked)
        };
    }

    /**
     * Update UI with current physics state
     * @param {Object} state - Module state
     */
    async updateUI(state) {
        console.log('[PhysicsController] Updating UI...');

        // Update camera collision checkbox
        const camera = this.scene.activeCamera;
        if (camera) {
            const collisionCheckbox = document.getElementById('cameraCollision');
            if (collisionCheckbox) {
                collisionCheckbox.checked = camera.checkCollisions || false;
                console.log(`[PhysicsController] Camera collision checkbox: ${collisionCheckbox.checked}`);
            }
        }

        // Update gravity preset buttons
        const stats = this.physicsModule.getStats();
        this.updateGravityButtons(stats.gravityPreset);

        console.log('[PhysicsController] UI updated');
    }

    // ==================== GRAVITY CONTROLS ====================

    /**
     * Set gravity preset
     * @param {string} preset - Preset name (earth, moon, mars, zeroG, arcade)
     */
    setGravityPreset(preset) {
        console.log(`[PhysicsController] Setting gravity preset: ${preset}`);

        this.physicsModule.setGravityPreset(preset);

        // Update UI - highlight active button
        this.updateGravityButtons(preset);

        this.showSuccess(`Gravity: ${preset.toUpperCase()}`);
    }

    /**
     * Update gravity preset button states
     * @param {string} activePreset
     */
    updateGravityButtons(activePreset) {
        if (!this._container) return;

        // Find all gravity preset buttons in the control panel
        const buttons = this._container.querySelectorAll('[data-action="physics:gravity:preset"]');

        buttons.forEach(button => {
            const preset = button.getAttribute('data-value');
            if (preset === activePreset) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        console.log(`[PhysicsController] Updated gravity buttons, active: ${activePreset}`);
    }

    // ==================== CAMERA CONTROLS ====================

    /**
     * Toggle camera collision
     * @param {boolean} enabled
     */
    toggleCameraCollision(enabled) {
        console.log(`[PhysicsController] Toggle camera collision: ${enabled}`);

        const camera = this.scene.activeCamera;
        if (!camera) {
            this.showError('No active camera found');
            return;
        }

        camera.checkCollisions = enabled;

        console.log(`[PhysicsController] Camera checkCollisions set to: ${camera.checkCollisions}`);
        this.showSuccess(`Camera Collision: ${enabled ? 'ON' : 'OFF'}`);
    }

    /**
     * Toggle camera gravity
     * @param {boolean} enabled
     */
    toggleCameraGravity(enabled) {
        console.log(`[PhysicsController] Toggle camera gravity: ${enabled}`);

        const camera = this.scene.activeCamera;
        if (!camera) {
            this.showError('No active camera found');
            return;
        }

        camera.applyGravity = enabled;

        // If enabling gravity, ensure scene gravity is set properly
        if (enabled && this.physicsModule.gravityPlugin) {
            const currentGravity = this.physicsModule.gravityPlugin.getGravity();
            console.log(`[PhysicsController] Camera gravity enabled with preset: ${currentGravity.preset}`);
        }

        console.log(`[PhysicsController] Camera applyGravity set to: ${camera.applyGravity}`);
        this.showSuccess(`Camera Gravity: ${enabled ? 'ON' : 'OFF'}`);
    }

    // ==================== NOTIFICATIONS ====================

    /**
     * Show success message
     * @param {string} message
     */
    showSuccess(message) {
        console.log(`[PhysicsController] ✓ ${message}`);
        // Parent class emits ui:success event
        super.showSuccess(message);
    }

    /**
     * Show error message
     * @param {string} message
     */
    showError(message) {
        console.error(`[PhysicsController] ✗ ${message}`);
        // Parent class emits ui:error event
        super.showError(message);
    }

    /**
     * Dispose controller
     */
    dispose() {
        console.log('[PhysicsController] Disposing...');
        super.dispose();
    }
}

export default PhysicsController;
