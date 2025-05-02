/**
 * Special symbols used to mark reactive objects and store metadata.
 */
export const enum ReactiveFlags {
  RAW = '__v_raw', // reference to the original object
  IS_REACTIVE = '__v_isReactive', // flag indicating if an object is reactive  
  SKIP = '__v_skip' // flag indicating an object should never be made reactive
}
