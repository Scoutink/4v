/**
 * @file InfiniteGroundPlugin.js
 * @description Infinite procedural terrain system with chunk-based loading
 *
 * @tags [IGR.*] Infinite ground system
 * @primary-tags [IGR] Infinite ground plugin
 *
 * @dependencies
 *   - [IGR -> PLG] Extends Plugin base class
 *   - [IGR -> CFG] Uses configuration
 *   - [IGR -> EVT] Emits terrain events
 *   - [IGR -> CAM] Tracks camera position
 *   - [IGR -> MAT] Material management
 *
 * @affects
 *   - [IGR -> GRD] Alternative to GroundPlugin
 *   - [IGR -> PERF] Performance impact from chunk management
 *   - [IGR -> MEM] Memory management via chunk disposal
 *
 * @features
 *   - Chunk-based infinite terrain
 *   - Dynamic chunk loading/unloading
 *   - Camera position tracking
 *   - Procedural height generation (optional)
 *   - Seamless chunk transitions
 *   - Material/texture sharing
 *   - Memory-efficient disposal
 *   - Configurable chunk size and view distance
 *
 * @user-requirements
 *   1. Infinite terrain (no edges)
 *   2. Memory efficient (load/unload chunks)
 *   3. Seamless transitions
 *   4. Compatible with existing texture system
 *
 * @author Development Team
 * @created 2025-01-21
 */

import Plugin from '../core/Plugin.js';

// [IGR] Infinite Ground Plugin
// USER REQUIREMENT: Infinite terrain with chunk-based loading
class InfiniteGroundPlugin extends Plugin {
    constructor() {
        super('infiniteGround');

        // [IGR.1] Chunk configuration
        this.chunkSize = 50;              // Size of each chunk (50x50 units)
        this.viewDistance = 3;             // Load chunks within N chunks from camera
        this.chunkHeight = 0;              // Base height (Y position)

        // [IGR.2] Chunk storage
        this.chunks = new Map();           // Active chunks: key = "x,z", value = chunk object
        this.chunkPool = [];               // Reusable disposed chunks for optimization

        // [IGR.3] Camera tracking
        this.camera = null;
        this.lastCameraChunk = { x: 0, z: 0 };
        this.updateInterval = 500;         // Check camera position every 500ms
        this.updateTimer = null;

        // [IGR.4] Material configuration
        this.sharedMaterial = null;        // One material for all chunks (performance)
        this.textureMode = 'tiled';
        this.textureOptions = {};

        // [IGR.4.3] Texture presets (same as GroundPlugin for compatibility)
        this.texturePresets = {
            grass: {
                name: 'Grass',
                diffuse: 'https://playground.babylonjs.com/textures/grass.png',
                normal: 'https://playground.babylonjs.com/textures/grassn.png',
                tiling: { u: 10, v: 10 },
                description: '🌿 Grass (Tiled)'
            },
            dirt: {
                name: 'Dirt',
                diffuse: 'https://playground.babylonjs.com/textures/ground.jpg',
                tiling: { u: 8, v: 8 },
                description: '🟤 Dirt (Tiled)'
            },
            stone: {
                name: 'Stone',
                diffuse: 'https://playground.babylonjs.com/textures/rock.png',
                normal: 'https://playground.babylonjs.com/textures/rockn.png',
                tiling: { u: 6, v: 6 },
                description: '🪨 Stone (Tiled)'
            },
            sand: {
                name: 'Sand',
                diffuse: 'https://playground.babylonjs.com/textures/sand.jpg',
                tiling: { u: 8, v: 8 },
                description: '🏖️ Sand (Tiled)'
            },
            concrete: {
                name: 'Concrete',
                diffuse: 'https://playground.babylonjs.com/textures/floor.png',
                tiling: { u: 4, v: 4 },
                description: '⬜ Concrete (Tiled)'
            },
            wood: {
                name: 'Wood',
                diffuse: 'https://playground.babylonjs.com/textures/wood.jpg',
                tiling: { u: 5, v: 5 },
                description: '🪵 Wood (Tiled)'
            }
        };

        // [IGR.5] Procedural height configuration
        this.heightVariation = false;      // Enable height variation
        this.heightScale = 5;              // Max height variation
        this.heightOctaves = 3;            // Perlin noise octaves
        this.heightFrequency = 0.05;       // Noise frequency

        // [IGR.6] Performance settings
        this.enableShadows = true;
        this.enableCollision = true;
        this.subdivisions = 10;            // Subdivisions per chunk

        // [IGR.7] Statistics
        this.stats = {
            chunksLoaded: 0,
            chunksDisposed: 0,
            totalChunksCreated: 0,
            activeChunks: 0
        };

        console.log('[IGR] InfiniteGroundPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load infinite ground configuration
        const terrainConfig = config.infiniteGround || config.terrain || {};

        this.chunkSize = terrainConfig.chunkSize || 50;
        this.viewDistance = terrainConfig.viewDistance || 3;
        this.chunkHeight = terrainConfig.height || 0;
        this.heightVariation = terrainConfig.heightVariation || false;
        this.heightScale = terrainConfig.heightScale || 5;
        this.enableShadows = terrainConfig.shadows !== false;
        this.enableCollision = terrainConfig.collision !== false;
        this.subdivisions = terrainConfig.subdivisions || 10;

        // [IGR.4] Material/texture configuration
        if (terrainConfig.material) {
            this.materialConfig = terrainConfig.material;
        } else if (terrainConfig.texture) {
            this.materialConfig = {
                diffuse: terrainConfig.texture,
                tiling: terrainConfig.tiling || { u: 1, v: 1 }
            };
        }

        console.log('[IGR] Infinite ground configuration loaded');
        console.log(`[IGR] Chunk size: ${this.chunkSize}, View distance: ${this.viewDistance} chunks`);
    }

    // [PLG.2.1] Start plugin
    start() {
        // [IGR.3] Find camera
        this.camera = this.scene.activeCamera;

        if (!this.camera) {
            console.error('[IGR] No active camera found. Cannot start infinite terrain.');
            return;
        }

        // [IGR.4] Create shared material
        this.createSharedMaterial();

        // [IGR.1] Load initial chunks around camera
        this.updateChunks(true);

        // [IGR.3] Start camera tracking
        this.startCameraTracking();

        // [EVT.2] Emit terrain ready event
        this.events.emit('infiniteGround:ready', {
            chunkSize: this.chunkSize,
            viewDistance: this.viewDistance,
            heightVariation: this.heightVariation
        });

        console.log('[IGR] InfiniteGroundPlugin started');
        console.log(`[IGR] Initial chunks loaded: ${this.chunks.size}`);
    }

    // [IGR.3] Start camera position tracking
    startCameraTracking() {
        // Update chunks periodically based on camera movement
        this.updateTimer = setInterval(() => {
            this.updateChunks();
        }, this.updateInterval);

        console.log('[IGR] Camera tracking started');
    }

    // [IGR.3] Stop camera tracking
    stopCameraTracking() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }

        console.log('[IGR] Camera tracking stopped');
    }

    // [IGR.1] Update chunks based on camera position
    updateChunks(force = false) {
        if (!this.camera) return;

        // [IGR.3.1] Get camera chunk coordinates
        const cameraChunk = this.worldToChunk(this.camera.position.x, this.camera.position.z);

        // [IGR.3.2] Only update if camera moved to different chunk (or forced)
        if (!force &&
            cameraChunk.x === this.lastCameraChunk.x &&
            cameraChunk.z === this.lastCameraChunk.z) {
            return;
        }

        this.lastCameraChunk = cameraChunk;

        // [IGR.1.1] Calculate which chunks should be loaded
        const chunksToLoad = this.getChunksInRange(cameraChunk.x, cameraChunk.z, this.viewDistance);

        // [IGR.1.2] Load missing chunks
        const loadedChunks = [];
        chunksToLoad.forEach(chunkCoord => {
            const key = `${chunkCoord.x},${chunkCoord.z}`;
            if (!this.chunks.has(key)) {
                this.loadChunk(chunkCoord.x, chunkCoord.z);
                loadedChunks.push(chunkCoord);
            }
        });

        // [IGR.1.3] Unload chunks outside range
        const unloadedChunks = [];
        this.chunks.forEach((chunk, key) => {
            const [x, z] = key.split(',').map(Number);
            const distance = Math.max(Math.abs(x - cameraChunk.x), Math.abs(z - cameraChunk.z));

            if (distance > this.viewDistance) {
                this.unloadChunk(x, z);
                unloadedChunks.push({ x, z });
            }
        });

        // [IGR.7] Update statistics
        this.stats.activeChunks = this.chunks.size;

        // Log chunk changes (only if changed)
        if (loadedChunks.length > 0 || unloadedChunks.length > 0) {
            console.log(`[IGR] Chunks updated - Loaded: ${loadedChunks.length}, Unloaded: ${unloadedChunks.length}, Active: ${this.chunks.size}`);

            // [EVT.2] Emit chunks updated event
            this.events.emit('infiniteGround:chunks-updated', {
                loaded: loadedChunks,
                unloaded: unloadedChunks,
                activeChunks: this.chunks.size,
                cameraChunk: cameraChunk
            });
        }
    }

    // [IGR.1.1] Get all chunk coordinates within range
    getChunksInRange(centerX, centerZ, distance) {
        const chunks = [];

        for (let x = centerX - distance; x <= centerX + distance; x++) {
            for (let z = centerZ - distance; z <= centerZ + distance; z++) {
                chunks.push({ x, z });
            }
        }

        return chunks;
    }

    // [IGR.2] Load a chunk at given coordinates
    loadChunk(chunkX, chunkZ) {
        const key = `${chunkX},${chunkZ}`;

        // [IGR.2.1] Check if already loaded
        if (this.chunks.has(key)) {
            console.warn(`[IGR] Chunk ${key} already loaded`);
            return;
        }

        // [IGR.2.2] Calculate world position
        const worldX = chunkX * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize;

        // [IGR.2.3] Create chunk mesh
        let mesh;

        if (this.heightVariation) {
            // Create heightmap ground with procedural variation
            mesh = this.createHeightmapChunk(chunkX, chunkZ);
        } else {
            // Create flat plane chunk
            mesh = BABYLON.MeshBuilder.CreateGround(
                `chunk_${chunkX}_${chunkZ}`,
                {
                    width: this.chunkSize,
                    height: this.chunkSize,
                    subdivisions: this.subdivisions
                },
                this.scene
            );
        }

        // [IGR.2.4] Position chunk
        mesh.position.x = worldX + this.chunkSize / 2;
        mesh.position.y = this.chunkHeight;
        mesh.position.z = worldZ + this.chunkSize / 2;

        // [IGR.2.5] Apply shared material
        mesh.material = this.sharedMaterial;

        // [IGR.2.6] Configure collision and picking
        mesh.checkCollisions = this.enableCollision;
        mesh.isPickable = true;

        // [IGR.2.7] Configure shadows
        if (this.enableShadows) {
            mesh.receiveShadows = true;
        }

        // [IGR.2.8] Store chunk
        const chunk = {
            x: chunkX,
            z: chunkZ,
            mesh: mesh,
            loadedAt: Date.now()
        };

        this.chunks.set(key, chunk);

        // [IGR.7] Update statistics
        this.stats.chunksLoaded++;
        this.stats.totalChunksCreated++;
        this.stats.activeChunks = this.chunks.size;

        // [EVT.2] Emit chunk loaded event
        this.events.emit('infiniteGround:chunk-loaded', {
            x: chunkX,
            z: chunkZ,
            worldPosition: { x: worldX, z: worldZ }
        });

        return chunk;
    }

    // [IGR.2.9] Create heightmap chunk with procedural variation
    createHeightmapChunk(chunkX, chunkZ) {
        const name = `chunk_${chunkX}_${chunkZ}`;
        const subdivisions = this.subdivisions;

        // Create base ground
        const mesh = BABYLON.MeshBuilder.CreateGround(
            name,
            {
                width: this.chunkSize,
                height: this.chunkSize,
                subdivisions: subdivisions
            },
            this.scene
        );

        // Apply height variation using Perlin-like noise
        if (this.heightVariation) {
            const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const z = positions[i + 2];

                // World position for noise calculation
                const worldX = (chunkX * this.chunkSize) + x;
                const worldZ = (chunkZ * this.chunkSize) + z;

                // Generate height using simple noise function
                const height = this.generateHeight(worldX, worldZ);
                positions[i + 1] = height;
            }

            mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
            mesh.createNormals(true); // Recalculate normals for proper lighting
        }

        return mesh;
    }

    // [IGR.5] Generate procedural height using noise
    generateHeight(x, z) {
        // Simple multi-octave noise
        let height = 0;
        let amplitude = this.heightScale;
        let frequency = this.heightFrequency;

        for (let i = 0; i < this.heightOctaves; i++) {
            height += this.noise2D(x * frequency, z * frequency) * amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        return height;
    }

    // [IGR.5] Simple 2D noise function (pseudo-Perlin)
    noise2D(x, z) {
        // Simple deterministic pseudo-random noise
        // For production, use proper Perlin/Simplex noise library
        const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1; // Range: -1 to 1
    }

    // [IGR.2] Unload a chunk at given coordinates
    unloadChunk(chunkX, chunkZ) {
        const key = `${chunkX},${chunkZ}`;
        const chunk = this.chunks.get(key);

        if (!chunk) {
            console.warn(`[IGR] Chunk ${key} not found for unloading`);
            return;
        }

        // [IGR.2.1] Dispose mesh
        if (chunk.mesh) {
            chunk.mesh.dispose();
        }

        // [IGR.2.2] Remove from active chunks
        this.chunks.delete(key);

        // [IGR.7] Update statistics
        this.stats.chunksDisposed++;
        this.stats.activeChunks = this.chunks.size;

        // [EVT.2] Emit chunk unloaded event
        this.events.emit('infiniteGround:chunk-unloaded', {
            x: chunkX,
            z: chunkZ
        });
    }

    // [IGR.4] Create shared material for all chunks
    createSharedMaterial() {
        // Create StandardMaterial (can be upgraded to PBR later)
        this.sharedMaterial = new BABYLON.StandardMaterial('infiniteGroundMaterial', this.scene);

        // [IGR.4.1] Default material properties
        this.sharedMaterial.diffuseColor = new BABYLON.Color3(0.55, 0.45, 0.33); // Brown/dirt
        this.sharedMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        this.sharedMaterial.specularPower = 16;

        // [IGR.4.2] Apply texture from config if specified
        if (this.materialConfig && this.materialConfig.diffuse) {
            this.setTexture(
                this.materialConfig.diffuse,
                'tiled',
                { tiling: this.materialConfig.tiling || { u: 1, v: 1 } }
            );

            // Apply normal map if specified
            if (this.materialConfig.normal) {
                const normalTexture = new BABYLON.Texture(this.materialConfig.normal, this.scene);
                normalTexture.uScale = this.materialConfig.tiling?.u || 1;
                normalTexture.vScale = this.materialConfig.tiling?.v || 1;
                this.sharedMaterial.bumpTexture = normalTexture;
            }
        }

        console.log('[IGR] Shared material created');

        return this.sharedMaterial;
    }

    // [IGR.4] Set texture on shared material
    setTexture(url, mode = 'tiled', options = {}) {
        if (!this.sharedMaterial) {
            console.warn('[IGR] No material to set texture');
            return;
        }

        const texture = new BABYLON.Texture(url, this.scene);

        // Configure texture based on mode
        switch (mode) {
            case 'tiled':
                const tilingU = options.tiling?.u || 1;
                const tilingV = options.tiling?.v || 1;
                texture.uScale = tilingU;
                texture.vScale = tilingV;
                texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
                texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
                break;

            case 'stretched':
                texture.uScale = 1;
                texture.vScale = 1;
                texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
                texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
                break;
        }

        this.sharedMaterial.diffuseTexture = texture;
        this.textureMode = mode;
        this.textureOptions = options;

        console.log(`[IGR] Texture applied to all chunks: ${mode} mode`);

        // [EVT.2] Emit texture changed event
        this.events.emit('infiniteGround:texture-changed', {
            url,
            mode,
            options
        });

        return this;
    }

    // [IGR.4] Set texture tiling
    setTextureTiling(uScale, vScale) {
        if (!this.sharedMaterial) return;

        if (this.sharedMaterial.diffuseTexture) {
            this.sharedMaterial.diffuseTexture.uScale = uScale;
            this.sharedMaterial.diffuseTexture.vScale = vScale;
        }

        if (this.sharedMaterial.bumpTexture) {
            this.sharedMaterial.bumpTexture.uScale = uScale;
            this.sharedMaterial.bumpTexture.vScale = vScale;
        }

        console.log(`[IGR] Texture tiling updated: u=${uScale}, v=${vScale}`);

        return this;
    }

    // [IGR.4.4] Use texture preset (compatible with GroundPlugin)
    useTexturePreset(presetName) {
        const preset = this.texturePresets[presetName];

        if (!preset) {
            console.warn(`[IGR] Unknown texture preset: ${presetName}`);
            console.log('[IGR] Available presets:', Object.keys(this.texturePresets).join(', '));
            return;
        }

        // Apply diffuse texture with tiling
        this.setTexture(preset.diffuse, 'tiled', { tiling: preset.tiling });

        // Apply normal map if available
        if (preset.normal && this.sharedMaterial) {
            const normalTexture = new BABYLON.Texture(preset.normal, this.scene);
            normalTexture.uScale = preset.tiling.u;
            normalTexture.vScale = preset.tiling.v;
            this.sharedMaterial.bumpTexture = normalTexture;
        }

        console.log(`[IGR] Applied texture preset: ${preset.name} (${preset.description})`);

        // [EVT.2] Emit preset changed event
        this.events.emit('infiniteGround:texture-preset:changed', {
            preset: presetName,
            config: preset
        });

        return this;
    }

    // [IGR.UTIL] Convert world coordinates to chunk coordinates
    worldToChunk(worldX, worldZ) {
        return {
            x: Math.floor(worldX / this.chunkSize),
            z: Math.floor(worldZ / this.chunkSize)
        };
    }

    // [IGR.UTIL] Convert chunk coordinates to world coordinates (center)
    chunkToWorld(chunkX, chunkZ) {
        return {
            x: chunkX * this.chunkSize + this.chunkSize / 2,
            z: chunkZ * this.chunkSize + this.chunkSize / 2
        };
    }

    // [IGR.7] Get statistics
    getStats() {
        return { ...this.stats };
    }

    // [IGR.CONFIG] Set view distance (how many chunks to load)
    setViewDistance(distance) {
        this.viewDistance = distance;
        this.updateChunks(true); // Force update with new distance
        console.log(`[IGR] View distance set to ${distance} chunks`);
        return this;
    }

    // [IGR.CONFIG] Enable/disable height variation
    setHeightVariation(enabled, scale = this.heightScale) {
        this.heightVariation = enabled;
        this.heightScale = scale;
        console.log(`[IGR] Height variation ${enabled ? 'enabled' : 'disabled'} (scale: ${scale})`);
        return this;
    }

    // [PLG.1.4] Dispose and cleanup
    dispose() {
        // [IGR.3] Stop camera tracking
        this.stopCameraTracking();

        // [IGR.2] Dispose all chunks
        this.chunks.forEach((chunk, key) => {
            if (chunk.mesh) {
                chunk.mesh.dispose();
            }
        });
        this.chunks.clear();

        // [IGR.4] Dispose shared material
        if (this.sharedMaterial) {
            this.sharedMaterial.dispose();
            this.sharedMaterial = null;
        }

        super.dispose();

        console.log('[IGR] InfiniteGroundPlugin disposed');
        console.log(`[IGR] Final stats - Total created: ${this.stats.totalChunksCreated}, Disposed: ${this.stats.chunksDisposed}`);
    }
}

export default InfiniteGroundPlugin;
