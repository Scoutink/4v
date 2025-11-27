/**
 * @file physics.config.js
 * @description Default configuration for Physics Module
 *
 * This file defines default physics settings including:
 * - Collision modes (hybrid, physics, simple)
 * - Gravity presets (Earth, Moon, Mars, etc.)
 * - Default physics material properties
 * - Camera physics settings
 * - Debug visualization options
 *
 * @author Development Team
 * @created 2025-11-25
 */

export default {
    // Module metadata
    enabled: true,
    version: '1.0.0',

    // Collision system configuration
    collision: {
        mode: 'hybrid',  // 'hybrid', 'physics', 'babylon'
        enabled: true,
        autoEnable: true  // Automatically enable collision on new objects
    },

    // Gravity configuration
    gravity: {
        preset: 'earth',  // 'earth', 'moon', 'mars', 'jupiter', 'zeroG', 'arcade', 'custom'
        enabled: true,
        presets: {
            earth: { x: 0, y: -9.81, z: 0 },
            moon: { x: 0, y: -1.62, z: 0 },
            mars: { x: 0, y: -3.71, z: 0 },
            jupiter: { x: 0, y: -24.79, z: 0 },
            zeroG: { x: 0, y: 0, z: 0 },
            arcade: { x: 0, y: -0.2, z: 0 },
            custom: { x: 0, y: -10, z: 0 }
        }
    },

    // Default physics material properties
    defaultMaterial: {
        mass: 1,           // kg (0 = static/immovable)
        restitution: 0.5,  // Bounciness (0 = no bounce, 1 = perfect bounce)
        friction: 0.5,     // Sliding resistance (0 = ice, 1 = sticky)
        shape: 'box'       // 'box', 'sphere', 'capsule', 'cylinder', 'mesh'
    },

    // Camera physics settings
    camera: {
        collision: true,
        gravity: false,  // False for editor mode (no falling)
        ellipsoid: { x: 0.5, y: 1, z: 0.5 }
    },

    // Physics material presets
    materialPresets: {
        static: {
            mass: 0,
            restitution: 0.2,
            friction: 0.8,
            description: 'Immovable object (walls, floors)'
        },
        dynamic: {
            mass: 1,
            restitution: 0.5,
            friction: 0.5,
            description: 'Normal movable object'
        },
        bouncy: {
            mass: 0.5,
            restitution: 0.9,
            friction: 0.3,
            description: 'Bouncy ball'
        },
        slippery: {
            mass: 1,
            restitution: 0.1,
            friction: 0.05,
            description: 'Ice or slippery surface'
        },
        heavy: {
            mass: 10,
            restitution: 0.2,
            friction: 0.8,
            description: 'Heavy crate or stone'
        },
        light: {
            mass: 0.1,
            restitution: 0.6,
            friction: 0.4,
            description: 'Light balloon or foam'
        }
    },

    // Debug visualization options
    debug: {
        showColliders: false,     // Show collision shape wireframes
        showForces: false,         // Show force vectors
        showVelocity: false,       // Show velocity vectors
        showContacts: false,       // Show collision contact points
        highlightColor: '#00FF00'  // Debug highlight color
    },

    // Performance settings
    performance: {
        maxPhysicsBodies: 100,     // Maximum active physics bodies
        sleepThreshold: 0.1,       // Velocity threshold for sleep
        lodDistance: 50,           // Distance to disable physics
        updateRate: 60             // Physics update rate (Hz)
    },

    // UI panel settings
    ui: {
        panelPosition: 'right',    // 'left', 'right'
        collapsed: false,
        showAdvanced: false
    }
};
