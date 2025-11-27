/**
 * @file UIPlugin.js
 * @description In-engine UI system using Babylon.GUI
 *
 * @tags [UI.*] All UI tags
 * @primary-tags [UI.1] HUD, [UI.2] Buttons, [UI.3] Panels, [UI.4] Tooltips
 * @critical-tags [!UI.5] Performance critical - minimize draw calls
 *
 * @dependencies
 *   - [UI -> BABYLON.GUI] Requires Babylon.GUI library
 *   - [UI -> EVT] Emits UI interaction events
 *
 * @affects
 *   - Screen overlay (2D UI on top of 3D scene)
 *   - No 3D scene modifications
 *
 * @events
 *   - Emits: ui:button:clicked, ui:panel:opened/closed, ui:slider:changed
 *
 * @features
 *   - Full-screen HUD system
 *   - Buttons with callbacks
 *   - Panels (show/hide)
 *   - Tooltips on hover
 *   - Progress bars
 *   - Text labels with positioning
 *
 * @author Development Team
 * @created 2025-11-20
 */

import Plugin from '../core/Plugin.js';

// [UI] UI plugin using Babylon.GUI
// [UI] USER REQUIREMENT: In-engine UI overlays
class UIPlugin extends Plugin {
    constructor() {
        super('ui');

        // [UI.1] Advanced Dynamic Texture (fullscreen UI)
        this.advancedTexture = null;

        // [UI.2] UI elements registry
        this.elements = new Map(); // name -> element
        this.panels = new Map(); // name -> panel
        this.tooltips = new Map(); // mesh -> tooltip

        // [UI.3] HUD container
        this.hudContainer = null;
        this.hudElements = new Map();

        // [UI.4] Default styling
        this.defaultStyles = {
            button: {
                width: '150px',
                height: '50px',
                color: 'white',
                background: '#4CAF50',
                fontSize: 16,
                cornerRadius: 8
            },
            panel: {
                width: '300px',
                height: '400px',
                color: 'white',
                background: 'rgba(0, 0, 0, 0.8)',
                cornerRadius: 12,
                thickness: 2
            },
            text: {
                color: 'white',
                fontSize: 16
            },
            tooltip: {
                width: '200px',
                height: '40px',
                color: 'white',
                background: 'rgba(0, 0, 0, 0.9)',
                fontSize: 14
            }
        };

        console.log('[UI] UIPlugin initialized');
    }

    // [PLG.1.2] Initialize plugin
    init(scene, events, config) {
        super.init(scene, events, config);

        // [CFG.2] Load UI configuration
        const uiConfig = config.ui || {};

        // [UI.5] Override default styles if provided
        if (uiConfig.styles) {
            Object.assign(this.defaultStyles, uiConfig.styles);
        }

        console.log('[UI] UIPlugin configuration loaded');
    }

    // [PLG.2.1] Start plugin
    start() {
        super.start();

        // [UI.1] Create fullscreen advanced texture
        this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
            'UI',
            true,
            this.scene
        );

        console.log('[UI] UIPlugin started - Advanced texture created');
    }

    // [UI.1] Create HUD
    // USER REQUIREMENT: Heads-up display for info
    createHUD() {
        if (this.hudContainer) {
            console.warn('[UI.1] HUD already created');
            return this.hudContainer;
        }

        // [UI.1.1] Create HUD container (top-level)
        this.hudContainer = new BABYLON.GUI.Container('hudContainer');
        this.hudContainer.width = 1;
        this.hudContainer.height = 1;
        this.hudContainer.isPointerBlocker = false; // Don't block clicks

        this.advancedTexture.addControl(this.hudContainer);

        console.log('[UI.1] HUD container created');

        return {
            addText: (name, options) => this.addHUDText(name, options),
            updateText: (name, text) => this.updateHUDText(name, text),
            removeText: (name) => this.removeHUDText(name),
            hide: () => { this.hudContainer.isVisible = false; },
            show: () => { this.hudContainer.isVisible = true; }
        };
    }

    // [UI.1] Add text to HUD
    addHUDText(name, options = {}) {
        const text = new BABYLON.GUI.TextBlock(name);
        text.text = options.text || '';
        text.color = options.color || this.defaultStyles.text.color;
        text.fontSize = options.fontSize || this.defaultStyles.text.fontSize;

        // [UI.1.2] Position (absolute or percentage)
        if (options.position) {
            if (typeof options.position.x === 'string') {
                text.left = options.position.x;
            } else {
                text.left = options.position.x + 'px';
            }

            if (typeof options.position.y === 'string') {
                text.top = options.position.y;
            } else {
                text.top = options.position.y + 'px';
            }
        }

        text.textHorizontalAlignment = options.horizontalAlignment || BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        text.textVerticalAlignment = options.verticalAlignment || BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;

        this.hudContainer.addControl(text);
        this.hudElements.set(name, text);

        console.log(`[UI.1] HUD text added: ${name}`);
        return text;
    }

    // [UI.1] Update HUD text
    updateHUDText(name, newText) {
        const textElement = this.hudElements.get(name);
        if (textElement) {
            textElement.text = newText;
        } else {
            console.warn(`[UI.1] HUD text not found: ${name}`);
        }
    }

    // [UI.1] Remove HUD text
    removeHUDText(name) {
        const textElement = this.hudElements.get(name);
        if (textElement) {
            this.hudContainer.removeControl(textElement);
            this.hudElements.delete(name);
            console.log(`[UI.1] HUD text removed: ${name}`);
        }
    }

    // [UI.2] Create button
    // USER REQUIREMENT: Interactive UI buttons
    createButton(name, options = {}) {
        const button = BABYLON.GUI.Button.CreateSimpleButton(name, options.text || 'Button');

        // [UI.2.1] Styling
        button.width = options.width || this.defaultStyles.button.width;
        button.height = options.height || this.defaultStyles.button.height;
        button.color = options.color || this.defaultStyles.button.color;
        button.background = options.background || this.defaultStyles.button.background;
        button.fontSize = options.fontSize || this.defaultStyles.button.fontSize;
        button.cornerRadius = options.cornerRadius !== undefined ? options.cornerRadius : this.defaultStyles.button.cornerRadius;

        // [UI.2.2] Position
        if (options.position) {
            button.left = options.position.x;
            button.top = options.position.y;
        }

        button.horizontalAlignment = options.horizontalAlignment || BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        button.verticalAlignment = options.verticalAlignment || BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;

        // [UI.2.3] Click handler
        if (options.onClick) {
            button.onPointerClickObservable.add(() => {
                options.onClick(button);

                // [EVT.2] Emit button clicked event
                this.events.emit('ui:button:clicked', {
                    name,
                    button
                });
            });
        }

        // [UI.2.4] Hover effects
        button.onPointerEnterObservable.add(() => {
            button.alpha = 0.8;
        });

        button.onPointerOutObservable.add(() => {
            button.alpha = 1.0;
        });

        this.advancedTexture.addControl(button);
        this.elements.set(name, button);

        console.log(`[UI.2] Button created: ${name}`);
        return button;
    }

    // [UI.3] Create panel
    // USER REQUIREMENT: Panels for settings, menus
    createPanel(name, options = {}) {
        // [UI.3.1] Panel container (Rectangle)
        const panel = new BABYLON.GUI.Rectangle(name);
        panel.width = options.width || this.defaultStyles.panel.width;
        panel.height = options.height || this.defaultStyles.panel.height;
        panel.color = options.color || 'white';
        panel.background = options.background || this.defaultStyles.panel.background;
        panel.cornerRadius = options.cornerRadius !== undefined ? options.cornerRadius : this.defaultStyles.panel.cornerRadius;
        panel.thickness = options.thickness !== undefined ? options.thickness : this.defaultStyles.panel.thickness;

        // [UI.3.2] Position
        if (options.position) {
            panel.left = options.position.x;
            panel.top = options.position.y;
        }

        panel.horizontalAlignment = options.horizontalAlignment || BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.verticalAlignment = options.verticalAlignment || BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;

        // [UI.3.3] Initially visible or hidden
        panel.isVisible = options.visible !== undefined ? options.visible : true;

        // [UI.3.4] Stack panel for content
        const stackPanel = new BABYLON.GUI.StackPanel();
        stackPanel.width = '100%';
        stackPanel.height = '100%';
        panel.addControl(stackPanel);

        this.advancedTexture.addControl(panel);
        this.panels.set(name, {
            panel,
            stackPanel,
            content: []
        });

        console.log(`[UI.3] Panel created: ${name}`);

        // [UI.3.5] Return panel API
        return {
            show: () => this.showPanel(name),
            hide: () => this.hidePanel(name),
            toggle: () => this.togglePanel(name),
            addText: (text, options) => this.addPanelText(name, text, options),
            addButton: (buttonName, text, onClick) => this.addPanelButton(name, buttonName, text, onClick),
            addSlider: (sliderName, options) => this.addPanelSlider(name, sliderName, options),
            clear: () => this.clearPanel(name),
            getRawPanel: () => panel,
            getStackPanel: () => stackPanel
        };
    }

    // [UI.3] Show panel
    showPanel(name) {
        const panelData = this.panels.get(name);
        if (panelData) {
            panelData.panel.isVisible = true;

            // [EVT.2] Emit panel opened event
            this.events.emit('ui:panel:opened', { name });

            console.log(`[UI.3] Panel shown: ${name}`);
        }
    }

    // [UI.3] Hide panel
    hidePanel(name) {
        const panelData = this.panels.get(name);
        if (panelData) {
            panelData.panel.isVisible = false;

            // [EVT.2] Emit panel closed event
            this.events.emit('ui:panel:closed', { name });

            console.log(`[UI.3] Panel hidden: ${name}`);
        }
    }

    // [UI.3] Toggle panel
    togglePanel(name) {
        const panelData = this.panels.get(name);
        if (panelData) {
            if (panelData.panel.isVisible) {
                this.hidePanel(name);
            } else {
                this.showPanel(name);
            }
        }
    }

    // [UI.3] Add text to panel
    addPanelText(panelName, text, options = {}) {
        const panelData = this.panels.get(panelName);
        if (!panelData) {
            console.warn(`[UI.3] Panel not found: ${panelName}`);
            return;
        }

        const textBlock = new BABYLON.GUI.TextBlock();
        textBlock.text = text;
        textBlock.color = options.color || 'white';
        textBlock.fontSize = options.fontSize || 14;
        textBlock.height = options.height || '30px';
        textBlock.paddingTop = '5px';
        textBlock.paddingBottom = '5px';

        panelData.stackPanel.addControl(textBlock);
        panelData.content.push(textBlock);

        return textBlock;
    }

    // [UI.3] Add button to panel
    addPanelButton(panelName, buttonName, text, onClick) {
        const panelData = this.panels.get(panelName);
        if (!panelData) {
            console.warn(`[UI.3] Panel not found: ${panelName}`);
            return;
        }

        const button = BABYLON.GUI.Button.CreateSimpleButton(buttonName, text);
        button.width = '90%';
        button.height = '40px';
        button.color = 'white';
        button.background = '#4CAF50';
        button.paddingTop = '5px';
        button.paddingBottom = '5px';

        if (onClick) {
            button.onPointerClickObservable.add(() => onClick(button));
        }

        panelData.stackPanel.addControl(button);
        panelData.content.push(button);

        return button;
    }

    // [UI.3] Add slider to panel
    addPanelSlider(panelName, sliderName, options = {}) {
        const panelData = this.panels.get(panelName);
        if (!panelData) {
            console.warn(`[UI.3] Panel not found: ${panelName}`);
            return;
        }

        // Slider container
        const sliderContainer = new BABYLON.GUI.StackPanel();
        sliderContainer.height = '60px';
        sliderContainer.width = '90%';
        sliderContainer.isVertical = true;

        // Label
        const label = new BABYLON.GUI.TextBlock();
        label.text = options.label || sliderName;
        label.height = '20px';
        label.color = 'white';
        label.fontSize = 12;
        sliderContainer.addControl(label);

        // Slider
        const slider = new BABYLON.GUI.Slider();
        slider.minimum = options.min || 0;
        slider.maximum = options.max || 100;
        slider.value = options.value || 50;
        slider.height = '20px';
        slider.width = '100%';
        slider.color = '#4CAF50';
        slider.background = '#555';

        // Value display
        const valueDisplay = new BABYLON.GUI.TextBlock();
        valueDisplay.text = slider.value.toString();
        valueDisplay.height = '20px';
        valueDisplay.color = '#81C784';
        valueDisplay.fontSize = 12;
        sliderContainer.addControl(valueDisplay);

        slider.onValueChangedObservable.add((value) => {
            valueDisplay.text = value.toFixed(options.decimals || 0);

            if (options.onChange) {
                options.onChange(value);
            }

            // [EVT.2] Emit slider changed event
            this.events.emit('ui:slider:changed', {
                panel: panelName,
                slider: sliderName,
                value
            });
        });

        sliderContainer.addControl(slider);
        panelData.stackPanel.addControl(sliderContainer);
        panelData.content.push(sliderContainer);

        return slider;
    }

    // [UI.3] Clear panel content
    clearPanel(panelName) {
        const panelData = this.panels.get(panelName);
        if (!panelData) {
            console.warn(`[UI.3] Panel not found: ${panelName}`);
            return;
        }

        panelData.content.forEach(control => {
            panelData.stackPanel.removeControl(control);
        });

        panelData.content = [];
        console.log(`[UI.3] Panel cleared: ${panelName}`);
    }

    // [UI.4] Create text label
    createText(name, options = {}) {
        const text = new BABYLON.GUI.TextBlock(name);
        text.text = options.text || '';
        text.color = options.color || this.defaultStyles.text.color;
        text.fontSize = options.fontSize || this.defaultStyles.text.fontSize;

        // Position
        if (options.position) {
            text.left = options.position.x;
            text.top = options.position.y;
        }

        text.horizontalAlignment = options.horizontalAlignment || BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        text.verticalAlignment = options.verticalAlignment || BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;

        this.advancedTexture.addControl(text);
        this.elements.set(name, text);

        console.log(`[UI.4] Text created: ${name}`);
        return text;
    }

    // [UI.5] Create progress bar
    createProgressBar(name, options = {}) {
        // Container
        const container = new BABYLON.GUI.Rectangle(name + '_container');
        container.width = options.width || '300px';
        container.height = options.height || '30px';
        container.color = 'white';
        container.thickness = 2;
        container.background = options.background || '#333';

        if (options.position) {
            container.left = options.position.x;
            container.top = options.position.y;
        }

        container.horizontalAlignment = options.horizontalAlignment || BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        container.verticalAlignment = options.verticalAlignment || BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;

        // Progress fill
        const fill = new BABYLON.GUI.Rectangle(name + '_fill');
        fill.width = 0; // Start at 0%
        fill.height = 1;
        fill.background = options.fillColor || '#4CAF50';
        fill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        container.addControl(fill);

        // Text overlay
        const text = new BABYLON.GUI.TextBlock(name + '_text');
        text.text = '0%';
        text.color = 'white';
        text.fontSize = 14;
        container.addControl(text);

        this.advancedTexture.addControl(container);
        this.elements.set(name, { container, fill, text });

        console.log(`[UI.5] Progress bar created: ${name}`);

        // Return API
        return {
            setValue: (value) => {
                // Value between 0 and 1
                const percent = Math.max(0, Math.min(1, value));
                fill.width = percent;
                text.text = `${Math.round(percent * 100)}%`;
            },
            show: () => { container.isVisible = true; },
            hide: () => { container.isVisible = false; },
            dispose: () => {
                this.advancedTexture.removeControl(container);
                this.elements.delete(name);
            }
        };
    }

    // [UI.6] Add tooltip to mesh
    // USER REQUIREMENT: Show info on hover
    addTooltip(mesh, options = {}) {
        const tooltip = new BABYLON.GUI.Rectangle('tooltip_' + mesh.name);
        tooltip.width = options.width || this.defaultStyles.tooltip.width;
        tooltip.height = options.height || this.defaultStyles.tooltip.height;
        tooltip.color = 'white';
        tooltip.background = options.background || this.defaultStyles.tooltip.background;
        tooltip.cornerRadius = 8;
        tooltip.thickness = 2;
        tooltip.isVisible = false;

        const text = new BABYLON.GUI.TextBlock();
        text.text = options.text || mesh.name;
        text.color = 'white';
        text.fontSize = options.fontSize || this.defaultStyles.tooltip.fontSize;
        tooltip.addControl(text);

        this.advancedTexture.addControl(tooltip);
        this.tooltips.set(mesh, { tooltip, text, offset: options.offset || { x: 0, y: 50 } });

        // Link to mesh (follow 3D position)
        tooltip.linkWithMesh(mesh);
        if (options.offset) {
            tooltip.linkOffsetY = options.offset.y || 50;
            tooltip.linkOffsetX = options.offset.x || 0;
        }

        console.log(`[UI.6] Tooltip added to mesh: ${mesh.name}`);

        return {
            show: () => { tooltip.isVisible = true; },
            hide: () => { tooltip.isVisible = false; },
            setText: (newText) => { text.text = newText; },
            dispose: () => {
                this.advancedTexture.removeControl(tooltip);
                this.tooltips.delete(mesh);
            }
        };
    }

    // [UI.7] Show tooltip for mesh
    showTooltip(mesh) {
        const tooltipData = this.tooltips.get(mesh);
        if (tooltipData) {
            tooltipData.tooltip.isVisible = true;
        }
    }

    // [UI.7] Hide tooltip for mesh
    hideTooltip(mesh) {
        const tooltipData = this.tooltips.get(mesh);
        if (tooltipData) {
            tooltipData.tooltip.isVisible = false;
        }
    }

    // [UI.8] Get element by name
    getElement(name) {
        return this.elements.get(name);
    }

    // [UI.8] Remove element
    removeElement(name) {
        const element = this.elements.get(name);
        if (element) {
            this.advancedTexture.removeControl(element);
            this.elements.delete(name);
            console.log(`[UI.8] Element removed: ${name}`);
        }
    }

    // [PLG.4] Dispose plugin
    dispose() {
        // Dispose all elements
        for (const [name, element] of this.elements.entries()) {
            if (element.dispose) {
                element.dispose();
            }
        }

        // Dispose panels
        for (const [name, panelData] of this.panels.entries()) {
            this.advancedTexture.removeControl(panelData.panel);
        }

        // Dispose tooltips
        for (const [mesh, tooltipData] of this.tooltips.entries()) {
            this.advancedTexture.removeControl(tooltipData.tooltip);
        }

        // Dispose advanced texture
        if (this.advancedTexture) {
            this.advancedTexture.dispose();
        }

        super.dispose();

        console.log('[UI] UIPlugin disposed');
    }
}

// [UI] Export for registration with engine
export default UIPlugin;
