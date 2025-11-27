/**
 * DependencyResolver
 * Resolves module dependencies and determines load order
 *
 * Features:
 * - Topological sorting (DAG traversal)
 * - Circular dependency detection
 * - Missing dependency detection
 * - Optimal load order calculation
 *
 * @example
 * const resolver = new DependencyResolver();
 * const modules = [groundModule, lightingModule, cameraModule];
 * const ordered = resolver.resolve(modules);
 * // Returns modules in dependency order
 */

export class DependencyResolver {
    constructor() {
        this.graph = new Map(); // Module name → dependencies
        this.inDegree = new Map(); // Module name → number of dependencies
    }

    /**
     * Resolve module dependencies and return load order
     * @param {Array<Object>} modules - Array of module instances
     * @returns {Array<Object>} Modules in dependency order
     * @throws {Error} If circular dependency or missing dependency detected
     */
    resolve(modules) {
        console.log('[DependencyResolver] Resolving dependencies...');

        // Build dependency graph
        this._buildGraph(modules);

        // Check for missing dependencies
        this._checkMissingDependencies(modules);

        // Detect circular dependencies
        this._detectCycles();

        // Topological sort
        const sorted = this._topologicalSort(modules);

        console.log('[DependencyResolver] Resolved order:', sorted.map(m => m.name).join(' → '));

        return sorted;
    }

    /**
     * Build dependency graph
     * @private
     * @param {Array<Object>} modules - Modules to analyze
     */
    _buildGraph(modules) {
        this.graph.clear();
        this.inDegree.clear();

        // Initialize graph
        for (const module of modules) {
            const deps = module.dependencies || [];
            this.graph.set(module.name, deps);
            this.inDegree.set(module.name, 0);
        }

        // Calculate in-degrees (number of modules depending on this one)
        for (const module of modules) {
            const deps = module.dependencies || [];
            for (const dep of deps) {
                if (this.inDegree.has(dep)) {
                    this.inDegree.set(dep, this.inDegree.get(dep) + 1);
                }
            }
        }
    }

    /**
     * Check for missing dependencies
     * @private
     * @param {Array<Object>} modules - Modules to check
     * @throws {Error} If dependencies are missing
     */
    _checkMissingDependencies(modules) {
        const moduleNames = new Set(modules.map(m => m.name));
        const missing = [];

        for (const module of modules) {
            const deps = module.dependencies || [];
            for (const dep of deps) {
                if (!moduleNames.has(dep)) {
                    missing.push({ module: module.name, dependency: dep });
                }
            }
        }

        if (missing.length > 0) {
            const errors = missing.map(m => `${m.module} → ${m.dependency}`).join(', ');
            throw new Error(`[DependencyResolver] Missing dependencies: ${errors}`);
        }
    }

    /**
     * Detect circular dependencies using DFS
     * @private
     * @throws {Error} If circular dependency detected
     */
    _detectCycles() {
        const visited = new Set();
        const recursionStack = new Set();

        const dfs = (node, path = []) => {
            if (recursionStack.has(node)) {
                // Circular dependency found
                const cycle = [...path, node];
                const cycleStr = cycle.join(' → ');
                throw new Error(`[DependencyResolver] Circular dependency: ${cycleStr}`);
            }

            if (visited.has(node)) {
                return; // Already processed
            }

            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            const deps = this.graph.get(node) || [];
            for (const dep of deps) {
                if (this.graph.has(dep)) {
                    dfs(dep, [...path]);
                }
            }

            recursionStack.delete(node);
        };

        // Check all nodes
        for (const node of this.graph.keys()) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }

        console.log('[DependencyResolver] No circular dependencies detected');
    }

    /**
     * Topological sort using Kahn's algorithm
     * @private
     * @param {Array<Object>} modules - Modules to sort
     * @returns {Array<Object>} Sorted modules
     */
    _topologicalSort(modules) {
        const sorted = [];
        const queue = [];

        // Create module map for quick lookup
        const moduleMap = new Map(modules.map(m => [m.name, m]));

        // Create dependency count map
        const depCount = new Map();
        for (const module of modules) {
            const deps = module.dependencies || [];
            depCount.set(module.name, deps.length);
        }

        // Find modules with no dependencies (start nodes)
        for (const module of modules) {
            if (depCount.get(module.name) === 0) {
                queue.push(module);
            }
        }

        // Process queue
        while (queue.length > 0) {
            const module = queue.shift();
            sorted.push(module);

            // Find modules that depend on this one
            for (const otherModule of modules) {
                const deps = otherModule.dependencies || [];
                if (deps.includes(module.name)) {
                    // Decrease dependency count
                    const count = depCount.get(otherModule.name) - 1;
                    depCount.set(otherModule.name, count);

                    // If all dependencies satisfied, add to queue
                    if (count === 0) {
                        queue.push(otherModule);
                    }
                }
            }
        }

        // Verify all modules processed
        if (sorted.length !== modules.length) {
            throw new Error('[DependencyResolver] Failed to resolve all modules (possible cycle)');
        }

        return sorted;
    }

    /**
     * Get dependency tree for a module
     * @param {Object} module - Module instance
     * @param {Array<Object>} allModules - All available modules
     * @returns {Array<string>} Dependency tree (breadth-first)
     */
    getDependencyTree(module, allModules) {
        const tree = [];
        const visited = new Set();
        const queue = [module.name];

        const moduleMap = new Map(allModules.map(m => [m.name, m]));

        while (queue.length > 0) {
            const name = queue.shift();
            if (visited.has(name)) continue;

            visited.add(name);
            tree.push(name);

            const mod = moduleMap.get(name);
            if (mod) {
                const deps = mod.dependencies || [];
                queue.push(...deps);
            }
        }

        return tree;
    }

    /**
     * Check if module A depends on module B (direct or transitive)
     * @param {string} moduleA - Module A name
     * @param {string} moduleB - Module B name
     * @returns {boolean} True if A depends on B
     */
    dependsOn(moduleA, moduleB) {
        const visited = new Set();
        const queue = [moduleA];

        while (queue.length > 0) {
            const name = queue.shift();
            if (visited.has(name)) continue;
            if (name === moduleB) return true;

            visited.add(name);

            const deps = this.graph.get(name) || [];
            queue.push(...deps);
        }

        return false;
    }

    /**
     * Get all modules that depend on a given module
     * @param {string} moduleName - Module name
     * @param {Array<Object>} allModules - All modules
     * @returns {Array<string>} Module names that depend on this module
     */
    getDependents(moduleName, allModules) {
        const dependents = [];

        for (const module of allModules) {
            const deps = module.dependencies || [];
            if (deps.includes(moduleName)) {
                dependents.push(module.name);
            }
        }

        return dependents;
    }

    /**
     * Visualize dependency graph (ASCII art)
     * @param {Array<Object>} modules - Modules to visualize
     * @returns {string} ASCII representation
     */
    visualize(modules) {
        let output = '\n=== Dependency Graph ===\n\n';

        for (const module of modules) {
            const deps = module.dependencies || [];
            output += `${module.name}\n`;

            if (deps.length === 0) {
                output += '  └─ (no dependencies)\n';
            } else {
                deps.forEach((dep, i) => {
                    const isLast = i === deps.length - 1;
                    const prefix = isLast ? '  └─' : '  ├─';
                    output += `${prefix} ${dep}\n`;
                });
            }

            output += '\n';
        }

        return output;
    }

    /**
     * Clear resolver state
     */
    clear() {
        this.graph.clear();
        this.inDegree.clear();
    }
}

export default DependencyResolver;
