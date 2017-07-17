# API

<!-- vim-markdown-toc GFM -->
* [Executor](#executor)
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

<!-- vim-markdown-toc -->

## Executor

The executor is instance of `lib/executors/Node` or `lib/executors/Browser`. It is typically assigned to an `intern` global.

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

[registerPlugin]: #registerpluginid-callback
[getPlugin]: #getpluginname
