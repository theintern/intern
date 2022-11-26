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

Executors are the core of Intern. They manage the testing process, including
emitting events for test lifecycle events. There are two executors:

- **Node**: Runs unit tests in Node and WebDriver tests against remote browsers
- **Browser**: Runs unit tests in a browser

In typical usage a user will not directly load an executor. Instead, a runner
script will load the executor and any configuration data provided by the user,
configure the executor, and start the testing process.

Executors are event emitters, and [listening for events](api.md#on) is the
primary way to interact with the testing process. Intern provides a number of
events that user code, such as custom reporters, can listen for. The
[full list](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/events)
is available in the generated API docs.

## Runners

A runner is a script that instantiates an executor, configures it, and starts
the testing process. Intern provides runners for [Node](running.md#node) and the
[browser](running.md#browser), and a [Grunt task](running.md#grunt). Runners are
the easiest way to get started running Intern tests, and should be sufficient in
many/most cases.

## Loader

A loader is an optional script that is used by Intern to load and configure a
module loader such as SystemJS or @dojo/loader. Only a single loader script may
be specified per environment (Node or browser). The script should load and setup
a loader, and return a function that can be used to load modules. Intern
includes several built-in loader scripts, and also supports
[custom loader scripts](extending.md#loaders).

If a loader isn’t specified, ‘default’ will be used. This loader uses an
environment-specific default method for loading scripts/modules. This means
`require` in a Node environment, or script injection in the browser.

## Plugins

Plugins are scripts that provide additional functionality to Intern. They may
register values or functions that can be directly used in tests, register
callbacks that will fire at certain points in the testing process, or modify the
environment in some way (e.g., `babel-register`).

```ts
// tests/plugin.js
intern.on('beforeRun', function() {
  // ...
});
```

For more details about creating and using plugins, see
[Extending: Plugins](extending.md#plugins).

## Interfaces

An interface is a particular style of suite and test declaration. Intern comes
with several built-in interfaces. For more information, see the
[Interfaces](writing_tests.md#interfaces) section in
[Writing Tests](writing_tests.md).

Assuming a module loader is being used, interfaces can be loaded just like any
other module:

```ts
const { registerSuite } = require('intern/lib/interfaces/object');
registerSuite({
  // ...
});
```

In situations where a module loader isn’t present, Intern also makes registered
interfaces available through its plugin system:

```ts
const { registerSuite } = intern.getPlugin('interface.object');
registerSuite({
  // ...
});
```

## Reporters

Reporters are used to display or output test results and coverage information.
Since Intern is an event emitter, anything that registers for Intern events can
be a “reporter”. A reporter can be as simple as:

```ts
// myReporter.ts
intern.on('testEnd', test => {
  if (test.error) {
    console.error(`FAIL: ${test.id}`);
  } else if (test.skip) {
    console.log(`SKIP: ${test.id}`);
  } else if (test.hasPassed) {
    console.log(`PASS: ${test.id}`);
  } else {
    console.log(`NOT RUN: ${test.id}`);
  }
});
```

Intern includes a number of built-in reporters that can be enabled using the
[reporters] config option. User reporters should be loaded as normal plugins;
there is no need to use the `reporters` option.

[reporters]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fcommon%2Fconfig/reporters
