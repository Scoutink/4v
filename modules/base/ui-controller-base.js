/**
 * UIControllerBase - Base class for module UI controllers
 *
 * Provides:
 * - Event delegation system
 * - Template binding
 * - Data attribute handling
 * - Form management
 * - Validation
 * - Error display
 *
 * Controllers handle ALL UI interactions for their modules.
 * No inline event handlers should remain in templates.
 *
 * @example
 * class GroundController extends UIControllerBase {
 *     constructor(module) {
 *         super(module, '#groundControls');
 *     }
 *
 *     getActions() {
 *         return {
 *             'ground:rotate': this.handleRotate.bind(this),
 *             'ground:preset': this.handlePreset.bind(this)
 *         };
 *     }
 *
 *     handleRotate(e, data) {
 *         this.module.setRotation(data.value);
 *     }
 * }
 */

export class UIControllerBase {
    /**
     * Create a UI controller
     * @param {Object} module - The module this controller manages
     * @param {string|HTMLElement} container - Container element or selector
     */
    constructor(module, container = null) {
        if (!module) {
            throw new Error('[UIControllerBase] Module is required');
        }

        this.module = module;
        this._container = null;
        this._attached = false;
        this._actionHandlers = new Map();
        this._formElements = new Map();
        this._validationRules = new Map();

        // Bind container if provided
        if (container) {
            this.setContainer(container);
        }

        console.log(`[UIController] ${module.name} controller created`);
    }

    // ==================== SETUP ====================

    /**
     * Set container element
     * @param {string|HTMLElement} container - Container element or selector
     */
    setContainer(container) {
        if (typeof container === 'string') {
            this._container = document.querySelector(container);
            if (!this._container) {
                throw new Error(`[UIController:${this.module.name}] Container not found: ${container}`);
            }
        } else if (container instanceof HTMLElement) {
            this._container = container;
        } else {
            throw new Error(`[UIController:${this.module.name}] Invalid container`);
        }

        console.log(`[UIController:${this.module.name}] Container set`);
    }

    /**
     * Get container element
     * @returns {HTMLElement|null}
     */
    getContainer() {
        return this._container;
    }

    /**
     * Initialize controller
     * Attach event listeners and setup UI
     * @returns {Promise<void>}
     */
    async init() {
        if (!this._container) {
            console.warn(`[UIController:${this.module.name}] No container, skipping init`);
            return;
        }

        console.log(`[UIController:${this.module.name}] Initializing...`);

        // Register action handlers
        this._registerActions();

        // Attach event listeners
        this.attachEventListeners();

        // Update UI with current state
        await this.updateUI(this.module.getState());

        console.log(`[UIController:${this.module.name}] Initialized`);
    }

    /**
     * Register action handlers (override in subclass)
     * @returns {Object} Map of action names to handler functions
     * @example
     * return {
     *     'module:action': this.handleAction.bind(this),
     *     'module:other': this.handleOther.bind(this)
     * };
     */
    getActions() {
        return {};
    }

    /**
     * Register all action handlers
     * @private
     */
    _registerActions() {
        const actions = this.getActions();

        for (const [action, handler] of Object.entries(actions)) {
            this._actionHandlers.set(action, handler);
        }

        console.log(`[UIController:${this.module.name}] Registered ${this._actionHandlers.size} actions`);
    }

    // ==================== EVENT DELEGATION ====================

    /**
     * Attach event listeners using delegation
     */
    attachEventListeners() {
        if (!this._container) return;
        if (this._attached) {
            console.warn(`[UIController:${this.module.name}] Already attached`);
            return;
        }

        // Delegate click events
        this._container.addEventListener('click', this._handleDelegatedClick.bind(this));

        // Delegate change events (for inputs, selects)
        this._container.addEventListener('change', this._handleDelegatedChange.bind(this));

        // Delegate input events (for sliders, text inputs)
        this._container.addEventListener('input', this._handleDelegatedInput.bind(this));

        this._attached = true;
        console.log(`[UIController:${this.module.name}] Event listeners attached`);
    }

    /**
     * Detach event listeners
     */
    detachEventListeners() {
        if (!this._container || !this._attached) return;

        // Remove listeners
        this._container.removeEventListener('click', this._handleDelegatedClick.bind(this));
        this._container.removeEventListener('change', this._handleDelegatedChange.bind(this));
        this._container.removeEventListener('input', this._handleDelegatedInput.bind(this));

        this._attached = false;
        console.log(`[UIController:${this.module.name}] Event listeners detached`);
    }

    /**
     * Handle delegated click event
     * @private
     * @param {Event} e - Click event
     */
    _handleDelegatedClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        e.preventDefault();
        e.stopPropagation();

        const action = target.dataset.action;
        const data = this._extractDataAttributes(target);

        this._invokeAction(action, e, data, target);
    }

    /**
     * Handle delegated change event
     * @private
     * @param {Event} e - Change event
     */
    _handleDelegatedChange(e) {
        const target = e.target;
        if (!target.dataset.action) return;

        const action = target.dataset.action;
        const data = this._extractDataAttributes(target);
        data.value = target.value;

        this._invokeAction(action, e, data, target);
    }

    /**
     * Handle delegated input event
     * @private
     * @param {Event} e - Input event
     */
    _handleDelegatedInput(e) {
        const target = e.target;
        if (!target.dataset.action) return;

        const action = target.dataset.action;
        const data = this._extractDataAttributes(target);
        data.value = target.value;

        this._invokeAction(action, e, data, target);
    }

    /**
     * Extract data attributes from element
     * @private
     * @param {HTMLElement} element - Element
     * @returns {Object} Data attributes as object
     */
    _extractDataAttributes(element) {
        const data = {};

        for (const [key, value] of Object.entries(element.dataset)) {
            if (key === 'action') continue; // Skip action itself

            // Try to parse as JSON
            try {
                data[key] = JSON.parse(value);
            } catch {
                data[key] = value;
            }
        }

        return data;
    }

    /**
     * Invoke action handler
     * @private
     * @param {string} action - Action name
     * @param {Event} event - Original event
     * @param {Object} data - Extracted data
     * @param {HTMLElement} target - Target element
     */
    _invokeAction(action, event, data, target) {
        // [PRODUCTION PATTERN] Try domain controller first
        if (this._actionHandlers.has(action)) {
            try {
                const handler = this._actionHandlers.get(action);
                handler(event, data, target);
                return; // Success, done
            } catch (error) {
                console.error(`[UIController:${this.module.name}] Error in action ${action}:`, error);
                this.showError(`Action failed: ${error.message}`);
                return;
            }
        }

        // [PRODUCTION PATTERN] Delegate to global ActionDispatcher as fallback
        if (window.__actionDispatcher) {
            try {
                window.__actionDispatcher.dispatch(action, data.value || null, target, event);
                // NOTE: ActionDispatcher logs its own success/warning messages
            } catch (error) {
                console.error(`[UIController:${this.module.name}] ActionDispatcher failed for ${action}:`, error);
            }
        } else {
            console.warn(`[UIController:${this.module.name}] No handler for action: ${action} (and no ActionDispatcher)`);
        }
    }

    // ==================== UI UPDATE ====================

    /**
     * Update UI with current state (override in subclass)
     * @param {Object} state - Module state
     * @returns {Promise<void>}
     */
    async updateUI(state) {
        // Override in subclass to update UI elements
        // Example:
        // this.updateElement('#groundWidth', state.width);
        // this.updateElement('#groundHeight', state.height);
    }

    /**
     * Update single element value
     * @param {string} selector - Element selector
     * @param {*} value - New value
     */
    updateElement(selector, value) {
        if (!this._container) return;

        const element = this._container.querySelector(selector);
        if (!element) return;

        if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
            element.value = value;
        } else {
            element.textContent = value;
        }
    }

    /**
     * Update multiple elements
     * @param {Object} updates - Map of selector → value
     */
    updateElements(updates) {
        for (const [selector, value] of Object.entries(updates)) {
            this.updateElement(selector, value);
        }
    }

    /**
     * Toggle element visibility
     * @param {string} selector - Element selector
     * @param {boolean} visible - Show or hide
     */
    toggleElement(selector, visible) {
        if (!this._container) return;

        const element = this._container.querySelector(selector);
        if (!element) return;

        element.style.display = visible ? '' : 'none';
    }

    /**
     * Enable/disable element
     * @param {string} selector - Element selector
     * @param {boolean} enabled - Enable or disable
     */
    setElementEnabled(selector, enabled) {
        if (!this._container) return;

        const element = this._container.querySelector(selector);
        if (!element) return;

        element.disabled = !enabled;
    }

    /**
     * Add CSS class to element
     * @param {string} selector - Element selector
     * @param {string} className - Class name
     */
    addClass(selector, className) {
        if (!this._container) return;

        const element = this._container.querySelector(selector);
        if (!element) return;

        element.classList.add(className);
    }

    /**
     * Remove CSS class from element
     * @param {string} selector - Element selector
     * @param {string} className - Class name
     */
    removeClass(selector, className) {
        if (!this._container) return;

        const element = this._container.querySelector(selector);
        if (!element) return;

        element.classList.remove(className);
    }

    // ==================== VALIDATION ====================

    /**
     * Add validation rule
     * @param {string} selector - Input selector
     * @param {Function} validator - Validation function (returns true if valid)
     * @param {string} errorMessage - Error message
     */
    addValidation(selector, validator, errorMessage) {
        this._validationRules.set(selector, { validator, errorMessage });
    }

    /**
     * Validate input
     * @param {string} selector - Input selector
     * @returns {boolean} True if valid
     */
    validateInput(selector) {
        if (!this._validationRules.has(selector)) return true;

        const element = this._container?.querySelector(selector);
        if (!element) return true;

        const rule = this._validationRules.get(selector);
        const isValid = rule.validator(element.value);

        if (!isValid) {
            this.showError(rule.errorMessage);
        }

        return isValid;
    }

    /**
     * Validate all inputs
     * @returns {boolean} True if all valid
     */
    validateAll() {
        let allValid = true;

        for (const selector of this._validationRules.keys()) {
            if (!this.validateInput(selector)) {
                allValid = false;
            }
        }

        return allValid;
    }

    // ==================== NOTIFICATIONS ====================

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        console.error(`[UIController:${this.module.name}] ${message}`);

        // Emit error event
        this.module.emit('ui:error', { message });

        // TODO: Show error in UI (toast, dialog, etc.)
        // For now, just console.error
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        console.log(`[UIController:${this.module.name}] ${message}`);

        // Emit success event
        this.module.emit('ui:success', { message });

        // TODO: Show success in UI (toast, etc.)
    }

    /**
     * Show warning message
     * @param {string} message - Warning message
     */
    showWarning(message) {
        console.warn(`[UIController:${this.module.name}] ${message}`);

        // Emit warning event
        this.module.emit('ui:warning', { message });

        // TODO: Show warning in UI
    }

    // ==================== FORM HELPERS ====================

    /**
     * Get form data as object
     * @param {string} formSelector - Form selector
     * @returns {Object} Form data
     */
    getFormData(formSelector) {
        if (!this._container) return {};

        const form = this._container.querySelector(formSelector);
        if (!form) return {};

        const data = {};
        const formData = new FormData(form);

        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }

        return data;
    }

    /**
     * Set form data
     * @param {string} formSelector - Form selector
     * @param {Object} data - Data to set
     */
    setFormData(formSelector, data) {
        if (!this._container) return;

        const form = this._container.querySelector(formSelector);
        if (!form) return;

        for (const [key, value] of Object.entries(data)) {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                input.value = value;
            }
        }
    }

    /**
     * Reset form
     * @param {string} formSelector - Form selector
     */
    resetForm(formSelector) {
        if (!this._container) return;

        const form = this._container.querySelector(formSelector);
        if (form) {
            form.reset();
        }
    }

    // ==================== CLEANUP ====================

    /**
     * Dispose controller
     */
    dispose() {
        console.log(`[UIController:${this.module.name}] Disposing...`);

        // Detach listeners
        this.detachEventListeners();

        // Clear maps
        this._actionHandlers.clear();
        this._formElements.clear();
        this._validationRules.clear();

        // Clear references
        this._container = null;

        console.log(`[UIController:${this.module.name}] Disposed`);
    }
}

export default UIControllerBase;
