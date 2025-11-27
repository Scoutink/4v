/**
 * @file LightingPlugin.js
 * @description Lighting system with multiple light types, presets, and runtime control
 *
 * @tags [LGT.*] Lighting system
 * @primary-tags [LGT] Lighting plugin
 *
 * @dependencies
 *   - [LGT -> PLG] Extends Plugin base class
 *   - [LGT -> CFG] Uses configuration
 *   - [LGT -> EVT] Emits lighting events
 *   - [LGT -> SHD] Works with ShadowPlugin
 *
 * @affects
 *   - [LGT -> MAT] Lighting affects material appearance
 *   - [LGT -> SHD] Lights create shadows
 *
 * @features
 *   - Light types: hemisphere, directional, point, spot
 *   - 6 presets: day, night, indoor, dramatic, sunset, studio
 *   - Runtime control: position, intensity, color
 *   - Per-light properties
 *   - Ready for external API integration (weather, time, sun position)
 *
 * @user-requirements
 *   1. Runtime light position changes (future: sun/moon from APIs)
 *   2. Multiple light types and presets
 *   3. Dynamic lighting control
 *
 * @author Development Team
 * @created 2025-11-20
 */

import Plugin from '../core/Plugin.js';

// [LGT] Lighting plugin
// [LGT] USER REQUIREMENT: Runtime control ready for external APIs
class LightingPlugin extends Plugin {
    constructor() {
        super('lighting');

        // [LGT.1] Light storage
        this.lights = new Map();

        // [LGT.2] Light presets
        this.presets = {
            // [LGT.2.1] Day preset - bright, natural sunlight
            day: {
                hemisphere: {
                    name: 'dayHemi',
                    direction: { x: 0, y: 1, z: 0 },
                    intensity: 0.6,
                    diffuse: { r: 0.9, g: 0.95, b: 1.0 },
                    ground: { r: 0.3, g: 0.35, b: 0.4 }
                },
                directional: {
                    name: 'daySun',
                    direction: { x: -1, y: -2, z: -1 },
                    position: { x: 20, y: 40, z: 20 },
                    intensity: 0.8,
                    diffuse: { r: 1.0, g: 0.95, b: 0.9 }
                }
            },

            // [LGT.2.2] Night preset - dim, moonlight
            night: {
                hemisphere: {
                    name: 'nightHemi',
                    direction: { x: 0, y: 1, z: 0 },
                    intensity: 0.2,
                    diffuse: { r: 0.3, g: 0.4, b: 0.6 },
                    ground: { r: 0.1, g: 0.1, b: 0.2 }
                },
                directional: {
                    name: 'nightMoon',
                    direction: { x: 1, y: -2, z: 1 },
                    position: { x: -20, y: 40, z: -20 },
                    intensity: 0.3,
                    diffuse: { r: 0.7, g: 0.8, b: 1.0 }
                }
            },

            // [LGT.2.3] Indoor preset - multiple point lights
            indoor: {
                hemisphere: {
                    name: 'indoorHemi',
                    direction: { x: 0, y: 1, z: 0 },
                    intensity: 0.4,
                    diffuse: { r: 1.0, g: 0.95, b: 0.85 },
                    ground: { r: 0.2, g: 0.2, b: 0.2 }
                },
                points: [
                    {
                        name: 'indoorLight1',
                        position: { x: -10, y: 8, z: -10 },
                        intensity: 0.5,
                        diffuse: { r: 1.0, g: 0.9, b: 0.8 },
                        range: 30
                    },
                    {
                        name: 'indoorLight2',
                        position: { x: 10, y: 8, z: 10 },
                        intensity: 0.5,
                        diffuse: { r: 1.0, g: 0.9, b: 0.8 },
                        range: 30
                    }
                ]
            },

            // [LGT.2.4] Dramatic preset - high contrast
            dramatic: {
                hemisphere: {
                    name: 'dramaticHemi',
                    direction: { x: 0, y: 1, z: 0 },
                    intensity: 0.1,
                    diffuse: { r: 0.2, g: 0.2, b: 0.3 },
                    ground: { r: 0.05, g: 0.05, b: 0.1 }
                },
                spot: {
                    name: 'dramaticSpot',
                    position: { x: 0, y: 15, z: 0 },
                    direction: { x: 0, y: -1, z: 0 },
                    intensity: 1.2,
                    diffuse: { r: 1.0, g: 1.0, b: 1.0 },
                    angle: Math.PI / 4,
                    exponent: 2
                }
            },

            // [LGT.2.5] Sunset preset - warm colors
            sunset: {
                hemisphere: {
                    name: 'sunsetHemi',
                    direction: { x: 0, y: 1, z: 0 },
                    intensity: 0.5,
                    diffuse: { r: 1.0, g: 0.6, b: 0.4 },
                    ground: { r: 0.4, g: 0.2, b: 0.3 }
                },
                directional: {
                    name: 'sunsetSun',
                    direction: { x: -1, y: -0.5, z: -1 },
                    position: { x: 30, y: 10, z: 30 },
                    intensity: 1.0,
                    diffuse: { r: 1.0, g: 0.5, b: 0.2 }
                }
            },

            // [LGT.2.6] Studio preset - even, neutral
            studio: {
                hemisphere: {
                    name: 'studioHemi',
                    direction: { x: 0, y: 1, z: 0 },
                    intensity: 0.5,
                    diffuse: { r: 1.0, g: 1.0, b: 1.0 },
                    ground: { r: 0.5, g: 0.5, b: 0.5 }
                },
                directional: [
                    {
                        name: 'studioKey',
                        direction: { x: -1, y: -1, z: -1 },
                        position: { x: 20, y: 20, z: 20 },
                        intensity: 0.7,
                        diffuse: { r: 1.0, g: 1.0, b: 1.0 }
                    },
                    {
                        name: 'studioFill',
                        direction: { x: 1, y: -1, z: 1 },
                        position: { x: -15, y: 15, z: -15 },
                        intensity: 0.4,
                        diffuse: { r: 1.0, g: 1.0, b: 1.0 }
                    }
                ]
            }
        };

        // [LGT] Current preset
        this.currentPreset = 'day';

        console.log('[LGT] LightingPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load lighting configuration
        const lightingConfig = config.lighting || {};

        this.currentPreset = lightingConfig.preset || 'day';

        console.log('[LGT] Lighting configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        // [LGT.2] Apply default preset
        this.usePreset(this.currentPreset);

        // [EVT.2] Emit lighting ready event
        this.events.emit('lighting:ready', {
            preset: this.currentPreset,
            lightCount: this.lights.size
        });

        console.log('[LGT] LightingPlugin started');
    }

    // [LGT.1] Create hemisphere light
    createHemisphereLight(name, options = {}) {
        // [LGT.1.1] Create light
        const direction = options.direction
            ? new BABYLON.Vector3(options.direction.x, options.direction.y, options.direction.z)
            : new BABYLON.Vector3(0, 1, 0);

        const light = new BABYLON.HemisphericLight(name, direction, this.scene);

        // [LGT.1.1] Set properties
        light.intensity = options.intensity !== undefined ? options.intensity : 0.6;

        if (options.diffuse) {
            light.diffuse = new BABYLON.Color3(
                options.diffuse.r,
                options.diffuse.g,
                options.diffuse.b
            );
        }

        if (options.ground) {
            light.groundColor = new BABYLON.Color3(
                options.ground.r,
                options.ground.g,
                options.ground.b
            );
        }

        if (options.specular) {
            light.specular = new BABYLON.Color3(
                options.specular.r,
                options.specular.g,
                options.specular.b
            );
        }

        // [LGT.1] Store light
        this.lights.set(name, {
            light: light,
            type: 'hemisphere',
            options: options
        });

        console.log(`[LGT.1] Hemisphere light created: ${name}`);

        return light;
    }

    // [LGT.1] Create directional light (sun/moon)
    createDirectionalLight(name, options = {}) {
        // [LGT.1.2] Create light
        const direction = options.direction
            ? new BABYLON.Vector3(options.direction.x, options.direction.y, options.direction.z)
            : new BABYLON.Vector3(-1, -2, -1);

        const light = new BABYLON.DirectionalLight(name, direction, this.scene);

        // [LGT.1.2] Set position (for shadow calculations)
        // USER REQUIREMENT: Position can be changed at runtime (sun movement!)
        if (options.position) {
            light.position = new BABYLON.Vector3(
                options.position.x,
                options.position.y,
                options.position.z
            );
        }

        // [LGT.1.2] Set properties
        light.intensity = options.intensity !== undefined ? options.intensity : 0.8;

        if (options.diffuse) {
            light.diffuse = new BABYLON.Color3(
                options.diffuse.r,
                options.diffuse.g,
                options.diffuse.b
            );
        }

        if (options.specular) {
            light.specular = new BABYLON.Color3(
                options.specular.r,
                options.specular.g,
                options.specular.b
            );
        }

        // [LGT.1] Store light
        this.lights.set(name, {
            light: light,
            type: 'directional',
            options: options
        });

        console.log(`[LGT.1] Directional light created: ${name}`);

        return light;
    }

    // [LGT.1] Create point light (lamp, torch)
    createPointLight(name, options = {}) {
        // [LGT.1.3] Create light
        const position = options.position
            ? new BABYLON.Vector3(options.position.x, options.position.y, options.position.z)
            : new BABYLON.Vector3(0, 5, 0);

        const light = new BABYLON.PointLight(name, position, this.scene);

        // [LGT.1.3] Set properties
        light.intensity = options.intensity !== undefined ? options.intensity : 0.5;

        if (options.diffuse) {
            light.diffuse = new BABYLON.Color3(
                options.diffuse.r,
                options.diffuse.g,
                options.diffuse.b
            );
        }

        if (options.specular) {
            light.specular = new BABYLON.Color3(
                options.specular.r,
                options.specular.g,
                options.specular.b
            );
        }

        // [LGT.4] Range (falloff distance)
        if (options.range) {
            light.range = options.range;
        }

        // [LGT.1] Store light
        this.lights.set(name, {
            light: light,
            type: 'point',
            options: options
        });

        console.log(`[LGT.1] Point light created: ${name}`);

        return light;
    }

    // [LGT.1] Create spot light (flashlight, stage)
    createSpotLight(name, options = {}) {
        // [LGT.1.4] Create light
        const position = options.position
            ? new BABYLON.Vector3(options.position.x, options.position.y, options.position.z)
            : new BABYLON.Vector3(0, 10, 0);

        const direction = options.direction
            ? new BABYLON.Vector3(options.direction.x, options.direction.y, options.direction.z)
            : new BABYLON.Vector3(0, -1, 0);

        const angle = options.angle || Math.PI / 4;
        const exponent = options.exponent || 2;

        const light = new BABYLON.SpotLight(
            name,
            position,
            direction,
            angle,
            exponent,
            this.scene
        );

        // [LGT.1.4] Set properties
        light.intensity = options.intensity !== undefined ? options.intensity : 0.8;

        if (options.diffuse) {
            light.diffuse = new BABYLON.Color3(
                options.diffuse.r,
                options.diffuse.g,
                options.diffuse.b
            );
        }

        if (options.specular) {
            light.specular = new BABYLON.Color3(
                options.specular.r,
                options.specular.g,
                options.specular.b
            );
        }

        // [LGT.4] Range
        if (options.range) {
            light.range = options.range;
        }

        // [LGT.1] Store light
        this.lights.set(name, {
            light: light,
            type: 'spot',
            options: options
        });

        console.log(`[LGT.1] Spot light created: ${name}`);

        return light;
    }

    // [LGT.1] Generic create light method
    createLight(type, name, options = {}) {
        switch (type) {
            case 'hemisphere':
                return this.createHemisphereLight(name, options);
            case 'directional':
                return this.createDirectionalLight(name, options);
            case 'point':
                return this.createPointLight(name, options);
            case 'spot':
                return this.createSpotLight(name, options);
            default:
                console.warn(`[LGT.1] Unknown light type: ${type}`);
                return null;
        }
    }

    // [LGT.2] Use lighting preset
    usePreset(presetName) {
        const preset = this.presets[presetName];

        if (!preset) {
            console.warn(`[LGT.2] Unknown preset: ${presetName}`);
            return;
        }

        // [LGT.2] Clear existing lights
        this.clearAllLights();

        // [LGT.2] Create lights from preset
        if (preset.hemisphere) {
            this.createHemisphereLight(preset.hemisphere.name, preset.hemisphere);
        }

        if (preset.directional) {
            if (Array.isArray(preset.directional)) {
                preset.directional.forEach(light => {
                    this.createDirectionalLight(light.name, light);
                });
            } else {
                this.createDirectionalLight(preset.directional.name, preset.directional);
            }
        }

        if (preset.points) {
            preset.points.forEach(light => {
                this.createPointLight(light.name, light);
            });
        }

        if (preset.spot) {
            this.createSpotLight(preset.spot.name, preset.spot);
        }

        this.currentPreset = presetName;

        // [EVT.2] Emit preset changed event
        this.events.emit('lighting:preset:changed', {
            preset: presetName,
            lightCount: this.lights.size
        });

        console.log(`[LGT.2] Lighting preset applied: ${presetName}`);
    }

    // [LGT.2] Add custom preset
    addPreset(name, presetConfig) {
        this.presets[name] = presetConfig;
        console.log(`[LGT.2] Custom preset added: ${name}`);
    }

    // [LGT.3] Set light position
    // USER REQUIREMENT: For sun/moon movement, future external API integration
    setLightPosition(name, position) {
        const lightData = this.lights.get(name);

        if (!lightData) {
            console.warn(`[LGT.3] Light not found: ${name}`);
            return;
        }

        const light = lightData.light;

        if (light.position) {
            light.position.x = position.x;
            light.position.y = position.y;
            light.position.z = position.z;

            // [EVT.2] Emit position changed event
            this.events.emit('lighting:position:changed', {
                name: name,
                position: light.position.clone()
            });

            console.log(`[LGT.3] Light position updated: ${name}`);
        }
    }

    // [LGT.3] Set light intensity
    setLightIntensity(name, intensity) {
        const lightData = this.lights.get(name);

        if (!lightData) {
            console.warn(`[LGT.3] Light not found: ${name}`);
            return;
        }

        lightData.light.intensity = intensity;

        // [EVT.2] Emit intensity changed event
        this.events.emit('lighting:intensity:changed', {
            name: name,
            intensity: intensity
        });

        console.log(`[LGT.3] Light intensity updated: ${name} = ${intensity}`);
    }

    // [LGT.3] Set light color
    setLightColor(name, color) {
        const lightData = this.lights.get(name);

        if (!lightData) {
            console.warn(`[LGT.3] Light not found: ${name}`);
            return;
        }

        const light = lightData.light;

        if (color instanceof BABYLON.Color3) {
            light.diffuse = color;
        } else {
            light.diffuse = new BABYLON.Color3(color.r, color.g, color.b);
        }

        // [EVT.2] Emit color changed event
        this.events.emit('lighting:color:changed', {
            name: name,
            color: light.diffuse
        });

        console.log(`[LGT.3] Light color updated: ${name}`);
    }

    // [LGT.3] Set light direction (directional/spot lights)
    setLightDirection(name, direction) {
        const lightData = this.lights.get(name);

        if (!lightData) {
            console.warn(`[LGT.3] Light not found: ${name}`);
            return;
        }

        const light = lightData.light;

        if (light.direction) {
            light.direction.x = direction.x;
            light.direction.y = direction.y;
            light.direction.z = direction.z;

            console.log(`[LGT.3] Light direction updated: ${name}`);
        }
    }

    // [LGT.4] Set light property (generic)
    setLightProperty(name, property, value) {
        const lightData = this.lights.get(name);

        if (!lightData) {
            console.warn(`[LGT.4] Light not found: ${name}`);
            return;
        }

        lightData.light[property] = value;

        console.log(`[LGT.4] Light property updated: ${name}.${property} = ${value}`);
    }

    // [LGT.3] Enable light
    enableLight(name) {
        const lightData = this.lights.get(name);

        if (!lightData) {
            console.warn(`[LGT.3] Light not found: ${name}`);
            return;
        }

        lightData.light.setEnabled(true);

        console.log(`[LGT.3] Light enabled: ${name}`);
    }

    // [LGT.3] Disable light
    disableLight(name) {
        const lightData = this.lights.get(name);

        if (!lightData) {
            console.warn(`[LGT.3] Light not found: ${name}`);
            return;
        }

        lightData.light.setEnabled(false);

        console.log(`[LGT.3] Light disabled: ${name}`);
    }

    // [LGT.1] Get light by name
    getLight(name) {
        const lightData = this.lights.get(name);
        return lightData ? lightData.light : null;
    }

    // [LGT.1] Get all lights
    getAllLights() {
        const allLights = [];
        this.lights.forEach((lightData, name) => {
            allLights.push({
                name: name,
                type: lightData.type,
                light: lightData.light
            });
        });
        return allLights;
    }

    // [LGT.1] Delete light
    deleteLight(name) {
        const lightData = this.lights.get(name);

        if (!lightData) {
            console.warn(`[LGT.1] Light not found: ${name}`);
            return;
        }

        lightData.light.dispose();
        this.lights.delete(name);

        console.log(`[LGT.1] Light deleted: ${name}`);
    }

    // [LGT] Clear all lights
    clearAllLights() {
        this.lights.forEach((lightData, name) => {
            lightData.light.dispose();
        });

        this.lights.clear();

        console.log('[LGT] All lights cleared');
    }

    // [LGT] Get current preset name
    getCurrentPreset() {
        return this.currentPreset;
    }

    // [LGT] Get available presets
    getPresets() {
        return Object.keys(this.presets);
    }

    // [LGT] Reset to default
    reset() {
        this.usePreset('day');
        console.log('[LGT] Lighting reset to defaults');
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Clear all lights
        this.clearAllLights();

        super.dispose();

        console.log('[LGT] LightingPlugin disposed');
    }
}

// [LGT] Export for registration with engine
export default LightingPlugin;
