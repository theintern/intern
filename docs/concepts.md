# Concepts and Definitions

This page briefly presents definitions and/or brief descriptions for several core Intern concepts.

<!-- vim-markdown-toc GFM -->
* [Assertions](#assertions)
* [Code coverage](#code-coverage)
* [Functional tests](#functional-tests)
* [Source maps](#source-maps)
* [Unit tests](#unit-tests)
* [Page objects](#page-objects)

<!-- vim-markdown-toc -->

## Assertions

An assertion is simply a check that throws an error if the check fails. This means that no special library is required
to make assertions. However, assertion libraries can make tests easier to understand, and can automatically generate
meaningful failure messages. To that end, Intern includes the [Chai](https://chaijs.com) assertion library, and exposes
it via the [plugin system](architecture.md#plugins) as “chai”.

## Code coverage

Code coverage is information about what parts of the application code are exercised during tests. It commonly indicates
what percentages of statements, branches, and functions are executed. Code coverage information is gathered by
“instrumenting” the code being tested. This instrumentation is actually code that is injected into the code being
tested. It records information about the executing code into a global variable that Intern retrieves after the testing is complete.

Intern uses [Istanbul](https://github.com/istanbuljs/istanbuljs) to manage code coverage. There are a couple of config
properties related to instrumentation. The mostly commonly used one is
[`excludeInstrumentation`](configuration.md#excludeinstrumentation), which can be used to filter the files that are
instrumented, or disable code coverage entirely. There’s generally no benefit to instrumenting the test files or library
code, and in some cases this can even cause problems, so by default `excludeInstrumentation` is setup to filter out
everything under `tests/` and `node_modules/`.

## Functional tests

Also known as WebDriver tests (after the [W3C standard](https://www.w3.org/TR/webdriver/)), functional tests test code
indirectly. While a unit test calls application functions and examines return values, a functional test manipulates the
code in the same way a typical user might, by opening pages, clicking buttons, and filling in form fields.

Functional tests in Intern typically use the [Leadfoot](https://theintern.github.io/leadfoot) WebDriver library to
control remote browsers. A functional test might look like:

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

Note that the functional test doesn't load any application code. Instead, it uses the `this.remote` object to load a
page in a remote browser and interact with it. There's no explicit assertion in this case, either. Searching for the
'banner' element serves as a test assertion, because the chain of Promises started from `this.remote` will reject if the
element isn’t found (and Intern will record that as a failure).

## Source maps

Source maps provide a link between transpiled/instrumented/minimized code and the original source. Intern uses source
maps both for coverage reporting and error formatting. For example, when it receives an error, either locally or from a
remote browser, Intern will look up the locations in the stack trace using any available source maps and replace them
with the corresponding location in the original source.

## Unit tests

Unit tests test code directly. A unit test will instantiate an application class, or call an application function, and
make assertions about the result.

Since Intern calls unit test code directly, it needs to run in the same environment as the test code itself. This
typically means running Intern in the browser to test browser-specific code, and in Node for Node code. You can get
around this limitation using mocks/fakes/stubs; for example, many browser-based projects use a virtual DOM implementation
to allow unit tests for browser code to run in a Node environment. (It’s less common to want to go the other way.)

A unit test might look like:

```ts
import Component from 'app/Component';
const { registerSuite } = intern.getPlugin('interface.object');
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

In the example above, the '#add' test instantiates a Component instance, calls a method on it, then makes an assertion
about the result. If the assertion fails, it throws an error message. The test could just as easily have done an
equality check itself:

```ts
if (comp.get('foo') !== 'bar') {
    throw new Error('not equal');
}
```

However, the assertion library will generate errors with meaningful messages automatically, which is pretty convenient.

## Page objects

"Page objects" are very useful functional testing concept. The basic idea is to define a page-level API for a page that
a test will be interacting with. For example, functional tests may need to login to a site:

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

See [Page objects](./writing_tests.md#page-objects) for more information.
