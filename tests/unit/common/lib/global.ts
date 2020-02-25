import _global from 'src/common/lib/global';

registerSuite('common/lib/global', {
  'global points to the real global'() {
    const realGlobal = (function(glb) {
      return glb;
    })(new Function('return this;')());
    assert.strictEqual(_global, realGlobal);
  }
});
