import * as util from '../../../src/lib/util';

const { registerSuite } = intern.getPlugin("interface.object");
const { assert } = intern.getPlugin("chai");

registerSuite('common/lib/util', {
  createHandle() {
    let count = 0;
    const handle = util.createHandle(() => {
      ++count;
    });

    handle.destroy();
    assert.strictEqual(count, 1);

    handle.destroy();
    assert.strictEqual(
      count,
      1,
      'destroy should be a no-op on subsequent calls'
    );
  },

  createCompositeHandle() {
    let count = 0;
    function destructor() {
      ++count;
    }
    const handle = util.createCompositeHandle(
      util.createHandle(destructor),
      util.createHandle(destructor)
    );

    handle.destroy();
    assert.strictEqual(
      count,
      2,
      'both destructors in the composite handle should have been called'
    );
    handle.destroy();
    assert.strictEqual(
      count,
      2,
      'destructors are not called after handle destruction'
    );
  },

  deepMixin: {
    'basic usage'() {
      const source: {
        nested: {
          a: number;
          b: any[];
        };
        a: number;
        b: number;
        c: number;
        d: Date;
        e: RegExp;
        hidden: number;
      } = Object.create({
        nested: {
          a: 1,
          b: [2, [3], { f: 4 }]
        }
      });
      source.a = 1;
      source.c = 3;
      source.d = new Date();
      source.e = /abc/;
      Object.defineProperty(source, 'b', {
        enumerable: true,
        get: function() {
          return 2;
        }
      });
      Object.defineProperty(source, 'hidden', {
        enumerable: false,
        value: 4
      });

      const object: {} = Object.create(null);
      const mixedObject: {} & typeof source = util.deepMixin(object, source);

      assert.strictEqual(
        object,
        mixedObject,
        'deepMixin should return the modified target object'
      );
      assert.strictEqual(mixedObject.a, 1);
      assert.strictEqual(mixedObject.b, 2);
      assert.strictEqual(mixedObject.c, 3);
      assert.strictEqual(
        mixedObject.d,
        source.d,
        'deepMixin should not deep copy Date object'
      );
      assert.strictEqual(
        mixedObject.e,
        source.e,
        'deepMixin should not deep copy RegExp object'
      );
      assert.isUndefined(
        mixedObject.hidden,
        'deepMixin should not copy non-enumerable properties'
      );
      assert.strictEqual(
        mixedObject.nested.a,
        1,
        'deepMixin should copy inherited properties'
      );
      assert.notStrictEqual(
        mixedObject.nested,
        source.nested,
        'deepMixin should perform a deep copy'
      );
      assert.notStrictEqual(
        mixedObject.nested.b,
        source.nested.b,
        'deepMixin should perform a deep copy'
      );
      assert.notStrictEqual(
        mixedObject.nested.b[1],
        source.nested.b[1],
        'deepMixin should perform a deep copy'
      );
      assert.notStrictEqual(
        mixedObject.nested.b[2],
        source.nested.b[2],
        'deepMixin should perform a deep copy'
      );
    },

    'merges nested object on to the target'() {
      const target = Object.create({
        apple: 0,
        banana: {
          weight: 52,
          price: 100,
          details: {
            colour: 'brown',
            texture: 'soft'
          }
        },
        cherry: 97
      });

      const source = Object.create({
        banana: { price: 200, details: { colour: 'yellow' } },
        durian: 100
      });

      const assignedObject = util.deepMixin(target, source);
      assert.deepEqual(assignedObject, {
        apple: 0,
        banana: {
          weight: 52,
          price: 200,
          details: { colour: 'yellow', texture: 'soft' }
        },
        cherry: 97,
        durian: 100
      });
    },

    'objects with circular references'() {
      let target: any = {
        nested: {
          baz: 'foo',
          qux: 'baz'
        }
      };

      target.cyclical = target;

      target = Object.create(target);

      let source: any = {
        nested: {
          foo: 'bar',
          bar: 'baz',
          baz: 'qux'
        }
      };
      source.cyclical = source;
      source = Object.create(source);

      const assignedObject = util.deepMixin(target, source);
      assert.deepEqual(assignedObject.nested, {
        foo: 'bar',
        bar: 'baz',
        baz: 'qux',
        qux: 'baz'
      });
    }
  },

  duplicate() {
    const prototype = { a: 1 };
    const source = Object.create(prototype, { b: { value: 2 } });
    source.c = { d: 4 };

    const copyOfObject: typeof source = util.duplicate(source);

    assert.strictEqual(Object.getPrototypeOf(copyOfObject), prototype);
    assert.strictEqual(copyOfObject.a, 1);
    assert.isUndefined(copyOfObject.b);
    assert.strictEqual(copyOfObject.c.d, 4);
    assert.notStrictEqual(copyOfObject.c, source.c);
  },

  partial() {
    const ending = 'jumps over the lazy dog';
    const finish = util.partial(
      function(this: any, ...args: unknown[]) {
        const start = this && this.start ? [this.start] : [];
        return start.concat(args).join(' ');
      },
      'jumps',
      'over'
    );

    function Sentence(this: any, start = '') {
      this.start = start;
    }
    Sentence.prototype.finish = finish;

    assert.strictEqual(
      finish('the lazy dog'),
      ending,
      'The arguments supplied to `lang.partial` should be prepended to the arguments list of the ' +
        'original function.'
    );
    assert.strictEqual(
      finish(),
      'jumps over',
      'The arguments supplied to `lang.partial` should still be used even if no arguments are passed to the ' +
        'wrapped function.'
    );
    assert.strictEqual(
      new (<any>Sentence)('The quick brown fox').finish('the lazy dog'),
      'The quick brown fox ' + ending,
      'A function passed to `lang.partial` should inherit its context.'
    );
  }
});
