/// <reference types="@dojo/loader"/>

class RequireHelpers {
  require: DojoLoader.RootRequire;
  registeredMocks: { id: string; original?: any }[];

  constructor(require: DojoLoader.RootRequire) {
    this.require = require;
    this.registeredMocks = [];
  }

  undefine(mid: string) {
    const require = this.require;
    require.undef(require.toAbsMid(mid));

    // If this plugin is used in a Node environment, it also must handle
    // undefining modules in the node loader since the dojo loader (beta2.1)
    // doesn't currently handle that.
    if (require.nodeRequire) {
      const nrequire = <NodeRequire>require.nodeRequire;
      delete nrequire.cache[nrequire.resolve(mid)];
    }
  }

  redefine(mid: string, mock: any) {
    this.undefine(mid);
    define(this.require.toAbsMid(mid), [], () => mock);
  }

  getOriginal(mid: string) {
    mid = this.require.toAbsMid(mid);
    try {
      return this.require(mid);
    } catch (error) {
      return undefined;
    }
  }

  registerMock(mid: string) {
    console.log('registering a mock for', mid);
    this.registeredMocks.push({ id: mid, original: this.getOriginal(mid) });
  }

  remove() {
    // For now, removing the mocks simply removes the relevant modules from
    // the loader without restoring them.
    while (this.registeredMocks.length > 0) {
      const { id, original } = this.registeredMocks.pop()!;
      if (typeof original !== 'undefined') {
        this.redefine(id, original);
      } else {
        this.undefine(id);
      }
    }
  }
}

intern.registerPlugin('mockRequire', () => {
  function mockRequire(
    require: DojoLoader.RootRequire,
    mid: string,
    mocks: { [key: string]: any }
  ) {
    mid = require.toAbsMid(mid);
    const helper = new RequireHelpers(require);

    helper.registerMock(mid);
    helper.undefine(mid);

    Object.keys(mocks).forEach(id => {
      helper.registerMock(id);
      helper.redefine(id, mocks[id]);
    });

    return new Promise(resolve => {
      require([mid], mod => {
        resolve({
          module: mod,
          remove() {
            helper.remove();
          }
        });
      });
    });
  }

  return <mocking.MockRequire>mockRequire;
});
