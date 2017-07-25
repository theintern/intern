# Concepts and Definitions

<!-- vim-markdown-toc GFM -->
* [Test organization](#test-organization)
    * [Assertions](#assertions)
    * [Test interface](#test-interface)
* [Test types](#test-types)
    * [Unit tests](#unit-tests)
    * [Functional tests](#functional-tests)
* [Code coverage](#code-coverage)
* [Source maps](#source-maps)
* [Page objects](#page-objects)

<!-- vim-markdown-toc -->

## Test organization

Intern organizes tests into suites and modules, and allows them to be registered with various test interfaces.

* **Test module** - a JavaScript module (AMD, CJS, ESM, ...) containing test suites
* **Test suite** - a group of related tests
* **Test case**, or **test** - an individual test
* **[Assertion](#assertions)** - a check for a condition that throws an error if the condition isn’t met
* **[Test interface](#test-interface)** - an API used to register test suites

These terms can be visualized in a hierarchy:

* test module
  * test suite
    * test suite
      * test case
        * assertion
        * assertion
        * ...
      * test case
        * assertion
        * ...
      * ...
    * ...
  * test suite
  * ...
* test module
* ...

### Assertions

An assertion is simply a check that throws an error if the check fails, like:

```ts
if (value !== 5) {
    throw new Error(`Expected ${value} to be 5`);
}
```

No special library is required to make assertions. However, assertion libraries can make tests easier to understand, and can automatically generate meaningful failure messages. Using the [Chai](https://chaijs.com) assertion library included with Intern, the above assertion could be written as:

```ts
assert.equal(value, 5);
```

If the assertion fails, Chai will construct a meaningful error message that includes the expected and actual values.

### Test interface

A test interface is an API used to register tests. For example, many testing frameworks use a "BDD" interface, with `describe` and `it` functions, where `describe` creates a suite and `it` creates an individual test. Intern includes several interfaces:

* **BDD**
* **TDD**, which uses `suite` and `test` functions
* **Object**, which allows suites to be defined using objects
* **Benchmark**, an object-like interface for registering benchmark tests
* **Qunit**, an implementation of the [QUnit](http://qunitjs.com) interface

## Test types

Intern supports two basic types of automated testing: unit tests and functional tests.

### Unit tests

Unit tests test code directly by, for example, instantiating an application class or calling an application function, and then make assertions about the result.

Since Intern calls unit test code directly, it needs to run in the same environment as the test code itself. This typically means running Intern in the browser to test browser-specific code, and in Node for Node code. You can get around this limitation using mocks/fakes/stubs; for example, many browser-based projects use a virtual DOM implementation to allow unit tests for browser code to run in a Node environment. (It’s less common to want to go the other way.)

A unit test might look like:

```ts
import Component from 'app/Component';
const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');
registerSuite('Component', {
    '#add'() {
        // Assume 'Component' is a class with 'add' and 'get' methods
        const comp = new Component();
        comp.add({ id: 'foo', value: 'bar' };
        assert.strictEqual(comp.get('foo'), 'bar');
    }
});
```

In the example above, the '#add' test instantiates a Component instance, calls a method on it, then makes an assertion about the result. If the assertion fails, it throws an error message. The test could just as easily have done an equality check itself:

```ts
if (comp.get('foo') !== 'bar') {
    throw new Error('not equal');
}
```

However, using an [assertion library](#assertions) will generate errors with meaningful messages automatically, which is pretty convenient.

### Functional tests

Also known as WebDriver tests (after the [W3C standard](https://www.w3.org/TR/webdriver/)), functional tests test code indirectly. While a unit test calls application functions and examines return values, a functional test manipulates the code in the same way a typical user might, by opening pages, clicking buttons, and filling in form fields.

Functional tests in Intern typically use the [Leadfoot](https://theintern.github.io/leadfoot) WebDriver library to control remote browsers. A functional test might look like:

```ts
const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');
registerSuite('home page', {
    'login'() {
        return this.remote
            .get('http://mysite.local/page.html')
            .findById('username')
            .type('bob')
            .end()
            .findById('password')
            .type('12345')
            .end()
            .findById('submit')
            .click()
            .sleep(1000)
            // Assume the logged in site has a '#banner' element
            .findById('banner');
    }
});
```

Note that the functional test doesn't load any application code. Instead, it uses the `this.remote` object to load a page in a remote browser and interact with it. There's no explicit assertion in this case, either. Searching for the 'banner' element serves as a test assertion, because the chain of Promises started from `this.remote` will reject if the element isn’t found (and Intern will record that as a failure).

## Code coverage

Code coverage is information about what parts of the application code are exercised during tests. It commonly indicates what percentages of statements, branches, and functions are executed. Code coverage information is gathered by “instrumenting” the code being tested. This instrumentation is actually code that is injected into the code being tested. It records information about the executing code into a global variable that Intern retrieves after the testing is complete.

Intern uses [Istanbul](https://github.com/istanbuljs/istanbuljs) to manage code coverage. There are three config properties related to instrumentation. The mostly commonly used one is [`coverage`](configuration.md#coverage), which can be used to specify which files should be instrumented. The other two are `functionalCoverage`, a boolean that indicates whether coverage should be collected during functional tests, and `instrumenterOptions`, which allows options to be passed directly to Istanbul.

## Source maps

Source maps provide a link between transpiled/instrumented/minimized code and the original source. Intern uses source maps both for coverage reporting and error formatting. For example, when it receives an error, either locally or from a remote browser, Intern will look up the locations in the stack trace using any available source maps and replace them with the corresponding location in the original source.

## Page objects

"Page objects" are very useful functional testing concept. The basic idea is to define a page-level API for a page that a test will be interacting with. For example, functional tests may need to login to a site:

```ts
// productPage.ts
registerSuite('product page', {
    'buy product'() {
        return this.remote
            .get('https://mysite.local')

            // Login to the site, using the specified username and password, then look for a
            // specific element to verify that the login succeeded
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
            .end()

            // now buy the product
            .findById('product-1')
            .click()
            .end()
            // ...
    },

    // ...
});
```

With a page object, this could be reduced to something more manageable:

```ts
// productPage.ts
import { login } from './pages/loginPage.ts';

registerSuite('product page', {
    'buy product'() {
        return this.remote
            .get('https://mysite.local')
            .then(login(username, password))

            // now buy the product
            .findById('product-1')
            .click()
            .end()
            // ...
    },

    // ...
});
```
