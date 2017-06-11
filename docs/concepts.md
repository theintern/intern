# Concepts and Definitions

<!-- vim-markdown-toc GFM -->
* [Assertions](#assertions)
* [Code coverage](#code-coverage)
* [Functional tests](#functional-tests)
* [Source maps](#source-maps)
* [Unit tests](#unit-tests)

<!-- vim-markdown-toc -->

## Assertions

An assertion is simply a check that throws an error if the check fails. This means that no special library is required
to make assertions. However, assertion libraries can make tests easier to understand, and can automatically generate
meaningful failure messages. To that end, Intern includes the [Chai](https://chaijs.com) assertion library, and exposes
its 3 interfaces (“assert”, “expect”, and “should”) as [plugins](architecture.md#plugins).

## Code coverage

Code coverage is information about what parts of the application code are exercised during tests. It commonly indicates
what percentages of statements, branches, and functions are executed. Code coverage information is gathered by
“instrumenting” the code being tested. This instrumentation records information about the executing code. After tests
are complete, this information is retrieved and collated into a report.

Intern uses [Istanbul](https://github.com/istanbuljs/istanbuljs) to manage code coverage. There are a couple of config
properties related to instrumentation. Probably the mostly commonly used one is
[`excludeInstrumentation`](configuration.md#excludeinstrumentation).

## Functional tests

Also known as WebDriver tests (after the [W3C standard](https://www.w3.org/TR/webdriver/)), functional tests test code
indirectly. While a unit test calls application functions and examines return values, a functional test manipulates the
code in the same way a typical user might, by opening pages, clicking buttons, and filling in form fields.

Functional tests in Intern typically use the Leadfoot WebDriver library to control remote browsers. A functional test
might look like:

```ts
const { registerSuite } = intern.getPlugin('interface.object');
const assert = intern.getPlugin('chai.assert');
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
remote browser, Intern will lookup the locations in the stack trace using any available source maps and replace them
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
const assert = intern.getPlugin('chai.assert');
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

