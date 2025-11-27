/**
 * @file GroundPlugin.js
 * @description Ground/terrain system with rotation, sizing, and edge behaviors
 *
 * @tags [GRD.*] Ground system
 * @primary-tags [GRD] Ground plugin
 *
 * @dependencies
 *   - [GRD -> PLG] Extends Plugin base class
 *   - [GRD -> CFG] Uses configuration
 *   - [GRD -> EVT] Emits ground events
 *   - [GRD -> MAT] Works with MaterialPlugin
 *   - [GRD -> COL] Collision detection
 *
 * @affects
 *   - [GRD -> CAM] Ground rotation affects camera orientation
 *   - [GRD -> MOV] Edge behavior affects movement
 *   - [GRD -> PHY] Ground physics properties
 *
 * @features
 *   - Ground types: plane, grid, heightmap
 *   - Rotation/tilt (USER REQ: 3D website use case!)
 *   - Size modes: fixed, device-relative
 *   - Edge behaviors: stop, teleport, wrap, custom
 *   - Material support
 *   - Collision and physics
 *
 * @user-requirements
 *   1. Ground rotation/tilt for 3D websites
 *   2. Fixed and procedural sizing (procedural in Phase 3)
 *   3. Device-relative sizing
 *   4. Edge behaviors (stop, teleport)
 *
 * @author Development Team
 * @created 2025-11-20
 */

import Plugin from '../core/Plugin.js';

// [GRD] Ground plugin
// [GRD] USER REQUIREMENT: Rotation for 3D websites, edge behaviors
class GroundPlugin extends Plugin {
    constructor() {
        super('ground');

        // [GRD.1] Ground mesh
        this.ground = null;

        // [GRD.2] Size configuration
        this.sizeMode = 'fixed';
        this.width = 100;
        this.height = 100;

        // [GRD.3] Rotation configuration
        // USER REQUIREMENT: For 3D websites (vertical/tilted layouts)
        this.rotation = { x: 0, y: 0, z: 0 };
        this.rotateFullScene = true; // USER REQUIREMENT: Rotate all objects with ground
        this.rotationPresets = {
            horizontal: { x: 0, y: 0, z: 0 },              // Default
            vertical: { x: Math.PI / 2, y: 0, z: 0 },      // Wall-like
            diagonal45: { x: Math.PI / 4, y: 0, z: Math.PI / 4 }  // 45° tilt
        };

        // [GRD.4] Edge behavior configuration
        // USER REQUIREMENT: Camera behavior at ground edges
        this.edgeBehavior = 'stop';  // 'stop', 'teleport', 'wrap', 'custom'
        this.edgeCallback = null;
        this.teleportPosition = { x: 0, y: 2, z: 0 };
        this.edgeDetectionObserver = null;
        this.boundaryWalls = null; // Invisible walls for 'stop' behavior

        // [GRD.5] Material configuration
        this.material = null;
        this.textureMode = 'tiled'; // 'tiled', 'stretched', 'centered'
        this.textureOptions = {};

        // [GRD.5.4] Texture presets
        // USER REQUIREMENT: Easy texture application with presets
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

        // [GRD] Type
        this.groundType = 'plane';

        // [GRD] State
        this.collisionEnabled = true;
        this.physicsEnabled = false;

        console.log('[GRD] GroundPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load ground configuration
        const groundConfig = config.ground || {};

        this.groundType = groundConfig.type || 'plane';
        this.sizeMode = groundConfig.sizeMode || 'fixed';
        this.width = groundConfig.width || groundConfig.size || 100;
        this.height = groundConfig.height || groundConfig.size || 100;
        this.rotation = groundConfig.rotation || { x: 0, y: 0, z: 0 };
        this.edgeBehavior = groundConfig.edgeBehavior || 'stop';
        this.collisionEnabled = groundConfig.collision !== false;

        // [FIX #6] Load saved edge behavior from localStorage
        if (typeof localStorage !== 'undefined') {
            const savedBehavior = localStorage.getItem('3dcms_edgeBehavior');
            if (savedBehavior) {
                this.edgeBehavior = savedBehavior;
                console.log('[GRD] Loaded saved edge behavior:', savedBehavior);
            }
        }

        // [GRD.4.2] Teleport position
        if (groundConfig.teleportPosition) {
            this.teleportPosition = groundConfig.teleportPosition;
        }

        // [GRD.5] Load material/texture configuration
        if (groundConfig.material) {
            this.materialConfig = groundConfig.material;
        } else if (groundConfig.texture) {
            // Support legacy texture config
            this.materialConfig = {
                diffuse: groundConfig.texture,
                tiling: groundConfig.tiling || { u: 1, v: 1 }
            };
        }

        console.log('[GRD] Ground configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        // [GRD.1] Create ground
        this.createGround(this.groundType);

        // [GRD.5] Apply texture from config if specified
        if (this.materialConfig) {
            if (this.materialConfig.diffuse) {
                this.setTexture(
                    this.materialConfig.diffuse,
                    'tiled',
                    { tiling: this.materialConfig.tiling || { u: 1, v: 1 } }
                );

                // Apply additional PBR maps if specified
                if (this.materialConfig.normal || this.materialConfig.roughness) {
                    const material = this.ground.material;
                    if (this.materialConfig.normal) {
                        const normalTexture = new BABYLON.Texture(this.materialConfig.normal, this.scene);
                        normalTexture.uScale = this.materialConfig.tiling?.u || 1;
                        normalTexture.vScale = this.materialConfig.tiling?.v || 1;
                        material.bumpTexture = normalTexture;
                    }
                }
            }
        }

        // [GRD.3] Apply rotation if specified
        if (this.rotation.x !== 0 || this.rotation.y !== 0 || this.rotation.z !== 0) {
            this.setRotation(this.rotation.x, this.rotation.y, this.rotation.z);
        }

        // [GRD.2.4] Handle device-relative sizing
        if (this.sizeMode === 'relative') {
            this.updateDeviceRelativeSize();

            // [GRD.2.4] Listen for window resize
            window.addEventListener('resize', this.updateDeviceRelativeSize.bind(this));
        }

        // [FIX #5] Store initial camera position for teleport functionality
        // [FIX #3.2] Store in ground-local space so it works with rotated ground
        if (this.scene.activeCamera) {
            const cameraPos = this.scene.activeCamera.position;
            if (this.ground) {
                // Transform to ground-local space
                const invWorldMatrix = this.ground.getWorldMatrix().invert();
                const localPos = BABYLON.Vector3.TransformCoordinates(cameraPos, invWorldMatrix);
                this.teleportPosition = {
                    x: localPos.x,
                    y: localPos.y,
                    z: localPos.z
                };
            } else {
                // Fallback to world position
                this.teleportPosition = {
                    x: cameraPos.x,
                    y: cameraPos.y,
                    z: cameraPos.z
                };
            }
            console.log('[GRD] Initial camera position stored for teleport (ground-local):', this.teleportPosition);
        }

        // [GRD.4] Start edge detection if needed
        if (this.sizeMode === 'fixed' && this.edgeBehavior !== 'none') {
            this.startEdgeDetection();

            // [GRD.4.5] Create invisible boundary walls for 'stop' behavior
            if (this.edgeBehavior === 'stop') {
                this.createBoundaryWalls();
            }
        }

        // [PRODUCTION ARCHITECTURE] Physics initialization with guaranteed timing
        // CRITICAL: Event-driven approach fails because physics:enabled fires BEFORE
        // GroundPlugin registers its listener. Using onBeforeRenderObservable ensures
        // physics is ready by first render frame.

        let physicsAdded = false;
        const physicsObserver = this.scene.onBeforeRenderObservable.add(() => {
            if (physicsAdded) return;

            const collisionPlugin = this.scene.metadata?.collisionPlugin;
            if (collisionPlugin?.physicsEnabled) {
                console.log('[GRD] Physics ready, adding ground physics body');
                this.addGroundPhysics();
                physicsAdded = true;
                this.scene.onBeforeRenderObservable.remove(physicsObserver);
            }
        });

        // [EVT.2] Emit ground ready event
        this.events.emit('ground:ready', {
            type: this.groundType,
            size: { width: this.width, height: this.height },
            rotation: this.rotation
        });

        console.log('[GRD] GroundPlugin started');
    }

    // [GRD.1] Create ground mesh
    createGround(type = 'plane', options = {}) {
        // Dispose existing ground
        if (this.ground) {
            this.ground.dispose();
        }

        this.groundType = type;

        switch (type) {
            case 'plane':
                this.ground = this.createPlaneGround(options);
                break;

            case 'grid':
                this.ground = this.createGridGround(options);
                break;

            case 'heightmap':
                this.ground = this.createHeightmapGround(options);
                break;

            default:
                console.warn(`[GRD.1] Unknown ground type: ${type}, using plane`);
                this.ground = this.createPlaneGround(options);
        }

        // [GRD.1] Apply common settings
        this.ground.name = 'ground';
        this.ground.metadata = this.ground.metadata || {}
            ;
        this.ground.metadata.isGround = true;

        // [COL.2] Enable collision if configured
        if (this.collisionEnabled) {
            this.ground.checkCollisions = true;
            this.ground.isPickable = true;
        }

        // [REMOVED] Synchronous physics check - now using event-driven approach in start()

        // [EVT.2] Emit ground created event
        this.events.emit('ground:created', {
            type: this.groundType,
            ground: this.ground
        });

        console.log(`[GRD.1] Ground created: ${type}`);

        return this.ground;
    }

    // [PRODUCTION ARCHITECTURE] Add physics body to ground (called via event)
    addGroundPhysics() {
        if (!this.ground) {
            console.warn('[GRD] Cannot add physics: ground not created yet');
            return;
        }

        const collisionPlugin = this.scene.metadata?.collisionPlugin;
        if (!collisionPlugin || !collisionPlugin.physicsEnabled) {
            console.warn('[GRD] Cannot add physics: CollisionPlugin not ready');
            return;
        }

        // Prevent duplicate physics bodies
        if (this.ground.physicsBody) {
            console.log('[GRD] Ground already has physics body, skipping');
            return;
        }

        console.log('[GRD] 🔧 Adding static physics body to ground');
        collisionPlugin.enablePhysicsBody(this.ground, {
            mass: 0,  // Static (immovable)
            shape: BABYLON.PhysicsShapeType.BOX,
            friction: 0.8,
            restitution: 0.1
        });
        console.log('[GRD] ✅ Ground physics body created');
    }

    // [GRD.1.1] Create plane ground
    createPlaneGround(options = {}) {
        const width = options.width || this.width;
        const height = options.height || this.height;
        const subdivisions = options.subdivisions || 32;

        const ground = BABYLON.MeshBuilder.CreateGround(
            'ground',
            {
                width: width,
                height: height,
                subdivisions: subdivisions
            },
            this.scene
        );

        // [GRD.5] Apply default material
        this.applyDefaultMaterial(ground);

        // [MOV.5] Ensure ground is pickable for click-to-move
        ground.isPickable = true;

        return ground;
    }

    // [GRD.1.2] Create grid ground (for editor visualization)
    createGridGround(options = {}) {
        const width = options.width || this.width;
        const height = options.height || this.height;
        const subdivisions = options.subdivisions || 20;

        const ground = BABYLON.MeshBuilder.CreateGround(
            'ground',
            {
                width: width,
                height: height,
                subdivisions: subdivisions
            },
            this.scene
        );

        // [GRD.5] Grid material
        const material = new BABYLON.StandardMaterial('gridMaterial', this.scene);
        material.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        material.wireframe = true;
        ground.material = material;

        // [MOV.5] Ensure ground is pickable for click-to-move
        ground.isPickable = true;

        return ground;
    }

    // [GRD.1.3] Create heightmap ground (terrain from image)
    createHeightmapGround(options = {}) {
        const width = options.width || this.width;
        const height = options.height || this.height;
        const subdivisions = options.subdivisions || 100;
        const minHeight = options.minHeight || 0;
        const maxHeight = options.maxHeight || 10;
        const url = options.url;

        if (!url) {
            console.error('[GRD.1.3] Heightmap URL required');
            return this.createPlaneGround(options);
        }

        const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
            'ground',
            url,
            {
                width: width,
                height: height,
                subdivisions: subdivisions,
                minHeight: minHeight,
                maxHeight: maxHeight,
                onReady: () => {
                    // [GRD.5] Apply default material
                    this.applyDefaultMaterial(ground);

                    // [MOV.5] Ensure ground is pickable for click-to-move
                    ground.isPickable = true;

                    // [EVT.2] Emit heightmap ready
                    this.events.emit('ground:heightmap:ready', { ground });
                }
            },
            this.scene
        );

        // [MOV.5] Set pickable immediately (before heightmap loads)
        ground.isPickable = true;

        return ground;
    }

    // [GRD.3] Use rotation preset
    // USER REQUIREMENT: Quick rotation presets
    useRotationPreset(presetName) {
        const preset = this.rotationPresets[presetName];
        if (!preset) {
            console.warn(`[GRD.3] Rotation preset '${presetName}' not found`);
            return;
        }

        this.setRotation(preset.x, preset.y, preset.z);
        console.log(`[GRD.3] ✅ Applied rotation preset: ${presetName}`);
    }

    // [GRD.3] Set ground rotation
    // [FIX #3] FIXED: Use parent-child hierarchy instead of buggy matrix math
    // USER REQUIREMENT: For 3D website layouts (vertical/tilted grounds)
    setRotation(x, y, z, rotateFullScene = this.rotateFullScene) {
        if (!this.ground) {
            console.warn('[GRD.3] No ground to rotate');
            return;
        }

        // [FIX #3.1] CORRECTED: Always parent objects when rotateFullScene is enabled
        // This fixes race condition where objects might not exist during initial setup
        // The parentObjectsToGround() method already filters out already-parented objects
        if (rotateFullScene) {
            const count = this.parentObjectsToGround();
            if (count > 0) {
                console.log(`[GRD.3] Parented ${count} new objects to ground for rotation`);
            }
        }

        // Store rotation
        this.rotation = { x, y, z };

        // [FIX #3] Simply rotate the ground - children follow automatically!
        this.ground.rotation.x = x;
        this.ground.rotation.y = y;
        this.ground.rotation.z = z;

        // [CRITICAL FIX] Force physics engine to sync parented objects
        // When ground rotates, parented physics bodies need explicit sync
        if (rotateFullScene) {
            // Compute world matrix to ensure transforms are current
            this.ground.computeWorldMatrix(true);

            // Force update all parented physics bodies
            this.ground.getChildMeshes().forEach(childMesh => {
                if (childMesh.physicsBody) {
                    // For ANIMATED bodies, we need to explicitly tell physics engine
                    // to update its transform from the mesh
                    childMesh.computeWorldMatrix(true);

                    // Sync physics body position/rotation with visual mesh
                    const body = childMesh.physicsBody;
                    const worldPos = childMesh.absolutePosition;
                    const worldRot = childMesh.absoluteRotationQuaternion;

                    body.setTargetTransform(worldPos, worldRot);
                }
            });

            console.log(`[GRD.3.1] Synced physics transforms for ${this.ground.getChildMeshes().length} parented objects`);
        }

        // [EVT.2] Emit rotation changed event
        this.events.emit('ground:rotation:changed', {
            rotation: this.rotation,
            ground: this.ground,
            fullScene: rotateFullScene
        });

        console.log(`[GRD.3] Ground rotation set: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) ${rotateFullScene ? '(full scene)' : ''}`);
    }

    // [FIX #3] NEW METHOD: Parent all scene objects to ground for automatic rotation
    // USER REQUIREMENT: When ground rotates, objects follow naturally via parent-child hierarchy
    parentObjectsToGround() {
        if (!this.scene || !this.ground) return;

        // Get all meshes that should be parented to ground
        const objectsToParent = this.scene.meshes.filter(mesh => {
            if (!mesh) return false;
            if (mesh === this.ground) return false;
            if (mesh.name === 'camera') return false;
            if (mesh.name === 'skybox') return false;
            if (mesh.metadata?.excludeFromGroundRotation) return false;
            // Don't parent objects that already have a parent (to avoid conflicts)
            // Note: Boundary walls are now explicitly parented when created
            if (mesh.parent) return false;
            return true;
        });

        // Parent each object to the ground
        objectsToParent.forEach(mesh => {
            this.glueObject(mesh);
        });

        console.log(`[GRD.3] Parented ${objectsToParent.length} objects to ground`);
        return objectsToParent.length;
    }

    // [GRD.6] Glue object to ground (Parenting + Physics)
    // USER REQUIREMENT: "Glue" objects so they don't move when ground tilts
    glueObject(mesh) {
        if (!mesh || !this.ground) return;

        // 1. Visual Parenting
        mesh.setParent(this.ground);

        // 2. Physics Handling
        // If object has physics, we need to ensure it moves with the ground
        if (mesh.physicsBody) {
            // Option A: Make it kinematic (animated) so it follows parent transform
            // [FIX] Force ANIMATED motion type to prevent flickering/fighting with physics engine
            mesh.physicsBody.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
            mesh.physicsBody.disablePreStep = false; // Ensure it updates

            // Option B: Disable physics temporarily (simple "stick")
            // mesh.physicsBody.disablePreStep = true;

            // We use Option A to allow it to still interact with other objects (like a moving wall)
        }

        mesh.metadata = mesh.metadata || {};
        mesh.metadata.isGlued = true;

        console.log(`[GRD.6] Glued object: ${mesh.name}`);
    }

    // [GRD.6] Unglue object from ground
    unglueObject(mesh) {
        if (!mesh) return;

        // 1. Unparent (restore world transform)
        mesh.setParent(null);

        // 2. Restore Physics
        if (mesh.physicsBody) {
            // Restore to dynamic (falling) or static based on original mass
            const originalMass = mesh.metadata?.physicsSettings?.mass || 1;
            const motionType = originalMass === 0 ? BABYLON.PhysicsMotionType.STATIC : BABYLON.PhysicsMotionType.DYNAMIC;

            mesh.physicsBody.setMotionType(motionType);

            // Wake up the body
            mesh.physicsBody.setActivationState(BABYLON.PhysicsActivationState.ACTIVE);
        }

        if (mesh.metadata) {
            mesh.metadata.isGlued = false;
        }

        console.log(`[GRD.6] Unglued object: ${mesh.name}`);
    }

    // [GRD.3] Use rotation preset
    // USER REQUIREMENT: Quick presets for common use cases
    useRotationPreset(preset) {
        const rotation = this.rotationPresets[preset];

        if (!rotation) {
            console.warn(`[GRD.3] Unknown rotation preset: ${preset}`);
            return;
        }

        this.setRotation(rotation.x, rotation.y, rotation.z);

        console.log(`[GRD.3] Rotation preset applied: ${preset}`);
    }

    // [GRD.3] Get current rotation
    getRotation() {
        return { ...this.rotation };
    }

    // [GRD.3.2] Set rotate full scene option
    // USER REQUIREMENT: Toggle whether ground rotation affects all objects
    setRotateFullScene(enabled) {
        this.rotateFullScene = enabled;
        console.log(`[GRD.3.2] Rotate full scene: ${enabled ? 'enabled' : 'disabled'}`);

        // [EVT.2] Emit setting changed event
        this.events.emit('ground:rotate_full_scene:changed', {
            enabled
        });
    }

    // [GRD.3.2] Get rotate full scene setting
    getRotateFullScene() {
        return this.rotateFullScene;
    }

    // [GRD.2] Set size mode
    setSizeMode(mode, options = {}) {
        this.sizeMode = mode;

        switch (mode) {
            case 'fixed':
                this.width = options.width || this.width;
                this.height = options.height || this.height;
                break;

            case 'relative':
                // Device-relative sizing
                this.updateDeviceRelativeSize(options);
                break;

            default:
                console.warn(`[GRD.2] Unknown size mode: ${mode}`);
        }

        // Recreate ground with new size
        if (this.ground) {
            this.createGround(this.groundType);
            this.setRotation(this.rotation.x, this.rotation.y, this.rotation.z);
        }

        console.log(`[GRD.2] Size mode set: ${mode}`);
    }

    // [GRD.2.4] Update device-relative size
    updateDeviceRelativeSize(options = {}) {
        const widthMultiplier = options.widthMultiplier || 2.0;
        const heightMultiplier = options.heightMultiplier || 2.0;

        // Calculate based on viewport
        const canvas = this.scene.getEngine().getRenderingCanvas();
        const viewportWidth = canvas.clientWidth;
        const viewportHeight = canvas.clientHeight;

        this.width = (viewportWidth / 100) * widthMultiplier * 50;
        this.height = (viewportHeight / 100) * heightMultiplier * 50;

        console.log(`[GRD.2.4] Device-relative size: ${this.width.toFixed(0)} x ${this.height.toFixed(0)}`);
    }

    // [GRD.2] Get current size
    getSize() {
        return {
            width: this.width,
            height: this.height,
            mode: this.sizeMode
        };
    }

    // [GRD.4] Set edge behavior
    // USER REQUIREMENT: Camera behavior at ground edges
    setEdgeBehavior(behavior, options = {}) {
        this.edgeBehavior = behavior;

        if (behavior === 'teleport' && options.returnPosition) {
            this.teleportPosition = options.returnPosition;
        }

        if (behavior === 'custom' && options.callback) {
            this.edgeCallback = options.callback;
        }

        // Dispose existing boundary walls if switching away from 'stop'
        if (behavior !== 'stop' && this.boundaryWalls) {
            this.boundaryWalls.forEach(wall => wall.dispose());
            this.boundaryWalls = null;
        }

        // Start/stop edge detection
        if (behavior !== 'none' && this.sizeMode === 'fixed') {
            this.startEdgeDetection();

            // Create boundary walls for 'stop' behavior
            if (behavior === 'stop') {
                this.createBoundaryWalls();
            }
        } else {
            this.stopEdgeDetection();
        }

        // [FIX #6] Save to localStorage for persistence
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('3dcms_edgeBehavior', behavior);
        }

        // [FIX #6] Emit event for UI update
        this.events.emit('ground:edge-behavior:changed', {
            behavior: behavior
        });

        console.log(`[GRD.4] Edge behavior set: ${behavior}`);
    }

    // [GRD.4] Start edge detection
    startEdgeDetection() {
        if (this.edgeDetectionObserver) {
            return; // Already started
        }

        // [GRD.4] Check edges every frame
        this.edgeDetectionObserver = this.scene.onBeforeRenderObservable.add(() => {
            this.checkCameraEdge();
        });

        console.log('[GRD.4] Edge detection started');
    }

    // [GRD.4] Stop edge detection
    stopEdgeDetection() {
        if (this.edgeDetectionObserver) {
            this.scene.onBeforeRenderObservable.remove(this.edgeDetectionObserver);
            this.edgeDetectionObserver = null;
            console.log('[GRD.4] Edge detection stopped');
        }
    }

    // [GRD.4] Check if camera is at edge
    // USER REQUIREMENT: Handle camera reaching ground boundaries
    checkCameraEdge() {
        // [FIX #7] Skip edge detection if infinite terrain is enabled
        if (typeof window !== 'undefined' && window.infiniteTerrainEnabled) {
            return; // Don't check edges with infinite terrain
        }

        const camera = this.scene.activeCamera;
        if (!camera || this.sizeMode !== 'fixed') {
            return;
        }

        // [FIX #3.2] Transform camera position to ground-local space
        // This accounts for ground rotation when checking boundaries
        let pos;
        if (this.ground) {
            // Get inverse world matrix to transform from world to local space
            const invWorldMatrix = this.ground.getWorldMatrix().invert();
            // Transform camera world position to ground-local position
            pos = BABYLON.Vector3.TransformCoordinates(camera.position, invWorldMatrix);
        } else {
            // Fallback to world position if ground doesn't exist
            pos = camera.position;
        }

        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        let edgeReached = null;

        // Check boundaries in ground-local space
        if (pos.x > halfWidth) edgeReached = 'east';
        else if (pos.x < -halfWidth) edgeReached = 'west';
        else if (pos.z > halfHeight) edgeReached = 'north';
        else if (pos.z < -halfHeight) edgeReached = 'south';

        if (edgeReached) {
            // [FIX] Pass the local position to handleEdgeReached to avoid re-calculation issues
            this.handleEdgeReached(camera, edgeReached, pos);
        }
    }

    // [GRD.4] Handle edge reached
    handleEdgeReached(camera, edge, localPos) {
        // [EVT.2] Emit edge reached event
        this.events.emit('ground:edge:reached', {
            edge: edge,
            position: camera.position.clone()
        });

        switch (this.edgeBehavior) {
            case 'stop':
                // [GRD.4.1] Stop at edge (clamp position)
                this.stopCameraAtEdge(camera, edge, localPos);
                break;

            case 'teleport':
                // [GRD.4.2] Teleport back to start
                this.teleportCamera(camera);
                break;

            case 'wrap':
                // [GRD.4.3] Wrap to opposite edge (Pac-Man style)
                this.wrapCameraAround(camera, edge);
                break;

            case 'custom':
                // [GRD.4.4] Custom callback
                if (this.edgeCallback) {
                    this.edgeCallback(camera, edge);
                }
                break;
        }
    }

    // [GRD.4.1] Stop camera at edge
    stopCameraAtEdge(camera, edge, currentLocalPos) {
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;
        const buffer = 0.5; // Small buffer to prevent jitter

        // [FIX] Use passed local position if available, otherwise calculate
        let localPos;
        if (currentLocalPos) {
            localPos = currentLocalPos.clone();
        } else if (this.ground) {
            const invWorldMatrix = this.ground.getWorldMatrix().invert();
            localPos = BABYLON.Vector3.TransformCoordinates(camera.position, invWorldMatrix);
        } else {
            localPos = camera.position.clone();
        }

        // [FIX #4] Clamp position at edge in ground-local space
        // We clamp ALL axes to ensure we don't drift past corners
        if (localPos.x > halfWidth - buffer) localPos.x = halfWidth - buffer;
        if (localPos.x < -halfWidth + buffer) localPos.x = -halfWidth + buffer;
        if (localPos.z > halfHeight - buffer) localPos.z = halfHeight - buffer;
        if (localPos.z < -halfHeight + buffer) localPos.z = -halfHeight + buffer;

        // [FIX #3.2] Transform clamped local position back to world space
        if (this.ground) {
            const worldMatrix = this.ground.getWorldMatrix();
            const worldPos = BABYLON.Vector3.TransformCoordinates(localPos, worldMatrix);
            camera.position.copyFrom(worldPos);
        } else {
            camera.position.copyFrom(localPos);
        }

        // [FIX #4] CRITICAL: Stop camera momentum/velocity to prevent jitter
        // UniversalCamera has inertia, must zero out velocity when hitting edge
        // This fixes the "backward movement" bug where inertia pushes past the clamp
        if (camera.cameraDirection) {
            camera.cameraDirection.scaleInPlace(0);
        }
        if (camera._localDirection) {
            camera._localDirection.scaleInPlace(0);
        }

        // If using physics engine for camera (not recommended but possible)
        if (camera.physicsBody) {
            camera.physicsBody.setLinearVelocity(BABYLON.Vector3.Zero());
            camera.physicsBody.setAngularVelocity(BABYLON.Vector3.Zero());
        }
        camera.cameraDirection.x = 0;
        camera.cameraDirection.y = 0;
        camera.cameraDirection.z = 0;

        console.log(`[GRD.4.1] Camera stopped at ${edge} edge`);

        // [FIX #4] Zero out velocity to prevent jitter
        if (camera.physicsBody) {
            camera.physicsBody.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
            camera.physicsBody.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
        }
    }

    // [GRD.4.2] Teleport camera to start
    teleportCamera(camera) {
        // [FIX #3.2] Transform teleport position from ground-local to world space
        if (this.ground) {
            const localPos = new BABYLON.Vector3(
                this.teleportPosition.x,
                this.teleportPosition.y,
                this.teleportPosition.z
            );
            const worldMatrix = this.ground.getWorldMatrix();
            const worldPos = BABYLON.Vector3.TransformCoordinates(localPos, worldMatrix);
            camera.position.copyFrom(worldPos);
        } else {
            // Fallback: use as world position
            camera.position.x = this.teleportPosition.x;
            camera.position.y = this.teleportPosition.y;
            camera.position.z = this.teleportPosition.z;
        }

        // [EVT.2] Emit teleport event
        this.events.emit('ground:camera:teleported', {
            position: camera.position.clone()
        });

        console.log('[GRD.4.2] Camera teleported to start');

        // [FIX #4] Reset physics state after teleport
        if (camera.physicsBody) {
            camera.physicsBody.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
            camera.physicsBody.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
        }
    }

    // [GRD.4.3] Wrap camera to opposite edge
    wrapCameraAround(camera, edge) {
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        switch (edge) {
            case 'east':
                camera.position.x = -halfWidth + 1;
                break;
            case 'west':
                camera.position.x = halfWidth - 1;
                break;
            case 'north':
                camera.position.z = -halfHeight + 1;
                break;
            case 'south':
                camera.position.z = halfHeight - 1;
                break;
        }

        // [EVT.2] Emit wrap event
        this.events.emit('ground:camera:wrapped', {
            edge: edge,
            position: camera.position.clone()
        });
    }

    // [GRD.4.5] Create invisible boundary walls
    // Prevents camera from falling off ground edges
    createBoundaryWalls() {
        if (this.boundaryWalls) {
            // Already created, dispose old walls
            this.boundaryWalls.forEach(wall => wall.dispose());
        }

        this.boundaryWalls = [];

        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;
        const wallHeight = 20; // Tall enough to block camera
        const wallThickness = 0.1; // Very thin

        // Create 4 walls (north, south, east, west)
        const wallConfigs = [
            { name: 'north', width: this.width, height: wallHeight, depth: wallThickness, x: 0, y: wallHeight / 2, z: halfHeight },
            { name: 'south', width: this.width, height: wallHeight, depth: wallThickness, x: 0, y: wallHeight / 2, z: -halfHeight },
            { name: 'east', width: wallThickness, height: wallHeight, depth: this.height, x: halfWidth, y: wallHeight / 2, z: 0 },
            { name: 'west', width: wallThickness, height: wallHeight, depth: this.height, x: -halfWidth, y: wallHeight / 2, z: 0 }
        ];

        wallConfigs.forEach(config => {
            const wall = BABYLON.MeshBuilder.CreateBox(
                `boundaryWall_${config.name} `,
                {
                    width: config.width,
                    height: config.height,
                    depth: config.depth
                },
                this.scene
            );

            wall.position.x = config.x;
            wall.position.y = config.y;
            wall.position.z = config.z;

            // Make wall invisible but still collidable
            wall.isVisible = false;
            wall.checkCollisions = true;
            wall.isPickable = false; // CRITICAL: Don't block raycasts for click-to-move

            // [FIX #3.1] Parent walls to ground so they rotate with it
            if (this.ground) {
                wall.parent = this.ground;
            }

            this.boundaryWalls.push(wall);
        });
        console.log('[GRD.4.5] Boundary walls created (invisible)');
    }

    // [GRD.5] Apply default material
    applyDefaultMaterial(mesh) {
        const material = new BABYLON.StandardMaterial('defaultGroundMaterial', this.scene);

        // [MAT.2] Default ground colors (brown/dirt)
        material.diffuseColor = new BABYLON.Color3(0.55, 0.45, 0.33);
        // [VISUAL IMPROVEMENT] Matte finish (no specular highlights) - looks better for terrain
        material.specularColor = BABYLON.Color3.Black();
        material.specularPower = 0;

        mesh.material = material;
        this.material = material;

        console.log('[GRD.5] ✅ Applied matte ground material');
    }

    // [GRD.5] Set ground material
    setMaterial(material) {
        if (!this.ground) {
            console.warn('[GRD.5] No ground to apply material');
            return;
        }

        this.ground.material = material;
        this.material = material;

        console.log('[GRD.5] Ground material updated');
    }

    // [GRD.5] Set ground color
    setColor(color) {
        if (!this.ground || !this.ground.material) {
            console.warn('[GRD.5] No ground or material to set color');
            return;
        }

        const material = this.ground.material;

        if (color instanceof BABYLON.Color3) {
            material.diffuseColor = color;
        } else {
            material.diffuseColor = BABYLON.Color3.FromHexString(color);
        }

        console.log('[GRD.5] Ground color updated');
    }

    // [GRD.5] Set ground texture with mode
    // USER REQUIREMENT: Tiled (default), stretched, or centered texture modes
    // @param {string} url - Texture URL
    // @param {string} mode - 'tiled', 'stretched', or 'centered'
    // @param {object} options - Mode-specific options (e.g., tiling for 'tiled' mode)
    setTexture(url, mode = 'tiled', options = {}) {
        if (!this.ground || !this.ground.material) {
            console.warn('[GRD.5] No ground or material to set texture');
            return;
        }

        const material = this.ground.material;
        const texture = new BABYLON.Texture(url, this.scene);

        switch (mode) {
            case 'tiled':
                // [GRD.5.1] Tiled mode - repeat texture
                const tilingU = options.u || options.tiling?.u || 1;
                const tilingV = options.v || options.tiling?.v || 1;
                texture.uScale = tilingU;
                texture.vScale = tilingV;
                texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
                texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
                break;

            case 'stretched':
                // [GRD.5.2] Stretched mode - fit texture to ground size once
                texture.uScale = 1;
                texture.vScale = 1;
                texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
                texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
                break;

            case 'centered':
                // [GRD.5.3] Centered mode - show texture at original size in center
                // Calculate scale based on ground size vs texture size
                const groundSize = Math.max(this.width, this.height);
                const centerScale = options.scale || 1; // Allow manual scaling
                texture.uScale = centerScale;
                texture.vScale = centerScale;
                texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
                texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
                // Center the texture using uOffset/vOffset
                texture.uOffset = (1 - texture.uScale) / 2;
                texture.vOffset = (1 - texture.vScale) / 2;
                break;

            default:
                console.warn(`[GRD.5] Unknown texture mode: ${mode}, using tiled`);
                texture.uScale = 1;
                texture.vScale = 1;
        }

        material.diffuseTexture = texture;
        this.textureMode = mode;
        this.textureOptions = options;

        console.log(`[GRD.5] Ground texture applied: ${mode} mode`);

        // [EVT.2] Emit texture changed event
        this.events.emit('ground:texture:changed', {
            url,
            mode,
            options
        });
    }

    // [GRD.5.4] Use texture preset
    // USER REQUIREMENT: Quick texture application with presets
    useTexturePreset(presetName) {
        const preset = this.texturePresets[presetName];

        if (!preset) {
            console.warn(`[GRD.5.4] Unknown texture preset: ${presetName} `);
            console.log('[GRD.5.4] Available presets:', Object.keys(this.texturePresets).join(', '));
            return;
        }

        // Apply diffuse texture with tiling
        this.setTexture(preset.diffuse, 'tiled', { tiling: preset.tiling });

        // Apply normal map if available
        if (preset.normal && this.ground && this.ground.material) {
            const normalTexture = new BABYLON.Texture(preset.normal, this.scene);
            normalTexture.uScale = preset.tiling.u;
            normalTexture.vScale = preset.tiling.v;
            this.ground.material.bumpTexture = normalTexture;
        }

        console.log(`[GRD.5.4] Applied texture preset: ${preset.name} (${preset.description})`);

        // [EVT.2] Emit preset changed event
        this.events.emit('ground:texture-preset:changed', {
            preset: presetName,
            config: preset
        });

        return this;
    }

    // [GRD.5.5] Set PBR texture with full material maps
    // USER REQUIREMENT: Advanced PBR textures for realistic ground
    setPBRTexture(options = {}) {
        if (!this.ground) {
            console.warn('[GRD.5.5] No ground to apply PBR texture');
            return;
        }

        // Create PBR material if current material is not PBR
        if (!(this.ground.material instanceof BABYLON.PBRMaterial)) {
            const pbrMaterial = new BABYLON.PBRMaterial('groundPBRMaterial', this.scene);
            this.ground.material = pbrMaterial;
            this.material = pbrMaterial;
        }

        const material = this.ground.material;
        const tiling = options.tiling || { u: 1, v: 1 };

        // Apply albedo (diffuse) texture
        if (options.albedo) {
            const albedoTexture = new BABYLON.Texture(options.albedo, this.scene);
            albedoTexture.uScale = tiling.u;
            albedoTexture.vScale = tiling.v;
            material.albedoTexture = albedoTexture;
        }

        // Apply normal map
        if (options.normal) {
            const normalTexture = new BABYLON.Texture(options.normal, this.scene);
            normalTexture.uScale = tiling.u;
            normalTexture.vScale = tiling.v;
            material.bumpTexture = normalTexture;
        }

        // Apply roughness map
        if (options.roughness) {
            const roughnessTexture = new BABYLON.Texture(options.roughness, this.scene);
            roughnessTexture.uScale = tiling.u;
            roughnessTexture.vScale = tiling.v;
            material.metallicTexture = roughnessTexture;
            material.useRoughnessFromMetallicTextureAlpha = false;
            material.useRoughnessFromMetallicTextureGreen = true;
        }

        // Apply metallic map
        if (options.metallic) {
            if (!material.metallicTexture) {
                const metallicTexture = new BABYLON.Texture(options.metallic, this.scene);
                metallicTexture.uScale = tiling.u;
                metallicTexture.vScale = tiling.v;
                material.metallicTexture = metallicTexture;
            }
            material.metallic = options.metallicValue || 0.0;
        }

        // Apply ambient occlusion
        if (options.ao) {
            const aoTexture = new BABYLON.Texture(options.ao, this.scene);
            aoTexture.uScale = tiling.u;
            aoTexture.vScale = tiling.v;
            material.ambientTexture = aoTexture;
            material.useAmbientOcclusionFromMetallicTextureRed = true;
        }

        // Set PBR properties
        material.roughness = options.roughnessValue || 0.8;
        material.metallic = options.metallicValue || 0.0;

        console.log('[GRD.5.5] PBR texture applied to ground');

        // [EVT.2] Emit PBR texture changed event
        this.events.emit('ground:pbr-texture:changed', {
            options
        });

        return this;
    }

    // [GRD.5.6] Set texture tiling (UV scale)
    // USER REQUIREMENT: Adjust texture repetition without reloading
    setTextureTiling(uScale, vScale) {
        if (!this.ground || !this.ground.material) {
            console.warn('[GRD.5.6] No ground or material to set tiling');
            return;
        }

        const material = this.ground.material;

        // Update diffuse/albedo texture
        if (material.diffuseTexture) {
            material.diffuseTexture.uScale = uScale;
            material.diffuseTexture.vScale = vScale;
        }
        if (material.albedoTexture) {
            material.albedoTexture.uScale = uScale;
            material.albedoTexture.vScale = vScale;
        }

        // Update normal map
        if (material.bumpTexture) {
            material.bumpTexture.uScale = uScale;
            material.bumpTexture.vScale = vScale;
        }

        // Update other PBR maps
        if (material.metallicTexture) {
            material.metallicTexture.uScale = uScale;
            material.metallicTexture.vScale = vScale;
        }
        if (material.ambientTexture) {
            material.ambientTexture.uScale = uScale;
            material.ambientTexture.vScale = vScale;
        }

        this.textureOptions.tiling = { u: uScale, v: vScale };

        console.log(`[GRD.5.6] Texture tiling set: u = ${uScale}, v = ${vScale} `);

        return this;
    }

    // [GRD.5.7] Get available texture presets
    getTexturePresets() {
        return { ...this.texturePresets };
    }

    // [GRD.5.8] Add custom texture preset
    addTexturePreset(name, config) {
        this.texturePresets[name] = config;
        console.log(`[GRD.5.8] Added custom texture preset: ${name} `);
        return this;
    }

    // [GRD.6] Enable collision
    enableCollision() {
        if (!this.ground) return;

        this.ground.checkCollisions = true;
        this.ground.isPickable = true;
        this.collisionEnabled = true;

        console.log('[GRD.6] Ground collision enabled');
    }

    // [GRD.6] Disable collision
    disableCollision() {
        if (!this.ground) return;

        this.ground.checkCollisions = false;
        this.ground.isPickable = false;
        this.collisionEnabled = false;

        console.log('[GRD.6] Ground collision disabled');
    }

    // [GRD] Get ground mesh
    getGround() {
        return this.ground;
    }

    // [GRD] Reset to defaults
    reset() {
        this.setRotation(0, 0, 0);
        this.setSizeMode('fixed', { width: 100, height: 100 });
        this.setEdgeBehavior('stop');

        console.log('[GRD] Ground reset to defaults');
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Stop edge detection
        this.stopEdgeDetection();

        // Dispose boundary walls
        if (this.boundaryWalls) {
            this.boundaryWalls.forEach(wall => wall.dispose());
            this.boundaryWalls = null;
        }

        // Dispose ground
        if (this.ground) {
            this.ground.dispose();
            this.ground = null;
        }

        // Dispose material
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }

        super.dispose();

        console.log('[GRD] GroundPlugin disposed');
    }
}

// [GRD] Export for registration with engine
export default GroundPlugin;
