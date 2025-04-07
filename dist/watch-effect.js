// tracks the currently executing effect to establish dependencies
export let activeEffect = null;
// allows setting the active effect, used internally by the effect runner
export function setActiveEffect(effect) {
    activeEffect = effect;
}
// storage for dependencies: target object -> property key -> set of effects that depend on this key
const targetMap = new WeakMap();
/**
 * removes an effect from all dependency sets it belongs to.
 * this is crucial to prevent memory leaks and unnecessary updates when an effect is stopped or re-run.
 */
export function cleanupEffect(effect) {
    if (effect.dependencies) {
        effect.dependencies.forEach(dep => {
            // remove this effect from the dependency set associated with a specific target/key
            dep.delete(effect);
        });
        // clear the effect's own list of dependencies for the next run
        effect.dependencies.clear();
    }
}
/**
 * establishes a dependency between the currently active effect and a specific object property.
 * called by proxy getters or ref getters.
 */
export function track(target, key) {
    // do nothing if there is no active effect or if the effect is stopped
    if (!activeEffect || !activeEffect.active)
        return;
    // get or create the dependency map for the target object
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }
    // get or create the set of effects for the specific property key
    let dep = depsMap.get(key);
    if (!dep) {
        dep = new Set();
        depsMap.set(key, dep);
    }
    // add the current effect to the dependency set if it's not already there
    const effectToAdd = activeEffect;
    if (!dep.has(effectToAdd)) {
        dep.add(effectToAdd);
        // also add this dependency set to the effect's own tracking list for cleanup purposes
        if (!effectToAdd.dependencies) {
            effectToAdd.dependencies = new Set();
        }
        effectToAdd.dependencies.add(dep);
        // trigger the onTrack debug hook if provided
        if (effectToAdd.options?.onTrack) {
            // pass the original user callback to the hook, not the internal wrapper
            effectToAdd.options.onTrack({ effect: effectToAdd._rawCallback, target, key, type: 'track' });
        }
    }
}
/**
 * triggers all active effects associated with a specific object property.
 * called by proxy setters/deleters or ref setters.
 * currently runs effects synchronously.
 */
export function trigger(target, key) {
    const depsMap = targetMap.get(target);
    if (!depsMap)
        return; // no effects tracked for this target
    // use a set to collect effects to run, avoiding duplicate executions within the same trigger cycle
    const effectsToRun = new Set();
    // helper to add effects from a specific dependency set to the run queue
    const addEffects = (depKey) => {
        const dep = depsMap.get(depKey);
        if (dep) {
            dep.forEach(effect => {
                // avoid triggering the effect if it's the one currently running (prevents infinite loops)
                // also ensure the effect hasn't been stopped
                if (effect !== activeEffect && effect.active) {
                    effectsToRun.add(effect);
                }
            });
        }
    };
    // add effects associated with the specific key that changed
    addEffects(key);
    // todo: consider adding effects associated with iteration keys (like Symbol.iterator or 'length' for arrays) if applicable
    // schedule or run the collected effects
    effectsToRun.forEach(effect => {
        // trigger the onTrigger debug hook if provided
        if (effect.options?.onTrigger) {
            effect.options.onTrigger({ effect: effect._rawCallback, target, key, type: 'trigger' });
        }
        // use a custom scheduler if provided, otherwise run the effect synchronously
        if (effect.options?.scheduler) {
            effect.options.scheduler(effect.run);
        }
        else {
            effect.run(); // execute the effect's wrapper function (`run`)
        }
    });
}
/**
 * runs a function immediately, tracks its reactive dependencies, and re-runs it
 * synchronously whenever any of those dependencies change.
 * returns a stop handle to manually stop the effect.
 */
export function watchEffect(effectCallback, options = {}) {
    // the wrapper function that manages the effect lifecycle (cleanup, tracking, execution)
    const run = () => {
        if (!effectFn.active) {
            // if stopped, potentially run the callback once without tracking, though behavior might be undefined
            // vue's behavior here might differ, review needed if exact compatibility matters
            try {
                return effectCallback();
            }
            catch (e) {
                console.error("error in stopped watchEffect callback:", e);
                // decide on return value for stopped effects that error
                return undefined; // or rethrow?
            }
        }
        const previousEffect = activeEffect;
        try {
            cleanupEffect(effectFn); // clean up dependencies from the previous run
            setActiveEffect(effectFn); // set this effect as the one currently tracking
            return effectCallback(); // execute the user's function, triggering tracks
        }
        finally {
            setActiveEffect(previousEffect); // restore the previous active effect
        }
    };
    // create the internal effect object
    const effectFn = {
        run: run,
        dependencies: new Set(), // initialize empty dependencies
        options: options,
        active: true, // start as active
        _rawCallback: effectCallback // store the original callback
    };
    // run the effect immediately unless the `lazy` option is true
    if (!options.lazy) {
        effectFn.run();
    }
    // create the function that stops the effect
    const stopHandle = () => {
        if (effectFn.active) {
            cleanupEffect(effectFn); // remove from dependency lists
            effectFn.active = false; // mark as inactive
            // potentially clear other properties like dependencies/options if desired, but keeping them might allow restart? TBD.
        }
    };
    // attach the effect instance to the stop handle for potential advanced usage
    stopHandle.effect = effectFn;
    return stopHandle;
}
