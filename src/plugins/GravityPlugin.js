/**
 * @file GravityPlugin.js
 * @description Unified gravity system with per-object overrides and runtime control
 *
 * @tags [GRV.*] All gravity tags
 * @primary-tags [GRV.1] Gravity initialization, [GRV.2] Presets
 * @critical-tags [!GRV.1] Scene gravity affects camera and all physics bodies
 *
 * @dependencies
 *   - [GRV -> CAM] Camera uses scene gravity
 *   - [GRV -> PHY] Physics bodies affected by gravity
 *   - [GRV -> COL] Requires physics to be initialized
 *
 * @affects
 *   - CameraPlugin (camera.applyGravity uses this)
 *   - CollisionPlugin (physics bodies use this)
 *   - All meshes with physics bodies
 *
 * @events
 *   - Emits: gravity:changed, gravity:preset:changed
 *   - Listens: (none - but external systems can request changes)
 *
 * @features
 *   - Scene-level default gravity
 *   - Runtime gravity changes
 *   - Per-object gravity multipliers (anti-gravity support)
 *   - Preset system (Earth, Moon, Mars, ZeroG, Arcade)
 *   - Future-ready for zones and external APIs
 *
 * @author Development Team
 * @created 2025-10-31
 */

import Plugin from '../core/Plugin.js';

// [GRV] Gravity system with runtime flexibility
// [!GRV.1] CRITICAL: Changes affect camera movement and all physics bodies
class GravityPlugin extends Plugin {
    constructor(options = {}) {
        super(options);

        // [GRV.2] Gravity presets (m/s²)
        // Can be extended with custom presets
        this.presets = {
            earth: { x: 0, y: -9.81, z: 0 },      // Earth gravity
            moon: { x: 0, y: -1.62, z: 0 },       // Moon gravity
            mars: { x: 0, y: -3.71, z: 0 },       // Mars gravity
            jupiter: { x: 0, y: -24.79, z: 0 },   // Jupiter gravity
            zeroG: { x: 0, y: 0, z: 0 },          // Zero gravity (space)
            arcade: { x: 0, y: -0.2, z: 0 },      // Floaty arcade feel
            custom: { x: 0, y: -10, z: 0 }        // Custom default
        };

        // [GRV.1] Current gravity value
        this.current = null;
        this.currentPresetName = null;

        // [GRV.5] Per-object gravity tracking
        // Stores meshes with custom gravity multipliers
        this.objectGravityMultipliers = new WeakMap();
    }

    // [GRV.1] Initialize gravity system
    // [GRV.1.1] Load preset or custom gravity from config
    start() {
        super.start();

        // [CFG.2] Read gravity config
        const gravityConfig = this.config.gravity || {};
        const preset = gravityConfig.preset || 'earth';
        const custom = gravityConfig.custom;

        // [GRV.1.1] Set initial gravity
        if (custom) {
            // [GRV.1.2] Custom gravity value
            this.setGravity(custom, 'custom');
        } else {
            // [GRV.2] Use preset
            this.setPreset(preset);
        }

        console.log(`[GRV.1] Gravity initialized: ${this.currentPresetName} (${this.current.y} m/s²)`);
    }

    // [GRV.2] Set gravity from preset
    // [GRV.2] Presets: earth, moon, mars, jupiter, zeroG, arcade
    setPreset(name) {
        const preset = this.presets[name];
        if (!preset) {
            console.warn(`[GRV.2] Gravity preset '${name}' not found, using 'earth'`);
            name = 'earth';
        }

        this.setGravity(this.presets[name] || this.presets.earth, name);

        // [EVT.2] Emit preset changed event
        this.events.emit('gravity:preset:changed', {
            preset: name,
            gravity: this.current
        });
    }

    // [!GRV.1.2] Set custom gravity value (runtime)
    // [GRV.3 -> CAM.5.2] Updates scene gravity (affects camera)
    // [GRV.4 -> PHY.3] Updates physics gravity (affects bodies)
    // RUNTIME: Can be called anytime to change gravity
    // EXTERNAL: Can be triggered by external APIs, events, zones
    setGravity(gravity, presetName = 'custom') {
        // [GRV.1.2] Validate and store gravity (raw physics values in m/s²)
        this.current = {
            x: typeof gravity.x === 'number' ? gravity.x : 0,
            y: typeof gravity.y === 'number' ? gravity.y : -9.81,
            z: typeof gravity.z === 'number' ? gravity.z : 0
        };
        this.currentPresetName = presetName;

        // [!GRV.3] Update scene gravity (for camera.applyGravity)
        // NOTE: Scene gravity uses SCALED values for smooth camera movement
        // Physics gravity uses actual m/s² values
        // Scale factor: divide by ~50 for camera-friendly movement
        const cameraGravityScale = 0.02; // ~1/50 scale for smooth camera
        this.scene.gravity = new BABYLON.Vector3(
            this.current.x * cameraGravityScale,
            this.current.y * cameraGravityScale,
            this.current.z * cameraGravityScale
        );
        
        console.log(`[GRV.3] Scene gravity set for camera: (${this.scene.gravity.x.toFixed(3)}, ${this.scene.gravity.y.toFixed(3)}, ${this.scene.gravity.z.toFixed(3)})`);

        // [!GRV.4] Update physics gravity (for physics bodies)
        // Physics engine uses actual m/s² values
        const physicsEngine = this.scene.getPhysicsEngine();
        if (physicsEngine) {
            physicsEngine.setGravity(
                new BABYLON.Vector3(
                    this.current.x,
                    this.current.y,
                    this.current.z
                )
            );
            console.log(`[GRV.4] Physics engine gravity set: (${this.current.x}, ${this.current.y}, ${this.current.z}) m/s²`);
        }

        // [EVT.2] Emit gravity changed event
        // External systems can listen and react
        this.events.emit('gravity:changed', {
            gravity: this.current,
            sceneGravity: {
                x: this.scene.gravity.x,
                y: this.scene.gravity.y,
                z: this.scene.gravity.z
            },
            preset: presetName
        });

        console.log(`[GRV.1.2] ✅ Gravity changed: ${presetName} (physics: ${this.current.y} m/s², camera: ${this.scene.gravity.y.toFixed(3)})`);
    }

    // [GRV.5] Set per-object gravity multiplier
    // [GRV.5] ANTI-GRAVITY: Use negative multiplier for upward force
    // Example: balloon with multiplier -0.3 floats upward
    // Example: heavy object with multiplier 2.0 falls faster
    // RUNTIME: Can be set/changed anytime
    setObjectGravityMultiplier(mesh, multiplier) {
        if (!mesh) {
            console.warn('[GRV.5] Cannot set gravity multiplier: mesh is null');
            return;
        }

        // [GRV.5] Store multiplier in mesh metadata
        // This is preserved across plugin reloads
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.gravityMultiplier = multiplier;

        // [GRV.5] Also track in WeakMap for internal use
        this.objectGravityMultipliers.set(mesh, multiplier);

        // [GRV.5 -> PHY.2] Apply to physics body if exists
        const physicsBody = mesh.physicsBody;
        if (physicsBody) {
            // Calculate effective gravity for this object
            const effectiveGravity = new BABYLON.Vector3(
                this.current.x * multiplier,
                this.current.y * multiplier,
                this.current.z * multiplier
            );

            // Apply custom gravity force
            // Note: This is a simplified approach
            // For full anti-gravity, we'd apply opposite force each frame
            physicsBody.setGravityFactor(multiplier);

            console.log(`[GRV.5] Object '${mesh.name}' gravity multiplier: ${multiplier}`);
        }

        // [EVT.2] Emit object gravity changed
        this.events.emit('gravity:object:changed', {
            mesh,
            multiplier,
            effectiveGravity: this.current.y * multiplier
        });
    }

    // [GRV.5] Get object's effective gravity
    // Returns scene gravity * object multiplier
    getObjectGravity(mesh) {
        const multiplier = mesh?.metadata?.gravityMultiplier || 1.0;
        return {
            x: this.current.x * multiplier,
            y: this.current.y * multiplier,
            z: this.current.z * multiplier,
            multiplier
        };
    }

    // [GRV.1] Get current gravity
    getGravity() {
        return {
            ...this.current,
            preset: this.currentPresetName
        };
    }

    // [GRV.5] Disable gravity temporarily
    // [GRV.5] Useful for cutscenes, special effects
    disable() {
        this.setGravity({ x: 0, y: 0, z: 0 }, 'disabled');
    }

    // [GRV.5] Re-enable gravity
    // [GRV.5] Restores to last preset or custom value
    enable() {
        if (this.currentPresetName && this.currentPresetName !== 'disabled') {
            this.setPreset(this.currentPresetName);
        } else {
            this.setPreset('earth'); // Default fallback
        }
    }

    // [GRV.2] Add custom preset (runtime)
    // EXTENSIBILITY: Allows external systems to add presets
    // Example: Weather API adds 'storm' preset with turbulent gravity
    addPreset(name, gravity) {
        if (!gravity || typeof gravity.y !== 'number') {
            console.warn('[GRV.2] Invalid gravity preset');
            return;
        }

        this.presets[name] = {
            x: gravity.x || 0,
            y: gravity.y,
            z: gravity.z || 0
        };

        console.log(`[GRV.2] Custom preset added: '${name}'`);

        // [EVT.2] Emit preset added
        this.events.emit('gravity:preset:added', { name, gravity });
    }

    // [GRV.2] Get all available presets
    getPresets() {
        return Object.keys(this.presets);
    }

    // [GRV.2] Get preset value
    getPreset(name) {
        return this.presets[name] ? { ...this.presets[name] } : null;
    }

    // [GRV.6] FUTURE: Gravity zones support
    // Placeholder for zone-based gravity (Phase 3+)
    // Example: Underwater zone with reduced gravity
    // Example: Black hole zone with extreme gravity
    createGravityZone(zoneMesh, gravity) {
        // [GRV.6] Store zone in mesh metadata
        zoneMesh.metadata = zoneMesh.metadata || {};
        zoneMesh.metadata.isGravityZone = true;
        zoneMesh.metadata.zoneGravity = gravity;

        console.log(`[GRV.6] Gravity zone created: '${zoneMesh.name}'`);

        // [EVT.2] Emit zone created
        this.events.emit('gravity:zone:created', {
            zone: zoneMesh,
            gravity
        });

        // Note: Actual zone detection would be in update loop
        // Checking if objects are inside zone bounds
        // This is a hook for future implementation
    }

    // [GRV.6] FUTURE: Check if position is in gravity zone
    // Returns zone gravity if in zone, null otherwise
    getGravityAtPosition(position) {
        // [GRV.6] Future: Check all gravity zones
        // For now, return scene gravity
        return this.current;
    }
}

// [GRV] Export for registration with engine
export default GravityPlugin;
