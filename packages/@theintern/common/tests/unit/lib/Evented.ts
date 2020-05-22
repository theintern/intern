import sinon from 'sinon';
import Evented, { CustomEventTypes, EventObject } from '../../../src/lib/Evented';

interface FooBarEvents extends CustomEventTypes {
  foo: R;
  bar: R;
}

interface R extends EventObject<string> {
  value: number;
}

const { registerSuite } = intern.getPlugin("interface.object");
const { assert } = intern.getPlugin("chai");

registerSuite('common/lib/Evented', {
  creation() {
    const evented = new Evented();
    assert(evented);
    assert.isFunction(evented.on);
    assert.isFunction(evented.emit);
  },

  on: {
    'on()'() {
      const eventStack: string[] = [];
      const evented = new Evented<FooBarEvents>();
      const handle = evented.on('foo', event => {
        eventStack.push(event.type);
      });

      evented.emit<'foo'>({ type: 'foo', value: 1 });
      evented.emit({ type: 'bar' });

      handle.destroy();

      evented.emit({ type: 'foo' });
      evented.emit({ type: 'bar' });

      assert.deepEqual(eventStack, ['foo']);
    },

    'on() with Symbol type'() {
      if (typeof Symbol === 'undefined') {
        this.skip('Symbol is not available in this environment');
      }

      const foo = Symbol();
      const bar = Symbol();
      const eventStack: symbol[] = [];
      const evented = new Evented<{}, symbol>();
      const handle = evented.on(foo, event => {
        eventStack.push(event.type);
      });

      evented.emit({ type: foo });
      evented.emit({ type: bar });
      evented.emit({ type: <any>'bar' });

      handle.destroy();

      evented.emit({ type: foo });
      evented.emit({ type: <any>'bar' });

      assert.deepEqual(eventStack, [foo]);
    },

    'multiple listeners, same event'() {
      const eventStack: string[] = [];
      const evented = new Evented<FooBarEvents>();

      const handle1 = evented.on('foo', () => {
        eventStack.push('one');
      });
      const handle2 = evented.on('foo', () => {
        eventStack.push('two');
      });

      evented.emit({ type: 'foo' });
      handle1.destroy();
      evented.emit({ type: 'foo' });
      handle2.destroy();
      evented.emit({ type: 'foo' });

      assert.deepEqual(eventStack, ['one', 'two', 'two']);
    },

    'on(type, listener[])'() {
      const eventStack: string[] = [];
      const evented = new Evented<FooBarEvents>();

      const handle = evented.on('foo', [
        () => {
          eventStack.push('foo1');
        },
        () => {
          eventStack.push('foo2');
        }
      ]);

      evented.emit({ type: 'foo' });
      handle.destroy();
      evented.emit({ type: 'foo' });

      assert.deepEqual(eventStack, ['foo1', 'foo2']);
    },

    'listener removes itself'() {
      const eventStack: string[] = [];
      const evented = new Evented<FooBarEvents>();

      evented.on('foo', () => {
        eventStack.push('one');
      });
      const handle = evented.on('foo', () => {
        eventStack.push('two');
        handle.destroy();
      });
      evented.on('foo', () => {
        eventStack.push('three');
      });

      evented.emit({ type: 'foo' });
      evented.emit({ type: 'foo' });

      assert.deepEqual(eventStack, ['one', 'two', 'three', 'one', 'three']);
    }
  },

  'wildcards in event type name': {
    'all event types'() {
      const eventStack: string[] = [];
      const evented = new Evented<{}, string>();
      evented.on('*', event => {
        eventStack.push(event.type);
      });

      evented.emit({ type: 'foo' });
      evented.emit({ type: 'bar' });
      evented.emit({ type: 'foo:bar' });

      assert.deepEqual(eventStack, ['foo', 'bar', 'foo:bar']);
    },
    'event types starting with a pattern'() {
      const eventStack: string[] = [];
      const evented = new Evented<{}, string>();
      evented.on('foo:*', event => {
        eventStack.push(event.type);
      });

      evented.emit({ type: 'foo' });
      evented.emit({ type: 'foo:' });
      evented.emit({ type: 'foo:bar' });

      assert.deepEqual(eventStack, ['foo:', 'foo:bar']);
    },
    'event types ending with a pattern'() {
      const eventStack: string[] = [];
      const evented = new Evented<{}, string>();
      evented.on('*:bar', event => {
        eventStack.push(event.type);
      });

      evented.emit({ type: 'bar' });
      evented.emit({ type: ':bar' });
      evented.emit({ type: 'foo:bar' });

      assert.deepEqual(eventStack, [':bar', 'foo:bar']);
    },
    'event types contains a pattern'() {
      const eventStack: string[] = [];
      const evented = new Evented<{}, string>();
      evented.on('*foo*', event => {
        eventStack.push(event.type);
      });

      evented.emit({ type: 'foo' });
      evented.emit({ type: 'foobar' });
      evented.emit({ type: 'barfoo' });
      evented.emit({ type: 'barfoobiz' });

      assert.deepEqual(eventStack, ['foo', 'foobar', 'barfoo', 'barfoobiz']);
    },
    'multiple matches'() {
      const eventStack: string[] = [];
      const evented = new Evented();
      evented.on('foo', event => {
        eventStack.push(`foo->${event.type.toString()}`);
      });
      evented.on('*foo', event => {
        eventStack.push(`*foo->${event.type.toString()}`);
      });

      evented.emit({ type: 'foo' });
      evented.emit({ type: 'foobar' });
      evented.emit({ type: 'barfoo' });

      assert.deepEqual(eventStack, ['foo->foo', '*foo->foo', '*foo->barfoo']);
    }
  },

  own: {
    'destroy handle': {
      handle() {
        const destroy = sinon.spy();
        const destroyable = new Evented();
        destroyable.own({ destroy });

        assert.strictEqual(
          destroy.callCount,
          0,
          'handle should not be called yet'
        );
        return destroyable.destroy().then(() => {
          assert.strictEqual(
            destroy.callCount,
            1,
            'handle should have been called'
          );
          return destroyable.destroy().then(() => {
            assert.strictEqual(
              destroy.callCount,
              1,
              'handle should not have been called again'
            );
          });
        });
      },

      'array of handles'() {
        const destroy1 = sinon.spy();
        const destroy2 = sinon.spy();

        const destroyable = new Evented();
        destroyable.own([{ destroy: destroy1 }, { destroy: destroy2 }]);

        assert.strictEqual(
          destroy1.callCount,
          0,
          'first handle should not be called yet'
        );
        assert.strictEqual(
          destroy2.callCount,
          0,
          'second handle should not be called yet'
        );
        return destroyable.destroy().then(() => {
          assert.strictEqual(
            destroy1.callCount,
            1,
            'first handle should have been called'
          );
          assert.strictEqual(
            destroy2.callCount,
            1,
            'second handle should have been called'
          );
          return destroyable.destroy().then(() => {
            assert.strictEqual(
              destroy1.callCount,
              1,
              'first handle should not have been called'
            );
            assert.strictEqual(
              destroy2.callCount,
              1,
              'second handle should not have been called'
            );
          });
        });
      }
    },

    'after destruction throws'() {
      const destroyable = new Evented();
      destroyable.own({
        destroy() {}
      });
      return destroyable.destroy().then(() => {
        assert.throws(() => {
          destroyable.own({
            destroy() {}
          });
        }, Error);
      });
    },

    'handle destruction': {
      handle() {
        const destroy = sinon.spy();
        const destroyable = new Evented();
        const handle = destroyable.own({ destroy });
        assert.strictEqual(destroy.callCount, 0, 'destroy not called yet');
        handle.destroy();
        assert.strictEqual(destroy.callCount, 1, 'handle was destroyed');
        destroyable.destroy();
        assert.strictEqual(
          destroy.callCount,
          1,
          'destroy was not called again'
        );
      },
      'array of handles'() {
        const destroy1 = sinon.spy();
        const destroy2 = sinon.spy();
        const destroyable = new Evented();
        const handle = destroyable.own([
          { destroy: destroy1 },
          { destroy: destroy2 }
        ]);
        assert.strictEqual(
          destroy1.callCount,
          0,
          'first destroy not called yet'
        );
        assert.strictEqual(
          destroy2.callCount,
          0,
          'second destroy not called yet'
        );
        handle.destroy();
        assert.strictEqual(destroy1.callCount, 1, 'first handle was destroyed');
        assert.strictEqual(
          destroy2.callCount,
          1,
          'second handle was destroyed'
        );
        destroyable.destroy();
        assert.strictEqual(
          destroy1.callCount,
          1,
          'first destroy was not called again'
        );
        assert.strictEqual(
          destroy2.callCount,
          1,
          'second destroy was not called again'
        );
      }
    }
  }
});
