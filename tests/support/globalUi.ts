/// <reference path="../globals.d.ts" />

/**
 * Install some commonly used test functionals globally
 */
intern.registerPlugin('globalUI', () => {
  const globalObj = typeof process === 'undefined' ? window : global;
  (globalObj as any).registerSuite = intern.getPlugin(
    'interface.object'
  ).registerSuite;
  (globalObj as any).assert = intern.getPlugin('chai').assert;
});
