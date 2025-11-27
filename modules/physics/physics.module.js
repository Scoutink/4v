/**
 * @file physics.module.js
 * @description Physics Module - Integrates Havok physics engine with modular architecture
 *
 * This module provides a unified interface for physics simulation including:
 * - Collision detection (Babylon simple + Havok physics)
 * - Gravity system with multiple presets
 * - Per-object physics properties
 * - Real-time physics controls
 * - Debug visualization
 *
 * Architecture:
 * - Integrates existing CollisionPlugin and GravityPlugin
 * - Follows modular architecture pattern (extends ModuleBase)
 * - Provides UI controller for physics panel
 * - Event-driven communication with other modules
 *
 * @author Development Team
 * @created 2025-11-25
 */

import ModuleBase from '../base/module-base.js';
import defaultConfig from './physics.config.js';
import PhysicsController from './physics.controller.js';

class PhysicsModule extends ModuleBase {
    constructor() {
        super('physics', '1.0.0');

        // Module state
        this.collisionPlugin = null;
        this.gravityPlugin = null;
        this.controller = null;

        // Physics state
        this.physicsEnabled = false;
        this.collisionMode = 'hybrid';
        this.currentGravityPreset = 'earth';

        // Tracked objects
        this.physicsObjects = new Map();  // mesh -> physics settings

        console.log('[PhysicsModule] Initialized');
    }

    /**
     * Get default configuration
     * @returns {Object} Default configuration
     */
    getDefaultConfig() {
        return defaultConfig;
    }

    /**
     * Define module dependencies
     * @returns {Array<string>} Array of module names this depends on
     */
    getDependencies() {
        // No module dependencies - this module accesses plugins directly
        // collision and gravity are PLUGINS registered in the engine, not modules
        return [];
    }

    /**
     * Initialize module
     * Called after dependencies are loaded
     */
    async _onInit() {
        console.log('[PhysicsModule] Initializing...');

        // Wait for plugins to be available (with timeout protection)
        await this._waitForPlugins(['collision', 'gravity'], 5000);

        // Get plugin instances from engine
        this.collisionPlugin = this._engine.plugins.get('collision');
        this.gravityPlugin = this._engine.plugins.get('gravity');

        if (!this.collisionPlugin) {
            throw new Error('[PhysicsModule] CollisionPlugin not found! Ensure "collision" is in modules list.');
        }

        if (!this.gravityPlugin) {
            throw new Error('[PhysicsModule] GravityPlugin not found! Ensure "gravity" is in modules list.');
        }

        // Store references in scene metadata for easy access
        const scene = this._engine.scene;
        scene.metadata = scene.metadata || {};
        scene.metadata.physicsModule = this;
        scene.metadata.collisionPlugin = this.collisionPlugin;
        scene.metadata.gravityPlugin = this.gravityPlugin;

        console.log('[PhysicsModule] Plugins connected');
    }

    /**
     * Start module
     * Begin physics simulation
     */
    async _onStart() {
        console.log('[PhysicsModule] Starting...');

        // Check if physics engine initialized successfully
        this.physicsEnabled = this.collisionPlugin.physicsEnabled;

        if (!this.physicsEnabled) {
            console.warn('[PhysicsModule] Physics engine not initialized. Collision-only mode.');
        }

        // Set initial gravity preset
        const preset = this._config.gravity.preset || 'earth';
        this.setGravityPreset(preset);

        // Set collision mode
        this.collisionMode = this._config.collision.mode || 'hybrid';

        // Initialize UI controller
        this.controller = new PhysicsController(this);

        // CRITICAL: Wait for DOM to be ready before initializing controller
        // Controller needs .control-panel element to attach event listeners
        try {
            await this._waitForDOM('.control-panel', 5000);
            await this.controller.init();
            console.log('[PhysicsModule] Controller initialized successfully');
        } catch (error) {
            console.warn('[PhysicsModule] Controller initialization failed (UI may not be available):', error.message);
            // Don't throw - physics can still work without UI controls
        }

        // Listen for physics events
        this.setupEventListeners();

        console.log(`[PhysicsModule] Started - Mode: ${this.collisionMode}, Gravity: ${this.currentGravityPreset}`);
    }

    /**
     * Stop module
     */
    async _onStop() {
        console.log('[PhysicsModule] Stopping...');

        // Clear tracked objects
        this.physicsObjects.clear();

        // Dispose controller
        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }

        console.log('[PhysicsModule] Stopped');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for gravity changes
        this._engine.events.on('gravity:changed', (data) => {
            console.log(`[PhysicsModule] Gravity changed: ${data.preset || 'custom'}`);
            this.currentGravityPreset = data.preset || 'custom';
        });

        // Listen for physics enabled/disabled
        this._engine.events.on('physics:enabled', (data) => {
            console.log('[PhysicsModule] Physics engine enabled');
            this.physicsEnabled = true;
        });

        this._engine.events.on('physics:failed', (data) => {
            console.warn('[PhysicsModule] Physics engine failed:', data.error);
            this.physicsEnabled = false;
        });

        // Listen for collision events
        this._engine.events.on('collision:physics:enabled', (data) => {
            this.physicsObjects.set(data.mesh, data.settings);
        });
    }

    // ==================== PUBLIC API ====================

    /**
     * Set gravity preset
     * @param {string} preset - Preset name (earth, moon, mars, etc.)
     */
    setGravityPreset(preset) {
        if (!this.gravityPlugin) return;

        const presets = this._config.gravity.presets;
        if (presets[preset]) {
            this.gravityPlugin.setPreset(preset);
            this.currentGravityPreset = preset;
            console.log(`[PhysicsModule] Gravity preset: ${preset}`);
        } else {
            console.warn(`[PhysicsModule] Unknown gravity preset: ${preset}`);
        }
    }

    /**
     * Set custom gravity value
     * @param {number} x - X component
     * @param {number} y - Y component
     * @param {number} z - Z component
     */
    setCustomGravity(x, y, z) {
        if (!this.gravityPlugin) return;

        this.gravityPlugin.setGravity({ x, y, z }, 'custom');
        this.currentGravityPreset = 'custom';
        console.log(`[PhysicsModule] Custom gravity: (${x}, ${y}, ${z})`);
    }

    /**
     * Enable collision on mesh
     * @param {BABYLON.Mesh} mesh - Mesh to enable collision on
     * @param {Object} options - Collision options
     */
    enableCollision(mesh, options = {}) {
        if (!this.collisionPlugin || !mesh) return;

        this.collisionPlugin.enableSimpleCollision(mesh, options);
    }

    /**
     * Enable physics body on mesh
     * @param {BABYLON.Mesh} mesh - Mesh to enable physics on
     * @param {Object} options - Physics options (mass, friction, restitution, shape)
     * @returns {BABYLON.PhysicsAggregate} Physics aggregate
     */
    enablePhysics(mesh, options = {}) {
        if (!this.collisionPlugin || !mesh) return null;

        if (!this.physicsEnabled) {
            console.warn('[PhysicsModule] Physics engine not enabled');
            return null;
        }

        return this.collisionPlugin.enablePhysicsBody(mesh, options);
    }

    /**
     * Apply physics preset to mesh
     * @param {BABYLON.Mesh} mesh - Target mesh
     * @param {string} presetName - Preset name (static, dynamic, bouncy, etc.)
     */
    applyPhysicsPreset(mesh, presetName) {
        if (!mesh) return;

        const preset = this._config.materialPresets[presetName];
        if (!preset) {
            console.warn(`[PhysicsModule] Unknown preset: ${presetName}`);
            return;
        }

        this.enablePhysics(mesh, {
            mass: preset.mass,
            restitution: preset.restitution,
            friction: preset.friction
        });

        console.log(`[PhysicsModule] Applied preset "${presetName}" to ${mesh.name}`);
    }

    /**
     * Update physics properties for mesh
     * @param {BABYLON.Mesh} mesh - Target mesh
     * @param {Object} properties - Properties to update
     */
    setPhysicsProperties(mesh, properties) {
        if (!this.collisionPlugin || !mesh) return;

        this.collisionPlugin.setPhysicsProperties(mesh, properties);
    }

    /**
     * Disable physics on mesh
     * @param {BABYLON.Mesh} mesh - Target mesh
     */
    disablePhysics(mesh) {
        if (!this.collisionPlugin || !mesh) return;

        this.collisionPlugin.disableCollision(mesh);
    }

    /**
     * Toggle physics engine on/off
     * @param {boolean} enabled - Enable or disable
     */
    togglePhysics(enabled) {
        if (!this.collisionPlugin) return;

        // This would require re-initializing physics engine
        // For now, we can enable/disable on all objects
        console.log(`[PhysicsModule] Physics toggle: ${enabled ? 'ON' : 'OFF'}`);

        // Emit event
        this._engine.events.emit('physics:toggled', { enabled });
    }

    /**
     * Set collision mode
     * @param {string} mode - 'hybrid', 'physics', or 'babylon'
     */
    setCollisionMode(mode) {
        if (!this.collisionPlugin) return;

        this.collisionMode = mode;
        console.log(`[PhysicsModule] Collision mode: ${mode}`);

        // Emit event
        this._engine.events.emit('collision:mode:changed', { mode });
    }

    /**
     * Get physics statistics
     * @returns {Object} Physics stats
     */
    getStats() {
        return {
            physicsEnabled: this.physicsEnabled,
            collisionMode: this.collisionMode,
            gravityPreset: this.currentGravityPreset,
            activeObjects: this.physicsObjects.size,
            currentGravity: this.gravityPlugin ? this.gravityPlugin.current : null
        };
    }

    /**
     * Enable debug visualization
     * @param {boolean} showColliders - Show collision shapes
     * @param {boolean} showForces - Show force vectors
     */
    setDebugMode(showColliders = false, showForces = false) {
        console.log(`[PhysicsModule] Debug: Colliders=${showColliders}, Forces=${showForces}`);

        // TODO: Implement debug visualization
        // This would use BABYLON.Debug.PhysicsViewer for Havok

        this._engine.events.emit('physics:debug:changed', { showColliders, showForces });
    }

    /**
     * Get UI controller
     * @returns {PhysicsController} Controller instance
     */
    getController() {
        return this.controller;
    }

    /**
     * Get collision plugin
     * @returns {CollisionPlugin} Collision plugin instance
     */
    getCollisionPlugin() {
        return this.collisionPlugin;
    }

    /**
     * Get gravity plugin
     * @returns {GravityPlugin} Gravity plugin instance
     */
    getGravityPlugin() {
        return this.gravityPlugin;
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Wait for plugins to be available in engine
     * @private
     * @param {Array<string>} pluginNames - Plugin names to wait for
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    async _waitForPlugins(pluginNames, timeout = 5000) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const allAvailable = pluginNames.every(name =>
                this._engine.plugins.has(name)
            );

            if (allAvailable) {
                console.log(`[PhysicsModule] All plugins ready: ${pluginNames.join(', ')}`);
                return;
            }

            // Wait 50ms before checking again
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Timeout - throw error with helpful message
        const missing = pluginNames.filter(name => !this._engine.plugins.has(name));
        throw new Error(
            `[PhysicsModule] Timeout waiting for plugins. Missing: ${missing.join(', ')}. ` +
            `Available plugins: ${Array.from(this._engine.plugins.keys()).join(', ')}`
        );
    }

    /**
     * Wait for DOM element to be available
     * @private
     * @param {string} selector - CSS selector for the element
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    async _waitForDOM(selector, timeout = 5000) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const element = document.querySelector(selector);
            if (element) {
                console.log(`[PhysicsModule] DOM element ready: ${selector}`);
                return;
            }

            // Wait 50ms before checking again
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        throw new Error(`[PhysicsModule] Timeout waiting for DOM element: ${selector}`);
    }
}

export default PhysicsModule;
