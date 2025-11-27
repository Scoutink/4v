/**
 * @file ShadowPlugin.js
 * @description Shadow system with quality levels and per-object control
 *
 * @tags [SHD.*] Shadow system
 * @primary-tags [SHD] Shadow plugin
 *
 * @dependencies
 *   - [SHD -> PLG] Extends Plugin base class
 *   - [SHD -> CFG] Uses configuration
 *   - [SHD -> EVT] Emits shadow events
 *   - [SHD -> LGT] Requires lights for shadows
 *
 * @affects
 *   - [SHD -> PRF] Shadow quality affects performance
 *
 * @features
 *   - Shadow generators for lights
 *   - Quality levels: low, medium, high, ultra
 *   - Shadow types: hard, soft, advanced
 *   - Per-object cast/receive control
 *   - Runtime enable/disable
 *   - Performance optimization
 *
 * @author Development Team
 * @created 2025-11-20
 */

import Plugin from '../core/Plugin.js';

// [SHD] Shadow plugin
class ShadowPlugin extends Plugin {
    constructor() {
        super('shadow');

        // [SHD.1] Shadow generators
        this.shadowGenerators = new Map();

        // [SHD.2] Quality settings
        this.qualityLevels = {
            low: {
                mapSize: 512,
                blur: 0,
                useKernelBlur: false,
                filteringQuality: BABYLON.ShadowGenerator.QUALITY_LOW
            },
            medium: {
                mapSize: 1024,
                blur: 16,
                useKernelBlur: true,
                filteringQuality: BABYLON.ShadowGenerator.QUALITY_MEDIUM
            },
            high: {
                mapSize: 2048,
                blur: 32,
                useKernelBlur: true,
                filteringQuality: BABYLON.ShadowGenerator.QUALITY_HIGH
            },
            ultra: {
                mapSize: 4096,
                blur: 64,
                useKernelBlur: true,
                filteringQuality: BABYLON.ShadowGenerator.QUALITY_HIGH
            }
        };

        // [SHD] Current settings
        this.quality = 'medium';
        this.shadowType = 'soft';
        this.enabled = true;

        // [SHD.4] Per-object tracking
        this.castingShadows = new WeakSet();
        this.receivingShadows = new WeakSet();

        console.log('[SHD] ShadowPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load shadow configuration
        const shadowConfig = config.shadows || {};

        this.enabled = shadowConfig.enabled !== false;
        this.quality = shadowConfig.quality || 'medium';
        this.shadowType = shadowConfig.type || 'soft';

        console.log('[SHD] Shadow configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        // [FIX #10] Listen for lighting preset changes to adjust shadows
        this.events.on('lighting:preset:changed', (data) => {
            this.adjustShadowsForLighting(data.preset);
        });

        // [EVT.2] Emit shadow ready event
        this.events.emit('shadow:ready', {
            enabled: this.enabled,
            quality: this.quality,
            type: this.shadowType
        });

        console.log('[SHD] ShadowPlugin started');
    }

    // [FIX #10] Adjust shadows based on lighting preset
    adjustShadowsForLighting(preset) {
        console.log(`[SHD] Adjusting shadows for lighting preset: ${preset}`);

        switch (preset) {
            case 'day':
                // Strong, sharp shadows from sun
                this.setShadowIntensity(1.0);
                this.setShadowType('soft');
                this.setQuality('high');
                break;

            case 'sunset':
                // Long, soft, orange-tinted shadows
                this.setShadowIntensity(0.7);
                this.setShadowType('soft');
                this.setQuality('high');
                break;

            case 'night':
                // Weak, bluish shadows from moon
                this.setShadowIntensity(0.3);
                this.setShadowType('advanced');
                this.setQuality('medium');
                break;

            case 'indoor':
                // Multiple soft shadows from point lights
                this.setShadowIntensity(0.5);
                this.setShadowType('soft');
                this.setQuality('medium');
                break;

            case 'dramatic':
                // High contrast shadows
                this.setShadowIntensity(0.9);
                this.setShadowType('hard');
                this.setQuality('high');
                break;

            case 'studio':
                // Even, neutral shadows
                this.setShadowIntensity(0.6);
                this.setShadowType('soft');
                this.setQuality('high');
                break;

            default:
                console.log(`[SHD] Unknown preset: ${preset}, using defaults`);
                this.setShadowIntensity(0.7);
                this.setShadowType('soft');
                this.setQuality('medium');
        }
    }

    // [FIX #10] Set shadow intensity (darkness)
    setShadowIntensity(intensity) {
        this.shadowGenerators.forEach((data, lightName) => {
            // darkness is inverse of intensity in Babylon.js
            data.generator.darkness = 1.0 - intensity;
        });

        console.log(`[SHD] Shadow intensity set to: ${intensity}`);
    }

    // [SHD.1] Create shadow generator for a light
    createShadowGenerator(lightName, options = {}) {
        // [SHD.1 -> LGT] Get light from lighting plugin
        // Assuming we can access other plugins via events or direct reference
        // For now, we'll work with light objects passed in options

        const light = options.light;

        if (!light) {
            console.error(`[SHD.1] Light required to create shadow generator`);
            return null;
        }

        // Check if light supports shadows
        if (!(light instanceof BABYLON.DirectionalLight) &&
            !(light instanceof BABYLON.SpotLight) &&
            !(light instanceof BABYLON.PointLight)) {
            console.warn(`[SHD.1] Light type doesn't support shadows: ${lightName}`);
            return null;
        }

        // [SHD.2] Get quality settings
        const qualitySettings = this.qualityLevels[this.quality];

        // [SHD.1] Create shadow generator
        const shadowGenerator = new BABYLON.ShadowGenerator(
            qualitySettings.mapSize,
            light
        );

        // [SHD.3] Apply shadow type
        this.applyShadowType(shadowGenerator, this.shadowType);

        // [SHD.2] Apply quality settings
        if (qualitySettings.useKernelBlur) {
            shadowGenerator.useKernelBlur = true;
            shadowGenerator.blurKernel = qualitySettings.blur;
        }

        shadowGenerator.filteringQuality = qualitySettings.filteringQuality;

        // [SHD.1] Store generator
        this.shadowGenerators.set(lightName, {
            generator: shadowGenerator,
            light: light,
            options: options
        });

        // [EVT.2] Emit shadow generator created
        this.events.emit('shadow:generator:created', {
            lightName: lightName,
            quality: this.quality
        });

        console.log(`[SHD.1] Shadow generator created for light: ${lightName}`);

        return shadowGenerator;
    }

    // [SHD.3] Apply shadow type to generator
    applyShadowType(shadowGenerator, type) {
        switch (type) {
            case 'hard':
                // [SHD.3.1] Hard shadows (no blur, sharp edges)
                shadowGenerator.useBlurExponentialShadowMap = false;
                shadowGenerator.useKernelBlur = false;
                shadowGenerator.usePoissonSampling = false;
                shadowGenerator.usePercentageCloserFiltering = false;
                break;

            case 'soft':
                // [SHD.3.2] Soft shadows (PCF - Percentage Closer Filtering)
                shadowGenerator.usePercentageCloserFiltering = true;
                shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
                break;

            case 'advanced':
                // [SHD.3.3] Advanced shadows (blur + PCF)
                shadowGenerator.useBlurExponentialShadowMap = true;
                shadowGenerator.useKernelBlur = true;
                shadowGenerator.blurKernel = 32;
                break;

            default:
                console.warn(`[SHD.3] Unknown shadow type: ${type}, using soft`);
                shadowGenerator.usePercentageCloserFiltering = true;
        }
    }

    // [SHD.2] Set shadow quality
    setQuality(quality) {
        if (!this.qualityLevels[quality]) {
            console.warn(`[SHD.2] Unknown quality level: ${quality}`);
            return;
        }

        this.quality = quality;

        // [SHD.2] Update all existing shadow generators
        this.shadowGenerators.forEach((data, lightName) => {
            const qualitySettings = this.qualityLevels[quality];
            const generator = data.generator;

            // Update map size (requires recreation)
            generator.getShadowMap().dispose();
            generator.mapSize = qualitySettings.mapSize;

            // Update blur
            if (qualitySettings.useKernelBlur) {
                generator.useKernelBlur = true;
                generator.blurKernel = qualitySettings.blur;
            } else {
                generator.useKernelBlur = false;
            }

            generator.filteringQuality = qualitySettings.filteringQuality;
        });

        // [EVT.2] Emit quality changed event
        this.events.emit('shadow:quality:changed', {
            quality: quality
        });

        console.log(`[SHD.2] Shadow quality set to: ${quality}`);
    }

    // [SHD.2] Get current quality
    getQuality() {
        return this.quality;
    }

    // [SHD.3] Set shadow type
    setShadowType(type) {
        this.shadowType = type;

        // [SHD.3] Update all existing shadow generators
        this.shadowGenerators.forEach((data, lightName) => {
            this.applyShadowType(data.generator, type);
        });

        // [EVT.2] Emit type changed event
        this.events.emit('shadow:type:changed', {
            type: type
        });

        console.log(`[SHD.3] Shadow type set to: ${type}`);
    }

    // [SHD.4] Enable shadow casting for mesh
    enableCastShadows(mesh) {
        if (!mesh) {
            console.warn('[SHD.4] No mesh provided');
            return;
        }

        // [SHD.4] Add mesh to all shadow generators
        this.shadowGenerators.forEach((data, lightName) => {
            data.generator.addShadowCaster(mesh);
        });

        // [SHD.4] Track mesh
        this.castingShadows.add(mesh);

        console.log(`[SHD.4] Shadow casting enabled for: ${mesh.name}`);
    }

    // [SHD.4] Disable shadow casting for mesh
    disableCastShadows(mesh) {
        if (!mesh) {
            console.warn('[SHD.4] No mesh provided');
            return;
        }

        // [SHD.4] Remove mesh from all shadow generators
        this.shadowGenerators.forEach((data, lightName) => {
            data.generator.removeShadowCaster(mesh);
        });

        // Note: WeakSet doesn't have delete, but mesh will be garbage collected

        console.log(`[SHD.4] Shadow casting disabled for: ${mesh.name}`);
    }

    // [SHD.4] Enable shadow receiving for mesh
    enableReceiveShadows(mesh) {
        if (!mesh) {
            console.warn('[SHD.4] No mesh provided');
            return;
        }

        mesh.receiveShadows = true;

        // [SHD.4] Track mesh
        this.receivingShadows.add(mesh);

        console.log(`[SHD.4] Shadow receiving enabled for: ${mesh.name}`);
    }

    // [SHD.4] Disable shadow receiving for mesh
    disableReceiveShadows(mesh) {
        if (!mesh) {
            console.warn('[SHD.4] No mesh provided');
            return;
        }

        mesh.receiveShadows = false;

        console.log(`[SHD.4] Shadow receiving disabled for: ${mesh.name}`);
    }

    // [SHD.4] Enable both cast and receive for mesh
    enableShadows(mesh) {
        this.enableCastShadows(mesh);
        this.enableReceiveShadows(mesh);
    }

    // [SHD.4] Disable both cast and receive for mesh
    disableShadows(mesh) {
        this.disableCastShadows(mesh);
        this.disableReceiveShadows(mesh);
    }

    // [SHD.5] Enable shadows globally
    enableShadowsGlobally() {
        this.enabled = true;

        // [SHD.5] Enable all shadow generators
        this.shadowGenerators.forEach((data, lightName) => {
            data.generator.getShadowMap().refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
        });

        // [EVT.2] Emit shadows enabled event
        this.events.emit('shadow:enabled', {});

        console.log('[SHD.5] Shadows enabled globally');
    }

    // [SHD.5] Disable shadows globally
    disableShadowsGlobally() {
        this.enabled = false;

        // [SHD.5] Disable all shadow generators
        this.shadowGenerators.forEach((data, lightName) => {
            data.generator.getShadowMap().refreshRate = 0; // Never render
        });

        // [EVT.2] Emit shadows disabled event
        this.events.emit('shadow:disabled', {});

        console.log('[SHD.5] Shadows disabled globally');
    }

    // [SHD.5] Set shadows for specific light
    setShadowsForLight(lightName, enabled) {
        const data = this.shadowGenerators.get(lightName);

        if (!data) {
            console.warn(`[SHD.5] Shadow generator not found for light: ${lightName}`);
            return;
        }

        if (enabled) {
            data.generator.getShadowMap().refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
        } else {
            data.generator.getShadowMap().refreshRate = 0;
        }

        console.log(`[SHD.5] Shadows ${enabled ? 'enabled' : 'disabled'} for light: ${lightName}`);
    }

    // [SHD.1] Get shadow generator for light
    getShadowGenerator(lightName) {
        const data = this.shadowGenerators.get(lightName);
        return data ? data.generator : null;
    }

    // [SHD.1] Get all shadow generators
    getAllShadowGenerators() {
        const generators = [];
        this.shadowGenerators.forEach((data, lightName) => {
            generators.push({
                lightName: lightName,
                generator: data.generator
            });
        });
        return generators;
    }

    // [SHD.1] Delete shadow generator
    deleteShadowGenerator(lightName) {
        const data = this.shadowGenerators.get(lightName);

        if (!data) {
            console.warn(`[SHD.1] Shadow generator not found: ${lightName}`);
            return;
        }

        data.generator.dispose();
        this.shadowGenerators.delete(lightName);

        console.log(`[SHD.1] Shadow generator deleted: ${lightName}`);
    }

    // [SHD] Clear all shadow generators
    clearAllShadowGenerators() {
        this.shadowGenerators.forEach((data, lightName) => {
            data.generator.dispose();
        });

        this.shadowGenerators.clear();

        console.log('[SHD] All shadow generators cleared');
    }

    // [SHD] Check if shadows are enabled
    isEnabled() {
        return this.enabled;
    }

    // [SHD] Get current shadow type
    getShadowType() {
        return this.shadowType;
    }

    // [SHD] Reset to defaults
    reset() {
        this.setQuality('medium');
        this.setShadowType('soft');
        this.enableShadowsGlobally();

        console.log('[SHD] Shadows reset to defaults');
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Clear all shadow generators
        this.clearAllShadowGenerators();

        super.dispose();

        console.log('[SHD] ShadowPlugin disposed');
    }
}

// [SHD] Export for registration with engine
export default ShadowPlugin;
