# Writing Tests

At the most basic level, a test is a function that either runs to completion or throws an error. Intern groups tests
into suites, and runs the suites when `intern.run()` is called. The first few sections in this document cover the basics
of writing and organizing tests.

* [Assertions](#assertions)
* [Interfaces](#interfaces)
* [Organization](#organization)
* [Sync vs Async](#sync-vs-async)

At a higher level, there are two general classes of test: unit and functional tests. Unit tests load application code,
execute various parts of it, and check that it's behaving properly. Functional tests load pages in browsers and
simulate user interaction, then verify that the page is behaving as expected (buttons work, elements show and hide,
etc.).

* [Unit tests](#unit-tests)
* [Functional tests](#functional-tests)

## Assertions

Tests should throw errors when some feature being tested doesn’t behave as expected. The standard `throw` mechanism will
work for this purpose, but performing a particular test and constructing meaningful error messages can be tedious.
Assertion libraries exist that can simplify this process. Intern bundles the [chai](http://chaijs.com) assertion
library, and exposes its ‘[assert](http://chaijs.com/api/assert/)’, ‘[expect](http://chaijs.com/api/bdd/)’, and ‘[should](http://chaijs.com/api/bdd/)’ interfaces via a `getAssertions` method.

```ts
const assert = intern.getAssertions('assert');
```

## Interfaces

There are several ways to write tests. The most common will be to use one of Intern’s built-in interfaces, such as the
object interface. Another possibility is to register tests or suites directly on the Intern object.

Interfaces may be accessed using the `getInterface` method.

### Object

This is the default interface used for Intern’s self-tests and most examples. A suite is a simple object, and tests are
functions in a `tests` property on that object.

```ts
const { registerSuite } = intern.getInterface('object');

registerSuite({
    name: 'Component',

    tests: {
        'create new'() {
            assert.doesNotThrow(() => new Component());
        },

        'update values'() {
            const component = new Component();
            component.update({ value: 20 });
            assert.equal(component.children[0].value, 20);
        }
    }
})
```

### TDD

```ts
const { suite, test } = intern.getInterface('tdd');

suite('Component', () => {
    test('create new', () => {
        assert.doesNotThrow(() => new Component());
    });

    test('update values', () => {
        const component = new Component();
        component.update({ value: 20 });
        assert.equal(component.children[0].value, 20);
    });
});
```

### BDD

```ts
const { bdd, it } = intern.getInterface('bdd');

describe('Component', () => {
    it('should not throw when created', () => {
        assert.doesNotThrow(() => new Component());
    });

    it('should render updated values', () => {
        const component = new Component();
        component.update({ value: 20 });
        assert.equal(component.children[0].value, 20);
    });
});
```

### Qunit

```ts
const { QUnit } = intern.getInterface('qunit');

QUnit.module('Component');
QUnit.test('create new', () => {
    assert.doesNotThrow(() => new Component());
});
QUnit.test('update values', () => {
    const component = new Component();
    component.update({ value: 20 });
    assert.equal(component.children[0].value, 20);
});
```

### Benchmark

The benchmark interface is an extension of the [object interface](#object) used to register [benchmark
suites](#benchmark-tests). Tests in benchmark suites are concerned with code performance rather than code correctness.
The interface looks very similar to the object interface, but it has a couple of extra properties.

```ts
const { registerSuite, async, skip } = intern.getInterface('benchmark');
let component: Component;

registerSuite({
    name: 'Component performance',

    beforeEach() {
        component = new Component();
    },

    afterEach() {
        component = null;
    }

    tests: {
        'update values'() {
            component.update({ value: 20 });
        }
    }
});
```

The `async` and `skip` properties are functions that can be used to identify an asynchronous test or to skip a test.

```ts
registerSuite({
    // ...

    tests: {
        'update values'() {
            component.update({ value: 20 });
        },

        // A skipped test will not be run
        skip(repaint() {
            component.repaint();
        }),

        // An async test will be passed a Deferred object
        async(request(dfd) {
            component.request('something.html').then(() => {
                dfd.resolve();
            }, error => {
                dfd.reject(error);
            });
        })
    }
});
```

### Native

The native interface is simply the `addTest` method on Executor, which is what the various test interfaces use behind
the scenes to register tests and suites. This method can take a constructed Suite or Test object, or an object of Suite
options or Test options.

```ts
intern.addTest({ name: 'create new', test: () => assert.doesNotThrow(() => new Component()) };
intern.addTest(new Test({
    name: 'update values',
    test: () => {
        const component = new Component();
        component.update({ value: 20 });
        assert.equal(component.children[0].value, 20);
    }
});
```

When tests are added directly, they will be part of the executor's root suite.

## Organization

Suites are typically grouped into script files, with one top-level suite per file. How the files themselves are
structured depends on how the suite files will be [loaded](./architecture.md#loaders). For example, if the ‘dojo’ loader
is used to load suites, an individual suite file would be an AMD module:

```js
define([ 'app/Component' ], function (Component) {
    var assert = intern.getAssertions('assert');
    var registerSuite = intern.getInterface('object').registerSuite;

    registerSuite({
        name: 'Component',
        tests: {
            'create new': function () {
                assert.doesNotThrow(() => new Component());
            }
        }
    });
});
```

On the other hand, if the loader is using SystemJS + Babel to load suites, suite file could be an ESM module:

```ts
import Component from '../app/Component';

const assert = intern.getAssertions('assert');
const { registerSuite } = intern.getInterface('object');

registerSuite({
    name: 'Component',
    tests: {
        'create new'() {
            assert.doesNotThrow(() => new Component());
        }
    }
});
```

## Sync vs Async

The examples on this page have all involved synchronous code, but tests may also execute asynchronous code. When a test
is async, Intern will wait for a notification that the test is finished before starting the next test. There are two
ways to let Intern know a test is async:

1. Call `this.async` (or `test.async`) to get a Deferred object, and then resolve or reject that Deferred when the test
   is finished, or
2. Return a Promise

Internally both cases are handled in the same way; Intern will wait for the Deferred object created by the call to
`async`, or for a Promise returned by the test, to resolve before continuing. If the Deferred or Promise is rejected,
the test fails, otherwise it passes.

If the Deferred or Promise takes too long to resolve, the test will timeout (which is considered a failure). The timeout
can be adjusted by passing a new timeout value to `async` or by setting the test’s `timeout` property. Both are values
in milliseconds.

```ts
const dfd = this.async(5000);
```

or

```ts
this.timeout = 5000;
```

## Unit tests

Unit tests are probably the most common type of test. All of the example tests on this page have been unit tests. These
work by directly loading a part of the application, exercising it, and verifying that it works as expected. For example,
the following test checks that an `update` method on some Component class does what it’s supposed to:

```ts
'update values'() {
    const component = new Component();
    component.update({ value: 20 });
    assert.equal(component.children[0].value, 20);
}
```

This test instantiates an object, calls a method on it, and makes an assertion about the resulting state of the object
(in this case, that a `value` property on a child has a particular value). This test assumes the `update` method on
component is synchronous; it would be very similar if the update method were asynchronous using Promises:

```ts
'update values'() {
    const component = new Component();
    return component.update({ value: 20 }).then(() => {
        assert.equal(component.children[0].value, 20);
    });
}
```

or using callbacks:

```ts
'update values'() {
    const dfd = this.async();
    const component = new Component();
    component.update({ value: 20 }, dfd.callback(error => {
        assert.equal(component.children[0].value, 20);
    }));
}
```

### Test context

Test methods are always called in the context of the test object itself. Consider the following case that uses the TDD
interface:

```ts
test('update values', function () {
    const dfd = this.async();
    const component = new Component();
    component.update({ value: 20 }, dfd.callback(error => {
        assert.equal(component.children[0].value, 20);
    }));
});
```

The value of `this` is the containing Test object. However, that would not be the case here:

```ts
test('update values', () => {
    const dfd = this.async();  // <-- Problem here!
    const component = new Component();
    component.update({ value: 20 }, dfd.callback(error => {
        assert.equal(component.children[0].value, 20);
    }));
});
```

To make using fat arrow functions with Intern easier, test functions will always be passed the Test object itself as the
first (and typically only) argument.

```ts
test('update values', test => {
    const dfd = test.async();
    const component = new Component();
    component.update({ value: 20 }, dfd.callback(error => {
        assert.equal(component.children[0].value, 20);
    }));
});
```

Similarly, suite lifecycle functions such as `before` and `afterEach` will always be passed the Suite object itself as
the first parameter.

### Environment

Since unit tests involve running application code directly, they will typically run in the same environment as the
application. If the application runs in a browser, the tests will likely also need to run in the browser. Similarly if
the application runs in Node, so will the tests.

This is not a hard-and-fast rule, though. In many cases the code being tested may run in both environments, or mocks
and/or shims may be employed to allow it to run in a non-native environment. For example, mock DOMs are often employed
to allow browser code to be tested in Node.

## Benchmark tests

Benchmark tests are a type of unit test that measures the performance of code rather than checking it for proper
behavior. A benchmark test assumes that the code it’s running will work without error; the test is whether it runs as
fast as expected.

Benchmark tests can only be added with the ‘benchmark’ interface, which is an extension of the ‘object’ interface. Also
note that benchmark suites will only be run when the `benchmark` config property is `true`. When `benchmark` is not set
or is false, calls to register benchmark suites will be ignored.

## Functional tests

Functional tests operate fundamentally differently than unit tests. While a unit test directly loads and executes
application code, functional tests load a page in a browser and interact with it in the same way a user would: by
examining the content of the page, clicking buttons, typing into text inputs, etc. This interaction is managed through a
`remote` property that is available on functional test suites. Note that _functional tests may only be run using the
WebDriver executor.

Consider the following functional test:

```ts
'login works'() {
    return this.remote
        .get('index.html')
        .findById('username')
        .type('scroob')
        .end()
        .findById('password')
        .type('12345')
        .end()
        .findById('login')
        .click()
        .end()
        .sleep(5000)
        .findByTagName('h1')
        .getVisibleText()
        .then(text => {
            assert.equal(text, 'Welcome!');
        });
}
```

This test first loads the page 'index.html' in the browser associated with the current test session (Intern can drive
multiple browsers at a time). Once the page has loaded, Intern finds an element on the page with DOM ID ‘username’ and
types ‘scroob’ into it, then finds the element with ID ‘password’ and types ‘12345’ into it, then finds the element with
ID ‘login’ and clicks it. After clicking the login element, Intern waits a few seconds and looks for an H1 element, then
verifies that it contains the text ‘Welcome!’.

One key point to keep in mind is that interaction with a browser is async, so all functional tests must be async. This
is actually pretty simple to deal with. The API provided by `this.remote` is the Leadfoot [Command
API](https://theintern.github.io/leadfoot/module-leadfoot_Command.html), which is fluid and async, and the
result of a bunch of fluid Command method calls will be something that looks like a Promise. A functional test just
needs to return the result of this Command chain, and Intern will treat it as async.
