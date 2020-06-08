const globalObject: any = (function(): any {
  if (typeof window !== 'undefined') {
    // window is defined in browsers
    return window;
  }
  if (typeof global !== 'undefined') {
    // global spec defines a reference to the global object called 'global'
    // https://github.com/tc39/proposal-global
    // `global` is also defined in NodeJS
    return global;
  }
  if (typeof self !== 'undefined') {
    // self is defined in WebWorkers
    return self;
  }
})();

export default globalObject;
