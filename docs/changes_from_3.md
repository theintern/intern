# Changes from Intern 3

<!-- vim-markdown-toc GFM -->

* [TypeScript everywhere](#typescript-everywhere)
* [No more AMD](#no-more-amd)
* [Configuration](#configuration)
* [Code coverage](#code-coverage)
* [Interfaces](#interfaces)
    * [Object interface](#object-interface)
    * [QUnit interface](#qunit-interface)
    * [Loading interfaces](#loading-interfaces)
* [Execution](#execution)

<!-- vim-markdown-toc -->

This page summarizes the main changes between Intern 3 and Intern 4.

## TypeScript everywhere

Intern has been entirely rewritten in TypeScript. This significantly improves maintainability and makes contributing code to Intern easier. It also improves Intern’s usability in TypeScript projects.

## No more AMD

Intern 3 was based around AMD modules. Intern itself was written as a set of AMD modules, and it assumed test suites would also be written this way. Intern 4 doesn’t assume the presence of any external loader. In Node it uses the native `require` mechanism, and Intern’s browser client is a monolithic webpack bundle that includes all the code necessary to run Intern.

Intern hasn’t abandoned AMD, though. It supports [loader] scripts that allow suites and application modules to be loaded with external loaders such as the Dojo loader. Intern includes scripts for the Dojo 1, Dojo 2, and SystemJS loaders, as well as for ESM modules in the browser, and creating custom loader scripts is relatively simple.

## Configuration

Intern is now configured using a [declarative JSON file](configuration.md#config-file) rather than an executable module. The default location for the config file is `intern.json` in the project root. Intern looks for a config file in this location by default, so the `config` argument on the command line or to the browser client is now optional.

Many of the config properties have the same names and take the same values as Intern 3, but they will often accept a wider range of values. For example, while `environments` is still canonically an array of environment descriptors, the `environments` config option can simply be a browser name.

```js
{
    "environments": "chrome"
}
```

## Code coverage

Code coverage in Intern 3 was enabled by default for all files loaded during the testing process. The `excludeInstrumentation` option was used to control which files were instrumented; it was a regular expression that matched files that _shouldn’t_ be covered. Instrumentation could be disabled by setting `excludeInstrumentation` to `false`.

In Intern 4, coverage is opt in; only files that match glob patterns in the [coverage] config property will be instrumented. Setting `coverage` to `false` will still completely disable code coverage instrumentation.

## Interfaces

Both the object interface and the standard way to load interfaces have changed.

### Object interface

The object testing interface API has changed in Intern 4. Intern 3’s object interface takes a single object that contains both Suite properties and tests:

```js
registerSuite({
    name: 'lib/Server',

    beforeEach() {
        // Test setup
    },

    test1() {
        // Test code
    },

    test2() {
        // Test code
    }
});
```

In Intern 4, `registerSuite` takes a name property as its first argument, and a suite descriptor object as its second. The descriptor object has two possible formats: it can contain only suite properties (including a `tests` property), or only tests. The first format is used when a suite needs lifecycle methods or other properties to be specified, while the second can be used when a suite contains only tests. Intern decides what format the object has based on the presence of a `tests` property.

```js
// Only suite properties
registerSuite('lib/Server', {
    beforeEach() {
    },

    tests: {
        test1() {
        },

        test2() {
        }
    }
});


// Only tests
registerSuite('lib/Server', {
    test1() {
    },

    test2() {
    }
});
```

### QUnit interface

The QUnit interface has been removed from the core Intern package and is being updated and re-implemented as an Intern plugin.

### Loading interfaces

In Intern 3, interfaces were typically loaded using an AMD loader plugin:

```js
define([ 'intern!object' ], function (registerSuite) { ... });
```

Intern 4 provides two ways to load an interface. The method that will work in all environments, whether or not an external loader is available, is to use the `getInterface` method on the global Intern object:

```js
const { registerSuite } = intern.getInterface('object');
```

The other method, which requires a loader (so will not work in the browser by default), is to import the interface module directly:

```js
import registerSuite from 'intern/lib/interfaces/object';
```

## Execution

Intern 3 had two Node runner scripts: `intern-client` and `intern-runner`. The ‘client’ script was used to run unit tests in Node, while the ‘runner’ script was used to run WebDriver tests. Intern 4 has only a single runner script, [intern](running.md#node), which handles both types of test. When this script is run, it determines what tests to execute based on the current configuration. If the configuration has suites in `suites` and has 'node' as one of its environments ('node' is also assumed if no environments are specified), Intern will run unit tests in Node. If a config has values in `suites` or `functionalSuites`, and if any remote environments are specified, Intern will run tests in those remote environments using WebDriver.

The [browser client](running.md#browser) still exists, but is now `index.html` in the Intern package, making it slightly easier to load. Assuming the test [config file](#configuration) is in the default location and the user’s project is being served by a static server (say, on port 8080), the browser client could be invoked by browsing to `http://localhost:8080/node_modules/intern/`.

Intern 4 also supports programmatic execution. Node code can simply import `intern`, configure the executor, and start testing:

```js
import intern from 'intern';
intern.configure({ suites: 'tests/unit/**/*.js' });
intern.run();
```

Programmatically running Intern in the browser works similarly, and even supports globs when used with Intern’s [static test server](running.md#browser):

```html
<script src="node_modules/intern/browser/intern.js"></script>
<script>
    intern.configure({ suites: 'tests/unit/**/*.js' });
    intern.run();
</script>
```

[coverage]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/coverage
[loader]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/loader
