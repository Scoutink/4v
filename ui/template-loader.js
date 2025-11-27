/**
 * Template Loader
 * Dynamically loads HTML templates and injects them into the DOM
 *
 * Usage:
 *   const loader = new TemplateLoader();
 *   await loader.load('loading-screen');
 *   await loader.loadMultiple(['properties-panel', 'control-panel']);
 */

export class TemplateLoader {
    constructor(basePath = './ui/templates/') {
        this.basePath = basePath;
        this.cache = new Map();
    }

    /**
     * Load a single template
     * @param {string} templateName - Name of template file (without .html)
     * @param {string|HTMLElement} target - Target element or selector to inject into
     * @returns {Promise<HTMLElement>} The injected element
     */
    async load(templateName, target = 'body') {
        // Check cache
        if (this.cache.has(templateName)) {
            console.log(`[TemplateLoader] Using cached template: ${templateName}`);
            return this.inject(this.cache.get(templateName), target);
        }

        // Load template
        const path = `${this.basePath}${templateName}.html`;
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            this.cache.set(templateName, html);
            console.log(`[TemplateLoader] Loaded template: ${templateName}`);

            return this.inject(html, target);
        } catch (error) {
            console.error(`[TemplateLoader] Failed to load template: ${templateName}`, error);
            throw error;
        }
    }

    /**
     * Load multiple templates
     * @param {Array<{name: string, target?: string}>} templates - Array of template configs
     * @returns {Promise<HTMLElement[]>} Array of injected elements
     */
    async loadMultiple(templates) {
        const promises = templates.map(config => {
            if (typeof config === 'string') {
                return this.load(config);
            }
            return this.load(config.name, config.target);
        });

        return Promise.all(promises);
    }

    /**
     * Inject HTML into target element
     * @param {string} html - HTML string
     * @param {string|HTMLElement} target - Target element or selector
     * @returns {HTMLElement} The first injected element
     */
    inject(html, target) {
        const targetEl = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        if (!targetEl) {
            throw new Error(`[TemplateLoader] Target element not found: ${target}`);
        }

        // Create temporary container
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Inject all child elements
        const elements = [];
        while (temp.firstChild) {
            const child = temp.firstChild;
            targetEl.appendChild(child);
            if (child.nodeType === 1) { // Element node
                elements.push(child);
            }
        }

        return elements[0];
    }

    /**
     * Preload templates without injecting
     * @param {string[]} templateNames - Array of template names
     * @returns {Promise<void>}
     */
    async preload(templateNames) {
        const promises = templateNames.map(async name => {
            if (!this.cache.has(name)) {
                const path = `${this.basePath}${name}.html`;
                const response = await fetch(path);
                const html = await response.text();
                this.cache.set(name, html);
                console.log(`[TemplateLoader] Preloaded template: ${name}`);
            }
        });

        await Promise.all(promises);
    }

    /**
     * Clear template cache
     */
    clearCache() {
        this.cache.clear();
        console.log('[TemplateLoader] Cache cleared');
    }

    /**
     * Get cached template HTML
     * @param {string} templateName
     * @returns {string|null}
     */
    getCached(templateName) {
        return this.cache.get(templateName) || null;
    }
}

export default TemplateLoader;
