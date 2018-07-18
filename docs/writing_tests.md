# Writing Tests

At the most basic level, a test is a function that either runs to completion or
throws an error. Intern groups tests into suites, and runs the suites when
`intern.run()` is called. The first few sections in this document cover the
basics of writing and organizing tests. Later sections describe the differences
between types of tests in more detail.

<!-- vim-markdown-toc GFM -->

* [Organization](#organization)
* [The test lifecycle](#the-test-lifecycle)
* [Interfaces](#interfaces)
    * [Object](#object)
        * [Nesting suites](#nesting-suites)
        * [Shared data](#shared-data)
    * [TDD](#tdd)
    * [BDD](#bdd)
    * [Benchmark](#benchmark)
    * [Native](#native)
* [Assertions](#assertions)
    * [assert](#assert)
    * [expect](#expect)
    * [should](#should)
* [Unit tests](#unit-tests)
    * [Testing asynchronous code](#testing-asynchronous-code)
    * [Skipping tests at runtime](#skipping-tests-at-runtime)
    * [Test and suite context](#test-and-suite-context)
    * [Environment](#environment)
* [Benchmark tests](#benchmark-tests)
* [Functional tests](#functional-tests)
    * [Page objects](#page-objects)
    * [Testing native apps](#testing-native-apps)
        * [Appium](#appium)
        * [ios-driver](#ios-driver)
        * [Selendroid](#selendroid)
    * [Debugging](#debugging)

<!-- vim-markdown-toc -->

## Organization

Suites are typically grouped into script files, with one top-level suite per
file. How the files themselves are structured depends on how the suite files
will be [loaded](./architecture.md#loader). For example, if the ‘dojo’ loader is
used to load suites, an individual suite file would be an AMD or UMD module:

```js
define(['app/Component'], function(Component) {
    const { assert } = intern.getPlugin('chai');
    const { registerSuite } = intern.getInterface('object');

    registerSuite('Component', {
        'create new'() {
            assert.doesNotThrow(() => new Component());
        }
    });
});
```

On other hand, if the loader is using SystemJS + Babel to load suites, a suite
file could be an ESM module:

```ts
import Component from '../app/Component';

const { assert } = intern.getPlugin('chai');
const { registerSuite } = intern.getInterface('object');

registerSuite('Component', {
    'create new'() {
        assert.doesNotThrow(() => new Component());
    }
});
```

## The test lifecycle

When tests are executed, the test system follows a specific lifecycle:

*   For each registered root suite...
    *   The suite’s `before` method is called, if it exists
    *   For each test within the suite...
        *   The suite’s `beforeEach` method is called, if it exists
        *   The test function is called
        *   The suite’s `afterEach` method is called, if it exists
    *   The suite’s `after` method is called, if it exists

For nested suites, `beforeEach` lifecycle methods are run from the outside in;
first the outermost parent’s `beforeEach` is run, then the next level in, and so
on until the suite’s own `beforeEach`, which is run last. The `afterEach`
lifecycle methods are run in the reverse order; first the suite’s own
`afterEach` is run, then its parent’s, and so on until the outermost suite.

Given the following test module...

```ts
const { registerSuite } = intern.getInterface('object');

registerSuite({
    before() {
        console.log('outer before');
    },

    beforeEach() {
        console.log('outer beforeEach');
    },

    afterEach() {
        console.log('outer afterEach');
    },

    after() {
        console.log('outer after');
    },

    tests: {
        'inner suite': {
            before() {
                console.log('inner before');
            },
            beforeEach() {
                console.log('inner beforeEach');
            },
            afterEach() {
                console.log('inner afterEach');
            },
            after() {
                console.log('inner after');
            },

            tests: {
                'test A'() {
                    console.log('inner test A');
                },
                'test B'() {
                    console.log('inner test B');
                }
            }
        },

        'test C': function() {
            console.log('outer test C');
        }
    }
});
```

...the resulting console output would be:

```
outer before
inner before
outer beforeEach
inner beforeEach
inner test A
inner afterEach
outer afterEach
outer beforeEach
inner beforeEach
inner test B
inner afterEach
outer afterEach
inner after
outer beforeEach
outer test C
outer afterEach
outer after
```

## Interfaces

There are several ways to write tests. The most common will be to use one of
Intern’s built-in interfaces, such as the object interface. Another possibility
is to register tests or suites directly on the Intern executor.

Interfaces may be accessed using the `getInterface('xyz')` method, or by
importing an interface directly if a module loader is in use. Note that since
interfaces are independent from the rest of the testing system, multiple
interfaces may be used at the same time (e.g., some suites could be written with
the object interface and others with BDD).

### Object

This is the default interface used for Intern’s self-tests and most examples. A
suite is a simple object, and tests are functions on that object.

```ts
// tests/unit/component.ts
const { registerSuite } = intern.getInterface('object');

registerSuite('Component', {
    'create new'() {
        assert.doesNotThrow(() => new Component());
    },

    'update values'() {
        const component = new Component();
        component.update({ value: 20 });
        assert.equal(component.children[0].value, 20);
    }
});
```

The property used to describe a suite has the basic format:

```ts
{
    // Suite properties, such as lifecycle functions
    beforeEach() {},
    afterEach() {},
    timeout: 500,

    tests: {
        // Tests or nested suites
        test1() {},
        test2() {},
    }
}
```

However, when no Suite properties are being provided (e.g., `beforeEach`,
`afterEach`, etc.) the tests can be directly on the suite object:

```ts
{
    test1() { },
    test2() { },
    // ...
}
```

The presence of a `tests` property determines how Intern will treat an object
suite descriptor. If a `tests` property is present, other properties are assumed
to be suite properties. If a `tests` property is not present, then all
properties on the descriptor are assumed to be tests.

#### Nesting suites

Suites can be nested by using a suite descriptor as a test:

```ts
registerSuite('Component', {
    foo() {
        assert.doesNotThrow(() => new Component());
    },

    bar() {
        const component = new Component();
        component.update({ value: 20 });
        assert.equal(component.children[0].value, 20);
    }

    'sub suite': {
        baz() {
            // A test in the sub-suite
        },

        bif() {
            // Another sub-suite test
        }
    }
});
```

#### Shared data

If tests need to share variables, it’s good practice to initialize the suite
with a function rather than directly with a suite object. This will ensure that
if a suite is loaded more than once, such as a functional test suite being
loaded for different remote environments, each instance will have its own copies
of the shared variables. Do this:

```ts
registerSuite('foo', () => {
    let counter = 0;
    let app;

    return {
        before() {
            app = new App(counter++);
        },

        tests: {
            'validate counter'() {
                assert.strictEqual(app.id, counter - 1);
            }
        }
    };
});
```

instead of this:

```ts
let counter = 0;
let app;

registerSuite('foo', {
    before() {
        app = new App(counter++);
    },

    tests: {
        'validate counter'() {
            assert.strictEqual(app.id, counter - 1);
        }
    }
});
```

A similar tactic may be used when tests in a sub-suite need to share data but
that data should only be visible to the sub-suite:

```ts
registerSuite('foo', {
    test1() {
    }

    test2() {
    }

    subSuite: (() => {
        let counter = 0;
        let app;

        return {
            before() {
                app = new App(counter++);
            },

            tests: {
                'validate counter'() {
                    assert.strictEqual(app.id, counter - 1);
                }
            }
        };
    })()
});
```

### TDD

Registering suites and tests using the TDD interface is more procedural than the
[object interface](#object).

```ts
const { suite, test } = intern.getInterface('tdd');
const { assert } = intern.getPlugin('chai');

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

Suites may be nested by calling `suite` within a suite callback. However,
calling `suite` within a test function isn't supported.

```ts
suite('Component', () => {
    test('create new', () => {});

    suite('sub suite', () => {
        test('test1', () => {});
    });
});
```

Unlike the object interface, the TDD interface allows multiple copies of a
lifecycle method to be added to a single suite. For example, a suite may call
`before` multiple times to set multiple before callbacks.

```ts
suite('Component', () => {
    before(() => {
        // Setup code
    });

    before(() => {
        // Additional setup code
    });

    // ...
});
```

### BDD

The BDD interface is nearly identical to the TDD interface, differing only in
the names of its test and suite registration functions (`describe` and `it`
rather than `suite` and `test`).

```ts
const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

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

### Benchmark

The benchmark interface is an extension of the [object interface](#object) used
to register [benchmark suites](#benchmark-tests). Tests in benchmark suites are
concerned with code _performance_ rather than code _correctness_. The interface
looks very similar to the object interface.

```ts
const { registerSuite, async } = intern.getInterface('benchmark');
let component: Component;

registerSuite('Component performance', {
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

The `async` function is used to identify asynchronous benchmark tests as the
standard [this.async](#testing-asynchronous-code) method doesn’t work properly
with benchmark tests.

```ts
registerSuite('Performance', {
    // ...

    'update values'() {
        component.update({ value: 20 });
    },

    // An async test will be passed a Deferred object
    async(request(dfd) {
        component.request('something.html').then(
            () => { dfd.resolve(); },
            error => { dfd.reject(error); }
        );
    })
});
```

The benchmark interface also supports two additional lifecycle methods,
`beforeEachLoop` and `afterEachLoop`. The test lifecycle for a benchmark test is
a bit different than for other types of test. A single benchmark test involves
running a test function many times in succession. The total of all of these runs
is the “test”, and this is what the standard `beforeEach` and `afterEach`
callbacks run before and after. The `beforeEachLoop` and `afterEachLoop` run
before and after each call of the test function in a run.

> ⚠️ Note that because of limitations in Benchmark.js, `beforeEachLoop` and
> `afterEachLoop` _must_ be synchronous, and cannot be wrapped in `async`.

Benchmark tests may also provide options directly to [Benchmark.js] by attaching
them to the test function.

```ts
registerSuite('foo', {
    'basic test': (() => {
        test() {
            // benchmark
        }

        test.options = {
            // Benchmark.js options
        };

        return test;
    })();
});
```

> ⚠️ Note that providing `setup` and `teardown` functions in an `options` object
> is not supported. Intern will always override these functions with its own
> lifecycle code. Instead, use `beforeEachLoop` and `afterEachLoop`.

### Native

The native interface is simply the
[addSuite](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/addsuite)
method on Executor, which is what the various test interfaces use behind the
scenes to register tests and suites. This method takes a factory function that
will be called with a Suite. The factory function should add suites or tests to
the given suite using the suite’s `add` method.

```ts
intern.addSuite(parent => {
    const suite = new Suite({
        name: 'create new',
        tests: [
            new Test({
                name: 'new test',
                test: () => assert.doesNotThrow(() => new Component())
            })
        ]
    });
    parent.add(suite);
});
```

## Assertions

Tests should throw errors when some feature being tested doesn’t behave as
expected. The standard `throw` mechanism will work for this purpose, but
performing a particular test and constructing meaningful error messages can be
tedious. Assertion libraries exist that can simplify this process. Intern
bundles the [chai](http://chaijs.com) assertion library, and exposes it it vial
the plugin system as “chai”.

```ts
const { assert } = intern.getPlugin('chai');
```

When running with a module loader or in Node, Chai can be imported directly.

Chai provides three assertion interfaces:
[assert](http://chaijs.com/api/assert/), [expect](http://chaijs.com/api/bdd/),
and [should](http://chaijs.com/api/bdd/).

### assert

This is the interface used by most of the examples in this documentation.

```ts
const { assert } = intern.getPlugin('chai');
// ...
assert.strictEqual(count, 5, 'unexpected value for count');
```

> 💡 When using the assert API, an easy way to remember the order of arguments
> is that they’re alphabetical: actual, expected, message.

### expect

```ts
const { expect } = intern.getPlugin('chai');
// ...
expect(count).to.equal(5, 'unexpected value for count');
```

### should

```ts
// Note that `should` needs to be called to be properly initialized
const should = intern.getPlugin('chai').should();
// ...
count.should.equal(5, 'unexpected value for count');
```

> ⚠️ This API modifies the global `Object.prototype` and doesn’t work with
> null/undefined values or objects that don't inherit from `Object.prototype`.

## Unit tests

[Unit tests](./concepts.md#unit-tests) are probably the most common type of
test. All of the example tests on this page have been unit tests. These work by
directly loading a part of the application, exercising it, and verifying that it
works as expected. For example, the following test checks that an `update`
method on some Component class does what it’s supposed to:

```ts
'update values'() {
    const component = new Component();
    component.update({ value: 20 });
    assert.equal(component.value, 20);
}
```

This test instantiates an object, calls a method on it, and makes an assertion
about the resulting state of the object (in this case, that the component’s
`value` property has a particular value). This test assumes the `update` method
on component is synchronous; it would be very similar if the update method were
asynchronous using Promises:

```ts
'update values'() {
    const component = new Component();
    return component.update({ value: 20 }).then(() => {
        assert.equal(component.value, 20);
    });
}
```

or using callbacks:

```ts
'update values'() {
    const dfd = this.async();
    const component = new Component();
    component.update({ value: 20 }, dfd.callback(error => {
        assert.equal(component.value, 20);
    }));
}
```

### Testing asynchronous code

The examples on this page have all involved synchronous code, but tests may also
execute asynchronous code. When a test is async, Intern will wait for a
notification that the test is finished before starting the next test. There are
two ways to let Intern know a test is async:

1.  Call [this.async] (or `test.async`) to get a Deferred object, and then
    resolve or reject that Deferred when the test is finished, or
2.  Return a Promise

Internally both cases are handled in the same way; Intern will wait for the
Deferred object created by the call to `async`, or for a Promise returned by the
test, to resolve before continuing. If the Deferred or Promise is rejected, the
test fails, otherwise it passes.

```ts
import { get as _get } from 'http';
import { promisify } from 'util';
const get = promisify(_get);

registerSuite('async demo', {
    'async test'() {
        const dfd = this.async();
        get(
            'http://example.com/test.txt',
            dfd.callback((error, data) => {
                if (error) {
                    throw error;
                }
                assert.strictEqual(data, 'Hello world!');
            })
        );
    },

    'Promise test'() {
        return get('http://example.com/test.txt').then(data =>
            assert.strictEqual(data, 'Hello world!')
        );
    }
});
```

If the Deferred or Promise takes too long to resolve, the test will timeout
(which is considered a failure). The timeout can be adjusted by

*   passing a new timeout value to `async`
*   by setting the test’s `timeout` property
*   by changing [defaultTimeout] in the test config

All are values in milliseconds.

```ts
const dfd = this.async(5000);
```

or

```ts
this.timeout = 5000;
```

### Skipping tests at runtime

Tests have a [skip](https://theintern.io/docs.html#Intern/4/api/lib%2FTest/skip)
method that can be used to skip the test if it should not be executed for some
reason.

```ts
registerSuite('skip demo', {
    'skip test'() {
        if (typeof window === 'undefined') {
            this.skip('browser-only test');
        }

        // ...
    }
});
```

> 💡Calling `this.skip` immediately halts test execution, so there is no need to
> call `return` after `skip`.

The Suite class also provides a
[skip](https://theintern.io/docs.html#Intern/4/api/lib%2FSuite/skip) method.
Calling `this.skip()` (or `suite.skip()`) from a suite lifecycle method, or
calling `this.parent.skip()` from a test, will cause all remaining tests in a
suite to be skipped.

Intern also provides a [grep] configuration option that can be used to skip
tests and suites by ID.

```json5
// intern.json
{
    "suites": "tests/unit/*.js",
    // Only tests with "skip demo" in their ID will be run
    "grep": "skip demo"
}
```

> 💡Note that a test ID is the concatenation of its parent suite ID and the test
> name (and a suite ID is the concatenation of _it’s_ parent suite ID and the
> suite’s own name, etc.).

### Test and suite context

Test methods are always called in the context of the test object itself.
Consider the following case that uses the TDD interface:

```ts
test('update values', function() {
    const dfd = this.async();
    const component = new Component();
    component.update(
        { value: 20 },
        dfd.callback(error => {
            assert.equal(component.children[0].value, 20);
        })
    );
});
```

The use of `this.async()` works because the test callback is called with the
containing Test instance as its context. Similarly, suite lifecycle methods such
as `before` and `afterEach` are called in the context of the suite object. The
`beforeEach` and `afterEach` methods are also passed the current test as the
first argument.

This manner of calling test methods doesn’t work so well with arrow functions:

```ts
test('update values', () => {
    const dfd = this.async(); // <--- Problem -- this isn't bound to the Test!
    // ...
});
```

To making working with arrow functions easier, Intern also passes the Test
instance as the first argument to test callbacks, and as the first argument to
test-focused suite lifecycle functions (`beforeEach` and `afterEach`). It passes
the Suite instance as the first argument to the `before` and `after` Suite
callback functions, and as the second argument to `beforeEach` and `afterEach`.

```ts
test('update values', test => {
    const dfd = test.async();
    // ...
});
```

### Environment

Since unit tests involve running application code directly, they will typically
run in the same environment as the application. If the application runs in a
browser, the tests will likely also need to run in the browser. Similarly if the
application runs in Node, so will the tests.

This is not a hard-and-fast rule, though. In many cases the code being tested
may run in both environments, or mocks and/or shims may be employed to allow it
to run in a non-native environment. For example, mock DOMs are often employed to
allow browser code to be tested in Node.

## Benchmark tests

Benchmark tests are a type of unit test that measures the performance of code
rather than checking it for proper behavior. A benchmark test assumes that the
code it’s running will work without error; the test is whether it runs as fast
as expected.

Benchmarks work by running the test function many times in a loop, with Intern
(through [Benchmark.js]) recording how long each test function takes to run on
average. This information can be saved (“baselined”) and used during later test
runs to see if performance has deviated from acceptable values.

Benchmark tests can only be added with the [benchmark interface](#benchmark).
Also note that benchmark suites will only be run when the [benchmark] config
property is `true`. When `benchmark` is not set or is false, calls to register
benchmark suites will be ignored.

The benchmark test lifecycle is very similar to the standard test lifecycle:

*   For each registered root suite...
    *   The suite’s `before` method is called, if it exists
    *   For each test within the suite...
        *   The suite’s `beforeEach` method is called, if it exists
        *   The benchmark is started. The test function will be called many
            times in a “test loop”. For each execution of the test loop...
            *   The beforeEachLoop method of the suite is called, if it exists
            *   The test function is called
            *   The afterEachLoop method of the suite is called, if it exists
        *   The suite’s `afterEach` method is called, if it exists
    *   The suite’s `after` method is called, if it exists

## Functional tests

[Functional tests](./concepts.md#functional-tests) operate fundamentally
differently than unit tests. While a unit test directly loads and executes
application code, functional tests load a page in a browser and interact with it
in the same way a user would: by examining the content of the page, clicking
buttons, typing into text inputs, etc. This interaction is managed through a
`remote` property that is available to functional tests.

Functional tests are registered using the same interfaces as
[unit tests](#unit-tests), and use the same [Suite] and [Test] objects, but are
loaded using the [functionalSuites] property. The key difference is that instead
of executing application code directly, functional tests use a
[Leadfoot Command object](https://theintern.io/docs.html#Leadfoot/2/api/Command/command-1),
available as a `remote` property on the test, to automate interactions that
you’d normally perform manually.

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

This test performs the following steps:

1.  Loads the page 'index.html' in the browser associated with the current test
    session (Intern can drive multiple browsers at a time)
2.  Finds an element on the page with DOM ID ‘username’ and types ‘scroob’ into
    it
3.  Finds the element with ID ‘password’ and types ‘12345’ into it
4.  Finds the element with ID ‘login’ and clicks it
5.  Waits a few seconds
6.  Finds an H1 element
7.  Verifies that it contains the text ‘Welcome!’

One key point to keep in mind is that interaction with a browser is async, so
all functional tests must be async. This is actually pretty simple to deal with.
The API provided by `this.remote` is the Leadfoot
[Command API](https://theintern.io/docs.html#Leadfoot/2/api/Command/command-1),
which is fluid and async, and the result of a bunch of fluid Command method
calls will be something that looks like a Promise. A functional test just needs
to return the result of this Command chain, and Intern will treat it as async.

> ⚠️ Always make sure to return the final call to the remote object, or return a
> Promise that resolves after the functional test is complete. Otherwise Intern
> won’t wait for your functional test to finish before moving on to the next
> test.

### Page objects

Typically a given page may be used in multiple functional tests, and tests may
perform a lot of the same actions on a given page.
[Page objects](./concepts.md#page-objects) are one way of reducing repetition
and improving maintainability. They are typically implemented for Intern using
functions that return callback functions, like the following:

```ts
// loginPage.ts
export function login(username: string, password: string) {
    return function() {
        return this.parent
            .findById('login')
            .click()
            .type(username)
            .end()
            .findById('password')
            .click()
            .type(password)
            .end()
            .findById('loginButton')
            .click()
            .end()
            .setFindTimeout(5000)
            .findById('loginSuccess')
            .end();
    };
}
```

Each page object function returns a function. This returned function will be
used as a `then` callback. To actually use a page object function, just call it
and use the return value for a `then` callback:

```ts
// productPage.ts
import { login } from './pages/loginPage.ts';

registerSuite('product page', {
    'buy product'() {
        return (
            this.remote
                .get('https://mysite.local')
                .then(login(username, password))

                // now buy the product
                .findById('product-1')
                .click()
                .end()
        );
        // ...
    }

    // ...
});
```

### Testing native apps

Native mobile application UIs can be tested by Intern using an
[Appium](http://appium.io/),
[ios-driver](http://ios-driver.github.io/ios-driver/), or
[Selendroid](http://selendroid.io/) server. Each server has slightly different
support for WebDriver, so make sure to read each project’s documentation to pick
the right one for you.

> ⚠️ Always be sure to set `fixSessionCapabilities: false` in your environment
> capabilities when testing a native app to bypass feature detection code that
> only works for standard web browsers.

#### Appium

To test a native app with Appium, one method is to pass the path to a valid IPA
or APK using the app key in your [environments] configuration:

```json5
{
    "environments": [
        {
            "platformName": "iOS",
            "app": "testapp.ipa",
            "fixSessionCapabilities": false
        }
    ]
}
```

You can also use `appPackage` and `appActivity` for Android, or `bundleId` and
`udid` for iOS, to run an application that is already installed on a test
device:

```json5
{
    "environments": [
        {
            "platformName": "iOS",
            "bundleId": "com.example.TestApp",
            "udid": "da39a3ee5e...",
            "fixSessionCapabilities": false
        },
        {
            "platformName": "Android",
            "appActivity": "MainActivity",
            "appPackage": "com.example.TestApp",
            "fixSessionCapabilities": false
        }
    ]
}
```

The available capabilities for Appium are complex, so review the
[Appium capabilities documentation](http://appium.io/slate/en/master/?javascript#appium-server-capabilities)
to understand all possible execution modes.

Once the application has started successfully, you can interact with it using
any of the supported
[WebDriver APIs](http://appium.io/slate/en/master/?javascript#finding-and-interacting-with-elements).

#### ios-driver

To test a native app with ios-driver, first run ios-driver, passing one or more
app bundles for the applications you want to test:

```
java -jar ios-driver.jar -aut TestApp.app
```

Then, pass the bundle ID and version using the `CFBundleName` and
`CFBundleVersion` keys in your [environments] configuration:

```json5
{
    "environments": [
        {
            "device": "iphone",
            "CFBundleName": "TestApp",
            "CFBundleVersion": "1.0.0",
            // required for ios-driver to use iOS Simulator
            "simulator": true,
            "fixSessionCapabilities": false
        }
    ]
}
```

Once the application has started successfully, you can interact with it using
any of the
[supported WebDriver APIs](https://ios-driver.github.io/ios-driver/?page=native).

#### Selendroid

To test a native app with Selendroid, first run Selendroid, passing one or more
APKs for the applications you want to test:

```
java -jar selendroid.jar -app testapp-1.0.0.apk
```

Then, pass the Android app ID of the application using the `aut` key in your
[environments] configuration:

```json5
{
    "environments": [
        {
            "automationName": "selendroid",
            "aut": "com.example.testapp:1.0.0",
            "fixSessionCapabilities": false
        }
    ]
}
```

Once the application has started successfully, you can interact with it using
any of the supported WebDriver APIs.

### Debugging

When debugging functional tests, keep in mind that JavaScript code is running in
two separate environments: functional test suites are running in Node.js, while
the page being tested is running in a web browser. Functional tests themselves
can be debugged using Node’s `--inspect` or `--inspect-brk` command line
options.

1.  Set a breakpoint in your test code by adding a `debugger` statement.
2.  Launch Node.js in inspect mode
    ```
    $ node --inspect-brk node_modules/.bin/intern
    ```
3.  Start Chrome and connect to the address and port provided by Node
4.  Continue execution (F8). The tests will run to the debugger statement.
5.  Debug!

[benchmark]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/benchmark
[benchmark.js]: https://benchmarkjs.com
[defaulttimeout]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/defaulttimeout
[environments]: ./configuration.md#environments
[functionalsuites]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/functionalsuites
[grep]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/grep
[this.async]: https://theintern.io/docs.html#Intern/4/api/lib%2FTest/async
[suite]: https://theintern.io/docs.html#Intern/4/api/lib%2FSuite
[test]: https://theintern.io/docs.html#Intern/4/api/lib%2FTest
