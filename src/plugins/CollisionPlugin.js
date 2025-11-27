/**
 * @file CollisionPlugin.js
 * @description Unified collision system with per-object configuration
 *
 * @tags [COL.*] All collision tags
 * @primary-tags [COL.1] Collision initialization, [COL.3] Physics bodies
 * @critical-tags [!COL.1] Must initialize before mesh creation
 *
 * @dependencies
 *   - [COL -> PHY] Physics engine (Havok)
 *   - [COL -> GRV] Gravity system for physics bodies
 *   - [COL -> CAM] Camera collision detection
 *
 * @affects
 *   - CameraPlugin (camera collision)
 *   - GroundPlugin (ground collision)
 *   - All meshes with physics bodies
 *
 * @events
 *   - Emits: collision:ready, collision:enabled, physics:enabled, collision:object:configured
 *   - Listens: (none - but external systems can request changes)
 *
 * @features
 *   - Hybrid collision (Babylon simple + Havok physics)
 *   - Per-object collision properties
 *   - Runtime enable/disable per mesh
 *   - Custom physics materials per object
 *   - Future-ready for collision events, triggers
 *
 * @author Development Team
 * @created 2025-10-31
 */

import Plugin from '../core/Plugin.js';

// [COL] Collision system with runtime flexibility
// [!COL.1] CRITICAL: Must initialize before creating meshes with collision
class CollisionPlugin extends Plugin {
    constructor(options = {}) {
        super(options);

        // [COL.1] Collision mode
        // 'babylon' = simple collision only
        // 'physics' = physics engine only
        // 'hybrid' = both (recommended)
        this.mode = 'hybrid';

        // [COL.1.2] Physics enabled flag
        this.physicsEnabled = false;

        // [COL.5] Per-object collision tracking
        this.objectCollisionSettings = new WeakMap();
    }

    // [!COL.1] Initialize collision system
    // [COL.1.1] Enable Babylon collision
    // [COL.1.2] Initialize physics if configured
    async start() {
        super.start();

        // [CFG.2] Read collision config
        const collisionConfig = this.config.collision || {};
        this.mode = collisionConfig.mode || 'hybrid';

        // [!COL.1.1] Enable scene-level Babylon collision
        // [COL.1.1 -> CAM.5] Required for camera collision
        this.scene.collisionsEnabled = true;

        // [!COL.1.2] Initialize physics if needed
        // [COL.1.2 -> PHY.1] Loads physics engine
        if (this.mode === 'physics' || this.mode === 'hybrid') {
            const physicsConfig = this.config.physics || {};
            if (physicsConfig.enabled !== false) {
                await this.initPhysics();
            }
        }

        // [EVT.2] Emit collision ready
        this.events.emit('collision:ready', {
            mode: this.mode,
            physicsEnabled: this.physicsEnabled
        });

        console.log(`[COL.1] Collision system initialized: ${this.mode} mode`);
    }

    // [COL.1.2] Initialize physics engine
    // [COL.1.2 -> PHY.1] Async Havok WASM loading
    // [COL.1.2 -> GRV.4] Uses gravity from GravityPlugin
    async initPhysics() {
        try {
            // [PHY.1.1] Load Havok WASM
            // PERFORMANCE: Use preloaded promise if available (set by Bootstrap)
            const havok = window.__havokPromise
                ? await window.__havokPromise
                : await HavokPhysics();

            console.log('[COL.1.2] Havok WASM loaded', window.__havokPromise ? '(preloaded)' : '(fresh)');

            // [PHY.1.2] Create Havok plugin
            const plugin = new BABYLON.HavokPlugin(true, havok);

            // [PHY.1.3] Enable physics in scene
            // [PHY.3 -> GRV.4] Gravity will be set by GravityPlugin
            const physicsConfig = this.config.physics || {};
            const gravity = physicsConfig.gravity || { x: 0, y: -9.81, z: 0 };

            this.scene.enablePhysics(
                new BABYLON.Vector3(gravity.x, gravity.y, gravity.z),
                plugin
            );

            this.physicsEnabled = true;

            // [CRITICAL] Store plugin reference in scene metadata for GroundPlugin access
            this.scene.metadata = this.scene.metadata || {};
            this.scene.metadata.collisionPlugin = this;

            // [EVT.2] Emit physics enabled
            this.events.emit('physics:enabled', {
                engine: 'havok',
                gravity
            });

            console.log('[COL.1.2] Physics engine initialized: Havok');

        } catch (error) {
            console.error('[COL.1.2] Physics initialization failed:', error);
            this.physicsEnabled = false;

            // [EVT.2] Emit physics failed
            this.events.emit('physics:failed', {
                error: error.message
            });
        }
    }

    // [COL.2] Enable simple Babylon collision for mesh
    // [COL.2 -> CAM.5] Used by camera collision
    // RUNTIME: Can enable/disable collision anytime
    enableSimpleCollision(mesh, options = {}) {
        if (!mesh) {
            console.warn('[COL.2] Cannot enable collision: mesh is null');
            return;
        }

        // [COL.2.1] Enable collision checking
        mesh.checkCollisions = options.checkCollisions !== false;

        // [COL.2.2] Enable picking (raycasting)
        // [COL.2.2 -> INT.2] Required for click detection
        mesh.isPickable = options.pickable !== false;

        // [COL.2.3] Move with collisions (for dynamic movement)
        if (options.moveWithCollisions) {
            mesh.moveWithCollisions = true;
        }

        // [COL.5] Store settings in metadata
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.collisionType = 'simple';
        mesh.metadata.collisionSettings = { ...options };

        // Track in WeakMap
        this.objectCollisionSettings.set(mesh, { type: 'simple', options });

        // [EVT.2] Emit collision enabled
        this.events.emit('collision:simple:enabled', {
            mesh,
            settings: options
        });

        console.log(`[COL.2] Simple collision enabled: ${mesh.name}`);
    }

    // [COL.3] Enable physics body for mesh
    // [COL.3 -> PHY.2] Creates Havok physics aggregate
    // RUNTIME: Can add/remove physics bodies anytime
    // EXTENSIBILITY: Per-object physics properties
    enablePhysicsBody(mesh, options = {}) {
        if (!mesh) {
            console.warn('[COL.3] Cannot enable physics: mesh is null');
            return;
        }

        // [COL.3 | PHY.1.3] Check if physics enabled
        if (!this.physicsEnabled) {
            console.warn('[COL.3] Physics not enabled. Use mode: "physics" or "hybrid"');
            return null;
        }

        // [COL.3.1] Select collision shape
        // Options: BOX, SPHERE, CAPSULE, CYLINDER, MESH (convex hull)
        const shape = options.shape || BABYLON.PhysicsShapeType.BOX;

        // [COL.3.2] Set mass
        // mass = 0: Static (immovable)
        // mass > 0: Dynamic (affected by forces)
        const mass = options.mass !== undefined ? options.mass : 1;

        // [COL.3.3] Restitution (bounciness: 0 = no bounce, 1 = perfect bounce)
        const restitution = options.restitution !== undefined ? options.restitution : 0.5;

        // [COL.3.4] Friction (sliding resistance: 0 = ice, 1 = sticky)
        const friction = options.friction !== undefined ? options.friction : 0.5;

        // [PHY.2] Create physics aggregate
        const aggregate = new BABYLON.PhysicsAggregate(
            mesh,
            shape,
            { mass, restitution, friction },
            this.scene
        );

        // [COL.5] Store physics settings in metadata
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.collisionType = 'physics';
        mesh.metadata.physicsSettings = {
            shape,
            mass,
            restitution,
            friction,
            ...options
        };

        // Track in WeakMap
        this.objectCollisionSettings.set(mesh, {
            type: 'physics',
            aggregate,
            options: { shape, mass, restitution, friction, ...options }
        });

        // [COL.3] Physics body enabled
        // [CRITICAL FIX] Ensure Babylon collision is ALSO enabled so camera (which uses checkCollisions)
        // cannot pass through this physics object.
        mesh.checkCollisions = true;

        // [EVT.2] Emit physics body enabled
        this.events.emit('collision:physics:enabled', {
            mesh,
            aggregate,
            settings: { shape, mass, restitution, friction }
        });

        console.log(`[COL.3] Physics body enabled: ${mesh.name} (mass: ${mass})`);

        return aggregate;
    }

    // [COL.4] Auto-detect and enable appropriate collision type
    // [COL.4.1] Static meshes -> simple collision
    // [COL.4.2] Dynamic meshes -> physics
    autoEnableCollision(mesh, hint = null) {
        if (!mesh) {
            return;
        }

        // [COL.4.1] Static meshes (ground, walls, buildings)
        if (hint === 'static' ||
            mesh.name.toLowerCase().includes('ground') ||
            mesh.name.toLowerCase().includes('terrain') ||
            mesh.name.toLowerCase().includes('wall') ||
            mesh.name.toLowerCase().includes('floor')) {

            // Enable simple collision
            this.enableSimpleCollision(mesh);

            // If physics enabled, add static physics body
            if (this.mode === 'physics' || this.mode === 'hybrid') {
                this.enablePhysicsBody(mesh, { mass: 0 });
            }
        }
        // [COL.4.2] Dynamic meshes (objects, characters, props)
        else if (this.mode === 'physics' || this.mode === 'hybrid') {
            // Enable physics body
            this.enablePhysicsBody(mesh);
            // Ensure simple collision is also on (redundant but safe)
            mesh.checkCollisions = true;
        }
        // Fallback to simple collision
        else {
            this.enableSimpleCollision(mesh);
        }

        console.log(`[COL.4] Auto-enabled collision for: ${mesh.name}`);
    }

    // [COL.5] RUNTIME: Update physics properties for mesh
    // EXTENSIBILITY: Change physics on the fly (ice, mud, bouncy surfaces)
    setPhysicsProperties(mesh, properties = {}) {
        if (!mesh || !mesh.physicsBody) {
            console.warn('[COL.5] Mesh has no physics body');
            return;
        }

        // [COL.3.2] Update mass
        if (properties.mass !== undefined) {
            mesh.physicsBody.setMassProperties({ mass: properties.mass });
        }

        // [COL.3.3] Update restitution
        if (properties.restitution !== undefined) {
            mesh.physicsBody.shape.material = mesh.physicsBody.shape.material || {};
            mesh.physicsBody.shape.material.restitution = properties.restitution;
        }

        // [COL.3.4] Update friction
        if (properties.friction !== undefined) {
            mesh.physicsBody.shape.material = mesh.physicsBody.shape.material || {};
            mesh.physicsBody.shape.material.friction = properties.friction;
        }

        // Update metadata
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.physicsSettings = {
            ...mesh.metadata.physicsSettings,
            ...properties
        };

        // [EVT.2] Emit properties changed
        this.events.emit('collision:object:configured', {
            mesh,
            properties
        });

        console.log(`[COL.5] Physics properties updated: ${mesh.name}`);
    }

    // [COL.5] Set motion type (Static, Dynamic, Kinematic/Animated)
    // Used by GroundPlugin for "Glue" feature
    setMotionType(mesh, type) {
        if (!mesh || !mesh.physicsBody) return;

        // Map string types to Babylon constants if needed
        let motionType = type;
        if (typeof type === 'string') {
            switch (type.toLowerCase()) {
                case 'static': motionType = BABYLON.PhysicsMotionType.STATIC; break;
                case 'dynamic': motionType = BABYLON.PhysicsMotionType.DYNAMIC; break;
                case 'kinematic':
                case 'animated': motionType = BABYLON.PhysicsMotionType.ANIMATED; break;
            }
        }

        mesh.physicsBody.setMotionType(motionType);
        console.log(`[COL.5] Motion type set to ${type} for ${mesh.name}`);
    }

    // [COL.5] Get collision settings for mesh
    getCollisionSettings(mesh) {
        return this.objectCollisionSettings.get(mesh) || null;
    }

    // [COL.5] Disable collision for mesh
    // RUNTIME: Temporarily disable collision (cutscenes, respawn)
    disableCollision(mesh) {
        if (!mesh) {
            return;
        }

        // Disable simple collision
        mesh.checkCollisions = false;

        // Disable physics body
        if (mesh.physicsBody) {
            mesh.physicsBody.disablePreStep = true;
        }

        console.log(`[COL.5] Collision disabled: ${mesh.name}`);
    }

    // [COL.5] Re-enable collision for mesh
    enableCollision(mesh) {
        if (!mesh) {
            return;
        }

        // Re-enable simple collision
        mesh.checkCollisions = true;

        // Re-enable physics body
        if (mesh.physicsBody) {
            mesh.physicsBody.disablePreStep = false;
        }

        console.log(`[COL.5] Collision enabled: ${mesh.name}`);
    }

    // [COL.6] FUTURE: Collision events/triggers
    // Placeholder for collision detection events (Phase 3+)
    // Example: onCollisionEnter, onCollisionExit, onTriggerEnter
    onCollision(mesh, callback) {
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.onCollision = callback;

        // Note: Actual collision detection would be in update loop
        // Or using Babylon's collision observables
        // This is a hook for future implementation

        console.log(`[COL.6] Collision callback registered: ${mesh.name}`);
    }

    // [COL.6] FUTURE: Trigger zones
    // Placeholder for trigger volumes (Phase 3+)
    // Example: onEnterZone, onExitZone
    createTriggerZone(mesh, onEnter, onExit) {
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.isTriggerZone = true;
        mesh.metadata.onEnter = onEnter;
        mesh.metadata.onExit = onExit;

        // Disable physical collision (pass-through)
        mesh.checkCollisions = false;
        if (mesh.physicsBody) {
            mesh.physicsBody.shape.isTrigger = true;
        }

        console.log(`[COL.6] Trigger zone created: ${mesh.name}`);
    }
}

// [COL] Export for registration with engine
export default CollisionPlugin;
