// Track currently running effect
// Note: activeEffect can hold effects with different return types
export let activeEffect = null;
// Setter function for activeEffect
export function setActiveEffect(effect) {
    activeEffect = effect;
}
// Store for tracking dependencies: target -> key -> Set<TrackedEffect>
// The Sets will hold effects of potentially different types
const targetMap = new WeakMap();
/**
 * Clean up dependencies for a specific effect
 */
export function cleanupEffect(effect) {
    if (effect.dependencies) {
        effect.dependencies.forEach(dep => {
            dep.delete(effect);
        });
        effect.dependencies.clear(); // Clear the set for the next run
    }
}
/**
 * Track a property access for the active effect
 */
export function track(target, key) {
    // Only track if there's an active effect that should be running
    if (!activeEffect || !activeEffect.active)
        return;
    // Get the dependency map for this target
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }
    // Get the set of effects for this property
    let dep = depsMap.get(key);
    if (!dep) {
        dep = new Set();
        depsMap.set(key, dep);
    }
    // Add the active effect to the set if not already present
    // Ensure we are adding the correct type to the Set
    const effectToAdd = activeEffect;
    if (!dep.has(effectToAdd)) {
        dep.add(effectToAdd);
        // Add this dep set to the effect's own dependency list for cleanup
        if (!effectToAdd.dependencies) {
            effectToAdd.dependencies = new Set();
        }
        effectToAdd.dependencies.add(dep);
        // Trigger onTrack if available
        if (effectToAdd.options?.onTrack) {
            // Pass the raw user callback, not the internal effect object
            effectToAdd.options.onTrack({ effect: effectToAdd._rawCallback, target, key, type: 'track' });
        }
    }
}
/**
 * Trigger effects associated with a property (Synchronous Only)
 */
export function trigger(target, key) {
    const depsMap = targetMap.get(target);
    if (!depsMap)
        return;
    // Use a Set to avoid duplicate runs within the same trigger
    const effectsToRun = new Set();
    const addEffects = (depKey) => {
        const dep = depsMap.get(depKey);
        if (dep) {
            dep.forEach(effect => {
                // Avoid infinite loops by not scheduling the currently running effect
                // Also check if effect is active
                if (effect !== activeEffect && effect.active) {
                    effectsToRun.add(effect);
                }
            });
        }
    };
    addEffects(key);
    // Schedule or run effects
    effectsToRun.forEach(effect => {
        // Trigger onTrigger if available
        if (effect.options?.onTrigger) {
            effect.options.onTrigger({ effect: effect._rawCallback, target, key, type: 'trigger' });
        }
        // Use scheduler if available, otherwise run directly
        if (effect.options?.scheduler) {
            effect.options.scheduler(effect.run);
        }
        else {
            effect.run(); // Run the effect's wrapper
        }
    });
}
/**
 * Runs a function and re-runs it when its reactive dependencies change.
 * Returns a stop handle that also exposes the effect instance.
 */
export function watchEffect(effectCallback, options = {}) {
    // The core runner function that handles cleanup, activeEffect setting, and execution
    const run = () => {
        if (!effectFn.active)
            return effectCallback(); // If stopped, just return value (though likely undefined)
        const previousEffect = activeEffect;
        try {
            cleanupEffect(effectFn);
            setActiveEffect(effectFn);
            return effectCallback(); // Execute the user's function
        }
        finally {
            setActiveEffect(previousEffect);
        }
    };
    // The effect object itself
    const effectFn = {
        run: run,
        dependencies: new Set(),
        options: options,
        active: true,
        _rawCallback: effectCallback
    };
    // Run effect immediately unless lazy
    if (!options.lazy) {
        effectFn.run();
    }
    // Create the stop handle function
    const stopHandle = () => {
        if (effectFn.active) {
            cleanupEffect(effectFn);
            effectFn.active = false;
            // Clear references
            // effectFn.dependencies = undefined; // Keep dependencies for potential re-activation?
            // effectFn.options = undefined;
        }
    };
    // Attach the effect instance to the stop handle
    stopHandle.effect = effectFn;
    return stopHandle;
}
