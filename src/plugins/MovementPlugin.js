/**
 * @file MovementPlugin.js
 * @description Movement system with multiple modes and runtime control
 *
 * @tags [MOV.*] All movement tags
 * @primary-tags [MOV.1] Movement initialization, [MOV.2] Mode switching
 * @critical-tags [!MOV.3] Update loop runs every frame
 *
 * @dependencies
 *   - [MOV -> CAM] Requires active camera
 *   - [MOV -> EVT] Subscribes to render:frame event
 *
 * @affects
 *   - Camera position (moves camera every frame)
 *
 * @events
 *   - Emits: movement:mode:changed, movement:updated
 *   - Listens: render:frame
 *
 * @features
 *   - Multiple movement modes (keyboard, click-to-move, custom)
 *   - Runtime mode switching
 *   - Smooth acceleration/deceleration
 *   - Per-zone movement restrictions (future-ready)
 *   - External control support (AI, network, etc.)
 *
 * @author Development Team
 * @created 2025-10-31
 */

import Plugin from '../core/Plugin.js';
import KeyboardMovement from '../movement/KeyboardMovement.js';
import ClickToMoveMovement from '../movement/ClickToMoveMovement.js';

// [MOV] Movement system with runtime flexibility
// [!MOV.3] Update loop runs every frame - keep lightweight
class MovementPlugin extends Plugin {
    constructor(options = {}) {
        super(options);

        // [MOV.1] Movement modes storage
        this.modes = new Map();

        // [MOV.2] Active movement mode
        this.activeMode = null;
        this.activeModeName = null;

        // [MOV.3] Movement state
        this.velocity = BABYLON.Vector3.Zero();
        this.targetVelocity = BABYLON.Vector3.Zero();

        // [MOV.3.2] Acceleration (smoothing factor: 0.1 = smooth, 1.0 = instant)
        // RUNTIME: Can be changed for different movement feels
        this.acceleration = options.acceleration !== undefined ? options.acceleration : 0.1;

        // [MOV.3] Speed multiplier (global)
        // RUNTIME: Can modify for slow-mo, speed boosts, etc.
        this.globalSpeedMultiplier = 1.0;

        // [PLG.2] Subscribe to render loop
        this.subscriptions = {
            'render:frame': this.update
        };
    }

    // [MOV.1] Initialize movement system
    // [MOV.1.1] Register default movement modes
    // [MOV.1.2] Activate default mode
    start() {
        super.start();

        // [CFG.2] Read movement config
        const movementConfig = this.config.movement || {};

        // [MOV.1.1] Register keyboard movement mode
        const keyboardConfig = movementConfig.keyboard || {};
        const keyboardMode = new KeyboardMovement(keyboardConfig);
        this.registerMode('keyboard', keyboardMode);

        // [MOV.1.1] Register click-to-move mode
        const clickConfig = movementConfig.clickToMove || {};
        const clickToMoveMode = new ClickToMoveMovement(
            this.scene,
            this.events,
            clickConfig
        );
        this.registerMode('clickToMove', clickToMoveMode);

        // [MOV.1.2] Activate BOTH modes for hybrid movement (keyboard + click-to-move)
        // This allows users to use WASD AND click ground simultaneously
        const camera = this.scene.activeCamera;
        if (camera) {
            keyboardMode.activate(camera, this.scene);
            clickToMoveMode.activate(camera, this.scene);
            this.activeMode = keyboardMode; // Primary mode for keyboard input
            this.activeModeName = 'hybrid';

            // Store reference to click-to-move for combined velocity in update()
            this.clickToMoveMode = clickToMoveMode;

            console.log('[MOV.1] Movement system initialized: hybrid mode (keyboard + click-to-move)');
        } else {
            console.warn('[MOV.1] No active camera for movement');
        }
    }

    // [MOV.1.1] Register a movement mode
    // EXTENSIBILITY: Custom movement modes can be added
    registerMode(name, mode) {
        this.modes.set(name, mode);

        // [EVT.2] Emit mode registered
        this.events.emit('movement:mode:registered', {
            name,
            mode
        });

        console.log(`[MOV.1.1] Movement mode registered: ${name}`);
    }

    // [MOV.2] Switch movement mode
    // [MOV.2.1] Deactivate old mode
    // [MOV.2.2] Activate new mode
    // RUNTIME: Can switch modes anytime (cutscenes, vehicles, etc.)
    setMode(name) {
        const mode = this.modes.get(name);
        if (!mode) {
            console.warn(`[MOV.2] Movement mode '${name}' not found`);
            return;
        }

        // [MOV.2.1] Deactivate old mode
        if (this.activeMode) {
            this.activeMode.deactivate();
        }

        // [MOV.2.2] Activate new mode
        this.activeMode = mode;
        this.activeModeName = name;

        const camera = this.scene.activeCamera;
        if (camera) {
            mode.activate(camera, this.scene);
        } else {
            console.warn('[MOV.2.2] No active camera for movement');
        }

        // [EVT.2] Emit mode changed
        this.events.emit('movement:mode:changed', {
            mode: name,
            previousMode: this.activeModeName
        });

        console.log(`[MOV.2] Movement mode changed to: ${name}`);
    }

    // [!MOV.3] Update movement (called every frame)
    // [MOV.3 -> EVT.2] Subscribed to render:frame event
    // PERFORMANCE: Runs at 60 FPS - keep lightweight!
    update() {
        if (!this.activeMode || !this.activeMode.enabled) {
            return;
        }

        const camera = this.scene.activeCamera;
        if (!camera) {
            return;
        }

        // [MOV.3.1] Get target velocity from active mode(s)
        // Hybrid mode: combine keyboard + click-to-move velocities
        if (this.activeModeName === 'hybrid' && this.clickToMoveMode) {
            const keyboardVelocity = this.activeMode.getVelocity();
            const clickToMoveVelocity = this.clickToMoveMode.getVelocity();
            this.targetVelocity = keyboardVelocity.add(clickToMoveVelocity);
        } else {
            this.targetVelocity = this.activeMode.getVelocity();
        }

        // [MOV.3.1] Apply global speed multiplier
        this.targetVelocity.scaleInPlace(this.globalSpeedMultiplier);

        // [MOV.3.2] Smooth velocity (acceleration/deceleration)
        // Lerp between current and target velocity
        this.velocity = BABYLON.Vector3.Lerp(
            this.velocity,
            this.targetVelocity,
            this.acceleration
        );

        // [MOV.3.3] Apply velocity to camera
        // [MOV.3.3 -> CAM.2] Updates camera position
        camera.position.addInPlace(this.velocity);

        // [EVT.2] Emit movement updated (not every frame - would be too many events)
        // Only emit if actually moving
        if (this.velocity.length() > 0.01) {
            // Throttled emission (every 10 frames = ~6 times per second)
            if (!this._updateCounter) {
                this._updateCounter = 0;
            }
            this._updateCounter++;

            if (this._updateCounter % 10 === 0) {
                this.events.emit('movement:updated', {
                    velocity: this.velocity.clone(),
                    position: camera.position.clone()
                });
            }
        }
    }

    // [MOV.2] Get active movement mode
    getActiveMode() {
        return {
            name: this.activeModeName,
            mode: this.activeMode
        };
    }

    // [MOV.2] Get all registered modes
    getModes() {
        return Array.from(this.modes.keys());
    }

    // [MOV.3] RUNTIME: Set acceleration
    // EXTENSIBILITY: Different feels (ice, mud, normal)
    setAcceleration(value) {
        this.acceleration = Math.max(0, Math.min(1, value)); // Clamp 0-1
        console.log(`[MOV.3.2] Acceleration: ${this.acceleration}`);
    }

    // [MOV.3] RUNTIME: Set global speed multiplier
    // EXTENSIBILITY: Slow-mo, speed boost, status effects
    setGlobalSpeedMultiplier(multiplier) {
        this.globalSpeedMultiplier = multiplier;

        // [EVT.2] Emit speed changed
        this.events.emit('movement:speed:changed', {
            multiplier
        });

        console.log(`[MOV.3] Global speed multiplier: ${multiplier}`);
    }

    // [MOV.3] RUNTIME: Set speed for current mode
    // EXTENSIBILITY: Per-mode speed control
    setSpeed(speed) {
        if (this.activeMode && this.activeMode.setSpeed) {
            this.activeMode.setSpeed(speed);
        }
    }

    // [MOV.3] Stop movement immediately
    // RUNTIME: Cutscenes, pausing, freeze effects
    stop() {
        this.velocity = BABYLON.Vector3.Zero();
        this.targetVelocity = BABYLON.Vector3.Zero();

        // Clear target for click-to-move
        if (this.activeMode && this.activeMode.clearTarget) {
            this.activeMode.clearTarget();
        }

        console.log('[MOV.3] Movement stopped');
    }

    // [MOV.6] FUTURE: Movement zones
    // Placeholder for zone-based movement restrictions (Phase 3+)
    // Example: No-fly zones, slow-motion areas, underwater
    createMovementZone(zoneMesh, restrictions) {
        zoneMesh.metadata = zoneMesh.metadata || {};
        zoneMesh.metadata.isMovementZone = true;
        zoneMesh.metadata.movementRestrictions = restrictions;

        console.log(`[MOV.6] Movement zone created: ${zoneMesh.name}`);

        // Note: Actual zone detection would be in update loop
        // Checking if camera is inside zone bounds
        // This is a hook for future implementation
    }

    // [MOV.6] FUTURE: Check if in movement zone
    // Returns zone restrictions if in zone, null otherwise
    getZoneRestrictions(position) {
        // [MOV.6] Future: Check all movement zones
        // For now, return null (no restrictions)
        return null;
    }

    // [MOV.3] Get current movement state
    getState() {
        return {
            mode: this.activeModeName,
            velocity: this.velocity.clone(),
            speed: this.globalSpeedMultiplier,
            acceleration: this.acceleration,
            moving: this.velocity.length() > 0.01
        };
    }

    // [PLG.1.5] Cleanup on disposal
    dispose() {
        // Deactivate current mode
        if (this.activeMode) {
            this.activeMode.deactivate();
        }

        // Clear modes
        this.modes.clear();

        super.dispose();
    }
}

// [MOV] Export for registration with engine
export default MovementPlugin;
