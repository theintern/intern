# API

<!-- vim-markdown-toc GFM -->
* [Executor](#executor)
    * [.addSuite((parent) => void)](#addsuiteparent--void)
    * [.configure(options)](#configureoptions)
    * [.emit(name, data)](#emitname-data)
    * [.getInterface(name)](#getinterfacename)
    * [.getPlugin(name)](#getpluginname)
    * [.getReporter(name)](#getreportername)
    * [.log(arg...)](#logarg)
    * [.on(eventName, callback)](#oneventname-callback)
    * [.registerInterface(name, interface)](#registerinterfacename-interface)
    * [.registerLoader(callback)](#registerloadercallback)
    * [.registerPlugin(id, callback)](#registerpluginid-callback)
    * [.registerReporter(name, Reporter)](#registerreportername-reporter)
    * [.run()](#run)
* [Suite](#suite)
    * [.skip(message)](#skipmessage)
* [Test](#test)
    * [.async(timeout, numCallsUntilResolution)](#asynctimeout-numcallsuntilresolution)
    * [.skip(message)](#skipmessage-1)

<!-- vim-markdown-toc -->

## Executor

The executor is instance of `lib/executors/Node` or `lib/executors/Browser`. It is typically assigned to an `intern` global.

### .addSuite((parent) => void)

Add a suite to the executor’s root suite. The `addSuite` method is passed a callback that takes a single argument, a parent suite. The callback will add whatever it needs to (one or more suites or tests) to the given suite using `Suite.add`.

```ts
intern.addSuite(parent => {
    const suite = new Suite({
        name: 'create new',
        tests: [ new Test({ name: 'new test', test: () => assert.doesNotThrow(() => new Component()) }) ]
    });
    parent.add(suite);
});
```

### .configure(options)

Configure the executor with an object containing [config properties](configuration.md#properties).

### .emit(name, data)

Emit an event. All listeners registered for the given event, and all listeners registered for all events, will be notified and given the event data.

### .getInterface(name)

A convenience method for retrieving test interfaces. This method calls [getPlugin] behind the scenes using the name `interface.${name}`.

### .getPlugin(name)

Retrieve a plugin. If no plugin named `name` has been registered, an error will be thrown.

### .getReporter(name)

A convenience method for retrieving reporter constructors. This method calls [getPlugin] behind the scenes using then name `reporter.${name}`.

### .log(arg...)

This is a convenience method for emitting log messages when [`config.debug`](./configuration.md#debug) is true. When `config.debug` is false, this method does nothing.

### .on(eventName, callback)

Register to be notified of executor events. The callback will be called with a single data argument:

```ts
intern.on('error', error => {
    console.log('An error occurred:', error);
});
```

Current events are:

| Event                  | Data               | Description
| :----                  | :---               | :----------
| afterRun               | none               | All tests have finished
| beforeRun              | none               | Tests are about to start
| coverage               | CoverageMessage    | Coverage data was collected
| deprecated             | DeprecationMessage | A deprecated method was called
| error                  | Error              | An error occured
| log                    | string             | A debug log message
| runEnd                 | none               | The testing process has finished
| runStart               | none               | The testing process has started
| serverEnd              | Server             | The testing server has stopped
| serverStart            | Server             | The testing server has started
| suiteAdd               | Suite              | A new suite was added to the set that will be run
| suiteEnd               | Suite              | A suite ended
| suiteStart             | Suite              | A suite started
| testAdd                | Test               | A new test was added to the set that will be run
| testEnd                | Test               | A test ended
| testStart              | Test               | A test started
| tunnelDownloadProgress | TunnelMessage      | Tunnel application data was downloaded
| tunnelStart            | TunnelMessage      | The tunnel has started
| tunnelStatus           | TunnelMessage      | Tunnel status has changed
| tunnelStop             | TunnelMessage      | The tunnel has stopped
| warning                | string             | A non-fatal error occurred

A listener can be notified of all events by registering for the '*' event, or by calling `on` with only a callback:

```ts
intern.on(event => {
    console.log(`An ${event.name} event occurred:`, event.data);
});
```

Note that some events are executor-specific. For example, the Browser executor will never emit a `tunnelStop` message.

### .registerInterface(name, interface)

A convenience method for registering test interfaces. This method calls [registerPlugin] behind the scenes using the name `interface.${name}`.

### .registerLoader(callback)

Register a module loader. The callback should accept an options object and return a function that can load modules.

```ts
intern.registerLoader(options: any => {
    // Register loader can return a Promise if it needs to load something itself
    return intern.loadScript('some/loader.js').then(() => {
        loader.config(options);
        // Return a function that takes a list of modules and returns a Promise that
        // resolves when they've been loaded.
        return (modules: string[]) => {
            return loader.load(modules);
        });
    });
});
```

### .registerPlugin(id, callback)

Register a plugin loader. The callback may return a Promise if the plugin needs to do some asynchronous initialization. If the plugin is being loaded via the `config.plugins` property, it's init callback will be passed any configured options. The resolved return value of the callback will be returned by [getPlugin].

```ts
intern.registerPlugin('foo', (options: any) => {
    return {
        doSomething() {
            // ...
        },
        doSomethingElse() {
            // ...
        }
    };
});
```

Code would use the plugin by calling [getPlugin]:

```ts
const { doSomething, doSomethingElse } = intern.getPlugin('foo');
doSomething();
```

### .registerReporter(name, Reporter)

A convenience method for registering reporter constructors. This method calls [registerPlugin] behind the scenes using the name `reporter.${name}`.

### .run()

Run the executor. This will resolve the config, load a configured loader, plugins, and suites, download and initialize a WebDriver tunnel (if configured), and start the testing process.

## Suite

### .skip(message)

Calling this function will cause all remaining tests in the suite to be skipped. If a message was provided, a reporter may report the suite’s tests as skipped. Skipped tests are not treated as passing or failing.

If this method is called from a test function (as `this.parent.skip()`), the test will be immediately halted, just as if the test’s own [skip](#skipmessage-1) method were called.

## Test

### .async(timeout, numCallsUntilResolution)

This function, when called from within a test, will alert Intern that the test is asynchronous, and also allows the timeout for the test to be adjusted.

The return value of the `async` function is a Deferred object. This object has the following properties:

| Property/method     | Description                                                                                                                     |
| :-------            | :----------                                                                                                                     |
| callback(func)      | Returns a function that, when called, resolves the Deferred if func does not throw an error, or rejects the Promise if it does. |
| promise             | A Promise-like object that resolves or rejects with the Deferred                                                                |
| reject(error)       | Rejects the Deferred. The error will be used when reporting the test failure.                                                   |
| rejectOnError(func) | Returns a function that, when called, rejects the Deferred if func throws. If func does not throw, the function does nothing.   |
| resolve(value)      | Resolves the deferred. The resolved value, if any, is not used by Intern.                                                       |

The optional `numCallsUntilResolution` argument to `async` affects how the `callback` method operates. By default, the Deferred is resolved (assuming it hasn’t already been rejected) the first time the function returned by `callback` is called. If `numCallsUntilResolution` is set (it must be a value > 0), the function returned by `callback` must be called `numCallsUntilResolution` times before the Deferred resolves.

### .skip(message)

Calling this function will cause a test to halt immediately. If a message was provided, a reporter may report the test as skipped. Skipped tests are not treated as passing or failing.

[registerPlugin]: #registerpluginid-callback
[getPlugin]: #getpluginname
