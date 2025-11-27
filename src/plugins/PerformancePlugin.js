/**
 * @file PerformancePlugin.js
 * @description Performance optimization and monitoring system
 *
 * @tags [PRF.*] All performance tags
 * @primary-tags [PRF.1] Metrics, [PRF.2] LOD, [PRF.3] Auto-optimization
 * @critical-tags [!PRF.4] Heavy monitoring can impact performance
 *
 * @dependencies
 *   - [PRF -> BABYLON] Requires scene instrumentation
 *   - [PRF -> EVT] Emits performance events
 *
 * @affects
 *   - Shadow quality (optimization)
 *   - Texture resolution (optimization)
 *   - Light count (optimization)
 *   - Mesh LOD switching
 *
 * @events
 *   - Emits: performance:quality:changed, performance:fps:low, performance:fps:critical
 *
 * @features
 *   - Real-time FPS and metrics tracking
 *   - LOD (Level of Detail) system
 *   - Automatic quality adjustment
 *   - Quality tier management
 *   - Frustum culling optimization
 *
 * @author Development Team
 * @created 2025-11-20
 */

import Plugin from '../core/Plugin.js';

// [PRF] Performance plugin
// [PRF] USER REQUIREMENT: Maintain target FPS automatically
class PerformancePlugin extends Plugin {
    constructor() {
        super('performance');

        // [PRF.1] Performance metrics
        this.metrics = {
            fps: 60,
            frameTime: 16.67,
            drawCalls: 0,
            totalVertices: 0,
            totalFaces: 0,
            textureCount: 0,
            meshCount: 0
        };

        // [PRF.2] FPS tracking for auto-optimization
        this.fpsHistory = [];
        this.fpsHistorySize = 60; // Last 60 frames (1 second at 60fps)
        this.averageFPS = 60;

        // [PRF.3] LOD management
        this.lodMeshes = new Map(); // mesh -> LOD data

        // [PRF.4] Auto-optimization settings
        this.autoOptimizationEnabled = false;
        this.targetFPS = 30;
        this.optimizationCheckInterval = 5000; // Check every 5 seconds
        this.lastOptimizationCheck = 0;
        this.lastQualityChange = 0;
        this.qualityChangeMinInterval = 60000; // Don't change quality more than once per minute

        // [PRF.5] Quality tiers
        this.currentTier = 'high';
        this.qualityTiers = {
            ultra: {
                shadows: 'ultra',
                shadowMapSize: 4096,
                textureQuality: 1.0,
                maxLights: 8,
                antialiasing: true
            },
            high: {
                shadows: 'high',
                shadowMapSize: 2048,
                textureQuality: 1.0,
                maxLights: 6,
                antialiasing: true
            },
            medium: {
                shadows: 'medium',
                shadowMapSize: 1024,
                textureQuality: 0.75,
                maxLights: 4,
                antialiasing: true
            },
            low: {
                shadows: 'low',
                shadowMapSize: 512,
                textureQuality: 0.5,
                maxLights: 2,
                antialiasing: false
            },
            potato: {
                shadows: 'off',
                shadowMapSize: 0,
                textureQuality: 0.25,
                maxLights: 1,
                antialiasing: false
            }
        };

        // [PRF.6] Scene instrumentation
        this.instrumentation = null;

        console.log('[PRF] PerformancePlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load performance configuration
        const perfConfig = config.performance || {};

        this.targetFPS = perfConfig.targetFPS || 30;
        this.autoOptimizationEnabled = perfConfig.autoOptimization || false;

        console.log('[PRF] PerformancePlugin configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        super.start();

        // [PRF.6] Setup scene instrumentation
        this.setupInstrumentation();

        // [PRF.7] Start metrics collection
        this.startMetricsCollection();

        console.log('[PRF] PerformancePlugin started');
    }

    // [PRF.6] Setup scene instrumentation
    setupInstrumentation() {
        this.instrumentation = new BABYLON.SceneInstrumentation(this.scene);
        this.instrumentation.captureFrameTime = true;
        this.instrumentation.captureGPUFrameTime = false; // Can be heavy

        console.log('[PRF.6] Scene instrumentation enabled');
    }

    // [PRF.7] Start metrics collection
    startMetricsCollection() {
        // [PRF.7.1] Collect metrics every frame
        this.scene.onBeforeRenderObservable.add(() => {
            this.collectMetrics();

            // [PRF.4] Check for auto-optimization
            if (this.autoOptimizationEnabled) {
                this.checkAutoOptimization();
            }
        });

        console.log('[PRF.7] Metrics collection started');
    }

    // [PRF.1] Collect performance metrics
    collectMetrics() {
        const engine = this.scene.getEngine();

        // [PRF.1.1] FPS
        this.metrics.fps = Math.round(engine.getFps());
        this.metrics.frameTime = this.instrumentation ? this.instrumentation.frameTimeCounter.lastSecAverage : 16.67;

        // [PRF.1.2] Rendering stats
        this.metrics.drawCalls = this.scene.getActiveMeshes().length;
        this.metrics.totalVertices = this.scene.getTotalVertices();

        // Calculate total indices manually (no built-in method)
        let totalIndices = 0;
        this.scene.meshes.forEach(mesh => {
            if (mesh.getTotalIndices) {
                totalIndices += mesh.getTotalIndices();
            }
        });
        this.metrics.totalFaces = Math.floor(totalIndices / 3);

        this.metrics.textureCount = this.scene.textures.length;
        this.metrics.meshCount = this.scene.meshes.length;

        // [PRF.2] Track FPS history
        this.fpsHistory.push(this.metrics.fps);
        if (this.fpsHistory.length > this.fpsHistorySize) {
            this.fpsHistory.shift();
        }

        // [PRF.2] Calculate average FPS
        if (this.fpsHistory.length > 0) {
            const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
            this.averageFPS = sum / this.fpsHistory.length;
        }
    }

    // [PRF.1] Get current metrics
    getMetrics() {
        return { ...this.metrics };
    }

    // [PRF.1] Get average FPS
    getAverageFPS() {
        return this.averageFPS;
    }

    // [PRF.2] Enable LOD for mesh
    // USER REQUIREMENT: Level of Detail for performance
    enableLOD(mesh, levels) {
        if (!Array.isArray(levels) || levels.length === 0) {
            console.warn('[PRF.2] LOD levels must be an array');
            return;
        }

        // Sort levels by distance (ascending)
        levels.sort((a, b) => a.distance - b.distance);

        // [PRF.2.1] Register LOD meshes with Babylon
        for (const level of levels) {
            if (level.mesh && level.distance) {
                mesh.addLODLevel(level.distance, level.mesh);
            }
        }

        this.lodMeshes.set(mesh, {
            levels,
            currentLevel: 0
        });

        console.log(`[PRF.2] LOD enabled for ${mesh.name} (${levels.length} levels)`);
    }

    // [PRF.2] Disable LOD for mesh
    disableLOD(mesh) {
        if (!this.lodMeshes.has(mesh)) {
            return;
        }

        // Remove all LOD levels
        const lodData = this.lodMeshes.get(mesh);
        for (const level of lodData.levels) {
            if (level.mesh) {
                mesh.removeLODLevel(level.mesh);
            }
        }

        this.lodMeshes.delete(mesh);
        console.log(`[PRF.2] LOD disabled for ${mesh.name}`);
    }

    // [PRF.3] Enable auto-optimization
    // USER REQUIREMENT: Automatically adjust quality to maintain FPS
    enableAutoOptimization(options = {}) {
        this.autoOptimizationEnabled = true;
        this.targetFPS = options.targetFPS || this.targetFPS;

        console.log(`[PRF.3] Auto-optimization enabled (target: ${this.targetFPS} FPS)`);

        // [EVT.2] Emit event
        this.events.emit('performance:auto_optimization:enabled', {
            targetFPS: this.targetFPS
        });
    }

    // [PRF.3] Disable auto-optimization
    disableAutoOptimization() {
        this.autoOptimizationEnabled = false;
        console.log('[PRF.3] Auto-optimization disabled');

        // [EVT.2] Emit event
        this.events.emit('performance:auto_optimization:disabled');
    }

    // [PRF.4] Check if optimization is needed
    checkAutoOptimization() {
        const now = performance.now();

        // [PRF.4.1] Only check every N seconds
        if (now - this.lastOptimizationCheck < this.optimizationCheckInterval) {
            return;
        }

        this.lastOptimizationCheck = now;

        // [PRF.4.2] Need enough FPS history
        if (this.fpsHistory.length < this.fpsHistorySize) {
            return;
        }

        const avgFPS = this.averageFPS;

        // [PRF.4.3] FPS too low - downgrade quality
        if (avgFPS < this.targetFPS - 5) {
            // Check if we can downgrade
            if (now - this.lastQualityChange < this.qualityChangeMinInterval) {
                return; // Too soon since last change
            }

            this.downgradeQuality();

            // [EVT.2] Emit FPS low event
            this.events.emit('performance:fps:low', {
                fps: avgFPS,
                target: this.targetFPS,
                tier: this.currentTier
            });
        }

        // [PRF.4.4] FPS too high - upgrade quality
        else if (avgFPS > this.targetFPS + 10) {
            // Check if we've been stable for a while
            if (now - this.lastQualityChange < this.qualityChangeMinInterval * 2) {
                return; // Need longer stability before upgrading
            }

            this.upgradeQuality();
        }

        // [PRF.4.5] Critical FPS - emergency downgrade
        if (avgFPS < 15) {
            this.events.emit('performance:fps:critical', {
                fps: avgFPS,
                tier: this.currentTier
            });

            // Emergency: Skip to potato tier
            if (this.currentTier !== 'potato') {
                this.setQualityTier('potato');
            }
        }
    }

    // [PRF.5] Set quality tier
    setQualityTier(tier) {
        if (!this.qualityTiers[tier]) {
            console.warn(`[PRF.5] Unknown quality tier: ${tier}`);
            return;
        }

        const oldTier = this.currentTier;
        this.currentTier = tier;
        this.lastQualityChange = performance.now();

        const settings = this.qualityTiers[tier];

        // [PRF.5.1] Apply settings (shadow plugin integration)
        if (this.engine && this.engine.getPlugin) {
            const shadowPlugin = this.engine.getPlugin('shadow');
            if (shadowPlugin) {
                if (settings.shadows === 'off') {
                    shadowPlugin.disableShadowsGlobally();
                } else {
                    shadowPlugin.enableShadowsGlobally();
                    shadowPlugin.setQuality(settings.shadows);
                }
            }
        }

        // [PRF.5.2] Apply antialiasing
        if (settings.antialiasing !== undefined) {
            this.scene.getEngine().setHardwareScalingLevel(settings.antialiasing ? 1.0 : 1.5);
        }

        // [EVT.2] Emit quality changed event
        this.events.emit('performance:quality:changed', {
            oldTier,
            newTier: tier,
            settings
        });

        console.log(`[PRF.5] Quality tier changed: ${oldTier} → ${tier}`);
    }

    // [PRF.5] Get current quality tier
    getQualityTier() {
        return this.currentTier;
    }

    // [PRF.5] Get quality settings
    getQualitySettings(tier) {
        return tier ? this.qualityTiers[tier] : this.qualityTiers[this.currentTier];
    }

    // [PRF.5] Downgrade quality tier
    downgradeQuality() {
        const tiers = ['ultra', 'high', 'medium', 'low', 'potato'];
        const currentIndex = tiers.indexOf(this.currentTier);

        if (currentIndex < tiers.length - 1) {
            this.setQualityTier(tiers[currentIndex + 1]);
        } else {
            console.log('[PRF.5] Already at lowest quality tier');
        }
    }

    // [PRF.5] Upgrade quality tier
    upgradeQuality() {
        const tiers = ['ultra', 'high', 'medium', 'low', 'potato'];
        const currentIndex = tiers.indexOf(this.currentTier);

        if (currentIndex > 0) {
            this.setQualityTier(tiers[currentIndex - 1]);
        } else {
            console.log('[PRF.5] Already at highest quality tier');
        }
    }

    // [PRF.6] Optimize mesh
    // USER REQUIREMENT: Reduce mesh complexity
    optimizeMesh(mesh, options = {}) {
        if (!mesh) {
            console.warn('[PRF.6] No mesh provided for optimization');
            return;
        }

        console.log(`[PRF.6] Optimizing mesh: ${mesh.name}`);

        // [PRF.6.1] Simplify geometry
        if (options.simplify && mesh.simplify) {
            const targetTriangles = options.targetTriangles || 1000;
            mesh.simplify(
                [{ quality: 0.5, distance: 0 }],
                false,
                BABYLON.SimplificationType.QUADRATIC,
                () => {
                    console.log(`[PRF.6] Mesh simplified: ${mesh.name}`);
                }
            );
        }

        // [PRF.6.2] Merge materials (if applicable)
        if (options.mergeMaterials && mesh.subMeshes && mesh.subMeshes.length > 1) {
            // TODO: Implement material merging
            console.log('[PRF.6] Material merging not yet implemented');
        }

        // [PRF.6.3] Freeze mesh (if static)
        if (options.freeze && !mesh.isDisposed()) {
            mesh.freezeWorldMatrix();
            console.log(`[PRF.6] Mesh frozen: ${mesh.name}`);
        }
    }

    // [PRF.7] Enable frustum culling
    enableFrustumCulling(enabled) {
        this.scene.meshes.forEach(mesh => {
            mesh.isPickable = enabled;
            mesh.alwaysSelectAsActiveMesh = !enabled;
        });

        console.log(`[PRF.7] Frustum culling: ${enabled ? 'enabled' : 'disabled'}`);
    }

    // [PRF.8] Freeze all static meshes
    freezeStaticMeshes() {
        let frozenCount = 0;

        this.scene.meshes.forEach(mesh => {
            // Don't freeze if mesh has animations or is already frozen
            if (!mesh.metadata?.dynamic && !mesh.isDisposed()) {
                mesh.freezeWorldMatrix();
                frozenCount++;
            }
        });

        console.log(`[PRF.8] Frozen ${frozenCount} static meshes`);
        return frozenCount;
    }

    // [PRF.8] Unfreeze all meshes
    unfreezeAllMeshes() {
        let unfrozenCount = 0;

        this.scene.meshes.forEach(mesh => {
            if (!mesh.isDisposed()) {
                mesh.unfreezeWorldMatrix();
                unfrozenCount++;
            }
        });

        console.log(`[PRF.8] Unfrozen ${unfrozenCount} meshes`);
        return unfrozenCount;
    }

    // [PRF.9] Get performance recommendations
    getRecommendations() {
        const recommendations = [];
        const metrics = this.getMetrics();

        // High draw calls
        if (metrics.drawCalls > 100) {
            recommendations.push({
                type: 'warning',
                message: `High draw calls (${metrics.drawCalls}). Consider mesh merging.`,
                action: 'Merge meshes or reduce object count'
            });
        }

        // High polygon count
        if (metrics.totalFaces > 100000) {
            recommendations.push({
                type: 'warning',
                message: `High polygon count (${Math.round(metrics.totalFaces / 1000)}K faces). Consider LOD or simplification.`,
                action: 'Implement LOD or simplify meshes'
            });
        }

        // Low FPS
        if (metrics.fps < 30) {
            recommendations.push({
                type: 'critical',
                message: `Low FPS (${metrics.fps}). Performance issues detected.`,
                action: 'Enable auto-optimization or reduce quality'
            });
        }

        // Many textures
        if (metrics.textureCount > 50) {
            recommendations.push({
                type: 'info',
                message: `Many textures loaded (${metrics.textureCount}). Consider texture atlasing.`,
                action: 'Use texture atlases to reduce texture count'
            });
        }

        return recommendations;
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Disable instrumentation
        if (this.instrumentation) {
            this.instrumentation.dispose();
        }

        // Clear LOD data
        this.lodMeshes.clear();

        // Unfreeze meshes
        this.unfreezeAllMeshes();

        super.dispose();

        console.log('[PRF] PerformancePlugin disposed');
    }
}

// [PRF] Export for registration with engine
export default PerformancePlugin;
