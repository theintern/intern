# Architecture

## Components

Intern has several major components:

* [Executors](#executors)
* [Runners](#runners)
* [Loaders](#loaders)
* [Preload scripts](#preload-scripts)
* [Interfaces](#interfaces)
* [Assertions](#assertions)
* [Reporters](#reporters)

### Executors

Executors are the core of Intern. They manage the testing process, including emitting events for test lifecycle events.
There are three main executors, each tailored to a particular runtime environment:

* **Node**: Runs unit tests in Node
* **Browser**: Runs unit tests in a browser
* **WebDriver**: Runs functional tests in Node, and runs unit tests in remote browsers

In typical usage a user will not directly load an executor. Instead, a runner script will load the executor and any
configuration data provided by the user, configure the executor, and start the testing process.

### Runners

A runner is a script that instantiates an executor, configures it, and starts the testing process. Intern provides
runners for both Node and the browser. Runners are the easiest way to get started running Intern tests, and should be
sufficient in many/most cases. More information about runners is available in [Running Intern](running.md).

### Loader

A loader is an optional script that is used by Intern’s runner scripts to set up the environment for testing, including
configuring a module loader (if necessary) and loading suites. Only a single loader script may be specified.

Loaders can be very simple; the only requirement is that the loader itself be a standalone script, not a module. For
example, the built-in ‘dojo’ loader script looks like the following:

```ts
intern.registerLoader(config => {
	const loaderConfig: any = config.loader.config || {};
	loaderConfig.baseUrl = loaderConfig.baseUrl || config.basePath;
	if (!('async' in loaderConfig)) {
		loaderConfig.async = true;
	}

	const globalObj: any = typeof window !== 'undefined' ? window : global;
	globalObj.dojoConfig = loaderConfig;

	return intern.loadScript('node_modules/dojo/dojo.js').then(() => {
		const loader = globalObj.require;
		const dfd = intern.createDeferred<void>();
		loader(config.suites, () => { dfd.resolve(); });
		return dfd.promise;
	});
});
```

If a loader isn’t specified, ‘default’ will be used. This loader uses an environment-specific default method for loading
suites in a provided suites list. This means `require` in a Node environment, or script injection in the browser. If a
user creates a fully custom runner script, a loader script will not be required.

### Preload Scripts

Preload scripts are simple scripts that are loaded before suites. These are a good place to load global scripts required
for browser tests, or to register `beforeRun` or `afterRun` event handlers.

```ts
// tests/pre.js
if (intern.environmentType === 'browser') {
    intern.on('beforeRun', function () {
	    // ...
    });
}
```

### Interfaces

An interface is a particular style of suite and test declaration. Intern comes with several built-in interfaces. For
more information, see the [Interfaces](./writing_tests.md#interfaces) section in [Writing Tests](writing_tests.md).

```ts
const { registerSuite } = intern.getInterface('object');
registerSuite({
    // ...
});
```

### Assertions

An assertion is simply a check that throws an error if the check fails. This means that no special library is required
to make assertions. However, assertion libraries can make tests easier to understand, and can automatically generate
meaningful failure messages. To that end, Intern includes the Chai assertion library, and exposes its 3 interface
(“assert”, “expect”, and “should”) using the `getInterface` method.

```ts
const assert = intern.getInterface('assert');
assert.lengthOf(someArray, 2);
```

### Reporters

Reporters are how Intern displays or outputs test results and coverage information. Since Intern is an event emitter,
anything that registers for Intern events can be a “reporter”. Classes that inherit from Reporter gain a few
conveniences. Reporter also exports a decorator that handles some of the event registration boilerplate.

## Extension points

Several components can be extended by registering new implementations:

* Reporters
* Interfaces
* Assertions
* Tunnels

In each case, Intern has a `registerX` method (e.g., `registerInterface`) that takes a name and some type-specific
item. For example, reporter constructors can be registered using the reporter constructor:

```ts
intern.registerReporter('custom', Custom);
```

Intern configs may then use the 'custom' reporter.
