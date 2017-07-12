# Architecture

<!-- vim-markdown-toc GFM -->
* [Executors](#executors)
* [Runners](#runners)
* [Loader](#loader)
* [Plugins](#plugins)
* [Interfaces](#interfaces)
* [Reporters](#reporters)

<!-- vim-markdown-toc -->

## Executors

Executors are the core of Intern. They manage the testing process, including emitting events for test lifecycle events. There are two executors:

* **Node**: Runs unit tests in Node and WebDriver tests against remote browsers
* **Browser**: Runs unit tests in a browser

In typical usage a user will not directly load an executor. Instead, a runner script will load the executor and any configuration data provided by the user, configure the executor, and start the testing process.

## Runners

A runner is a script that instantiates an executor, configures it, and starts the testing process. Intern provides runners for [Node](running.md#node) and the [browser](running.md#browser), and a [Grunt task](running.md#grunt). Runners are the easiest way to get started running Intern tests, and should be sufficient in many/most cases.

## Loader

A loader is an optional script that is used by Intern to load and configure a module loader. Only a single loader script may be specified per environment (Node or browser). The script should load and setup a loader, and return a function that can be used to load modules.

Loader scripts will generally be very simple; the main requirement is that the script is standalone (i.e., not a module itself). For example, the built-in ‘dojo’ loader script looks like the following:

```ts
intern.registerLoader(options => {
    const globalObj: any = typeof window !== 'undefined' ? window : global;

    options.baseUrl = options.baseUrl || intern.config.basePath;
    if (!('async' in options)) {
        options.async = true;
    }

    // Setup the loader config
    globalObj.dojoConfig = loaderConfig;

    // Load the loader using intern.loadScript, which loads simple scripts via injection
    return intern.loadScript('node_modules/dojo/dojo.js').then(() => {
        const require = globalObj.require;

        // Return a function that can be used to load modules with the loader
        return (modules: string[]) => {
            let handle: { remove(): void };

            return new Promise<void>((resolve, reject) => {
                handle = require.on('error', (error: Error) => {
                    intern.emit('error', error);
                    reject(new Error(`Dojo loader error: ${error.message}`));
                });

                // The module loader function doesn't return modules, it just loads them
                require(modules, () => { resolve(); });
            }).then(
                () => { handle.remove(); },
                error => {
                    handle && handle.remove();
                    throw error;
                }
            );
        };
    });
});
```

If a loader isn’t specified, ‘default’ will be used. This loader uses an environment-specific default method for loading scripts/modules. This means `require` in a Node environment, or script injection in the browser.

## Plugins

Plugins are scripts that are loaded after the loader, but before suites. These are a good place to load global scripts required for browser tests, or to register `beforeRun` or `afterRun` event handlers.

```ts
// tests/plugin.js
intern.registerPlugin('foo', function () {
    intern.on('beforeRun', function () {
        // ...
    });
});
```

Plugins can register resources for use in tests with the `registerPlugin` method. Intern will resolve and store the return value of `registerPlugin`; tests can retrieve it by calling `intern.getPlugin('foo')`.

The `registerPlugin` method can also be used simply for asynchronous initialization. If a Promise is returned, Intern will wait for it to rseolve before proceeding.

When loading a plugin via a configuration property (e.g., `"plugins"` in a config file) without a module loader, the call to `registerPlugin` must be made synchronously. In other words, a plugin generally shouldn’t do this:

```ts
// tests/plugin.js
System.import('some_module').then(function (module) {
    intern.registerPlugin('foo', function () {
        return module;
    });
});
```

Instead, do this:

```ts
// tests/plugin.js
intern.registerPlugin('foo', function () {
    return System.import('some_module');
});
```

Plugins can be accessed in suites or other user code using the `getPlugin` method.

```ts
const { registerSuite } = intern.getPlugin('interface.object');
```

## Interfaces

An interface is a particular style of suite and test declaration. Intern comes with several built-in interfaces. For more information, see the [Interfaces](./writing_tests.md#interfaces) section in [Writing Tests](writing_tests.md).

Assuming a module loader is being used, interfaces can be loaded just like any other module:

```ts
const { registerSuite } = require('intern/lib/interfaces/object');
registerSuite({
    // ...
});
```

In situations where a module loader isn’t present, Intern also makes registered interfaces available through its plugin system:

```ts
const { registerSuite } = intern.getPlugin('interface.object');
registerSuite({
    // ...
});
```

## Reporters

Reporters are how Intern displays or outputs test results and coverage information. Since Intern is an event emitter, anything that registers for Intern events can be a “reporter”.

Intern includes a Reporter base class that provides several convenience features, such as the ability to mark event handler methods with a decorator (assuming you’re using TypeScript) in a type-safe manner.

```ts
import Reporter, { eventHandler } from 'intern/lib/reporters/Reporter';

class MyReporter extends Reporter {
    @eventHandler()
    runEnd() {
        console.log('Testing is done!');
    }

    @eventHandler()
    suiteStart(suite: Suite) {
        console.log(`Suite ${suite.id} started`);
    }
}
```
