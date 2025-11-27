/**
 * @file MaterialPlugin.js
 * @description Material system with Standard and PBR materials, material library
 *
 * @tags [MAT.*] Material system
 * @primary-tags [MAT] Material plugin
 *
 * @dependencies
 *   - [MAT -> PLG] Extends Plugin base class
 *   - [MAT -> CFG] Uses configuration
 *   - [MAT -> EVT] Emits material events
 *
 * @affects
 *   - [MAT -> LGT] Materials interact with lighting
 *   - [MAT -> GRD] Ground materials
 *
 * @features
 *   - Standard materials (diffuse, specular, emissive)
 *   - PBR materials (albedo, metallic, roughness)
 *   - Material library with presets
 *   - Texture support
 *   - Runtime property changes
 *   - Material cloning
 *
 * @author Development Team
 * @created 2025-11-20
 */

import Plugin from '../core/Plugin.js';

// [MAT] Material plugin
class MaterialPlugin extends Plugin {
    constructor() {
        super('material');

        // [MAT.1] Material storage
        this.materials = new Map();

        // [MAT.4] Material library presets
        this.presets = this.createDefaultPresets();

        console.log('[MAT] MaterialPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        console.log('[MAT] Material configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        // [EVT.2] Emit material ready event
        this.events.emit('material:ready', {
            presetCount: Object.keys(this.presets).length
        });

        console.log('[MAT] MaterialPlugin started');
    }

    // [MAT.1] Create standard material
    createStandardMaterial(name, options = {}) {
        // [MAT.1] Create material
        const material = new BABYLON.StandardMaterial(name, this.scene);

        // [MAT.2] Set diffuse color
        if (options.diffuseColor) {
            material.diffuseColor = this.parseColor(options.diffuseColor);
        }

        // [MAT.2] Set specular color
        if (options.specularColor) {
            material.specularColor = this.parseColor(options.specularColor);
        }

        // [MAT.2] Set emissive color
        if (options.emissiveColor) {
            material.emissiveColor = this.parseColor(options.emissiveColor);
        }

        // [MAT.2] Set ambient color
        if (options.ambientColor) {
            material.ambientColor = this.parseColor(options.ambientColor);
        }

        // [MAT.2] Set specular power
        if (options.specularPower !== undefined) {
            material.specularPower = options.specularPower;
        }

        // [MAT.2] Set alpha/opacity
        if (options.alpha !== undefined) {
            material.alpha = options.alpha;
        }

        // [MAT.2] Set textures
        if (options.diffuseTexture) {
            material.diffuseTexture = new BABYLON.Texture(options.diffuseTexture, this.scene);
        }

        if (options.normalTexture) {
            material.bumpTexture = new BABYLON.Texture(options.normalTexture, this.scene);
        }

        if (options.specularTexture) {
            material.specularTexture = new BABYLON.Texture(options.specularTexture, this.scene);
        }

        // [MAT.1] Store material
        this.materials.set(name, {
            material: material,
            type: 'standard',
            options: options
        });

        console.log(`[MAT.1] Standard material created: ${name}`);

        return material;
    }

    // [MAT.1] Create PBR material
    createPBRMaterial(name, options = {}) {
        // [MAT.1] Create material
        const material = new BABYLON.PBRMaterial(name, this.scene);

        // [MAT.3] Set albedo color (base color)
        if (options.albedoColor) {
            material.albedoColor = this.parseColor(options.albedoColor);
        }

        // [MAT.3] Set metallic
        if (options.metallic !== undefined) {
            material.metallic = options.metallic;
        }

        // [MAT.3] Set roughness
        if (options.roughness !== undefined) {
            material.roughness = options.roughness;
        }

        // [MAT.3] Set reflectivity color
        if (options.reflectivityColor) {
            material.reflectivityColor = this.parseColor(options.reflectivityColor);
        }

        // [MAT.3] Set emissive color
        if (options.emissiveColor) {
            material.emissiveColor = this.parseColor(options.emissiveColor);
        }

        // [MAT.2] Set alpha/opacity
        if (options.alpha !== undefined) {
            material.alpha = options.alpha;
        }

        // [MAT.3] Set textures
        if (options.albedoTexture) {
            material.albedoTexture = new BABYLON.Texture(options.albedoTexture, this.scene);
        }

        if (options.normalTexture) {
            material.bumpTexture = new BABYLON.Texture(options.normalTexture, this.scene);
        }

        if (options.metallicTexture) {
            material.metallicTexture = new BABYLON.Texture(options.metallicTexture, this.scene);
        }

        if (options.roughnessTexture) {
            material.roughnessTexture = new BABYLON.Texture(options.roughnessTexture, this.scene);
        }

        // [MAT.3] Environment texture for reflections
        if (options.environmentTexture) {
            material.environmentTexture = new BABYLON.CubeTexture(options.environmentTexture, this.scene);
        }

        // [MAT.1] Store material
        this.materials.set(name, {
            material: material,
            type: 'pbr',
            options: options
        });

        console.log(`[MAT.1] PBR material created: ${name}`);

        return material;
    }

    // [MAT.4] Create default material presets
    createDefaultPresets() {
        return {
            // [MAT.4] Wood preset
            wood: {
                type: 'standard',
                diffuseColor: { r: 0.55, g: 0.35, b: 0.2 },
                specularColor: { r: 0.2, g: 0.2, b: 0.2 },
                specularPower: 16
            },

            // [MAT.4] Metal presets
            metal: {
                type: 'pbr',
                albedoColor: { r: 0.7, g: 0.7, b: 0.7 },
                metallic: 1.0,
                roughness: 0.3
            },

            gold: {
                type: 'pbr',
                albedoColor: { r: 1.0, g: 0.85, b: 0.3 },
                metallic: 1.0,
                roughness: 0.2
            },

            silver: {
                type: 'pbr',
                albedoColor: { r: 0.95, g: 0.95, b: 0.95 },
                metallic: 1.0,
                roughness: 0.15
            },

            copper: {
                type: 'pbr',
                albedoColor: { r: 0.95, g: 0.6, b: 0.4 },
                metallic: 1.0,
                roughness: 0.25
            },

            // [MAT.4] Glass preset
            glass: {
                type: 'pbr',
                albedoColor: { r: 0.9, g: 0.95, b: 1.0 },
                metallic: 0.0,
                roughness: 0.0,
                alpha: 0.3
            },

            // [MAT.4] Plastic presets
            plastic: {
                type: 'standard',
                diffuseColor: { r: 0.3, g: 0.4, b: 0.8 },
                specularColor: { r: 0.8, g: 0.8, b: 0.8 },
                specularPower: 64
            },

            plasticRed: {
                type: 'standard',
                diffuseColor: { r: 0.9, g: 0.1, b: 0.1 },
                specularColor: { r: 0.8, g: 0.8, b: 0.8 },
                specularPower: 64
            },

            // [MAT.4] Stone/concrete
            stone: {
                type: 'standard',
                diffuseColor: { r: 0.5, g: 0.5, b: 0.5 },
                specularColor: { r: 0.1, g: 0.1, b: 0.1 },
                specularPower: 8
            },

            // [MAT.4] Rubber
            rubber: {
                type: 'pbr',
                albedoColor: { r: 0.1, g: 0.1, b: 0.1 },
                metallic: 0.0,
                roughness: 0.9
            },

            // [MAT.4] Fabric/cloth
            fabric: {
                type: 'standard',
                diffuseColor: { r: 0.6, g: 0.4, b: 0.3 },
                specularColor: { r: 0.1, g: 0.1, b: 0.1 },
                specularPower: 4
            },

            // [MAT.4] Ceramic
            ceramic: {
                type: 'pbr',
                albedoColor: { r: 0.95, g: 0.95, b: 0.95 },
                metallic: 0.0,
                roughness: 0.2
            },

            // [MAT.4] Emissive/glowing
            emissive: {
                type: 'standard',
                diffuseColor: { r: 0.2, g: 0.2, b: 0.8 },
                emissiveColor: { r: 0.5, g: 0.5, b: 1.0 },
                specularPower: 32
            },

            // [MAT.4] Gemstone presets
            ruby: {
                type: 'pbr',
                albedoColor: { r: 0.9, g: 0.1, b: 0.1 },
                metallic: 0.3,
                roughness: 0.1,
                alpha: 0.85
            },

            emerald: {
                type: 'pbr',
                albedoColor: { r: 0.1, g: 0.8, b: 0.3 },
                metallic: 0.3,
                roughness: 0.1,
                alpha: 0.85
            },

            sapphire: {
                type: 'pbr',
                albedoColor: { r: 0.1, g: 0.3, b: 0.9 },
                metallic: 0.3,
                roughness: 0.1,
                alpha: 0.85
            }
        };
    }

    // [MAT.2] Set diffuse color
    setDiffuseColor(material, color) {
        if (material.diffuseColor) {
            material.diffuseColor = this.parseColor(color);
            console.log('[MAT.2] Diffuse color updated');
        } else if (material.albedoColor) {
            material.albedoColor = this.parseColor(color);
            console.log('[MAT.3] Albedo color updated');
        }
    }

    // [MAT.2] Set specular color
    setSpecularColor(material, color) {
        if (material.specularColor) {
            material.specularColor = this.parseColor(color);
            console.log('[MAT.2] Specular color updated');
        }
    }

    // [MAT.2] Set emissive color
    setEmissiveColor(material, color) {
        material.emissiveColor = this.parseColor(color);
        console.log('[MAT.2] Emissive color updated');
    }

    // [MAT.2] Set texture
    setTexture(material, type, url, tiling = { u: 1, v: 1 }) {
        const texture = new BABYLON.Texture(url, this.scene);
        texture.uScale = tiling.u;
        texture.vScale = tiling.v;

        switch (type) {
            case 'diffuse':
            case 'albedo':
                if (material.diffuseTexture !== undefined) {
                    material.diffuseTexture = texture;
                } else if (material.albedoTexture !== undefined) {
                    material.albedoTexture = texture;
                }
                break;

            case 'normal':
            case 'bump':
                material.bumpTexture = texture;
                break;

            case 'specular':
                material.specularTexture = texture;
                break;

            case 'metallic':
                if (material.metallicTexture !== undefined) {
                    material.metallicTexture = texture;
                }
                break;

            case 'roughness':
                if (material.roughnessTexture !== undefined) {
                    material.roughnessTexture = texture;
                }
                break;
        }

        console.log(`[MAT.2] Texture set: ${type}`);
    }

    // [MAT.2] Set opacity/alpha
    setOpacity(material, alpha) {
        material.alpha = alpha;

        if (alpha < 1.0) {
            material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        }

        console.log(`[MAT.2] Opacity set: ${alpha}`);
    }

    // [MAT.3] Set metallic (PBR only)
    setMetallic(material, value) {
        if (material.metallic !== undefined) {
            material.metallic = value;
            console.log(`[MAT.3] Metallic set: ${value}`);
        } else {
            console.warn('[MAT.3] Material does not support metallic property');
        }
    }

    // [MAT.3] Set roughness (PBR only)
    setRoughness(material, value) {
        if (material.roughness !== undefined) {
            material.roughness = value;
            console.log(`[MAT.3] Roughness set: ${value}`);
        } else {
            console.warn('[MAT.3] Material does not support roughness property');
        }
    }

    // [MAT.4] Use preset
    usePreset(presetName) {
        const preset = this.presets[presetName];

        if (!preset) {
            console.warn(`[MAT.4] Unknown preset: ${presetName}`);
            return null;
        }

        // Create material from preset
        const materialName = `${presetName}_${Date.now()}`;

        if (preset.type === 'pbr') {
            return this.createPBRMaterial(materialName, preset);
        } else {
            return this.createStandardMaterial(materialName, preset);
        }
    }

    // [MAT.4] Add custom preset
    addPreset(name, presetConfig) {
        this.presets[name] = presetConfig;
        console.log(`[MAT.4] Custom preset added: ${name}`);
    }

    // [MAT.4] Get available presets
    getPresets() {
        return Object.keys(this.presets);
    }

    // [MAT.5] Apply material to mesh
    applyMaterial(mesh, material) {
        if (!mesh || !material) {
            console.warn('[MAT.5] Mesh or material not provided');
            return;
        }

        mesh.material = material;

        console.log(`[MAT.5] Material applied to: ${mesh.name}`);
    }

    // [MAT.5] Animate material property
    animateMaterialProperty(material, property, targetValue, duration = 1.0) {
        // [MAT.5] Create animation
        const animation = new BABYLON.Animation(
            'materialAnimation',
            property,
            60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const keys = [
            { frame: 0, value: material[property] },
            { frame: 60 * duration, value: targetValue }
        ];

        animation.setKeys(keys);

        // [MAT.5] Run animation
        this.scene.beginDirectAnimation(material, [animation], 0, 60 * duration, false);

        console.log(`[MAT.5] Animating ${property} to ${targetValue} over ${duration}s`);
    }

    // [MAT.1] Get material by name
    getMaterial(name) {
        const materialData = this.materials.get(name);
        return materialData ? materialData.material : null;
    }

    // [MAT.1] Get all materials
    getAllMaterials() {
        const allMaterials = [];
        this.materials.forEach((materialData, name) => {
            allMaterials.push({
                name: name,
                type: materialData.type,
                material: materialData.material
            });
        });
        return allMaterials;
    }

    // [MAT.1] Delete material
    deleteMaterial(name) {
        const materialData = this.materials.get(name);

        if (!materialData) {
            console.warn(`[MAT.1] Material not found: ${name}`);
            return;
        }

        materialData.material.dispose();
        this.materials.delete(name);

        console.log(`[MAT.1] Material deleted: ${name}`);
    }

    // [MAT] Clone material
    cloneMaterial(material, newName) {
        if (!material) {
            console.warn('[MAT] No material to clone');
            return null;
        }

        const cloned = material.clone(newName);

        // Store cloned material
        const type = material instanceof BABYLON.PBRMaterial ? 'pbr' : 'standard';
        this.materials.set(newName, {
            material: cloned,
            type: type,
            options: {}
        });

        console.log(`[MAT] Material cloned: ${newName}`);

        return cloned;
    }

    // [MAT] Parse color (supports Color3, hex, rgb object)
    parseColor(color) {
        if (color instanceof BABYLON.Color3) {
            return color;
        } else if (typeof color === 'string') {
            // Hex string
            return BABYLON.Color3.FromHexString(color);
        } else if (color.r !== undefined && color.g !== undefined && color.b !== undefined) {
            // RGB object
            return new BABYLON.Color3(color.r, color.g, color.b);
        } else {
            console.warn('[MAT] Invalid color format');
            return new BABYLON.Color3(1, 1, 1);
        }
    }

    // [MAT] Clear all materials
    clearAllMaterials() {
        this.materials.forEach((materialData, name) => {
            materialData.material.dispose();
        });

        this.materials.clear();

        console.log('[MAT] All materials cleared');
    }

    // [MAT] Reset to defaults
    reset() {
        // Recreate default presets
        this.presets = this.createDefaultPresets();

        console.log('[MAT] Materials reset to defaults');
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Clear all materials
        this.clearAllMaterials();

        super.dispose();

        console.log('[MAT] MaterialPlugin disposed');
    }
}

// [MAT] Export for registration with engine
export default MaterialPlugin;
