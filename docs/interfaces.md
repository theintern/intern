# Test interfaces

<!-- vim-markdown-toc GFM -->
* [Overview](#overview)
* [The Object interface](#the-object-interface)
* [The TDD & BDD interfaces](#the-tdd--bdd-interfaces)
* [The QUnit interface](#the-qunit-interface)
* [The Benchmark interface](#the-benchmark-interface)

<!-- vim-markdown-toc -->

## Overview

Test interfaces are the way in which your tests make it into Intern. You can use one of the standard interfaces that come with Intern, or you can [create your own custom interface](./customisation.md#custom-interfaces) if you don’t like the available defaults.

If you already have a suite of tests written for a different testing framework, you don’t have to rewrite all of your tests! Just create a custom interface that provides the same API as your old test system.

Because test interfaces are independent from the rest of the testing system, you can use more than one test interface at the same time in a single project. Just be careful not to introduce unnecessary inconsistencies by doing this!

## The Object interface

The Object interface is the most basic API for writing tests. It exposes a single function, usually referenced as `registerSuite`. This function is used to register a series of tests by passing in a plain JavaScript object containing test functions:

```js
define(function (require) {
  var registerSuite = require('intern!object');

  registerSuite({
    name: 'Suite name',

    setup: function () {
      // executes before suite starts;
      // can also be called `before` instead of `setup`
    },

    teardown: function () {
      // executes after suite ends;
      // can also be called `after` instead of `teardown`
    },

    beforeEach: function (test 3.0) {
      // executes before each test
    },

    afterEach: function (test 3.0) {
      // executes after each test
    },

    'Test foo': function () {
      // a test case
    },

    'Test bar': function () {
      // another test case
    },

    /* … */
  });
});
```

If you need to hold variables that are modified by test suites, it’s important to pass a function to `registerSuite` and create the variables inside that function, instead of putting the variables directly inside the factory:

```js
define(function (require) {
  var assert = require('intern/chai!assert');
  var registerSuite = require('intern!object');

  // Don't put this here! This variable is shared!
  var counter = 0;

  registerSuite({
    name: 'Anti-pattern',

    setup: function () {
      app = {
        id: counter++
      };
    },

    'Test the id': function () {
      // May or may not be true! The value of `counter`
      // may have been modified by another suite execution!
      assert.strictEqual(app.id, counter - 1);
    }
  });
});

define(function (require) {
  var assert = require('intern/chai!assert');
  var registerSuite = require('intern!object');

  registerSuite(function () {
    // Do put this here! This variable is unique for each environment!
    var counter = 0;

    return {
      name: 'Correct pattern',

      setup: function () {
        app = {
          id: counter++
        };
      },

      'Test the id': function () {
        // The value of `counter` will always be what is expected
        assert.strictEqual(app.id, counter - 1);
      }
    };
  });
});
```

Failure to follow this guidance will cause extremely unpredictable test execution, but *only* once you start running functional tests against multiple environments concurrently using the [test runner](./running.md#the-test-runner)! This defect will be invisible when running tests against a single environment or when running with [maxConcurrency](#maxconcurrency) set to 1.

It is also possible to nest suites by using an object as a value instead of a function:

```js
define(function (require) {
  var registerSuite = require('intern!object');

  registerSuite({
    name: 'Suite name',

    'Test foo': function () {
      // a test case
    },

    // this is a sub-suite, not a test
    'Sub-suite name': {
      // it can also have its own suite lifecycle methods
      setup: function () { /* … */ },
      teardown: function () { /* … */ },
      beforeEach: function () { /* … */ },
      afterEach: function () { /* … */ },

      'Sub-suite test': function () {
        // a test case inside the sub-suite
      },

      'Sub-sub-suite name': {
        // and so on…
      }
    },

    /* … */
  });
});
```

## The TDD & BDD interfaces

The TDD & BDD interfaces are nearly identical to each other, differing only slightly in the names of the properties that they expose. Registering suites and tests using the TDD & BDD interfaces is more procedural than the [Object interface](#the-object-interface):

```js
define(function (require) {
  var tdd = require('intern!tdd');

  tdd.suite('Suite name', function () {
    tdd.before(function () {
      // executes before suite starts
    });

    tdd.after(function () {
      // executes after suite ends
    });

    tdd.beforeEach(function () {
      // executes before each test
    });

    tdd.afterEach(function () {
      // executes after each test
    });

    tdd.test('Test foo', function () {
      // a test case
    });

    tdd.test('Test bar', function () {
      // another test case
    });

    // …
  });
});
```

The BDD interface attempts to enforce a more literary, behaviour-describing convention for suites and tests by using different names for its registration functions:

```js
define(function (require) {
  var bdd = require('intern!bdd');

  bdd.describe('the thing being tested', function () {
    bdd.before(function () {
      // executes before suite starts
    });

    bdd.after(function () {
      // executes after suite ends
    });

    bdd.beforeEach(function () {
      // executes before each test
    });

    bdd.afterEach(function () {
      // executes after each test
    });

    bdd.it('should do foo', function () {
      // a test case
    });

    bdd.it('should do bar', function () {
      // another test case
    });

    // …
  });
});
```

Both interfaces work the same, so just pick which style you prefer and stick with it!

Just like the Object interface, the TDD & BDD interfaces allow suites to be nested by calling `tdd.suite` or `bdd.describe` from within a parent suite:

```js
define(function (require) {
  var tdd = require('intern!tdd');

  tdd.suite('Suite name', function () {
    tdd.test('Test foo', function () {
      // a test case
    });

    tdd.suite('Sub-suite name', function () {
      // it can also have its own suite lifecycle methods
      tdd.before(function () { /* … */ });
      tdd.after(function () { /* … */ });
      tdd.beforeEach(function () { /* … */ });
      tdd.afterEach(function () { /* … */ });

      tdd.test('Sub-test name', function () {
        // a test case inside the sub-suite
      });

      tdd.suite('Sub-sub-suite', function () {
        // and so on…
      })
    });

    // …
  });
});
```

Don’t try to call `tdd.suite` or `bdd.describe` from inside a test case; it’s not supported.

## The QUnit interface

The QUnit interface provides a test interface that is compatible with the QUnit 1 API. This interface allows you to easily take existing QUnit tests and run them with Intern, or apply your existing QUnit knowledge to writing tests with Intern.

Converting existing QUnit tests to use Intern is as simple as wrapping your test files to expose Intern’s QUnit interface:

```js
define(function (require) {
  var QUnit = require('intern!qunit');

  QUnit.module('Suite name');
  QUnit.test('Test foo', function (assert) {
    assert.expects(1);
    assert.ok(true, 'Everything is OK');
  });

  // … other tests …
});
```

The QUnit interface has been successfully used by multiple jQuery projects to convert their tests to Intern, but there may be some edge cases where its behaviour differs. Please [let us know](https://github.com/theintern/intern/issues/new?body=Description:%0A%0ASteps+to+reproduce:%0A%0A1.%20%E2%80%A6%0A2.%20%E2%80%A6%0A3.%20%E2%80%A6%0A%0AExpected%20result:%0AActual%20result:%0A%0AIntern%20version:%0A%0AAny%20additional%20information:) if you run into any in your own projects!

## The Benchmark interface

The benchmark interface is a specialized version of the object interface used to write benchmarking tests. Its usage is similar to that of the object interface, with a few key differences. One is that asynchronous tests must be declared using an `async` wrapper function, and tests that will be explicitly skipped also need to use a wrapper function (`skip`). The `this.async()` and `this.skip()` methods are not supported for benchmark tests.

```js
define([ 'intern!benchmark' ], function (registerSuite) {
  var async = registerSuite.async; 
  var skip = registerSuite.skip; 

  registerSuite({
    name: 'a suite',

    'basic test': function () {
      // benchmark
    },

    'skipped test': skip(function () {
      // benchmark
    }),

    'async test': async(function (dfd) {
      // benchmark that returns a Promise or resolves the passed in deferred object
    })
  });
});
```

Intern's benchmarking support is based on [Benchmark.js](https://benchmarkjs.com/), which accepts configuration options beyond the standard ones provided through Intern. To pass additional options directly to Benchmark.js, attach them as an "options" property to the test function.

```js
registerSuite({
  'basic test': (function () {
    function test() {
      // benchmark
    }

    test.options = {
      // benchmark.js options
    };

    return test;
  })()
});
```

The benchmark interface also adds two new lifecycle functions: `beforeEachLoop` and `afterEachLoop`. These are similar to Benchmark.js's `setup` and `teardown` methods, in that they will be called for each execution of Benchmark.js's test loop. (The existing `beforeEach` and `afterEach` methods will be called before and after the benchmarking process for a particular test, which will involve calling the test function multiple times.) Like Intern's existing lifecycle functions, these methods support nested suites.

Note that because of limitations in Benchmark.js, `beforeEachLoop` and `afterEachLoop` *must* be synchronous and *cannot* use `this.async()`, return a Promise, or be wrapped with `async`.

Note that providing `setup` and `teardown` functions on benchmark test "options" object is not supported. Intern will always override these functions with its own lifecycle code. Instead, use `beforeEachLoop` and `afterEachLoop`.
