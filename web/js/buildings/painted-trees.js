// Moved: the painted trees now live in ./trees.js (the one tree module; api.js already imports it).
// Kept as a re-export so older labs and scripts that import this path still work.
export { createTrees, createTreeBuilders, TREE_RAMPS } from './trees.js';
