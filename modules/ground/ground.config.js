/**
 * GroundModule Default Configuration
 */

export const groundConfig = {
    // Ground dimensions
    width: 50,
    height: 50,

    // Ground type: 'plane' or 'heightmap'
    type: 'plane',

    // Subdivisions (affects geometry detail)
    subdivisions: 10,

    // Ground rotation (in radians)
    rotation: {
        x: 0,  // Tilt X
        y: 0,  // Tilt Y
        z: 0   // Tilt Z
    },

    // Rotate full scene with ground
    rotateFullScene: true,

    // Edge behavior: 'stop', 'teleport', 'wrap', 'none'
    edgeBehavior: 'stop',

    // Teleport position (for teleport edge behavior)
    teleportPosition: {
        x: 0,
        y: 2,
        z: 0
    },

    // Material settings
    material: {
        diffuse: '../dirt.jpg',
        normal: null,
        specular: null,
        tiling: 4,
        roughness: 0.8,
        metallic: 0.1
    },

    // Physics settings
    collision: true,
    pickable: true, // Required for click-to-move

    // Heightmap settings (when type='heightmap')
    heightmap: {
        url: null,
        minHeight: 0,
        maxHeight: 10,
        onReady: null
    },

    // Infinite terrain settings
    infiniteTerrain: {
        enabled: false,
        chunkSize: 50,
        viewDistance: 3,
        height: 0,
        heightVariation: false,
        material: {
            diffuse: 'https://playground.babylonjs.com/textures/grass.png',
            normal: 'https://playground.babylonjs.com/textures/grassn.png',
            tiling: { u: 10, v: 10 }
        }
    }
};

export default groundConfig;
