# API

<!-- vim-markdown-toc GFM -->

* [intern](#intern)
  * [configure](#configure)
  * [getPlugin](#getplugin)
  * [on](#on)
  * [registerPlugin](#registerplugin)
  * [run](#run)
* [Interfaces](#interfaces)
  * [object](#object)
  * [tdd](#tdd)
  * [bdd](#bdd)
  * [benchmark](#benchmark)
* [Assertions](#assertions)
* [Suite](#suite)
  * [error](#error)
  * [id](#id)
  * [name](#name)
  * [remote](#remote)
  * [skip](#skip)
  * [skipped](#skipped)
  * [timeElapsed](#timeelapsed)
* [Test](#test)
  * [async](#async)
  * [error](#error-1)
  * [hasPassed](#haspassed)
  * [id](#id-1)
  * [name](#name-1)
  * [remote](#remote-1)
  * [skip](#skip-1)
  * [skipped](#skipped-1)
  * [timeElapsed](#timeelapsed-1)
  * [timeout](#timeout)

<!-- vim-markdown-toc -->

## intern

The global `intern` object is an instance of
[Executor](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor).
It is automatically created when Intern is imported or loaded via a script tag.
This object is also the default export from the intern package:

```ts
import intern from 'intern';
```

### configure

The
[configure](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/configure)
method is used to configure the executor. It should be passed an object
containing
[configuration properties](http://localhost:6419/docs/configuration.md#properties).

```ts
intern.configure({
  suites: 'build/tests/**/*.js',
  environments: 'chrome'
});
```

`configure` may be called multiple times before testing is started. The final
configuration will be
[resolved](http://localhost:6419/docs/configuration.md#configuration-resolution)
before any plugins or suites are loaded.

### getPlugin

The
[getPlugin](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/getPlugin)
method returns any resources exported by a registered plugin. The main purpose
of this method is to allow resources to be accessed in environments without a
loader. For example, importing an interface with

```ts
import { suite, test } from 'intern/lib/interfaces/tdd';
```

will not work in a browser environment where a module loader is not available,
but `getPlugin` will work in any environment since it doesn't depend on a
loader.

```ts
const { suite, test } = intern.getPlugin('interfaces.tdd');
```

`getPlugin` is a generic function, so custom plugins can be typed:

```ts
import { PluginType } from 'tests/support/myPlugin';
const { foo, bar } = intern.getPlugin<PluginType>('myPlugin');
```

In the above example, the `PluginType` type is imported from a plugin and used
for typing when retrieving plugin resources from Intern.

### on

The
[on](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/on)
method is used to register listeners for Intern events.

```ts
intern.on('testStart', test => {
  console.log(`${test.id} has started`);
});
```

A listener listens for a certain event and is called with a specific payload.
For example, listeners for `testStart` and `testEnd` events will be called with
an instance of Test (or a Test-like object).

Intern provides a number of events that code can listen for:

| Event      | Emitted when...                                                                   | Argument |
| :--------- | :-------------------------------------------------------------------------------- | -------- |
| error      | An error (not a test failure) has occurred while running tests.                   | error    |
| runStart   | Testing begins                                                                    | none     |
| runEnd     | Testing ends                                                                      | none     |
| suiteStart | A suite starts. A suite with no parent indicates the start of a new session.      | suite    |
| suiteEnd   | A suite ends                                                                      | suite    |
| testStart  | A test starts                                                                     | test     |
| testEnd    | A test ends. Check the `error`, `skipped`, and `hasPassed` properties for status. | test     |

> 💡That the payloads passed to event listeners may or may not be actual
> instances of a particular class. For example, the `testEnd` listener may be
> passed a Test-like object rather than an actual instance of
> [Test](https://theintern.io/docs.html#Intern/4/api/lib%2FTest).

Event listeners may be asynchronous.

```ts
intern.on('testStart', test => {
  return new Promise(resolve => {
    const db = openDbConnection();
    // An async method to write to a db
    db.put(test, () => {
      resolve();
    });
  });
});
```

Multiple listeners may register for an event. They will be called sequentially
in the order in which they were registered.

### registerPlugin

[registerPlugin](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/registerplugin),
as it's name suggests, is used to register an extension with Intern. It's
signature is

```ts
registerPlugin(name: string, init: PluginInitializer): void;
```

A
[PluginInitializer](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/plugininitializer)
is just a callback that takes an optional `options` argument and returns any
exported resources, or a Promise that resolves to resources.

```ts
intern.registerPlugin('foo', options => {
  return {
    doSomething() {
      // ...
    },
    doSomethingElse() {
      // ...
    }
  };
});
```

Since an initializer may return a promise, it can also be used to initialize
asynchronous code during Intern's initialization process;

```ts
intern.registerPlugin(
  'myplugin',
  () =>
    new Promise(resolve => {
      asyncFunction.then(resolve);
    })
);
```

### run

The
[run](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/run)
method initiates the testing process. It returns a promise that resolves when
testing is complete. It will reject if there is an error during the testing
process or if any tests fail.

## Interfaces

Interfaces are the primary way that test writers interact with Intern. Intern
provides 4 interfaces: **object**, **bdd**, **tdd**, and **benchmark**.

All interfaces support the same set of lifecycle methods:

- **before** - Run before any tests
- **after** - Run after all tests
- **beforeEach** - Run before each test
- **afterEach** - Run after each test

### object

```ts
const { registerSuite } = intern.getPlugin('interface.object');
```

The
[object](https://theintern.io/docs.html#Intern/4/api/lib%2Finterfaces%2Fobject)
interface allows test suites to be created declaratively using a plain
JavaScript object. Simple suites can just contain an object of test functions:

```ts
registerSuite('Suite name', {
  test1() {
    // do something
  },

  test2() {
    // do something
  }
});
```

Suites may also register lifecycle callbacks (`beforeEach`, `afterEach`, etc.).
When these are used, tests must be contained under a `tests` property.

```ts
registerSuite('Suite name', {
  beforeEach() {
    // test setup
  },

  tests: {
    test1() {
      // do something
    },

    test2() {
      // do something
    }
  }
});
```

Suites may be nested.

```ts
registerSuite('Suite name', {
    test1() {
        // do something
    },

    test2() {
        // do something
    },

    'sub-suite': {
        subTest1() {
            // do something
        }

        subTest2() {
            // do something
        }
    }
});
```

### tdd

```ts
const { suite, test, beforeEach } = intern.getPlugin('interface.tdd');
```

The [tdd](https://theintern.io/docs.html#Intern/4/api/lib%2Finterfaces%2Ftdd)
interface is callback-driven.

```ts
suite('Suite name', () => {
  beforeEach(() => {
    // test setup
  });

  test('test1', () => {
    // do something
  });

  test('test2', () => {
    // do something
  });
});
```

This interface is a bit more flexible than the object interface. For example, it
allows multiple instances of a given lifecycle method to be registered. This can
be useful when setting up shared functionality between suites:

```ts
function initSuite() {
  beforeEach(() => {
    // do common init
  });
}

suite('Suite', () => {
  initSuite();

  beforeEach(() => {
    // suite init
  });

  test('test1', () => {
    // ...
  });
});

suite('Other suite', () => {
  initSuite();

  test('test1', () => {
    // ...
  });
});
```

### bdd

```ts
const { describe, it, beforeEach } = intern.getPlugin('interface.bdd');
```

The [bdd](https://theintern.io/docs.html#Intern/4/api/lib%2Finterfaces%2Fbdd)
interface is identical to the tdd interface, it just renames the `suite` and
`test` methods to `describe` and `it`.

```ts
describe('Thing', () => {
  beforeEach(() => {
    // test setup
  });

  it('should do A', () => {
    // do something
  });

  it('should do b', () => {
    // do something
  });
});
```

### benchmark

```ts
const { registerSuite } = intern.getPlugin('interface.benchmark');
```

The
[benchmark](https://theintern.io/docs.html#Intern/4/api/lib%2Finterfaces%2Fbenchmark/benchmarkinterface)
interface is modified version of the object interface used to run performance
benchmark tests. The two differences from object are:

- Async tests must be wrapped in an `async` function as the standard mechanisms
  for handling async code don't work with benchmark tests. Note that this is
  _not_ the same as the `async` keyword.
- Two additional lifecycle methods are supported: `beforeEachLoop` and
  `afterEachLoop`. A benchmark suite will call each test function many times in
  a row to evaluate average performance. The standard `beforeEach` and
  `afterEach` run before and after a benchmark begins. The `*Loop` variations
  are run before and after each call of the test function.

```ts
registerSuite('Suite name', {
  beforeEach() {
    // test setup
  },

  beforeEachLoop() {
    // test function call setup
  },

  tests: {
    test1() {
      // do something
    },

    test2: async(dfd => {
      // do something
    })
  }
});
```

## Assertions

Intern includes the [chai](http://chaijs.com) assertion library, available to
suites as the 'chai' plugin.

```ts
const { assert } = intern.getPlugin('chai');

registerSuite('Suite name', {
  test1() {
    assert.isNotNull(someValue);
  }
});
```

All three interfaces (assert, expect, and should) are exported by the chai
plugin.

## Suite

The [Suite](https://theintern.io/docs.html#Intern/4/api/lib%2FSuite) class
manages a group of tests. It provides several properties and methods that may be
useful during testing and in reporters.

### error

The [error](https://theintern.io/docs.html#Intern/4/api/lib%2FSuite/error)
property is set when a suite experienced an error. It can be used in reporters
to determine whether a suite has failed.

```ts
intern.on('suiteEnd', suite => {
  if (suite.error) {
    console.log(`${suite.id} failed: ${suite.error}`);
  }
});
```

### id

The [id](https://theintern.io/docs.html#Intern/4/api/lib%2FSuite/id) property is
the complete ID of a suite.

```ts
intern.on('suiteEnd', suite => {
  console.log(`${suite.id} finished`);
});
```

### name

The [name](https://theintern.io/docs.html#Intern/4/api/lib%2FSuite/name)
property is the short name of a suite. This can be useful for reporters that
generate structured reports, where a suite doesn‘t need to be referred to by its
complete ID.

```ts
intern.on('suiteEnd', suite => {
  console.log(`${suite.name} finished`);
});
```

### remote

The [remote](https://theintern.io/docs.html#Intern/4/api/lib%2FSuite/remote)
property is an instance of a Leadfoot
[Command](https://theintern.io/docs.html#Leadfoot/2/api/Command) object that is
used to access a remote browser in functional test suites.

```ts
registerSuite('Suite', {
  before() {
    // Load a page before any tests start
    return this.remote.get('page.html');
  }
});
```

### skip

The [skip](https://theintern.io/docs.html#Intern/4/api/lib%2FSuite/skip) method
is called to skip a suite. Any tests that have not been run will be marked as
skipped.

```ts
registerSuite({
  before() {
    if (condition) {
      this.skip('Skipping because ...');
    }
  }
});
```

### skipped

The [skipped](https://theintern.io/docs.html#Intern/4/api/lib%2FSuite/skipped)
property is set when a suite has been skipped. It can be used in reporters to
determine whether a suite has been skipped.

```ts
intern.on('suiteEnd', suite => {
  if (suite.skipped) {
    console.log(`${suite.id} was skipped: ${suite.skipped}`);
  }
});
```

### timeElapsed

The
[timeElapsed](https://theintern.io/docs.html#Intern/4/api/lib%2FSuite/timeelapsed)
property indicates the time required for the test to run in ms.

```ts
intern.on('suiteEnd', suite => {
  console.log(`${suite.id} ran in ${suite.timeElapsed} ms`);
});
```

## Test

The [Test](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/test) class
represents a single test. It provides several properties and methods that may be
useful during testing and in reporters.

### async

Call the [async](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/async)
method in a test to return a Deferred object that can be used to manage an async
test, and/or to adjust the test timeout.

```ts
test1() {
	// Test will timeout in 500ms
	const dfd = this.async(500);
	someAsyncOperation(error => {
		if (error) {
			dfd.reject(error);
		} else {
			dfd.resolve();
		}
	});
});
```

### error

The [error](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/error)
property is set when a test experienced an error. It can be used in reporters to
determine whether a test has failed.

```ts
intern.on('testEnd', test => {
  if (test.error) {
    console.log(`${test.id} failed: ${test.error}`);
  }
});
```

### hasPassed

The
[hasPassed](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/haspassed)
property is set when a test has passed. It can be used in reporters to determine
whether a test was run successfully.

```ts
intern.on('testEnd', test => {
  if (test.hasPassed) {
    console.log(`${test.id} passed`);
  }
});
```

### id

The [id](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/id) property is
the complete ID of a test.

```ts
intern.on('testEnd', test => {
  console.log(`${test.id} finished`);
});
```

### name

The [name](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/name) property
is the short name of a test. This can be useful for reporters that generate
structured reports, where a test doesn‘t need to be referred to by its complete
ID.

```ts
intern.on('testEnd', test => {
  console.log(`${test.name} finished`);
});
```

### remote

The [remote](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/remote)
property is an instance of a Leadfoot
[Command](https://theintern.io/docs.html#Leadfoot/2/api/Command) object that is
used to access a remote browser in functional tests.

```ts
registertest('test', {
  test1() {
    return this.remote
      .get('page.html')
      .findByCssSelector('.button')
      .click();
  }
});
```

### skip

The [skip](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/skip) method
is called to skip a test.

```ts
registertest({
  test1() {
    if (condition) {
      this.skip('Skipping because ...');
    }
  }
});
```

### skipped

The [skipped](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/skipped)
property is set when a test has been skipped. It can be used in reporters to
determine whether a test has been skipped.

```ts
intern.on('testEnd', test => {
  if (test.skipped) {
    console.log(`${test.id} was skipped: ${test.skipped}`);
  }
});
```

### timeElapsed

The
[timeElapsed](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/timeelapsed)
property indicates the time required for the test to run in ms.

```ts
intern.on('testEnd', test => {
  console.log(`${test.id} ran in ${test.timeElapsed} ms`);
});
```

### timeout

Set the
[timeout](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/timeout)
property in a test to adjust the maximum time the test may take to run. If the
test exceeds this time, it will fail. The default timeout is 30000 ms.

```ts
test1() {
	this.timeout = 500;
	// test
}
```

}

```

```
