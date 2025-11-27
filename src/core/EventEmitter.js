/**
 * @file EventEmitter.js
 * @description Event emitter for plugin communication (pub/sub pattern)
 *
 * @tags [EVT.*] All event system tags
 * @primary-tags [!EVT.1] Event emitter core (CRITICAL)
 * @critical-tags [!EVT.1.2] Event emission affects all plugins
 *
 * @dependencies None (foundation class)
 *
 * @affects All plugins (all inter-plugin communication)
 *
 * @events
 *   - Used by: ALL plugins for communication
 *   - Pattern: system:action:detail
 *
 * @author Development Team
 * @created 2025-10-31
 */

// [!EVT.1] CRITICAL: Event emitter core
// Used by: ALL plugins (plugin communication backbone)
// Impact: Breaking this breaks ALL plugin communication
// Pattern: Publish/Subscribe (Observer pattern)
class EventEmitter {
    constructor() {
        // [EVT.1] Event listeners storage
        // Format: { 'event:name': [handler1, handler2, ...] }
        this.listeners = {};

        // [EVT.1] One-time listeners storage
        this.onceListeners = {};
    }

    // [EVT.1.1] Register event listener
    // [EVT.2] Event naming: system:action:detail
    // Example: camera:created, collision:enabled, render:frame
    on(event, handler) {
        if (typeof handler !== 'function') {
            throw new Error(`[EVT.1.1] Handler must be a function for event: ${event}`);
        }

        // [EVT.1.1] Initialize array if first listener
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        // [EVT.1.1] Add handler to listeners
        this.listeners[event].push(handler);

        // Return unsubscribe function
        return () => this.off(event, handler);
    }

    // [EVT.1.1] Register one-time event listener
    // [EVT.1.1] Automatically removed after first emission
    once(event, handler) {
        if (typeof handler !== 'function') {
            throw new Error(`[EVT.1.1] Handler must be a function for event: ${event}`);
        }

        // [EVT.1.1] Wrap handler to auto-remove after execution
        const wrappedHandler = (...args) => {
            this.off(event, wrappedHandler);
            handler(...args);
        };

        // [EVT.1.1] Store original handler for removal
        wrappedHandler._originalHandler = handler;

        return this.on(event, wrappedHandler);
    }

    // [EVT.1.3] Unregister event listener
    // [EVT.1.3] Prevents memory leaks when plugins dispose
    off(event, handler) {
        if (!this.listeners[event]) {
            return;
        }

        // [EVT.1.3] Remove specific handler
        if (handler) {
            this.listeners[event] = this.listeners[event].filter(h =>
                h !== handler && h._originalHandler !== handler
            );

            // [EVT.1.3] Clean up empty arrays
            if (this.listeners[event].length === 0) {
                delete this.listeners[event];
            }
        }
        // [EVT.1.3] Remove all handlers for event
        else {
            delete this.listeners[event];
        }
    }

    // [!EVT.1.2] CRITICAL: Event emission
    // Called hundreds of times per second during rendering
    // PERFORMANCE WARNING: Keep this lightweight
    // DO NOT add console.log or heavy operations here
    // [EVT.3] Event payload structure passed to handlers
    emit(event, payload = {}) {
        // [EVT.1.2] Execute all handlers for this event
        const handlers = this.listeners[event];
        if (!handlers || handlers.length === 0) {
            return false; // No listeners
        }

        // [EVT.1.2] Call each handler with payload
        // Using slice to avoid issues if handler modifies array
        handlers.slice().forEach(handler => {
            try {
                handler(payload);
            } catch (error) {
                // [EVT.1.2] Log error but don't break other handlers
                console.error(`[EVT.1.2] Error in handler for event '${event}':`, error);
            }
        });

        return true; // Listeners executed
    }

    // [EVT.1.3] Clear all listeners for an event
    // [EVT.1.3] Useful for cleanup and testing
    clear(event) {
        if (event) {
            delete this.listeners[event];
        } else {
            // [EVT.1.3] Clear all events if no specific event given
            this.listeners = {};
        }
    }

    // [EVT.1] Get listener count for an event
    // [EVT.1] Useful for debugging and testing
    listenerCount(event) {
        return this.listeners[event]?.length || 0;
    }

    // [EVT.1] Get all registered event names
    // [EVT.1] Useful for debugging
    eventNames() {
        return Object.keys(this.listeners);
    }

    // [EVT.1] Check if event has listeners
    hasListeners(event) {
        return this.listenerCount(event) > 0;
    }
}

// [EVT.1] Export for use in engine and plugins
export default EventEmitter;
