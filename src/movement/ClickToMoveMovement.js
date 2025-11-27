/**
 * @file ClickToMoveMovement.js
 * @description Click-to-move navigation (point-and-click style)
 *
 * @tags [MOV.5.*] Click-to-move movement
 * @primary-tags [MOV.5] Click-to-move mode
 *
 * @dependencies
 *   - [MOV.5 -> CAM] Requires active camera
 *   - [MOV.5 -> INT] Uses raycasting for click detection
 *   - [MOV.5 -> GRD] Ground must be pickable
 *
 * @affects
 *   - Camera position (moves to clicked point)
 *
 * @features
 *   - Click-to-move with pathfinding-ready
 *   - Visual markers at click points
 *   - Height-locked movement (stays at camera Y)
 *   - Speed control
 *   - Double-click for speed boost
 *
 * @author Development Team
 * @created 2025-10-31
 */

// [MOV.5] Click-to-move movement mode
// [MOV.5 -> GRD.2.3] Requires ground to be pickable
class ClickToMoveMovement {
    constructor(scene, events, config = {}) {
        this.scene = scene;
        this.events = events;

        // [MOV.5.2] Target position (where to move)
        this.target = null;

        // [MOV.5.3] Movement speed
        // RUNTIME: Can be changed dynamically
        this.speed = config.speed !== undefined ? config.speed : 0.1;

        // [MOV.5.3] Speed multiplier
        this.speedMultiplier = 1.0;

        // [MOV.5.3] Stop threshold (distance at which to stop)
        this.threshold = config.threshold || 0.5;

        // [MOV.5] Double-click detection
        this.lastClickTime = 0;
        this.doubleClickWindow = config.doubleClickWindow || 400; // ms

        // [MOV.5] Visual markers
        this.showMarkers = config.showMarkers !== false;
        this.markerDuration = config.markerDuration || 1000; // ms

        // [MOV.5.4] Camera rotation settings
        // USER REQUIREMENT: Camera should face direction of movement
        this.rotateCameraToDirection = config.rotateCameraToDirection !== false;
        this.rotationSpeed = config.rotationSpeed || 0.1;

        // [MOV.5] State
        this.enabled = false;
        this.camera = null;
        this.observer = null;
    }

    // [MOV.2.2] Activate movement mode
    activate(camera, scene) {
        this.enabled = true;
        this.camera = camera;
        this.scene = scene;

        // [MOV.5.1] Listen for pointer clicks
        // [INT.2] Uses Babylon's pointer observable
        this.observer = scene.onPointerObservable.add(
            this.onClick.bind(this),
            BABYLON.PointerEventTypes.POINTERPICK
        );

        console.log('[MOV.5] Click-to-move activated');
    }

    // [MOV.2.1] Deactivate movement mode
    deactivate() {
        this.enabled = false;

        // Remove pointer observer
        if (this.observer) {
            this.scene.onPointerObservable.remove(this.observer);
            this.observer = null;
        }

        // Clear target
        this.target = null;

        console.log('[MOV.5] Click-to-move deactivated');
    }

    // [MOV.5.1] Handle pointer click
    // [MOV.5.1 -> GRD.2.3] Picks ground mesh
    onClick(pointerInfo) {
        if (!this.enabled) {
            return;
        }

        const event = pointerInfo.event;

        // [MOV.5.1] Only handle left clicks
        if (event.button !== 0) {
            return;
        }

        const pick = pointerInfo.pickInfo;

        // [MOV.5.1] Check if click hit something pickable
        if (pick && pick.hit && pick.pickedPoint && pick.pickedMesh) {
            // [MOV.5.1] Only move to ground or walkable surfaces
            // Check if mesh is ground or marked as walkable
            const mesh = pick.pickedMesh;
            const isGround = mesh.name === 'ground' || mesh.name.startsWith('chunk_');
            const isWalkable = mesh.metadata && mesh.metadata.walkable === true;

            if (!isGround && !isWalkable) {
                console.log(`[MOV.5.1] Clicked ${mesh.name} - not walkable, ignoring`);
                return; // Don't move to non-walkable objects
            }

            // [MOV.5.2] Set target position
            this.target = pick.pickedPoint.clone();

            // [MOV.5.2] Lock to camera's current Y height
            // Prevents camera from diving into ground or flying
            this.target.y = this.camera.position.y;

            // [MOV.5] Double-click detection
            const now = performance.now();
            const isDoubleClick = (now - this.lastClickTime) < this.doubleClickWindow;
            this.lastClickTime = now;

            // [MOV.5] Speed boost on double-click
            if (isDoubleClick) {
                this.speedMultiplier = 2.0;
                setTimeout(() => {
                    this.speedMultiplier = 1.0;
                }, 1000);

                console.log('[MOV.5] Double-click: speed boost!');
            }

            // [MOV.5] Show visual marker
            if (this.showMarkers) {
                this.createMarker(pick.pickedPoint);
            }

            // [EVT.2] Emit target set event
            this.events.emit('movement:target:set', {
                target: this.target,
                pickedMesh: pick.pickedMesh
            });

            console.log(`[MOV.5.2] Move target set: (${this.target.x.toFixed(1)}, ${this.target.y.toFixed(1)}, ${this.target.z.toFixed(1)})`);
        }
    }

    // [MOV.3.1] Calculate velocity toward target
    // [MOV.5.3] Click-to-move specific velocity
    getVelocity() {
        if (!this.target || !this.camera || !this.enabled) {
            return BABYLON.Vector3.Zero();
        }

        // [MOV.5.3] Calculate direction to target
        const direction = this.target.subtract(this.camera.position);
        const distance = direction.length();

        // [MOV.5.3] Stop if close enough
        if (distance < this.threshold) {
            this.target = null;

            // [EVT.2] Emit target reached
            this.events.emit('movement:target:reached', {
                position: this.camera.position.clone()
            });

            return BABYLON.Vector3.Zero();
        }

        // [MOV.5.4] Rotate camera to face direction of movement
        // USER REQUIREMENT: Camera direction aligns with movement direction
        if (this.rotateCameraToDirection && this.camera.rotation) {
            // Calculate target rotation (yaw) from direction
            const targetRotationY = Math.atan2(direction.x, direction.z);

            // Smoothly interpolate camera rotation
            // This creates smooth rotation instead of instant snap
            const currentRotationY = this.camera.rotation.y;

            // Calculate shortest rotation path (handles 360° wrapping)
            let rotationDiff = targetRotationY - currentRotationY;

            // Normalize to [-PI, PI] range
            while (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
            while (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;

            // Apply smooth rotation
            this.camera.rotation.y += rotationDiff * this.rotationSpeed;
        }

        // [MOV.5.3] Normalize and apply speed
        direction.normalize();
        const effectiveSpeed = this.speed * this.speedMultiplier;

        return direction.scale(effectiveSpeed);
    }

    // [MOV.5] Create visual marker at click point
    createMarker(position) {
        // [MOV.5] Create disc marker
        const disc = BABYLON.MeshBuilder.CreateDisc(
            'clickMarker',
            { radius: 0.5 },
            this.scene
        );

        // [MOV.5] Position and rotate to lie flat on ground
        disc.position = position.clone();
        disc.rotation.x = Math.PI / 2;

        // [MOV.5] Create material
        const material = new BABYLON.StandardMaterial('markerMat', this.scene);
        material.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green
        material.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        disc.material = material;

        // [MOV.5] Not pickable (don't interfere with clicks)
        disc.isPickable = false;

        // [MOV.5] Fade out and dispose
        setTimeout(() => {
            disc.dispose();
        }, this.markerDuration);
    }

    // [MOV.5.2] RUNTIME: Set target position manually
    // EXTENSIBILITY: AI pathfinding, waypoints, external control
    setTarget(position) {
        this.target = position instanceof BABYLON.Vector3
            ? position.clone()
            : new BABYLON.Vector3(position.x, position.y, position.z);

        // Lock Y to camera height
        this.target.y = this.camera.position.y;

        console.log('[MOV.5.2] Manual target set');
    }

    // [MOV.5.3] RUNTIME: Change speed
    setSpeed(speed) {
        this.speed = speed;
        console.log(`[MOV.5.3] Click-to-move speed: ${speed}`);
    }

    // [MOV.5.3] RUNTIME: Set speed multiplier
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = multiplier;
    }

    // [MOV.5] Get current state
    getState() {
        return {
            enabled: this.enabled,
            hasTarget: this.target !== null,
            target: this.target ? this.target.clone() : null,
            speed: this.speed,
            speedMultiplier: this.speedMultiplier
        };
    }

    // [MOV.5.2] Clear target (stop movement)
    clearTarget() {
        this.target = null;
    }
}

// [MOV.5] Export for use in MovementPlugin
export default ClickToMoveMovement;
