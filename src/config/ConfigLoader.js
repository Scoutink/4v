/**
 * @file ConfigLoader.js
 * @description Configuration loading and validation system
 *
 * @tags [CFG.*] All configuration tags
 * @primary-tags [!CFG.1] Config loading system
 * @critical-tags [!CFG.1.1] Config validation affects all plugins
 *
 * @dependencies None (foundation class)
 *
 * @affects All plugins (all plugins read config)
 *
 * @events None (utility class)
 *
 * @author Development Team
 * @created 2025-10-31
 */

// [!CFG.1] Configuration loading and management
// Used by: ALL plugins (read configuration values)
// Impact: Invalid config breaks plugin initialization
class ConfigLoader {
    // [CFG.1] Load configuration from object or file
    // [CFG.1.2] Merges with defaults
    // [CFG.1.1] Validates against schema (optional)
    static async load(source) {
        let config = {};

        // [CFG.1] Load from object or use defaults
        if (typeof source === 'object' && source !== null) {
            config = source;
        } else if (typeof source === 'string') {
            // [CFG.1] Load from URL or file path using fetch
            try {
                const response = await fetch(source);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                config = await response.json();
                console.log(`[CFG.1] Loaded config from ${source}`);
            } catch (error) {
                console.error(`[CFG.1] Error loading config from ${source}:`, error);
                console.warn('[CFG.1] Using default configuration');
                config = {};
            }
        } else {
            console.log('[CFG.1] No config provided, using defaults');
            config = {};
        }

        // [CFG.1.2] Merge with default values
        // [CFG.1.2 -> defaults] Uses default configuration
        const merged = ConfigLoader.mergeDefaults(config);

        // [CFG.1.1] Validate configuration (basic validation)
        const validated = ConfigLoader.validate(merged);

        console.log('[CFG.1] Configuration loaded and validated');

        return validated;
    }

    // [CFG.1.2] Merge config with defaults
    // [CFG.1.2] Provides fallback values for missing properties
    static mergeDefaults(config) {
        // [CFG.1.2] Default configuration
        const defaults = {
            // [ENG.1.2] Engine options
            engineOptions: {
                antialias: true,
                preserveDrawingBuffer: true,
                stencil: true
            },

            // [CAM.1] Camera configuration
            camera: {
                defaultType: 'universal',
                position: { x: 0, y: 2, z: -10 },
                speed: 0.5,
                sensitivity: 3000,
                collision: true,
                gravity: true,
                ellipsoid: { x: 1, y: 1.5, z: 1 }
            },

            // [GRV.1] Gravity configuration
            gravity: {
                preset: 'earth' // 'earth', 'moon', 'mars', 'zeroG', 'arcade'
            },

            // [COL.1] Collision configuration
            collision: {
                mode: 'hybrid' // 'babylon', 'physics', 'hybrid'
            },

            // [PHY.1] Physics configuration
            physics: {
                enabled: true,
                engine: 'havok', // 'havok', 'cannon', 'ammo'
                gravity: { x: 0, y: -9.81, z: 0 }
            },

            // [MOV.1] Movement configuration
            movement: {
                defaultMode: 'keyboard', // 'keyboard', 'clickToMove'
                acceleration: 0.1,
                keyboard: {
                    speed: 0.5
                }
            },

            // [LGT.1] Lighting configuration
            lighting: {
                preset: 'day' // 'day', 'night', 'studio'
            },

            // [SHD.1] Shadow configuration
            shadows: {
                enabled: true,
                quality: 'medium' // 'low', 'medium', 'high', 'ultra'
            },

            // [GRD.1] Ground configuration
            ground: {
                enabled: true,
                type: 'plane', // 'plane', 'heightmap', 'procedural'
                size: 100,
                subdivisions: 32,
                material: {
                    diffuse: 'dirt.jpg',
                    tiling: { u: 40, v: 40 }
                }
            }
        };

        // [CFG.1.2] Deep merge config with defaults
        return ConfigLoader.deepMerge(defaults, config);
    }

    // [CFG.1.2] Deep merge two objects
    // [CFG.1.2] Preserves nested structures
    static deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (
                    typeof source[key] === 'object' &&
                    source[key] !== null &&
                    !Array.isArray(source[key])
                ) {
                    // [CFG.1.2] Recursively merge objects
                    result[key] = ConfigLoader.deepMerge(
                        target[key] || {},
                        source[key]
                    );
                } else {
                    // [CFG.1.2] Override with source value
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    // [CFG.1.1] Validate configuration
    // [CFG.1.1] Basic validation (can be extended with JSON schema)
    static validate(config) {
        const errors = [];

        // [CFG.1.1 -> CAM.1] Validate camera config
        if (config.camera) {
            if (config.camera.speed && config.camera.speed < 0) {
                errors.push('[CFG.1.1] Camera speed must be positive');
            }
            if (config.camera.sensitivity && config.camera.sensitivity < 0) {
                errors.push('[CFG.1.1] Camera sensitivity must be positive');
            }
        }

        // [CFG.1.1 -> GRD.1] Validate ground config
        if (config.ground && config.ground.size && config.ground.size <= 0) {
            errors.push('[CFG.1.1] Ground size must be positive');
        }

        // [CFG.1.1 -> PHY.1] Validate physics config
        if (config.physics && config.physics.enabled) {
            const validEngines = ['havok', 'cannon', 'ammo'];
            if (!validEngines.includes(config.physics.engine)) {
                errors.push(`[CFG.1.1] Invalid physics engine. Must be one of: ${validEngines.join(', ')}`);
            }
        }

        // [CFG.1.1] Log errors but don't throw (allow engine to run)
        if (errors.length > 0) {
            console.warn('[CFG.1.1] Configuration validation warnings:');
            errors.forEach(error => console.warn('  -', error));
        }

        return config;
    }

    // [CFG.2] Get config value by path
    // [CFG.2] Example: get(config, 'camera.position.x')
    static get(config, path, defaultValue = undefined) {
        const keys = path.split('.');
        let value = config;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        return value !== undefined ? value : defaultValue;
    }

    // [CFG.3] Set config value at path
    // [CFG.3] Runtime config updates (use with caution)
    static set(config, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let obj = config;

        // [CFG.3] Navigate to parent object
        for (const key of keys) {
            if (!(key in obj) || typeof obj[key] !== 'object') {
                obj[key] = {};
            }
            obj = obj[key];
        }

        // [CFG.3] Set value
        obj[lastKey] = value;

        return config;
    }
}

// [CFG.1] Export for use in engine and plugins
export default ConfigLoader;
