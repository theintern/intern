# Extending

<!-- vim-markdown-toc GFM -->
* [Types of extension](#types-of-extension)
    * [Plugins](#plugins)
    * [Reporters](#reporters)
    * [Interfaces](#interfaces)
    * [Pre- and post-test code](#pre--and-post-test-code)
* [Loading extensions](#loading-extensions)
    * [require](#require)
    * [plugins](#plugins-1)

<!-- vim-markdown-toc -->

Intern provides several extension points.

## Types of extension

There are a few general classes of Intern extension.

### Plugins

Plugins are extensions that provide some type of reusable functionality. For example, a plugin that provided tests with access to a MongoDB database might look like:

```js
intern.registerPlugin('dbaccess', async (options) => {
    const connect = promisify(MongoClient.connect);
    const db = await connect(options.dbUrl);
    return { db };
});
```

Within a suite, the plugin would be accessed like:

```js
const { db } = intern.getPlugin('dbaccess');
```

### Reporters

Reporters are simply event listeners that register for Intern [events](./api.md#oneventname-callback)). For example, a reporter that displays test results to the console could be as simple as:

```js
intern.on('testEnd', test => {
    if (test.skipped) {
        console.log(`${test.id} skipped`);
    }
    else if (test.error) {
        console.log(`${test.id} failed`);
    }
    else {
        console.log(`${test.id} passed`);
    }
});
```

Intern provides a number of pre-registered reporters that can be enabled via the [`reporters`](./configuration.md#reporters) config option.

### Interfaces

An interface is an API for registering test suites. Intern has several built in interfaces, such as [object](./writing_tests.md#object) and [bdd](./writing_tests.md#bdd). These interfaces all work by creating [Suite](./api.md#suite) and [Test](./api.md#test) objects and registering them with Intern’s root suite(s). New interfaces should follow the same pattern. For example, below is an excerpt from the tdd interface, which allows suites to be registered using `suite` and `test` functions:

```js
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
	}
	else {
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

### Pre- and post-test code

Code that needs to run before or after the testing process can run in 'beforeRun' or 'afterRun' event listeners:

```js
intern.on('beforeRun', () => {
    // code
});
```

As with all Intern event listeners the callback may run asynchronous code. Async callbacks should return a Promise that resolves when the async code has completed.

## Loading extensions

There are two main ways to load extensions: the `require` and `plugins` config properties.

### require

Scripts loaded using the [`require`](./configuration.md#require) config property are the most basic type of extension. These are simply scripts that are run before a loader, plugins, or test suites, using the environment’s native script loading mechanism (`require` in Node, script injection in the browser). This means that in the browser these scripts must be self-contained (in Node they can make use of Node’s module loader). The code in these scripts must also be synchronous.

### plugins

Another way to load scripts is using the [`plugins`](./configuration.md#plugins) config property. There are three key differences between scripts loaded via `plugins` versus those loaded with `require`:

* Plugins are loaded with a module loader (if one is being used)
* Plugins can be configured
* Plugins support asynchronous initialization
