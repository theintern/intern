# Unit testing

<!-- vim-markdown-toc GFM -->
* [Writing a unit test](#writing-a-unit-test)
* [The test lifecycle](#the-test-lifecycle)
* [Asynchronous tests](#asynchronous-tests)
	* [Returning a Promise](#returning-a-promise)
	* [Calling this.async](#calling-thisasync)
* [Skipping tests at runtime](#skipping-tests-at-runtime)
* [Testing CommonJS modules](#testing-commonjs-modules)
* [Testing non-modular code](#testing-non-modular-code)
* [Testing other transpiled code](#testing-other-transpiled-code)
* [Testing non-CORS APIs](#testing-non-cors-apis)
	* [Option 1: All traffic except Web services to Intern](#option-1-all-traffic-except-web-services-to-intern)
	* [Option 2: Only JavaScript traffic to Intern](#option-2-only-javascript-traffic-to-intern)

<!-- vim-markdown-toc -->

## Writing a unit test

As described in the [fundamentals overview](./fundamentals.md), unit tests are the cornerstone of every test suite. Unit tests allow us to test applications by loading and interacting directly with application code.

In order to write a unit test, you first need to pick an [interface](./interfaces.md) to use. For the sake of clarity, this guide uses the [Object interface](./interfaces#the-object-interface), but all the test and suite lifecycle functions themselves are written the same way, and have the same functionality, no matter which interface you use.

A unit test function, at its most basic level, is simply a function that throws an error when a test failure occurs, or throws no errors when a test passes:

```js
define(function (require) {
  var registerSuite = require('intern!object');

  registerSuite({
    'passing test': function () {},
    'failing test': function () {
      throw new Error('Oops');
    }
  });
});
```

The `this` keyword within a test function in Intern refers to the internal [Test object](./internals#the-test-object). This object provides functionality for [asynchronous testing](./internals.md#async-tests) and [skipping tests](#skipping-tests-at-runtime).

In order to facilitate testing, the [Chai Assertion Library](http://chaijs.com/) is bundled with Intern. Chai allows us to easily verify that certain operations perform as expected by comparing expected and actual values and throwing useful errors when they don’t match:

```js
define(function (require) {
  var registerSuite = require('intern!object');
  var assert = require('intern/chai!assert');

  registerSuite({
    'passing test': function () {
      var result = 2 + 3;

      assert.equal(result, 5,
        'Addition operator should add numbers together');
    },
    'failing test': function () {
      var result = 2 * 3;

      assert.equal(result, 5,
        'Addition operator should add numbers together');
    }
  });
});
```

> 💡 Good code comments describe *why* code is doing something and not *what* it is doing. Similarly, good assertion messages describe *why* the assertion exists and not *what* it is asserting. Keep this in mind as you write your tests!

Chai provides its own set of different interfaces for providing assertions. They all do the same things, so just like Intern’s test interfaces, pick the one whose syntax you prefer:

-   The [assert](http://chaijs.com/guide/styles/#assert) API, loaded from `'intern/chai!assert'`, looks like `assert.isTrue(value)`
-   The [expect](http://chaijs.com/guide/styles/#expect) API, loaded from `'intern/chai!expect'`, looks like `expect(value).to.be.true`
-   The [should](http://chaijs.com/guide/styles/#should) API, loaded from `'intern/chai!should'`, looks like `value.should.be.true`

> 💡 When using the assert API, an easy way to remember the order of arguments is that they are alphabetical: *a*ctual, *e*xpected, *m*essage.

> ⚠️ The should-style API pollutes the global `Object.prototype` and doesn’t work with null/undefined values or objects that don’t inherit from `Object.prototype`. It is recommended that this style of assertion be avoided.

## The test lifecycle

When tests are executed, the test system follows a specific lifecycle:

-   For *each registered root suite*:
    -   The [setup](./internals.md#the-suite-object) method of the suite is called, if it exists
    -   For *each test* within the suite:
        -   The [beforeEach](./internals.md#the-suite-object) method of the suite is called, if it exists
        -   The test function is called
        -   The [afterEach](./internals.md##the-suite-object) method of the suite is called, if it exists
    -   The [teardown](./internals.md#the-suite-object) method of the suite is called, if it exists

So, given the this test module:

```js
define(function (require) {
  var registerSuite = require('intern!object');

  registerSuite({
    setup: function () {
      console.log('outer setup');
    },
    beforeEach: function () {
      console.log('outer beforeEach');
    },
    afterEach: function () {
      console.log('outer afterEach');
    },
    teardown: function () {
      console.log('outer teardown');
    },

    'inner suite': {
      setup: function () {
        console.log('inner setup');
      },
      beforeEach: function () {
        console.log('inner beforeEach');
      },
      afterEach: function () {
        console.log('inner afterEach');
      },
      teardown: function () {
        console.log('inner teardown');
      },

      'test A': function () {
        console.log('inner test A');
      },
      'test B': function () {
        console.log('inner test B');
      }
    },

    'test C': function () {
      console.log('outer test C');
    }
  });
});
```

…the resulting console output would be in this order:

1. outer setup
1. inner setup
1. outer beforeEach
1. inner beforeEach
1. inner test A
1. inner afterEach
1. outer afterEach
1. outer beforeEach
1. inner beforeEach
1. inner test B
1. inner afterEach
1. outer afterEach
1. inner teardown
1. outer beforeEach
1. outer test C
1. outer afterEach
1. outer teardown

The `this` keyword inside of the suite lifecycle methods (setup, beforeEach, afterEach, teardown) refers to the internal [Suite object](./internals.md#the-suite-object).

## Asynchronous tests

As mentioned in the earlier section on [conventions](./getting-started.md#conventions), asynchronous testing in Intern is based on Promises. When writing a test, you may either return a Promise from your test function (convenient for interfaces that already use Promises), or call `this.async` from within a test function to create a promise for that test.

### Returning a Promise

If your test returns a promise (any object with a then function), it is understood that your test is asynchronous. Resolving the promise indicates a passing test, and rejecting the promise indicates a failed test. The test will also fail if the promise is not fulfilled within the timeout of the test (the default is 30 seconds; set `this.timeout` to change the value).

### Calling this.async

All tests have a `this.async` method that can be used to retrieve a Deferred object. It has the following signature:

```js
this.async(timeout?: number, numCallsUntilResolution?: number): Deferred;
```

After calling this method, Intern will assume your test is asynchronous, even if you do not return a Promise. (If you do return a Promise, the returned Promise takes precedence over the one generated by `this.async`.)

The Deferred object by `this.async` includes a reference to the generated Promise, along with methods for resolving and rejecting the promise:

| Property/method                       | Description                                                                                                                                                                                                                                                                                         |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| callback(fn: Function): Function      | Returns a function that, when called, resolves the Promise if `fn` does not throw an error, or rejects the Promise if it does. This is the most common way to complete an asynchronous test.                                                                                                        |
| promise: Promise                      | The underlying Promise object for this Deferred.                                                                                                                                                                                                                                                    |
| reject(error: Error): void            | Rejects the Promise. The error passed to `reject` is used as the error for reporting the test failure.                                                                                                                                                                                              |
| rejectOnError(fn: Function): Function | Returns a function that, when called, does nothing if `fn` does not throw an error, or rejects the Promise if it does. This is useful when working with nested callbacks where only the innermost callback should resolve the Promise but a failure in any of the outer callbacks should reject it. |
| resolve(value?: any): void            | Resolves the Promise. The resolved value is not used by Intern.                                                                                                                                                                                                                                     |

The `this.async` method accepts two optional arguments:

| Argument                | Description                                                                                                                                                                                                                                                                                                               |
|-------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| timeout                 | Set the timeout of the test in milliseconds. Equivalent to setting `this.timeout`. If not provided, this defaults to 30 seconds.                                                                                                                                                                                          |
| numCallsUntilResolution | Specifies how many times the `callback` method should be called before actually resolving the Promise. This defaults to 1. `numCallsUntilResolution` is only useful in rare cases where you may have a callback that will be called several times and the test should be considered complete only on the last invocation. |

A basic asynchronous test using `this.async` looks like this:

```js
define(function (require) {
  var registerSuite = require('intern!object');
  var assert = require('intern/chai!assert');

  var request = require('request');

  registerSuite({
    name: 'async demo',

    'async test': function () {
      var dfd = this.async(1000);

      request(
        'http://example.com/test.txt',
        dfd.callback(function (error, data) {
          if (error) {
            throw error;
          }

          assert.strictEqual(data, 'Hello world!');
        })
      );
    }
  });
});
```

In this example, an HTTP request is made using a hypothetical `request` library that uses legacy Node.js-style callbacks. When the call is completed successfully, the data is checked to make sure it is correct.

If the data is correct, the Promise associated with `dfd` will be resolved, and the test will pass; otherwise, it will be rejected (because an error is thrown), and the test will fail.

## Skipping tests at runtime

All tests have a `skip` method that can be used to skip the test if it should not be executed for some reason:

```js
define(function (require) {
  var registerSuite = require('intern!object');
  var assert = require('intern/chai!assert');

  registerSuite({
    name: 'skip demo',

    'skip test': function () {
      if (typeof window === 'undefined') {
        this.skip('Browser-only test');
      }

      // ...
    }
  });
});
```

> 💡 Calling `this.skip` halts execution of the rest of the function, so it is not necessary to `return` after calling it.

The [grep configuration option](./configuration.md#grep) can also be used to skip tests whose IDs don’t match a regular expression.

Suites also have a `skip` method. Calling `this.skip()` from a suite lifecycle method, or calling `this.parent.skip()` from a test, will cause all remaining tests in a suite to be skipped.

```js
define(function (require) {
  var registerSuite = require('intern!object');
  var assert = require('intern/chai!assert');

  registerSuite({
    name: 'skip demo',

    setup: function () {
      // Skip entire suite if not running in a browser
      if (typeof window === 'undefined') {
        this.skip('Browser-only suite');
      }
    },

    'test 1': function () {
      // test code
    },

    'test 2': function () {
      // Skip remainder of suite if `someVar` isn't defined
      if (window.someVar == null) {
        this.parent.skip('somVar not defined');
      }
      // test code
    },

    // tests ...
  });
});
```

> 💡 When a test is skipped because `this.skip()` or `this.parent.skip()` was called from within the test, the `beforeEach` and `afterEach` lifecycle methods are still executed for that test. However, when tests are skipped due to `grep` or because `skip` was called on a suite (either in a lifecycle method or in a previous test), `beforeEach` and `afterEach` are *not* executed for the skipped test(s).

## Testing CommonJS modules

CommonJS modules, including Node.js built-ins, can be loaded as dependencies to a test module using the `dojo/node` loader plugin that comes with Intern:

```js
define(function (require) {
  var registerSuite = require('intern!object');
  var assert = require('intern/chai!assert');
  var path = require('intern/dojo/node!path');

  registerSuite({
    name: 'path',

    'basic tests': function () {
      var ab = path.join('a', 'b');

      // …
    }
  });
});
```

> 💡 CommonJS modules will be loaded using the native Node.js loader. This means they will follow the Node.js module path resolution rules. It also means that AMD loader features like `map` cannot be used when testing CommonJS modules to mock their dependencies.

## Testing non-modular code

Browser code that doesn’t support any module system and expects to be loaded along with other dependencies in a specific order can be loaded using the `intern/order` loader plugin:

```js
define([
  'intern!object',
  'intern/chai!assert',
  'intern/order!../jquery.js',
  'intern/order!../plugin.jquery.js'
], function (registerSuite, assert) {
  registerSuite({
    name: 'plugin.jquery.js',

    'basic tests': function () {
      jQuery('<div>').plugin();
      // …
    }
  });
});
```

It is also possible to use the [use-amd](https://github.com/tbranyen/use-amd) loader plugin to load non-modular code:

```js
define(function (require) {
  var registerSuite = require('intern!object');
  var assert = require('intern/chai!assert');
  var jQuery = require('use!plugin.jquery');

  registerSuite({
    name: 'plugin.jquery.js',

    'basic tests': function () {
      jQuery('<div>').plugin();
      // …
    }
  });
});
```

In this case, the dependency ordering is handled by use-amd instead.

> ⚠️ Authoring non-modular code that pollutes the global scope is strongly discouraged. Any code using this style should be upgraded… just as soon as you have a good test suite you can use to prevent regressions!

## Testing other transpiled code

Other transpiled code can be tested without requiring a build step by first writing a [loader plugin](https://github.com/amdjs/amdjs-api/blob/master/LoaderPlugins.md) that performs code compilation for you:

```js
// in tests/support/customscript.js
define(function (require) {
  var compiler = require('customscript');
  var request = require('intern/dojo/request');

  return {
    load: function (resourceId, require, load) {
      // Get the raw source code…
      request(require.toUrl(resourceId)).then(function (sourceCode) {
        // …then compile it into JavaScript code…
        compiler.compile(sourceCode).then(function (javascriptCode) {
          // …then execute the compiled function. In this case,
          // the compiled code returns its value. An AMD module would
          // call a `define` function, and a CJS module would set its
          // values on `exports` or `module.exports`.
          load(new Function(javascriptCode)());
        });
      });
    }
  };
});
```

Once you have a suitable loader plugin, just load your code through the loader plugin like any other dependency:

```js
// in tests/unit/foo.js
define(function (require) {
  var registerSuite = require('intern!object');
  var assert = require('intern/chai!assert');
  var foo = require('../support/customscript!app/foo.cs');

  registerSuite({
    name: 'app/foo',

    'basic tests': function () {
      foo.doSomething();
      // …
    }
  });
});
```

> 💡 This same mechanism can be used to write the test modules themselves in a different language or module format by referencing a loader plugin ID in the [suites](./configuration.md#suites) and [functionalSuites](./configuration.md#functionalsuites) arrays.

## Testing non-CORS APIs

When writing unit tests with Intern, occasionally you will need to interact with a Web service using XMLHttpRequest. However, because the [test runner](./running.md#the-test-runner) serves code at http://localhost:9000 by default, any cross-origin requests will fail.

In order to test Ajax requests without using CORS or JSONP, the solution is to set up a reverse proxy to Intern and tell the test runner to load from that URL instead by setting the [proxyUrl](./configuration.md#proxyurl) configuration option.

You can either set up the Web server to only send requests to Intern for your JavaScript files, or you can set up the Web server to send all requests to Intern except for the Web services you’re trying to access.

### Option 1: All traffic except Web services to Intern

1.  Modify [proxyUrl](./configuration.md#proxyurl) in your Intern configuration to point to the URL where the Web server lives
2.  Set up the Web server to reverse proxy to http://localhost:9000/ by default
3.  Add `location` directives to pass the more specific Web service URLs to the Web service instead

An nginx configuration implementing this pattern might look like this:

```nginx
server {
  server_name proxy.example;

  location /web-service/ {
    # This will proxy to http://www.web-service.example/web-service/<rest of url>;
    # use `proxy_pass http://www.web-service.example/` to proxy to
    # http://www.web-service.example/<rest of url> instead
    proxy_pass http://www.web-service.example;
  }

  location / {
    proxy_pass http://localhost:9000;
  }
}
```

### Option 2: Only JavaScript traffic to Intern

1.  Modify [proxyUrl](./configuration.md#proxyurl) in your Intern configuration to point to the URL where the Web server lives
2.  Set up the Web server to reverse proxy to http://localhost:9000/ for the special /\_\_intern/ location, plus any directories that contain JavaScript

An nginx configuration implementing this pattern might look like this:

```nginx
server {
  server_name proxy.example;
  root /var/www/;

  location /js/ {
    proxy_pass http://localhost:9000;
  }

  location /__intern/ {
    proxy_pass http://localhost:9000;
  }

  location / {
    try_files $uri $uri/ =404;
  }
}
```
