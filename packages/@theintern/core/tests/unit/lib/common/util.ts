import * as util from 'src/lib/common/util';

registerSuite('lib/common/util', {
  parseUrl() {
    const url = util.parseUrl(
      'http://www.foo.com:80/some/local/document.md?foo=bar&location=my%20house#kitchen'
    );
    assert.propertyVal(url, 'protocol', 'http');
    assert.propertyVal(url, 'hostname', 'www.foo.com');
    assert.propertyVal(url, 'port', '80');
    assert.propertyVal(url, 'path', '/some/local/document.md');
    assert.propertyVal(url, 'query', 'foo=bar&location=my%20house');
    assert.propertyVal(url, 'hash', 'kitchen');
  },

  prefix() {
    assert.equal(
      util.prefix('This is a test of things.', '...'),
      '...This is a test of things.'
    );
    assert.equal(
      util.prefix('This is\na test\nof things.', '...'),
      '...This is\n...a test\n...of things.'
    );
  },

  pullFromArray() {
    const arrayTest = (
      array: any[],
      value: any,
      expectedArray: any[],
      expectedReturn: any
    ) => {
      const returned = util.pullFromArray(array, value);
      assert.deepEqual(array, expectedArray);
      assert.deepEqual(returned, expectedReturn);
    };
    arrayTest([1, 2, 3], 2, [1, 3], [2]);
    arrayTest([1, 2, 2, 3], 2, [1, 3], [2, 2]);
    arrayTest([1, 2, 3], 4, [1, 2, 3], []);
    arrayTest([1, 2, 3], <any>'a', [1, 2, 3], []);
  },

  stringify() {
    assert.equal(util.stringify('foo'), '"foo"');
    assert.equal(util.stringify(5), '5');
    assert.equal(util.stringify(/(.*)/), '"(.*)"');

    // Older versions of Firefox may inject "use strict"; into fuction
    // values
    assert.match(
      // prettier-ignore
      util.stringify(function() { return 'foo'; }),
      /"function \(\) {(?:\\n\\"use strict\\";\\n)? return 'foo'; }"/
    );

    assert.equal(util.stringify({}), '{}');
    assert.equal(util.stringify(<any>null), 'null');
    assert.equal(util.stringify(''), '""');
    assert.equal(
      util.stringify({ foo: 'bar', baz: 10 }),
      '{"foo":"bar","baz":10}'
    );
  },
});
