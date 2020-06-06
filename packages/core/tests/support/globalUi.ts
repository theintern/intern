/**
 * Install some commonly used test functionals globally
 */
intern.registerPlugin('globalUI', () => {
  const globalObj: any = typeof process === 'undefined' ? window : global;
  globalObj.registerSuite = intern.getPlugin('interface.object').registerSuite;
  globalObj.assert = intern.getPlugin('chai').assert;
});
