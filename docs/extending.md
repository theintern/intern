# Extending

<!-- vim-markdown-toc GFM -->

* [Types of extension](#types-of-extension)
    * [Plugins](#plugins)
    * [Reporters](#reporters)
    * [Interfaces](#interfaces)
    * [Pre- and post-test code](#pre--and-post-test-code)
* [Loading extensions](#loading-extensions)

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

As the example above indicates, plugin initialization code may be asynchronous.

### Reporters

Reporters are simply event listeners that register for Intern [events]. For example, a reporter that displays test results to the console could be as simple as:

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

Intern provides several built-in reporters that can be enabled via the [reporters] config option.

### Interfaces

An interface is an API for registering test suites. Intern has several built in interfaces, such as [object](./writing_tests.md#object) and [bdd](./writing_tests.md#bdd). These interfaces all work by creating [Suite] and [Test] objects and registering them with Intern’s root suite(s). New interfaces should follow the same pattern. For example, below is an excerpt from the [tdd] interface, which allows suites to be registered using `suite` and `test` functions:

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

Extensions are loaded using the [plugins] config property. Plugins may provide actual Intern plugins by calling `registerPlugin`, or they may be standalone scripts that affect the JavaScript environment, like `babel-register`. By default, scripts listed in `plugins` will be loaded before an external loader, using the platform native loading mechanism. Plugins can be marked as requiring the external loader with a `useLoader` property.

```js
{
    "loader": "dojo2",
    "plugins": [
        "node_modules/babel-register/lib/node.js",
        {
            "script": "tests/support/dojoMocking.js",
            "useLoader": true
        },
        {
            "script": "tests/support/mongodbAccess.js",
            "options": { "dbUrl": "https://testdb.local" }
        }
    ]
}
```

[events]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/events
[plugins]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/plugins
[reporters]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/reporters
[Suite]: https://theintern.io/docs.html#Intern/4/api/lib%2FSuite
[Test]: https://theintern.io/docs.html#Intern/4/api/lib%2FTest
[tdd]: https://theintern.io/docs.html#Intern/4/api/lib%2Finterfaces%2Ftdd
