/**
 * @file SkyPlugin.js
 * @description Sky and environment system with skybox, HDR, and atmosphere
 *
 * @tags [SKY.*] Sky system
 * @primary-tags [SKY] Sky plugin
 *
 * @dependencies
 *   - [SKY -> PLG] Extends Plugin base class
 *   - [SKY -> CFG] Uses configuration
 *   - [SKY -> EVT] Emits sky events
 *   - [SKY -> MAT] Works with MaterialPlugin (environment reflections)
 *
 * @affects
 *   - [SKY -> CAM] Skybox follows camera
 *   - [SKY -> LGT] Sky color affects ambient lighting mood
 *   - [SKY -> MAT] Environment texture for PBR reflections
 *
 * @features
 *   - Skybox types: color, gradient, texture, HDR
 *   - Sky presets: day, night, sunset, cloudy, space, custom
 *   - HDR environment for PBR reflections
 *   - Procedural sky (gradient generation)
 *   - Fog system integration
 *
 * @user-requirements
 *   1. Visible sky background (not just black)
 *   2. Sky presets for different moods
 *   3. HDR environment for metallic reflections
 *   4. Easy customization via config
 *
 * @author Development Team
 * @created 2025-01-21
 */

import Plugin from '../core/Plugin.js';

// [SKY] Sky plugin
// USER REQUIREMENT: Add visible sky and environment system
class SkyPlugin extends Plugin {
    constructor() {
        super('sky');

        // [SKY.1] Skybox mesh
        this.skybox = null;
        this.skyboxMaterial = null;

        // [SKY.2] Environment texture (for PBR reflections)
        this.environmentTexture = null;

        // [SKY.3] Current sky configuration
        this.currentPreset = 'day';
        this.skyType = 'gradient'; // 'color', 'gradient', 'texture', 'hdr'
        this.skyColor = '#87CEEB'; // Sky blue
        this.visible = true;

        // [SKY.4] Sky presets
        this.presets = {
            day: {
                type: 'gradient',
                topColor: '#0066CC',    // Deep blue
                bottomColor: '#87CEEB', // Sky blue
                environmentIntensity: 1.0,
                description: '☀️ Clear Day'
            },
            sunset: {
                type: 'gradient',
                topColor: '#FF6B35',    // Orange-red
                bottomColor: '#F7931E', // Golden orange
                environmentIntensity: 0.8,
                description: '🌅 Sunset'
            },
            night: {
                type: 'gradient',
                topColor: '#000033',    // Deep navy
                bottomColor: '#001166', // Dark blue
                environmentIntensity: 0.3,
                description: '🌙 Night'
            },
            cloudy: {
                type: 'gradient',
                topColor: '#666666',    // Dark gray
                bottomColor: '#AAAAAA', // Light gray
                environmentIntensity: 0.6,
                description: '☁️ Cloudy'
            },
            space: {
                type: 'color',
                color: '#000000',       // Black
                environmentIntensity: 0.2,
                description: '🌌 Space'
            }
        };

        // [SKY.5] Fog configuration
        this.fogEnabled = false;
        this.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
        this.fogColor = new BABYLON.Color3(0.9, 0.9, 0.9);
        this.fogStart = 20;
        this.fogEnd = 60;

        console.log('[SKY] SkyPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load sky configuration
        const skyConfig = config.sky || {};

        this.currentPreset = skyConfig.preset || 'day';
        this.visible = skyConfig.visible !== false;
        this.fogEnabled = skyConfig.fog?.enabled || false;

        // [SKY.1] Create skybox
        this.createSkybox();

        // [SKY.2] Apply initial preset
        if (skyConfig.preset) {
            this.usePreset(skyConfig.preset);
        } else {
            // Use default day sky
            this.usePreset('day');
        }

        // [SKY.3] Setup environment for PBR
        this.setupEnvironment();

        // [SKY.4] Setup fog if enabled
        if (this.fogEnabled) {
            this.enableFog(skyConfig.fog);
        }

        console.log(`[SKY] Sky initialized with preset: ${this.currentPreset}`);
    }

    // [SKY.1] Create skybox mesh
    createSkybox() {
        if (this.skybox) {
            this.skybox.dispose();
        }

        // Create skybox (large sphere that contains the entire scene)
        // Size = 1000 to ensure it contains all scene objects
        this.skybox = BABYLON.MeshBuilder.CreateBox(
            'skybox',
            { size: 1000 },
            this.scene
        );

        // Create skybox material
        this.skyboxMaterial = new BABYLON.StandardMaterial('skyboxMaterial', this.scene);

        // Skybox configuration
        this.skyboxMaterial.backFaceCulling = false;
        this.skyboxMaterial.disableLighting = true; // Don't receive lighting

        this.skybox.material = this.skyboxMaterial;

        // Skybox rendering configuration
        this.skybox.infiniteDistance = true; // Always at infinite distance (doesn't move with camera)
        this.skybox.renderingGroupId = 0;   // Render first (background)

        // Don't receive shadows or interact with physics
        this.skybox.isPickable = false;
        this.skybox.checkCollisions = false;

        console.log('[SKY] Skybox mesh created');

        return this.skybox;
    }

    // [SKY.2] Use preset configuration
    usePreset(presetName) {
        const preset = this.presets[presetName];

        if (!preset) {
            console.warn(`[SKY] Unknown preset: ${presetName}. Using 'day'.`);
            return this.usePreset('day');
        }

        this.currentPreset = presetName;

        // Apply sky based on type
        switch (preset.type) {
            case 'color':
                this.setSolidColor(preset.color);
                break;

            case 'gradient':
                this.setGradient(preset.topColor, preset.bottomColor);
                break;

            case 'texture':
                if (preset.textureUrl) {
                    this.setTexture(preset.textureUrl);
                }
                break;

            case 'hdr':
                if (preset.hdrUrl) {
                    this.setHDRTexture(preset.hdrUrl);
                }
                break;
        }

        // Adjust environment intensity
        if (this.environmentTexture) {
            this.scene.environmentIntensity = preset.environmentIntensity || 1.0;
        }

        // Emit event
        this.events.emit('sky:preset-changed', {
            preset: presetName,
            config: preset
        });

        console.log(`[SKY] Applied preset: ${presetName} (${preset.description})`);

        return this;
    }

    // [SKY.3] Set solid color sky
    setSolidColor(color) {
        this.skyType = 'color';

        // Clear any textures
        this.skyboxMaterial.reflectionTexture = null;

        // Set diffuse color
        const babylonColor = this._hexToColor3(color);
        this.skyboxMaterial.diffuseColor = babylonColor;
        this.skyboxMaterial.emissiveColor = babylonColor;

        // Set scene clear color (background)
        this.scene.clearColor = new BABYLON.Color4(
            babylonColor.r,
            babylonColor.g,
            babylonColor.b,
            1.0
        );

        console.log(`[SKY] Solid color sky: ${color}`);

        return this;
    }

    // [SKY.4] Set gradient sky (procedural)
    setGradient(topColor, bottomColor) {
        this.skyType = 'gradient';

        // Create reflection texture for gradient
        const gradientTexture = new BABYLON.CubeTexture.CreateFromPrefilteredData(
            'https://playground.babylonjs.com/textures/environment.dds',
            this.scene
        );

        // Apply texture to skybox
        this.skyboxMaterial.reflectionTexture = gradientTexture;
        this.skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

        // Override with gradient colors via diffuse/emissive
        const topColor3 = this._hexToColor3(topColor);
        const bottomColor3 = this._hexToColor3(bottomColor);

        // Average color for skybox tint
        const avgColor = new BABYLON.Color3(
            (topColor3.r + bottomColor3.r) / 2,
            (topColor3.g + bottomColor3.g) / 2,
            (topColor3.b + bottomColor3.b) / 2
        );

        this.skyboxMaterial.diffuseColor = avgColor;
        this.skyboxMaterial.emissiveColor = avgColor;

        // Set scene clear color to bottom color
        this.scene.clearColor = new BABYLON.Color4(
            bottomColor3.r,
            bottomColor3.g,
            bottomColor3.b,
            1.0
        );

        console.log(`[SKY] Gradient sky: ${topColor} → ${bottomColor}`);

        return this;
    }

    // [SKY.5] Set texture sky (cube map)
    setTexture(textureUrl) {
        this.skyType = 'texture';

        // Load cube texture
        const texture = new BABYLON.CubeTexture(textureUrl, this.scene);

        this.skyboxMaterial.reflectionTexture = texture;
        this.skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

        console.log(`[SKY] Texture sky: ${textureUrl}`);

        return this;
    }

    // [SKY.6] Set HDR environment texture
    setHDRTexture(hdrUrl) {
        this.skyType = 'hdr';

        // Load HDR texture
        const hdrTexture = new BABYLON.CubeTexture.CreateFromPrefilteredData(
            hdrUrl,
            this.scene
        );

        // Apply to skybox
        this.skyboxMaterial.reflectionTexture = hdrTexture;
        this.skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

        // Apply to scene environment (for PBR)
        this.scene.environmentTexture = hdrTexture;
        this.environmentTexture = hdrTexture;

        console.log(`[SKY] HDR sky: ${hdrUrl}`);

        return this;
    }

    // [SKY.7] Setup environment texture for PBR materials
    setupEnvironment() {
        // Use default Babylon.js environment for PBR reflections
        const envTexture = new BABYLON.CubeTexture.CreateFromPrefilteredData(
            'https://playground.babylonjs.com/textures/environment.dds',
            this.scene
        );

        this.scene.environmentTexture = envTexture;
        this.environmentTexture = envTexture;
        this.scene.environmentIntensity = 1.0;

        console.log('[SKY] Environment texture setup for PBR');

        return this;
    }

    // [SKY.8] Show/hide skybox
    setVisible(visible) {
        this.visible = visible;

        if (this.skybox) {
            this.skybox.setEnabled(visible);
        }

        console.log(`[SKY] Skybox visibility: ${visible}`);

        return this;
    }

    // [SKY.9] Enable fog
    enableFog(fogConfig = {}) {
        this.fogEnabled = true;

        this.scene.fogMode = fogConfig.mode || BABYLON.Scene.FOGMODE_LINEAR;
        this.scene.fogColor = this._hexToColor3(fogConfig.color || '#AAAAAA');
        this.scene.fogStart = fogConfig.start || 20;
        this.scene.fogEnd = fogConfig.end || 60;
        this.scene.fogDensity = fogConfig.density || 0.01;

        console.log('[SKY] Fog enabled');

        return this;
    }

    // [SKY.10] Disable fog
    disableFog() {
        this.fogEnabled = false;
        this.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;

        console.log('[SKY] Fog disabled');

        return this;
    }

    // [SKY.11] Get current preset name
    getCurrentPreset() {
        return this.currentPreset;
    }

    // [SKY.12] Get all available presets
    getPresets() {
        return { ...this.presets };
    }

    // [SKY.13] Add custom preset
    addPreset(name, config) {
        this.presets[name] = config;
        console.log(`[SKY] Added custom preset: ${name}`);
        return this;
    }

    // [SKY.UTIL] Convert hex color to Babylon Color3
    _hexToColor3(hex) {
        // Remove # if present
        hex = hex.replace('#', '');

        // Parse RGB
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;

        return new BABYLON.Color3(r, g, b);
    }

    // [PLG.1.4] Dispose and cleanup
    dispose() {
        if (this.skybox) {
            this.skybox.dispose();
            this.skybox = null;
        }

        if (this.skyboxMaterial) {
            this.skyboxMaterial.dispose();
            this.skyboxMaterial = null;
        }

        if (this.environmentTexture) {
            this.environmentTexture.dispose();
            this.environmentTexture = null;
        }

        super.dispose();

        console.log('[SKY] SkyPlugin disposed');
    }
}

export default SkyPlugin;
