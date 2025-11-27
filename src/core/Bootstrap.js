/**
 * @file Bootstrap.js
 * @description Core bootstrap logic for Legozo 3D CMS.
 * 
 * This file is now LIGHT - it only:
 * 1. Initializes the LegozoLoader
 * 2. Sets up global error handling
 * 3. Wires up the ActionDispatcher for UI events
 * 4. Exposes minimal global handlers for legacy HTML onclick attributes
 * 
 * All action handling logic is now in ActionDispatcher.js
 * 
 * @architecture
 *   index.html → Bootstrap → LegozoLoader → Engine → Plugins
 *                        ↓
 *              ActionDispatcher → Plugin Actions
 */

import { LegozoLoader } from '../../core/legozo-loader.js';
import { ActionDispatcher } from './ActionDispatcher.js';

export class Bootstrap {
    constructor() {
        this.legozo = null;
        this.dispatcher = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Global error handlers
            this.setupErrorHandling();

            console.log('[Bootstrap] Initializing Legozo 3D CMS...');

            // Initialize Loader
            this.legozo = new LegozoLoader();
            window.legozo = this.legozo; // Expose for debugging/console access

            // Start the application
            await this.legozo.init('./config/scene-demo.json');
            await this.legozo.start();

            // Initialize ActionDispatcher (handles all data-action events)
            this.dispatcher = new ActionDispatcher(this.legozo.engine);
            this.dispatcher.init();
            window.__actionDispatcher = this.dispatcher; // Expose for debugging

            // Setup minimal global handlers for legacy onclick attributes
            this.setupLegacyHandlers();

            console.log('[Bootstrap] ✅ Legozo 3D CMS started successfully');

        } catch (error) {
            console.error('[Bootstrap] Startup failed:', error);
            this.showError(error);
        }
    }

    /**
     * Setup global error handling
     */
    setupErrorHandling() {
        window.addEventListener('error', (e) => console.error('[Legozo] Error:', e.error));
        window.addEventListener('unhandledrejection', (e) => console.error('[Legozo] Unhandled rejection:', e.reason));
    }

    /**
     * Show fatal error UI
     * @param {Error} error 
     */
    showError(error) {
        document.body.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                 background: rgba(255,0,0,0.9); color: white; padding: 30px; border-radius: 10px;
                 font-family: monospace; max-width: 600px; z-index: 9999;">
                <h2>❌ Failed to Initialize</h2>
                <p>${error.message}</p>
                <pre style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; overflow: auto;">
${error.stack}</pre>
                <button onclick="location.reload()" style="background: white; color: #c00; border: none;
                     padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 15px;">
                    Reload Page
                </button>
            </div>
        `;
    }

    /**
     * Setup legacy global handlers for HTML onclick attributes
     * These are maintained for backward compatibility with existing templates
     * New code should use data-action attributes instead
     */
    setupLegacyHandlers() {
        const engine = this.legozo.engine;

        // Welcome/Demo - Start button on welcome screen
        window.startDemo = () => {
            document.getElementById('welcomeMessage')?.classList.add('hidden');
        };

        // Mode Toggle - Uses dispatcher
        window.toggleMode = () => {
            this.dispatcher.dispatch('mode:toggle');
        };

        // Instructions Toggle
        window.toggleInstructions = () => {
            const instructions = document.getElementById('instructions');
            const btn = document.getElementById('toggleBtn');
            if (instructions) {
                instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none';
                btn?.classList.toggle('visible');
            }
        };

        // Ground Texture - Delegates to dispatcher
        window.setGroundTexture = (texture) => {
            this.dispatcher.dispatch('ground:texture', texture);
        };

        // Texture Tiling - Delegates to dispatcher
        window.updateTextureTiling = (value) => {
            this.dispatcher.dispatch('ground:tiling', value);
            document.getElementById('textureTiling').textContent = `${value}x`;
        };

        // Sky Presets - Delegates to dispatcher
        window.setSkyPreset = (preset) => {
            this.dispatcher.dispatch('sky:preset', preset);
        };

        // Lighting Presets - Delegates to dispatcher
        window.setLightingPreset = (preset) => {
            this.dispatcher.dispatch('lighting:preset', preset);
        };

        // Shadow Quality - Delegates to dispatcher
        window.setShadowQuality = (quality) => {
            this.dispatcher.dispatch('shadow:quality', quality);
        };

        // Edge Behavior - Delegates to dispatcher
        window.setEdgeBehavior = (behavior) => {
            this.dispatcher.dispatch(`ground:edge:${behavior}`);
        };

        console.log('[Bootstrap] Legacy handlers registered (delegating to ActionDispatcher)');
    }
}

// Auto-start
const bootstrap = new Bootstrap();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootstrap.init());
} else {
    bootstrap.init();
}
