/**
 * GroundController
 * Handles UI interactions for ground module
 *
 * Responsibilities:
 * - Ground rotation controls (presets and custom)
 * - Edge behavior controls
 * - Infinite terrain toggle
 * - UI state updates
 *
 * Uses event delegation (no inline onclick handlers)
 */

import UIControllerBase from '../base/ui-controller-base.js';

export class GroundController extends UIControllerBase {
    constructor(module) {
        super(module, null); // Container will be set by loader

        this.infiniteTerrainEnabled = false;
        this.infiniteGroundPlugin = null;
    }

    /**
     * Define action handlers
     * Maps data-action values to handler methods
     */
    getActions() {
        return {
            // Rotation presets
            'ground:preset:horizontal': (e, data) => this.handlePreset('horizontal'),
            'ground:preset:vertical': (e, data) => this.handlePreset('vertical'),
            'ground:preset:diagonal45': (e, data) => this.handlePreset('diagonal45'),

            // Full scene rotation toggle
            'ground:rotate:fullscene': (e, data) => this.handleFullSceneToggle(e.target.checked),

            // Custom rotation (sliders)
            'ground:rotate:x': (e, data) => this.handleCustomRotation('x', data.value),
            'ground:rotate:y': (e, data) => this.handleCustomRotation('y', data.value),
            'ground:rotate:z': (e, data) => this.handleCustomRotation('z', data.value),

            // Edge behavior
            'ground:edge:stop': (e, data) => this.handleEdgeBehavior('stop'),
            'ground:edge:teleport': (e, data) => this.handleEdgeBehavior('teleport'),
            'ground:edge:wrap': (e, data) => this.handleEdgeBehavior('wrap'),
            'ground:edge:none': (e, data) => this.handleEdgeBehavior('none'),

            // Infinite terrain
            'ground:infinite:toggle': (e, data) => this.handleInfiniteTerrainToggle(),
            'ground:infinite:viewdistance': (e, data) => this.handleViewDistance(data.value),
            'ground:infinite:height': (e, data) => this.handleHeightVariation(e.target.checked)
        };
    }

    /**
     * Initialize controller
     */
    async init() {
        await super.init();

        // Subscribe to module events
        this.module.on('ground:rotated', (data) => this.onRotationChanged(data));
        this.module.on('ground:edge-behavior:changed', (data) => this.onEdgeBehaviorChanged(data));

        console.log('[GroundController] Initialized');
    }

    // ==================== ROTATION HANDLERS ====================

    /**
     * Handle rotation preset
     * @param {string} preset - Preset name
     */
    handlePreset(preset) {
        console.log(`[GroundController] Applying preset: ${preset}`);

        try {
            this.module.setRotationPreset(preset);
            this.showSuccess(`Applied ${preset} rotation`);

            // Update UI to show active preset
            this.updatePresetButtons(preset);

        } catch (error) {
            this.showError(`Failed to apply preset: ${error.message}`);
        }
    }

    /**
     * Handle custom rotation from sliders
     * @param {string} axis - 'x', 'y', or 'z'
     * @param {string|number} value - Rotation value in degrees
     */
    handleCustomRotation(axis, value) {
        const degrees = parseFloat(value);
        if (isNaN(degrees)) {
            this.showError('Invalid rotation value');
            return;
        }

        console.log(`[GroundController] Custom rotation ${axis}: ${degrees}°`);

        // Get current rotation
        const current = this.module.getRotation();

        // Convert from radians to degrees
        const rotation = {
            x: (current.x * 180) / Math.PI,
            y: (current.y * 180) / Math.PI,
            z: (current.z * 180) / Math.PI
        };

        // Update the changed axis
        rotation[axis] = degrees;

        // Apply new rotation
        this.module.setCustomRotation(rotation.x, rotation.y, rotation.z);

        // Update slider display
        this.updateElement(`#rotation${axis.toUpperCase()}Value`, `${degrees}°`);
    }

    /**
     * Handle full scene rotation toggle
     * @param {boolean} checked - Whether to rotate full scene
     */
    handleFullSceneToggle(checked) {
        console.log(`[GroundController] Full scene rotation: ${checked ? 'enabled' : 'disabled'}`);

        const plugin = this.module.getPlugin();
        if (plugin) {
            plugin.rotateFullScene = checked;
            this.showSuccess(checked ? 'Full scene rotation enabled' : 'Ground-only rotation enabled');
        }
    }

    /**
     * Update rotation changed
     * @param {Object} data - {x, y, z} in radians
     */
    onRotationChanged(data) {
        // Update slider displays
        const xDeg = Math.round((data.x * 180) / Math.PI);
        const yDeg = Math.round((data.y * 180) / Math.PI);
        const zDeg = Math.round((data.z * 180) / Math.PI);

        this.updateElement('#rotationXValue', `${xDeg}°`);
        this.updateElement('#rotationYValue', `${yDeg}°`);
        this.updateElement('#rotationZValue', `${zDeg}°`);

        // Update slider values
        this.updateElement('#rotationX', xDeg);
        this.updateElement('#rotationY', yDeg);
        this.updateElement('#rotationZ', zDeg);
    }

    /**
     * Update preset button states
     * @param {string} activePreset - Active preset name
     */
    updatePresetButtons(activePreset) {
        // Remove active class from all preset buttons
        const presetButtons = this._container?.querySelectorAll('[data-action^="ground:preset"]');
        if (presetButtons) {
            presetButtons.forEach(btn => btn.classList.remove('active'));
        }

        // Add active class to selected preset
        const activeButton = this._container?.querySelector(`[data-action="ground:preset:${activePreset}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // ==================== EDGE BEHAVIOR HANDLERS ====================

    /**
     * Handle edge behavior change
     * @param {string} behavior - 'stop', 'teleport', 'wrap', 'none'
     */
    handleEdgeBehavior(behavior) {
        console.log(`[GroundController] Setting edge behavior: ${behavior}`);

        try {
            this.module.setEdgeBehavior(behavior);
            this.showSuccess(`Edge behavior: ${behavior}`);

            // Save to localStorage for persistence
            localStorage.setItem('ground_edge_behavior', behavior);

        } catch (error) {
            this.showError(`Failed to set edge behavior: ${error.message}`);
        }
    }

    /**
     * Edge behavior changed event
     * @param {Object} data - {behavior}
     */
    onEdgeBehaviorChanged(data) {
        // Update button states
        const buttons = this._container?.querySelectorAll('[data-action^="ground:edge"]');
        if (buttons) {
            buttons.forEach(btn => btn.classList.remove('active'));
        }

        // Mark active button
        const activeButton = this._container?.querySelector(`[data-action="ground:edge:${data.behavior}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // ==================== INFINITE TERRAIN HANDLERS ====================

    /**
     * Handle infinite terrain toggle
     */
    async handleInfiniteTerrainToggle() {
        console.log('[GroundController] Toggling infinite terrain...');

        if (!this.infiniteTerrainEnabled) {
            await this.enableInfiniteTerrain();
        } else {
            await this.disableInfiniteTerrain();
        }
    }

    /**
     * Enable infinite terrain
     */
    async enableInfiniteTerrain() {
        try {
            const InfiniteGroundPlugin = (await import('../../src/plugins/InfiniteGroundPlugin.js')).default;

            // Dispose current ground
            const groundPlugin = this.module.getPlugin();
            if (groundPlugin && groundPlugin.ground) {
                groundPlugin.ground.dispose();
            }

            // Create infinite ground
            this.infiniteGroundPlugin = new InfiniteGroundPlugin();
            this.module._engine.registerPlugin('infiniteGround', this.infiniteGroundPlugin);

            // Initialize
            const config = {
                infiniteGround: {
                    chunkSize: 50,
                    viewDistance: 3,
                    height: 0,
                    heightVariation: false,
                    subdivisions: 10,
                    material: {
                        diffuse: 'https://playground.babylonjs.com/textures/grass.png',
                        normal: 'https://playground.babylonjs.com/textures/grassn.png',
                        tiling: { u: 10, v: 10 }
                    }
                }
            };

            await this.infiniteGroundPlugin.init(this.module._engine.scene, this.module._engine.events, config);
            await this.infiniteGroundPlugin.start();

            this.infiniteTerrainEnabled = true;
            window.infiniteTerrainEnabled = true;

            // Update UI
            this.updateInfiniteTerrainUI(true);

            // Disable edge behavior buttons (not relevant with infinite terrain)
            this.setEdgeBehaviorControlsEnabled(false);

            this.showSuccess('Infinite terrain enabled');

        } catch (error) {
            this.showError(`Failed to enable infinite terrain: ${error.message}`);
        }
    }

    /**
     * Disable infinite terrain
     */
    async disableInfiniteTerrain() {
        try {
            // Dispose infinite ground
            if (this.infiniteGroundPlugin) {
                this.infiniteGroundPlugin.dispose();
                this.module._engine.plugins.delete('infiniteGround');
                this.infiniteGroundPlugin = null;
            }

            // Recreate finite ground
            const groundPlugin = this.module.getPlugin();
            if (groundPlugin) {
                await groundPlugin.createGround('plane');
            }

            this.infiniteTerrainEnabled = false;
            window.infiniteTerrainEnabled = false;

            // Update UI
            this.updateInfiniteTerrainUI(false);

            // Re-enable edge behavior controls
            this.setEdgeBehaviorControlsEnabled(true);

            // Reattach camera controls
            const camera = this.module._engine.scene.activeCamera;
            const canvas = document.getElementById('renderCanvas');
            if (camera && canvas) {
                camera.attachControl(canvas, true);
            }

            this.showSuccess('Infinite terrain disabled');

        } catch (error) {
            this.showError(`Failed to disable infinite terrain: ${error.message}`);
        }
    }

    /**
     * Update infinite terrain UI
     * @param {boolean} enabled - Enabled state
     */
    updateInfiniteTerrainUI(enabled) {
        const button = this._container?.querySelector('[data-action="ground:infinite:toggle"]');
        if (button) {
            button.textContent = enabled ? '🟢 Disable Infinite Terrain' : '🌍 Enable Infinite Terrain';
            button.classList.toggle('active', enabled);
        }

        // Show/hide infinite terrain controls
        const controls = this._container?.querySelector('#infiniteControls');
        if (controls) {
            controls.style.display = enabled ? 'block' : 'none';
        }
    }

    /**
     * Set edge behavior controls enabled/disabled
     * @param {boolean} enabled - Enabled state
     */
    setEdgeBehaviorControlsEnabled(enabled) {
        const buttons = this._container?.querySelectorAll('[data-action^="ground:edge"]');
        if (buttons) {
            buttons.forEach(btn => {
                btn.disabled = !enabled;
                btn.style.opacity = enabled ? '1' : '0.5';
            });
        }
    }

    /**
     * Handle view distance change
     * @param {string|number} value - View distance in chunks
     */
    handleViewDistance(value) {
        if (!this.infiniteGroundPlugin) return;

        const distance = parseInt(value);
        this.infiniteGroundPlugin.setViewDistance(distance);

        this.updateElement('#viewDistanceValue', `${distance} chunks`);
        console.log(`[GroundController] View distance: ${distance} chunks`);
    }

    /**
     * Handle height variation toggle
     * @param {boolean} enabled - Enabled state
     */
    handleHeightVariation(enabled) {
        if (!this.infiniteGroundPlugin) return;

        this.infiniteGroundPlugin.setHeightVariation(enabled);
        console.log(`[GroundController] Height variation: ${enabled}`);
    }

    // ==================== UI UPDATES ====================

    /**
     * Update UI with module state
     * @param {Object} state - Module state
     */
    async updateUI(state) {
        if (!this._container) return;

        // Update rotation displays
        if (state.rotation) {
            this.onRotationChanged(state.rotation);
        }

        // Update edge behavior buttons
        if (state.edgeBehavior) {
            this.onEdgeBehaviorChanged({ behavior: state.edgeBehavior });
        }

        // Load saved edge behavior from localStorage
        const savedBehavior = localStorage.getItem('ground_edge_behavior');
        if (savedBehavior) {
            this.module.setEdgeBehavior(savedBehavior);
        }
    }

    // ==================== CLEANUP ====================

    /**
     * Dispose controller
     */
    dispose() {
        // Cleanup infinite terrain if active
        if (this.infiniteGroundPlugin) {
            this.infiniteGroundPlugin.dispose();
            this.infiniteGroundPlugin = null;
        }

        super.dispose();
    }
}

export default GroundController;
