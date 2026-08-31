"use strict";

/**
 * Enhanced Lifecycle Manager v1.0
 * Manages comprehensive cleanup of all resources
 * Prevents memory leaks and ensures clean shutdown
 */
class LifecycleManager {
    constructor() {
        this.timers = new Map();
        this.intervals = new Map();
        this.listeners = new Map();
        this.resources = new Map();
    }

    /**
     * Register a setTimeout
     */
    setTimeout(name, fn, delay) {
        this.clearTimeout(name);
        const id = setTimeout(fn, delay);
        this.timers.set(name, id);
        return id;
    }

    /**
     * Register a setInterval
     */
    setInterval(name, fn, delay) {
        this.clearInterval(name);
        const id = setInterval(fn, delay);
        this.intervals.set(name, id);
        return id;
    }

    /**
     * Clear a specific timeout
     */
    clearTimeout(name) {
        const id = this.timers.get(name);
        if (id) {
            clearTimeout(id);
            this.timers.delete(name);
            return true;
        }
        return false;
    }

    /**
     * Clear a specific interval
     */
    clearInterval(name) {
        const id = this.intervals.get(name);
        if (id) {
            clearInterval(id);
            this.intervals.delete(name);
            return true;
        }
        return false;
    }

    /**
     * Register an event listener
     */
    on(target, event, handler, name) {
        if (!target || typeof target.on !== 'function') return false;
        
        const key = name || `${event}_${Math.random()}`;
        target.on(event, handler);
        
        const listeners = this.listeners.get(target) || {};
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push({ handler, key });
        this.listeners.set(target, listeners);
        
        return true;
    }

    /**
     * Remove a specific listener
     */
    removeListener(target, event, handler) {
        if (!target || typeof target.removeListener !== 'function') return false;
        
        target.removeListener(event, handler);
        
        const listeners = this.listeners.get(target);
        if (!listeners || !listeners[event]) return false;
        
        listeners[event] = listeners[event].filter(l => l.handler !== handler);
        return true;
    }

    /**
     * Remove all listeners from a target
     */
    removeAllListeners(target, event) {
        if (!target || typeof target.removeAllListeners !== 'function') return false;
        
        if (event) {
            target.removeAllListeners(event);
        } else {
            target.removeAllListeners();
        }
        
        if (this.listeners.has(target)) {
            if (event) {
                delete this.listeners.get(target)[event];
            } else {
                this.listeners.delete(target);
            }
        }
        
        return true;
    }

    /**
     * Register a resource for cleanup
     */
    addResource(name, resource, cleanupFn) {
        this.resources.set(name, { resource, cleanupFn });
        return true;
    }

    /**
     * Remove a resource
     */
    removeResource(name) {
        const item = this.resources.get(name);
        if (!item) return false;
        
        try {
            if (item.cleanupFn && typeof item.cleanupFn === 'function') {
                item.cleanupFn(item.resource);
            }
        } catch (e) {
            // Ignore errors during cleanup
        }
        
        this.resources.delete(name);
        return true;
    }

    /**
     * Get all registered timers
     */
    getTimers() {
        return Array.from(this.timers.keys());
    }

    /**
     * Get all registered intervals
     */
    getIntervals() {
        return Array.from(this.intervals.keys());
    }

    /**
     * Clear all timers and intervals
     */
    clearAllTimers() {
        for (const [name, id] of this.timers.entries()) {
            clearTimeout(id);
        }
        this.timers.clear();
        
        for (const [name, id] of this.intervals.entries()) {
            clearInterval(id);
        }
        this.intervals.clear();
    }

    /**
     * Remove all listeners
     */
    clearAllListeners() {
        for (const [target, events] of this.listeners.entries()) {
            try {
                target.removeAllListeners();
            } catch (e) {
                // Ignore errors
            }
        }
        this.listeners.clear();
    }

    /**
     * Cleanup all resources
     */
    cleanup() {
        // Clear timers
        this.clearAllTimers();
        
        // Clear listeners
        this.clearAllListeners();
        
        // Cleanup resources
        for (const [name, item] of this.resources.entries()) {
            try {
                if (item.cleanupFn && typeof item.cleanupFn === 'function') {
                    item.cleanupFn(item.resource);
                }
            } catch (e) {
                // Ignore errors during cleanup
            }
        }
        this.resources.clear();
    }

    /**
     * Get lifecycle stats
     */
    getStats() {
        return {
            timers: this.timers.size,
            intervals: this.intervals.size,
            listeners: this.listeners.size,
            resources: this.resources.size,
            timerNames: Array.from(this.timers.keys()),
            intervalNames: Array.from(this.intervals.keys())
        };
    }
}

module.exports = { LifecycleManager };
