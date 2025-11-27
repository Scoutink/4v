/**
 * @file CameraPlugin.js
 * @description Camera management with runtime control and smooth transitions
 *
 * @tags [CAM.*] All camera tags
 * @primary-tags [CAM.1] Camera creation, [CAM.2] Camera switching
 * @critical-tags [!CAM.2] Camera switching affects rendering, movement, controls
 *
 * @dependencies
 *   - [CAM -> COL] Collision system for camera collision
 *   - [CAM -> GRV] Gravity system for camera gravity
 *   - [CAM -> MOV] Movement system uses camera
 *
 * @affects
 *   - MovementPlugin (camera position)
 *   - CollisionPlugin (camera collision)
 *   - Rendering (active camera)
 *
 * @events
 *   - Emits: camera:created, camera:changed, camera:moved, camera:rotated
 *   - Listens: (none - but external systems can request changes)
 *
 * @features
 *   - Multiple camera types (Universal, ArcRotate, Free, Follow)
 *   - Runtime position/rotation changes
 *   - Smooth transitions and animations
 *   - Per-scene camera settings with runtime overrides
 *   - Action hooks for zones, triggers, external APIs
 *
 * @author Development Team
 * @created 2025-10-31
 */

import Plugin from '../core/Plugin.js';

// [CAM] Camera management system
// [!CAM.2] CRITICAL: Active camera determines what user sees
class CameraPlugin extends Plugin {
    constructor(options = {}) {
        super(options);

        // [CAM.1] Camera storage
        // Map of camera name -> { camera, type, config }
        this.cameras = new Map();

        // [CAM.2] Active camera name
        this.activeCamera = null;

        // [CAM.2.2] Current camera transition animation
        this.currentTransition = null;
    }

    // [CAM.1] Initialize camera system
    // [CAM.1 -> CFG.2] Read camera config
    start() {
        super.start();

        // [CFG.2] Read camera configuration
        const cameraConfig = this.config.camera || {};
        const defaultType = cameraConfig.defaultType || 'universal';

        // [CAM.1] Create default camera
        this.createCamera(defaultType, 'main', cameraConfig);

        // [CAM.2.1] Set as active camera
        this.setActiveCamera('main');

        console.log(`[CAM.1] Camera system initialized: ${defaultType}`);
    }

    // [CAM.1] Create new camera
    // [CAM.1 -> COL.2] May setup collision
    // [CAM.1 -> GRV.3] May use scene gravity
    // RUNTIME: Can create cameras anytime
    createCamera(type, name, config = {}) {
        // [CAM.1] Validate type
        const validTypes = ['universal', 'arcRotate', 'free', 'follow'];
        if (!validTypes.includes(type)) {
            console.warn(`[CAM.1] Invalid camera type '${type}', using 'universal'`);
            type = 'universal';
        }

        // [CAM.1] Check for duplicate names
        if (this.cameras.has(name)) {
            console.warn(`[CAM.1] Camera '${name}' already exists, replacing`);
            this.removeCamera(name);
        }

        let camera;

        // [CAM.1.1] Create UniversalCamera
        // [CAM.1.1 -> MOV.4] Supports keyboard movement
        if (type === 'universal') {
            const position = config.position || { x: 0, y: 2, z: -10 };
            camera = new BABYLON.UniversalCamera(
                name,
                new BABYLON.Vector3(position.x, position.y, position.z),
                this.scene
            );

            // [CAM.3.1] Keyboard controls
            camera.keysUp = [87, 38];     // W, Up Arrow
            camera.keysDown = [83, 40];   // S, Down Arrow
            camera.keysLeft = [65, 37];   // A, Left Arrow
            camera.keysRight = [68, 39];  // D, Right Arrow

            // [CAM.3.1] Movement speed
            camera.speed = config.speed !== undefined ? config.speed : 0.5;

            // [CAM.3.2] Mouse sensitivity
            camera.angularSensibility = config.sensitivity || 3000;

            // [CAM.5] Collision setup if enabled
            if (config.collision) {
                // [CAM.5.1] Collision ellipsoid
                // [CAM.5.1 -> COL.2.1] Uses Babylon simple collision
                camera.checkCollisions = true;
                const ellipsoid = config.ellipsoid || { x: 1, y: 1.5, z: 1 };
                camera.ellipsoid = new BABYLON.Vector3(
                    ellipsoid.x,
                    ellipsoid.y,
                    ellipsoid.z
                );

                // [CAM.5.2] Gravity application
                // [CAM.5.2 -> GRV.3] Uses scene.gravity from GravityPlugin
                // FIXED: Respect config.gravity setting - don't unconditionally enable
                if (config.gravity === true) {
                    camera.applyGravity = true;
                    console.log('[CAM.5.2] Camera gravity ENABLED (config.gravity = true)');
                } else {
                    camera.applyGravity = false;
                    console.log('[CAM.5.2] Camera gravity DISABLED (config.gravity = false)');
                }
                
                // [FIX] Use Babylon's native collision system for camera "walking"
                // Physics engines (Havok/Ammo) are great for objects, but for a First Person Controller,
                // Babylon's built-in collision/gravity is often smoother and less prone to "ghosting" or jitter.
                // Note: checkCollisions is separate from applyGravity - collision stops camera from going through walls
                // Collision is always enabled when config.collision is true

                // [FIX] Do NOT create a physics body for the camera unless explicitly requested for a specific reason.
                // A kinematic physics body often fights with the input manager.
                /*
                if (this.scene.getPhysicsEngine()) {
                     // ... code removed ...
                }
                */

                console.log('[CAM.5] Camera collision enabled (Babylon native)');
            }
        }

        // [CAM.1.2] Create ArcRotateCamera
        // [CAM.1.2] Good for showcases, orbit views
        else if (type === 'arcRotate') {
            const alpha = config.alpha || Math.PI / 2;
            const beta = config.beta || Math.PI / 4;
            const radius = config.radius || 10;
            const target = config.target || { x: 0, y: 0, z: 0 };

            camera = new BABYLON.ArcRotateCamera(
                name,
                alpha,
                beta,
                radius,
                new BABYLON.Vector3(target.x, target.y, target.z),
                this.scene
            );

            // [CAM.3.2] Zoom limits
            camera.lowerRadiusLimit = config.minZoom || 2;
            camera.upperRadiusLimit = config.maxZoom || 50;

            // [CAM.3.2] Rotation speed
            camera.angularSensibilityX = config.sensitivityX || 1000;
            camera.angularSensibilityY = config.sensitivityY || 1000;

            // [CAM.3.2] Panning
            camera.panningSensibility = config.panningSensibility || 1000;
        }

        // [CAM.1.3] Create FreeCamera
        // [CAM.1.3] Like Universal but simpler
        else if (type === 'free') {
            const position = config.position || { x: 0, y: 2, z: -10 };
            camera = new BABYLON.FreeCamera(
                name,
                new BABYLON.Vector3(position.x, position.y, position.z),
                this.scene
            );

            camera.speed = config.speed !== undefined ? config.speed : 0.5;
            camera.angularSensibility = config.sensitivity || 3000;
        }

        // [CAM.1.4] Create FollowCamera
        // [CAM.1.4] Follows a target mesh (third-person)
        else if (type === 'follow') {
            const position = config.position || { x: 0, y: 10, z: -10 };
            camera = new BABYLON.FollowCamera(
                name,
                new BABYLON.Vector3(position.x, position.y, position.z),
                this.scene
            );

            // [CAM.1.4 -> target] Requires target mesh
            if (config.target) {
                camera.lockedTarget = config.target;
            }

            // [CAM.1.4] Follow camera specific settings
            camera.radius = config.radius || 10;
            camera.heightOffset = config.heightOffset || 5;
            camera.rotationOffset = config.rotationOffset || 0;
            camera.cameraAcceleration = config.acceleration || 0.05;
            camera.maxCameraSpeed = config.maxSpeed || 20;
        }

        // [CAM.3.2] Attach controls to canvas
        // [CAM.3.2 -> ENG.1.1] Requires canvas from engine
        const canvas = this.scene.getEngine().getRenderingCanvas();
        camera.attachControl(canvas, true);

        // [CAM.1] Store camera
        this.cameras.set(name, {
            camera,
            type,
            config: { ...config }
        });

        // [EVT.2] Emit camera created event
        this.events.emit('camera:created', {
            name,
            type,
            camera,
            config
        });

        console.log(`[CAM.1] Camera created: ${name} (${type})`);

        return camera;
    }

    // [!CAM.2] Switch active camera
    // [CAM.2 -> rendering] Changes what user sees
    // [CAM.2 -> MOV.3] Movement system may need to update
    // RUNTIME: Can switch cameras anytime (cutscenes, perspectives)
    setActiveCamera(name, transitionDuration = 0) {
        const cameraData = this.cameras.get(name);
        if (!cameraData) {
            console.warn(`[CAM.2] Camera '${name}' not found`);
            return;
        }

        // [CAM.2.2] Smooth transition if duration > 0
        if (transitionDuration > 0 && this.activeCamera) {
            this.transitionToCamera(name, transitionDuration);
        } else {
            // [CAM.2.1] Instant switch
            this.scene.activeCamera = cameraData.camera;
            this.activeCamera = name;

            // [EVT.2] Emit camera changed event
            this.events.emit('camera:changed', {
                name,
                camera: cameraData.camera,
                type: cameraData.type
            });

            console.log(`[CAM.2.1] Camera switched to: ${name}`);
        }
    }

    // [CAM.2.2] Smooth camera transition
    // [CAM.2.2] RUNTIME: Animated camera changes for cinematic effects
    // EXTENSIBILITY: Can be triggered by zones, actions, external APIs
    transitionToCamera(targetName, duration = 1.0) {
        const targetData = this.cameras.get(targetName);
        if (!targetData) {
            console.warn(`[CAM.2.2] Target camera '${targetName}' not found`);
            return;
        }

        const currentCamera = this.scene.activeCamera;
        const targetCamera = targetData.camera;

        // [CAM.2.2] Cancel any existing transition
        if (this.currentTransition) {
            this.currentTransition.stop();
        }

        // [CAM.2.2] Animate position
        const positionAnimation = BABYLON.Animation.CreateAndStartAnimation(
            'cameraTransition',
            currentCamera,
            'position',
            60,
            duration * 60,
            currentCamera.position,
            targetCamera.position,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            new BABYLON.CubicEase()
        );

        this.currentTransition = positionAnimation;

        // [CAM.2.2] Switch camera after transition
        setTimeout(() => {
            this.setActiveCamera(targetName, 0); // Instant switch after animation
            this.currentTransition = null;
        }, duration * 1000);

        console.log(`[CAM.2.2] Transitioning to camera: ${targetName} (${duration}s)`);

        // [EVT.2] Emit transition started
        this.events.emit('camera:transition:started', {
            from: this.activeCamera,
            to: targetName,
            duration
        });
    }

    // [CAM.4] RUNTIME: Move camera to position
    // EXTENSIBILITY: Can be triggered by zones, waypoints, external systems
    moveCameraTo(position, duration = 1.0, easing = null) {
        const camera = this.scene.activeCamera;
        if (!camera) {
            console.warn('[CAM.4] No active camera to move');
            return;
        }

        const targetPos = new BABYLON.Vector3(
            position.x !== undefined ? position.x : camera.position.x,
            position.y !== undefined ? position.y : camera.position.y,
            position.z !== undefined ? position.z : camera.position.z
        );

        // [CAM.4] Animate position change
        const animation = BABYLON.Animation.CreateAndStartAnimation(
            'cameraMoveToPosition',
            camera,
            'position',
            60,
            duration * 60,
            camera.position,
            targetPos,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            easing || new BABYLON.QuadraticEase()
        );

        // [EVT.2] Emit camera moved event
        this.events.emit('camera:moved', {
            camera,
            from: camera.position.clone(),
            to: targetPos,
            duration
        });

        console.log(`[CAM.4] Moving camera to: (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`);

        return animation;
    }

    // [CAM.4] RUNTIME: Rotate camera to look at target
    // EXTENSIBILITY: Auto-rotate when entering zones, looking at objects
    rotateCameraToTarget(target, duration = 1.0) {
        const camera = this.scene.activeCamera;
        if (!camera || !camera.rotation) {
            console.warn('[CAM.4] Camera does not support rotation animation');
            return;
        }

        const targetPos = target instanceof BABYLON.Vector3
            ? target
            : new BABYLON.Vector3(target.x, target.y, target.z);

        // Calculate target rotation
        const direction = targetPos.subtract(camera.position);
        const targetRotation = new BABYLON.Vector3(
            Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z)),
            Math.atan2(direction.x, direction.z),
            0
        );

        // [CAM.4] Animate rotation
        const animation = BABYLON.Animation.CreateAndStartAnimation(
            'cameraRotateToTarget',
            camera,
            'rotation',
            60,
            duration * 60,
            camera.rotation,
            targetRotation,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            new BABYLON.QuadraticEase()
        );

        // [EVT.2] Emit camera rotated event
        this.events.emit('camera:rotated', {
            camera,
            target: targetPos,
            duration
        });

        console.log('[CAM.4] Rotating camera to target');

        return animation;
    }

    // [CAM.4] RUNTIME: Set camera properties
    // EXTENSIBILITY: External systems can adjust camera settings
    setCameraProperty(property, value) {
        const camera = this.scene.activeCamera;
        if (!camera) {
            console.warn('[CAM.4] No active camera');
            return;
        }

        if (property in camera) {
            camera[property] = value;

            // [EVT.2] Emit property changed
            this.events.emit('camera:property:changed', {
                camera,
                property,
                value
            });

            console.log(`[CAM.4] Camera property '${property}' set to:`, value);
        } else {
            console.warn(`[CAM.4] Camera property '${property}' not found`);
        }
    }

    // [CAM.2.1] Get camera by name
    getCamera(name) {
        return this.cameras.get(name);
    }

    // [CAM.2.1] Get active camera
    getActiveCamera() {
        return this.cameras.get(this.activeCamera);
    }

    // [CAM.2.1] Remove camera
    removeCamera(name) {
        const cameraData = this.cameras.get(name);
        if (!cameraData) {
            return;
        }

        // Don't remove if active
        if (name === this.activeCamera) {
            console.warn(`[CAM.2.1] Cannot remove active camera '${name}'`);
            return;
        }

        // Dispose camera
        cameraData.camera.dispose();
        this.cameras.delete(name);

        console.log(`[CAM.2.1] Camera removed: ${name}`);
    }

    // [CAM.4] Save camera state
    // RUNTIME: Useful for snapshots, save systems
    saveState(name = 'snapshot') {
        const camera = this.scene.activeCamera;
        if (!camera) {
            console.warn('[CAM.4] No active camera to save');
            return null;
        }

        const state = {
            position: camera.position.clone(),
            rotation: camera.rotation ? camera.rotation.clone() : null,
            target: camera.target ? camera.target.clone() : null
        };

        // Store in metadata for retrieval
        camera.metadata = camera.metadata || {};
        camera.metadata.savedStates = camera.metadata.savedStates || {};
        camera.metadata.savedStates[name] = state;

        console.log(`[CAM.4] Camera state saved: ${name}`);

        return state;
    }

    // [CAM.4] Restore camera state
    // RUNTIME: Restore saved positions
    restoreState(name = 'snapshot', duration = 0) {
        const camera = this.scene.activeCamera;
        if (!camera || !camera.metadata?.savedStates?.[name]) {
            console.warn(`[CAM.4] Saved state '${name}' not found`);
            return;
        }

        const state = camera.metadata.savedStates[name];

        if (duration > 0) {
            // Animate to saved state
            if (state.position) {
                this.moveCameraTo(state.position, duration);
            }
        } else {
            // Instant restore
            if (state.position) {
                camera.position = state.position.clone();
            }
            if (state.rotation && camera.rotation) {
                camera.rotation = state.rotation.clone();
            }
            if (state.target && camera.target) {
                camera.target = state.target.clone();
            }
        }

        console.log(`[CAM.4] Camera state restored: ${name}`);
    }
}

// [CAM] Export for registration with engine
export default CameraPlugin;
