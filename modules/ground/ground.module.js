/**
 * GroundModule
 * Manages ground/terrain in the 3D scene
 *
 * Features:
 * - Ground creation (plane, heightmap)
 * - Ground rotation (presets and custom)
 * - Edge behaviors (stop, teleport, wrap)
 * - Infinite terrain support
 * - Material application
 *
 * Wraps the existing GroundPlugin from src/plugins/
 */

import ModuleBase from '../base/module-base.js';
import GroundPlugin from '../../src/plugins/GroundPlugin.js';

export class GroundModule extends ModuleBase {
    constructor() {
        super('ground', '2.0.0');

        this.plugin = null;
        this.controller = null;
    }

    /**
     * Module dependencies
     * Ground module has no dependencies (foundational)
     */
    get dependencies() {
        return [];
    }

    /**
     * Default configuration
     */
    getDefaultConfig() {
        return {
            width: 50,
            height: 50,
            type: 'plane',
            subdivisions: 10,
            rotation: {
                x: 0,
                y: 0,
                z: 0
            },
            rotateFullScene: true,
            edgeBehavior: 'stop',
            material: {
                diffuse: '../dirt.jpg',
                tiling: 4
            },
            collision: true,
            pickable: true
        };
    }

    /**
     * Initialize module
     */
    async _onInit() {
        console.log('[GroundModule] Initializing...');

        // Create GroundPlugin instance
        this.plugin = new GroundPlugin();

        // Register with engine
        this._engine.registerPlugin('ground', this.plugin);

        // Initialize plugin (it will be called by engine.start())
        // No need to call manually here

        console.log('[GroundModule] Plugin wrapped and registered');
    }

    /**
     * Start module
     */
    async _onStart() {
        console.log('[GroundModule] Starting...');

        // Plugin is already started by engine
        // Just emit ready event
        this.emit('ground:ready', {
            width: this.plugin.width,
            height: this.plugin.height,
            type: this.plugin.groundType
        });
    }

    /**
     * Stop module
     */
    async _onStop() {
        console.log('[GroundModule] Stopping...');
        // Keep ground visible, just stop accepting changes
    }

    /**
     * Dispose module
     */
    _onDispose() {
        console.log('[GroundModule] Disposing...');

        if (this.plugin) {
            this.plugin.dispose();
            this.plugin = null;
        }

        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }
    }

    // ==================== PUBLIC API ====================

    /**
     * Set ground rotation
     * @param {number} x - X rotation (radians)
     * @param {number} y - Y rotation (radians)
     * @param {number} z - Z rotation (radians)
     */
    setRotation(x, y, z) {
        if (!this.plugin) return;

        this.plugin.setRotation(x, y, z);

        this.setState({
            rotation: { x, y, z }
        });

        this.emit('ground:rotated', { x, y, z });
    }

    /**
     * Use rotation preset
     * @param {string} preset - Preset name (horizontal, vertical, diagonal45)
     */
    setRotationPreset(preset) {
        if (!this.plugin) return;

        this.plugin.useRotationPreset(preset);

        const rotation = this.plugin.getRotation();
        this.setState({ rotation });

        this.emit('ground:preset:applied', { preset, rotation });
    }

    /**
     * Set custom rotation from degrees
     * @param {number} x - X rotation (degrees)
     * @param {number} y - Y rotation (degrees)
     * @param {number} z - Z rotation (degrees)
     */
    setCustomRotation(x, y, z) {
        // Convert degrees to radians
        const xRad = (x * Math.PI) / 180;
        const yRad = (y * Math.PI) / 180;
        const zRad = (z * Math.PI) / 180;

        this.setRotation(xRad, yRad, zRad);
    }

    /**
     * Get current rotation
     * @returns {Object} {x, y, z} in radians
     */
    getRotation() {
        if (!this.plugin) return { x: 0, y: 0, z: 0 };
        return this.plugin.getRotation();
    }

    /**
     * Set edge behavior
     * @param {string} behavior - 'stop', 'teleport', 'wrap', 'none'
     */
    setEdgeBehavior(behavior) {
        if (!this.plugin) return;

        this.plugin.setEdgeBehavior(behavior);

        this.setState({ edgeBehavior: behavior });
        this.emit('ground:edge-behavior:changed', { behavior });
    }

    /**
     * Get ground mesh
     * @returns {BABYLON.Mesh|null}
     */
    getGround() {
        if (!this.plugin) return null;
        return this.plugin.ground;
    }

    /**
     * Get ground dimensions
     * @returns {Object} {width, height}
     */
    getDimensions() {
        if (!this.plugin) return { width: 0, height: 0 };

        return {
            width: this.plugin.width,
            height: this.plugin.height
        };
    }

    /**
     * Create new ground
     * @param {string} type - 'plane' or 'heightmap'
     * @param {Object} options - Ground options
     */
    async createGround(type, options = {}) {
        if (!this.plugin) return;

        await this.plugin.createGround(type, options);

        this.setState({
            type,
            ...options
        });

        this.emit('ground:created', { type, options });
    }

    /**
     * Apply material to ground
     * @param {Object} material - Material configuration
     */
    applyMaterial(material) {
        if (!this.plugin) return;

        // TODO: Implement material application
        // This will be handled by MaterialModule in coordination

        this.emit('ground:material:applied', { material });
    }

    /**
     * Get plugin instance (for advanced use)
     * @returns {GroundPlugin|null}
     */
    getPlugin() {
        return this.plugin;
    }

    /**
     * Set controller
     * @param {Object} controller - GroundController instance
     */
    setController(controller) {
        this.controller = controller;
    }

    /**
     * Get controller
     * @returns {Object|null}
     */
    getController() {
        return this.controller;
    }
}

export default GroundModule;
