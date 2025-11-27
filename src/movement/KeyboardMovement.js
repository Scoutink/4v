/**
 * @file KeyboardMovement.js
 * @description Keyboard-based movement mode (WASD + Arrow keys)
 *
 * @tags [MOV.4.*] Keyboard movement
 * @primary-tags [MOV.4] Keyboard movement mode
 *
 * @dependencies
 *   - [MOV.4 -> CAM] Requires active camera
 *
 * @affects
 *   - Camera position (moves camera based on key input)
 *
 * @features
 *   - WASD + Arrow key support
 *   - Q/E for up/down movement
 *   - Customizable key bindings
 *   - Speed multipliers
 *   - Camera-relative movement
 *
 * @author Development Team
 * @created 2025-10-31
 */

// [MOV.4] Keyboard movement mode
// [MOV.4 -> CAM.1] Requires camera for movement
class KeyboardMovement {
    constructor(config = {}) {
        // [MOV.4.1] Key binding configuration
        // Customizable - can be changed per scene/preference
        this.keys = {
            forward: config.forwardKeys || [87, 38],   // W, Up Arrow
            backward: config.backwardKeys || [83, 40], // S, Down Arrow
            left: config.leftKeys || [65, 37],         // A, Left Arrow
            right: config.rightKeys || [68, 39],       // D, Right Arrow
            up: config.upKeys || [81],                 // Q
            down: config.downKeys || [69]              // E
        };

        // [MOV.4.1] Movement speed
        // RUNTIME: Can be changed dynamically (zones, power-ups, etc.)
        this.speed = config.speed !== undefined ? config.speed : 0.5;

        // [MOV.4.1] Speed multiplier
        // RUNTIME: Can be modified (sprint, slow-mo, power-ups)
        this.speedMultiplier = 1.0;

        // [MOV.4.2] Track pressed keys
        this.keysPressed = new Set();

        // [MOV.4] Movement mode state
        this.enabled = false;
        this.camera = null;
        this.scene = null;
    }

    // [MOV.2.2] Activate movement mode
    // [MOV.2.2 -> CAM.1] Requires camera reference
    activate(camera, scene) {
        this.enabled = true;
        this.camera = camera;
        this.scene = scene;

        // [MOV.4.2] Listen for key events
        this.onKeyDown = this.handleKeyDown.bind(this);
        this.onKeyUp = this.handleKeyUp.bind(this);

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);

        console.log('[MOV.4] Keyboard movement activated');
    }

    // [MOV.2.1] Deactivate movement mode
    // [MOV.2.1] Clean up event listeners
    deactivate() {
        this.enabled = false;

        // Remove event listeners
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);

        // Clear pressed keys
        this.keysPressed.clear();

        console.log('[MOV.4] Keyboard movement deactivated');
    }

    // [MOV.4.2] Handle key down
    handleKeyDown(e) {
        this.keysPressed.add(e.keyCode);
    }

    // [MOV.4.2] Handle key up
    handleKeyUp(e) {
        this.keysPressed.delete(e.keyCode);
    }

    // [MOV.3.1] Calculate velocity from key input
    // [MOV.4.3] Keyboard-specific velocity calculation
    // [MOV.4.3 -> CAM.1] Movement relative to camera direction
    getVelocity() {
        if (!this.camera || !this.enabled) {
            return BABYLON.Vector3.Zero();
        }

        // [MOV.4.3] Calculate movement vector
        const velocity = new BABYLON.Vector3(0, 0, 0);
        const effectiveSpeed = this.speed * this.speedMultiplier;

        // [MOV.4.3] Forward/backward movement
        if (this.isKeyPressed(this.keys.forward)) {
            velocity.z += effectiveSpeed;
        }
        if (this.isKeyPressed(this.keys.backward)) {
            velocity.z -= effectiveSpeed;
        }

        // [MOV.4.3] Left/right strafe
        if (this.isKeyPressed(this.keys.left)) {
            velocity.x -= effectiveSpeed;
        }
        if (this.isKeyPressed(this.keys.right)) {
            velocity.x += effectiveSpeed;
        }

        // [MOV.4.3] Up/down movement (Q/E keys)
        if (this.isKeyPressed(this.keys.up)) {
            velocity.y += effectiveSpeed;
        }
        if (this.isKeyPressed(this.keys.down)) {
            velocity.y -= effectiveSpeed;
        }

        // [MOV.4.3] Transform to camera space
        // Movement is relative to where camera is facing
        if (this.camera.getViewMatrix) {
            const camMatrix = this.camera.getViewMatrix().clone().invert();
            const worldVelocity = BABYLON.Vector3.TransformNormal(velocity, camMatrix);

            // Keep Y component for vertical movement
            worldVelocity.y = velocity.y;

            return worldVelocity;
        }

        return velocity;
    }

    // [MOV.4.2] Check if any of the given keys are pressed
    isKeyPressed(keyCodes) {
        return keyCodes.some(code => this.keysPressed.has(code));
    }

    // [MOV.4.1] RUNTIME: Change movement speed
    // EXTENSIBILITY: Zones, power-ups, status effects
    setSpeed(speed) {
        this.speed = speed;
        console.log(`[MOV.4.1] Keyboard movement speed: ${speed}`);
    }

    // [MOV.4.1] RUNTIME: Set speed multiplier
    // EXTENSIBILITY: Temporary speed boosts, slow-mo
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = multiplier;
        console.log(`[MOV.4.1] Speed multiplier: ${multiplier}`);
    }

    // [MOV.4.1] RUNTIME: Customize key bindings
    // EXTENSIBILITY: User preferences, different control schemes
    setKeyBinding(action, keyCodes) {
        if (this.keys.hasOwnProperty(action)) {
            this.keys[action] = Array.isArray(keyCodes) ? keyCodes : [keyCodes];
            console.log(`[MOV.4.1] Key binding updated: ${action}`, keyCodes);
        }
    }

    // [MOV.4] Get current state
    getState() {
        return {
            enabled: this.enabled,
            speed: this.speed,
            speedMultiplier: this.speedMultiplier,
            keysPressed: Array.from(this.keysPressed)
        };
    }
}

// [MOV.4] Export for use in MovementPlugin
export default KeyboardMovement;
