# Extending

<!-- vim-markdown-toc GFM -->

* [Plugins](#plugins)
    * [Reporters](#reporters)
    * [Interfaces](#interfaces)
    * [Pre- and post-test code](#pre--and-post-test-code)
* [Loading extensions](#loading-extensions)

<!-- vim-markdown-toc -->

Intern‘s functionality can be extended using user scripts and third party
libraries.

## Plugins

Plugins are the standard cross-environment way to add functionality to Intern. A
plugin registers resources with Intern, and suites may request and use these
resources. For example, a plugin that provided tests with access to a MongoDB
database might look like:

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

The main benefit to the plugin mechanism is that it is universal — it works in
both Node and the browser. If Intern is only being used in a Node environment,
extension code can be written as Node modules and loaded in suites using
`import` or `require`.

The plugin mechanism may be used to implement a variety of Intern extensions.

### Reporters

Reporters are simply plugins that register for Intern [events]. For example, a
reporter that displays test results to the console could be as simple as:

```ts
// myReporter.ts
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

Intern provides several built-in reporters that can be enabled via the
[reporters] config option. User/custom reporters can simply register for Intern
events; they do not need to use the `reporters` config property.

### Interfaces

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

### Pre- and post-test code

Code that needs to run before or after the testing process can run in
'beforeRun' or 'afterRun' event listeners:

```ts
intern.on('beforeRun', () => {
    // code
});
```

As with all Intern event listeners the callback may run asynchronous code. Async
callbacks should return a Promise that resolves when the async code has
completed.

## Loading extensions

Extensions are loaded using the [plugins] config property. Both user scripts and
standalone third-party scripts, like `babel-register`, may be loaded this way.
By default, scripts listed in `plugins` will be loaded before an external
loader, using the platform native loading mechanism. Plugins can be marked as
requiring the external loader with a `useLoader` property.

```json5
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
[suite]: https://theintern.io/docs.html#Intern/4/api/lib%2FSuite
[test]: https://theintern.io/docs.html#Intern/4/api/lib%2FTest
[tdd]: https://theintern.io/docs.html#Intern/4/api/lib%2Finterfaces%2Ftdd
