# Extending

<!-- vim-markdown-toc GFM -->

* [The plugin mechanism](#the-plugin-mechanism)
* [Pre- and post-test code](#pre--and-post-test-code)
* [Reporters](#reporters)
* [Interfaces](#interfaces)
* [Loaders](#loaders)

<!-- vim-markdown-toc -->

Intern‘s functionality can be extended using user scripts and third party
libraries.

## The plugin mechanism

The “plugin” mechanism is a cross-environment method for adding functionality to
Intern. [Plugins](architecture.md#plugins) are registered using the
[plugins](configuration.md#configuring-plugins) config property and loaded by
Intern using an environment’s native code loading mechanism: `require` in Node
and script injection in the browser. If an external loader has been configured
using the `loader` property, plugins can be marked to use the loader with a
`useLoader` property.

A plugin can register resources with Intern that may be used in tests and
suites, or it can also alter Intern’s functionality in some way, or even modify
the environment itself.

For example, a plugin that provided tests with access to a MongoDB database
might look like:

```ts
intern.registerPlugin('dbaccess', async options => {
  const connect = promisify(MongoClient.connect);
  const db = await connect(options.dbUrl);
  return { db };
});
```

Within a suite, the plugin would be accessed like:

```ts
const { db } = intern.getPlugin('dbaccess');
```

A third party script such as `ts-node/register` may also be loaded as a plugin.
For example, loading `ts-node/register` as a plugin will allow Intern to load
TypeScript modules directly (in Node only):

```json5
{
  plugins: 'node_modules/ts-node/register/index.js'
}
```

> 💡The plugin registration mechanism (`registerPlugin`) isn’t necessary in
> environments with modules loaders since tests may load extension code using
> standard loader mechanisms (e.g., `require`). It is most useful for
> environments where a module loader may not be present, such as when testing
> legacy code in a browser.

> ⚠️When loading a plugin without a module loader, the call to `registerPlugin`
> must be synchronous.

Note that when loading a plugin without a module loader, the call to
`registerPlugin` must be made synchronously. In other words, a plugin generally
shouldn’t do this:

```ts
// tests/plugin.js
System.import('some_module').then(function(module) {
  intern.registerPlugin('foo', function() {
    return module;
  });
});
```

Instead, do this:

```ts
// tests/plugin.js
intern.registerPlugin('foo', function() {
  return System.import('some_module');
});
```

## Pre- and post-test code

Code that needs to run before or after the testing process can run in
[beforeRun] or [afterRun] event listeners:

```ts
// tests/setup.ts
intern.on('beforeRun', () => {
  // code
});
```

To load this module using ts-node:

```json5
{
  plugins: ['node_modules/ts-node/register/index.js', 'tests/setup.ts']
}
```

As with all Intern event listeners the callback may run asynchronous code. Async
callbacks should return a Promise that resolves when the async code has
completed.

## Reporters

Reporters are code that registers for Intern [events]. For example, a reporter
that displays test results to the console could be as simple as:

```ts
// tests/myReporter.ts
intern.on('testEnd', test => {
  if (test.skipped) {
    console.log(`${test.id} skipped`);
  } else if (test.error) {
    console.log(`${test.id} failed`);
  } else {
    console.log(`${test.id} passed`);
  }
});
```

If the reporter needs a bit more config, or needs to take some async action
during initialization, it can use the `registerPlugin` mechanism:

```ts
intern.registerPlugin('myReporter', options => {
  return fetch(options.template).then(templateSource => {
    const template = JSON.parse(templateSource);
    intern.on('testEnd', test => {
      if (test.skipped) {
        console.log(template.skipped.replace(/{test}/, test.id));
      } else if (test.error) {
        console.log(template.error.replace(/{test}/, test.id));
      } else {
        console.log(template.passed.replace(/{test}/, test.id));
      }
    });
  });
});
```

Load the reporter as a plugin:

```json5
{
  plugins: '_build/tests/myReporter.js'
}
```

If a reporter takes options, they can be passed through an `options` property on
a plugin descriptor:

```json5
{
  plugins: {
    script: '_build/tests/myReporter.js',
    options: {
      filename: 'report.txt'
    }
  }
}
```

Intern provides several built-in reporters that can be enabled via the
[reporters] config option. User/custom reporters can simply register for Intern
events; they do not need to use the `reporters` config property.

## Interfaces

An interface is an API for registering test suites. Intern has several built in
interfaces, such as [object](writing_tests.md#object) and
[bdd](writing_tests.md#bdd). These interfaces all work by creating [Suite] and
[Test] objects and registering them with Intern’s root suite(s). New interfaces
should follow the same pattern. For example, below is an excerpt from the [tdd]
interface, which allows suites to be registered using `suite` and `test`
functions:

```ts
import Suite from '../Suite';
import Test from '../Test';
import intern from '../../intern';

let currentSuite;

export function suite(name, factory) {
  if (!currentSuite) {
    executor.addSuite(parent => {
      currentSuite = parent;
      registerSuite(name, factory);
      currentSuite = null;
    });
  } else {
    registerSuite(name, factory);
  }
}

export function test(name, test) {
  if (!currentSuite) {
    throw new Error('A test must be declared within a suite');
  }
  currentSuite.add(new Test({ name, test }));
}

function registerSuite(name, factory) {
  const parent = currentSuite!;
  currentSuite = new Suite({ name, parent });
  parent.add(currentSuite);
  factory(currentSuite);
  currentSuite = parent;
}
```

An interface plugin would define and register its interface methods:

```ts
// myInterface.ts
intern.registerPlugin('myInterface', async options => {
    function suite(...) {
    }

    function test(...) {
    }

    return { suite, test };
});

// someSuite.ts
const { suite, test } = intern.getPlugin('myInterface');

suite('foo', () => {
    test('test1', () => {
        ...
    });
});
```

## Loaders

Loader scripts will generally be very simple; the main requirement is that the
script is standalone (i.e., not a module itself). For example, the built-in
‘dojo’ loader script looks like the following:

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
        require(modules, () => {
          resolve();
        });
      }).then(
        () => {
          handle.remove();
        },
        error => {
          handle && handle.remove();
          throw error;
        }
      );
    };
  });
});
```

See [configuring loaders](configuration.md#configuring-loaders) for more
information about how to load and pass options to a custom loader.

[afterrun]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/afterrun
[beforerun]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/beforerun
[events]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/events
[plugins]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/plugins
[reporters]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/reporters
[suite]: https://theintern.io/docs.html#Intern/4/api/lib%2FSuite
[test]: https://theintern.io/docs.html#Intern/4/api/lib%2FTest
[tdd]: https://theintern.io/docs.html#Intern/4/api/lib%2Finterfaces%2Ftdd
