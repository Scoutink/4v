/**
 * @file AssetPlugin.js
 * @description Asset loading and management system
 *
 * @tags [ASSET.*] All asset loading tags
 * @primary-tags [ASSET.1] Model loading, [ASSET.2] Texture loading
 * @critical-tags [!ASSET.3] Asset disposal critical for memory
 *
 * @dependencies
 *   - [ASSET -> BABYLON] Requires SceneLoader for GLTF/GLB
 *   - [ASSET -> EVT] Emits load progress and completion events
 *
 * @affects
 *   - Scene mesh count (adds loaded models)
 *   - Memory usage (textures and models)
 *
 * @events
 *   - Emits: asset:loaded, asset:progress, asset:error, asset:disposed
 *
 * @features
 *   - GLTF/GLB model loading
 *   - Texture loading with options
 *   - Asset library management
 *   - Batch preloading with progress
 *   - Memory management and disposal
 *
 * @author Development Team
 * @created 2025-11-20
 */

import Plugin from '../core/Plugin.js';

// [ASSET] Asset loading and management plugin
// [ASSET] USER REQUIREMENT: Load 3D models and textures dynamically
class AssetPlugin extends Plugin {
    constructor() {
        super('asset');

        // [ASSET.1] Asset registry
        this.assets = new Map();

        // [ASSET.2] Loading state
        this.loadingAssets = new Set();

        // [ASSET.3] Asset types
        this.assetTypes = {
            MODEL: 'model',
            TEXTURE: 'texture',
            SOUND: 'sound',  // Future
            MATERIAL: 'material'  // Future
        };

        // [ASSET.4] Default loading options
        this.defaultOptions = {
            model: {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scaling: { x: 1, y: 1, z: 1 }
            },
            texture: {
                uScale: 1,
                vScale: 1,
                wrapU: BABYLON.Texture.WRAP_ADDRESSMODE,
                wrapV: BABYLON.Texture.WRAP_ADDRESSMODE
            }
        };

        console.log('[ASSET] AssetPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load asset configuration
        const assetConfig = config.assets || {};

        // [ASSET.5] Base paths for different asset types
        this.basePaths = {
            models: assetConfig.modelsPath || 'assets/models/',
            textures: assetConfig.texturesPath || 'assets/textures/',
            sounds: assetConfig.soundsPath || 'assets/sounds/'
        };

        console.log('[ASSET] AssetPlugin configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        super.start();
        console.log('[ASSET] AssetPlugin started');
    }

    // [ASSET.1] Load GLTF/GLB model
    // USER REQUIREMENT: Load 3D models from files
    async loadModel(url, options = {}) {
        const name = options.name || this.generateAssetName('model');

        console.log(`[ASSET.1] Loading model: ${name} from ${url}`);

        // [ASSET.2] Mark as loading
        this.loadingAssets.add(name);

        try {
            // [ASSET.1.1] Use full path or relative path
            const fullUrl = url.startsWith('http') ? url : this.basePaths.models + url;

            // [ASSET.1.2] Load using Babylon SceneLoader
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                '',  // Load all meshes
                '',  // Base URL (empty, included in fullUrl)
                fullUrl,
                this.scene,
                (event) => {
                    // [EVT.2] Emit progress event
                    const progress = event.loaded / event.total;
                    this.events.emit('asset:progress', {
                        name,
                        type: 'model',
                        progress,
                        loaded: event.loaded,
                        total: event.total
                    });

                    if (options.onProgress) {
                        options.onProgress(event);
                    }
                }
            );

            // [ASSET.1.3] Apply transformations
            const meshes = result.meshes;

            if (options.position) {
                const root = meshes[0];
                root.position.x = options.position.x || 0;
                root.position.y = options.position.y || 0;
                root.position.z = options.position.z || 0;
            }

            if (options.rotation) {
                const root = meshes[0];
                root.rotation.x = options.rotation.x || 0;
                root.rotation.y = options.rotation.y || 0;
                root.rotation.z = options.rotation.z || 0;
            }

            if (options.scaling) {
                const root = meshes[0];
                root.scaling.x = options.scaling.x || 1;
                root.scaling.y = options.scaling.y || 1;
                root.scaling.z = options.scaling.z || 1;
            }

            // [ASSET.3] Store in registry
            this.assets.set(name, {
                type: 'model',
                url,
                meshes: result.meshes,
                animationGroups: result.animationGroups,
                skeletons: result.skeletons,
                particleSystems: result.particleSystems,
                loadedAt: Date.now()
            });

            // [ASSET.2] Remove from loading
            this.loadingAssets.delete(name);

            // [EVT.2] Emit loaded event
            this.events.emit('asset:loaded', {
                name,
                type: 'model',
                asset: this.assets.get(name)
            });

            console.log(`[ASSET.1] Model loaded: ${name} (${meshes.length} meshes)`);

            // [ASSET.4] Success callback
            if (options.onSuccess) {
                options.onSuccess(result.meshes, result);
            }

            return result.meshes;

        } catch (error) {
            // [ASSET.2] Remove from loading
            this.loadingAssets.delete(name);

            // [EVT.2] Emit error event
            this.events.emit('asset:error', {
                name,
                type: 'model',
                url,
                error: error.message
            });

            console.error(`[ASSET.1] Failed to load model: ${name}`, error);

            // [ASSET.4] Error callback
            if (options.onError) {
                options.onError(error);
            }

            throw error;
        }
    }

    // [ASSET.2] Load texture
    // USER REQUIREMENT: Load textures with options
    loadTexture(url, options = {}) {
        const name = options.name || this.generateAssetName('texture');

        console.log(`[ASSET.2] Loading texture: ${name} from ${url}`);

        // [ASSET.2] Mark as loading
        this.loadingAssets.add(name);

        try {
            // [ASSET.2.1] Use full path or relative path
            const fullUrl = url.startsWith('http') ? url : this.basePaths.textures + url;

            // [ASSET.2.2] Create texture
            const texture = new BABYLON.Texture(
                fullUrl,
                this.scene,
                undefined,  // noMipMap
                undefined,  // invertY
                undefined,  // samplingMode
                () => {
                    // [ASSET.2] Remove from loading
                    this.loadingAssets.delete(name);

                    // [EVT.2] Emit loaded event
                    this.events.emit('asset:loaded', {
                        name,
                        type: 'texture',
                        asset: this.assets.get(name)
                    });

                    console.log(`[ASSET.2] Texture loaded: ${name}`);

                    if (options.onSuccess) {
                        options.onSuccess(texture);
                    }
                },
                (message, exception) => {
                    // [ASSET.2] Remove from loading
                    this.loadingAssets.delete(name);

                    // [EVT.2] Emit error event
                    this.events.emit('asset:error', {
                        name,
                        type: 'texture',
                        url,
                        error: message
                    });

                    console.error(`[ASSET.2] Failed to load texture: ${name}`, message);

                    if (options.onError) {
                        options.onError(message, exception);
                    }
                }
            );

            // [ASSET.2.3] Apply texture options
            texture.uScale = options.uScale || 1;
            texture.vScale = options.vScale || 1;
            texture.wrapU = options.wrapU || BABYLON.Texture.WRAP_ADDRESSMODE;
            texture.wrapV = options.wrapV || BABYLON.Texture.WRAP_ADDRESSMODE;

            if (options.hasAlpha !== undefined) {
                texture.hasAlpha = options.hasAlpha;
            }

            // [ASSET.3] Store in registry
            this.assets.set(name, {
                type: 'texture',
                url,
                texture,
                loadedAt: Date.now()
            });

            return texture;

        } catch (error) {
            // [ASSET.2] Remove from loading
            this.loadingAssets.delete(name);

            console.error(`[ASSET.2] Failed to load texture: ${name}`, error);

            if (options.onError) {
                options.onError(error);
            }

            throw error;
        }
    }

    // [ASSET.5] Preload multiple assets with progress tracking
    // USER REQUIREMENT: Batch loading with progress
    async preload(assetsToLoad, callbacks = {}) {
        console.log(`[ASSET.5] Preloading ${assetsToLoad.length} assets`);

        const results = {
            loaded: [],
            failed: [],
            total: assetsToLoad.length
        };

        let completedCount = 0;

        // [ASSET.5.1] Load each asset
        for (const assetDef of assetsToLoad) {
            try {
                let asset;

                switch (assetDef.type) {
                    case 'model':
                        asset = await this.loadModel(assetDef.url, {
                            name: assetDef.name,
                            ...assetDef.options
                        });
                        break;

                    case 'texture':
                        asset = this.loadTexture(assetDef.url, {
                            name: assetDef.name,
                            ...assetDef.options
                        });
                        break;

                    default:
                        throw new Error(`Unknown asset type: ${assetDef.type}`);
                }

                results.loaded.push({
                    name: assetDef.name,
                    type: assetDef.type,
                    asset
                });

            } catch (error) {
                results.failed.push({
                    name: assetDef.name,
                    type: assetDef.type,
                    error: error.message
                });
            }

            // [ASSET.5.2] Update progress
            completedCount++;

            if (callbacks.onProgress) {
                callbacks.onProgress(completedCount, results.total);
            }

            // [EVT.2] Emit progress event
            this.events.emit('asset:preload:progress', {
                loaded: completedCount,
                total: results.total,
                progress: completedCount / results.total
            });
        }

        // [ASSET.5.3] All complete
        console.log(`[ASSET.5] Preload complete: ${results.loaded.length}/${results.total} loaded`);

        if (callbacks.onComplete) {
            callbacks.onComplete(results);
        }

        // [EVT.2] Emit complete event
        this.events.emit('asset:preload:complete', results);

        return results;
    }

    // [ASSET.6] Get loaded asset
    getAsset(name) {
        return this.assets.get(name);
    }

    // [ASSET.6] Check if asset is loaded
    hasAsset(name) {
        return this.assets.has(name);
    }

    // [ASSET.6] Check if asset is currently loading
    isLoading(name) {
        return this.loadingAssets.has(name);
    }

    // [ASSET.6] List all loaded assets
    listAssets() {
        return Array.from(this.assets.keys());
    }

    // [ASSET.6] Get assets by type
    getAssetsByType(type) {
        const results = [];
        for (const [name, asset] of this.assets.entries()) {
            if (asset.type === type) {
                results.push({ name, ...asset });
            }
        }
        return results;
    }

    // [!ASSET.7] Dispose asset
    // CRITICAL: Proper disposal prevents memory leaks
    disposeAsset(name) {
        const asset = this.assets.get(name);

        if (!asset) {
            console.warn(`[ASSET.7] Asset not found: ${name}`);
            return false;
        }

        console.log(`[ASSET.7] Disposing asset: ${name}`);

        try {
            // [ASSET.7.1] Dispose based on type
            switch (asset.type) {
                case 'model':
                    // Dispose all meshes
                    if (asset.meshes) {
                        asset.meshes.forEach(mesh => {
                            if (mesh && !mesh.isDisposed()) {
                                mesh.dispose();
                            }
                        });
                    }
                    // Dispose animation groups
                    if (asset.animationGroups) {
                        asset.animationGroups.forEach(ag => ag.dispose());
                    }
                    // Dispose skeletons
                    if (asset.skeletons) {
                        asset.skeletons.forEach(skeleton => skeleton.dispose());
                    }
                    break;

                case 'texture':
                    if (asset.texture && !asset.texture.isDisposed()) {
                        asset.texture.dispose();
                    }
                    break;
            }

            // [ASSET.7.2] Remove from registry
            this.assets.delete(name);

            // [EVT.2] Emit disposed event
            this.events.emit('asset:disposed', {
                name,
                type: asset.type
            });

            console.log(`[ASSET.7] Asset disposed: ${name}`);
            return true;

        } catch (error) {
            console.error(`[ASSET.7] Error disposing asset: ${name}`, error);
            return false;
        }
    }

    // [!ASSET.7] Dispose all assets
    // CRITICAL: Call before switching scenes
    clearAssets() {
        console.log(`[ASSET.7] Clearing all assets (${this.assets.size} total)`);

        const assetNames = Array.from(this.assets.keys());

        for (const name of assetNames) {
            this.disposeAsset(name);
        }

        console.log('[ASSET.7] All assets cleared');
    }

    // [ASSET.8] Generate unique asset name
    generateAssetName(type) {
        let index = 1;
        let name = `${type}_${index}`;

        while (this.assets.has(name)) {
            index++;
            name = `${type}_${index}`;
        }

        return name;
    }

    // [ASSET.9] Get loading statistics
    getStats() {
        return {
            total: this.assets.size,
            loading: this.loadingAssets.size,
            byType: {
                models: this.getAssetsByType('model').length,
                textures: this.getAssetsByType('texture').length
            }
        };
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Dispose all assets
        this.clearAssets();

        super.dispose();

        console.log('[ASSET] AssetPlugin disposed');
    }
}

// [ASSET] Export for registration with engine
export default AssetPlugin;
