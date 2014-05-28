# ディグダグ

Dig Dug is a simple abstraction library for downloading and launching WebDriver service tunnels and interacting with
the REST APIs of these services.

The following services are currently supported:

* [BrowserStack](http://www.browserstack.com)
* [Sauce Labs](http://www.saucelabs.com)
* [TestingBot](http://www.testingbot.com)

## Configuration

In many cases, the only configuration you'll need to do is provide authentication data. This can be provided by setting properties on tunnels or via environment variables. The tunnels use the following environment variables:

Tunnel class         | Environment variables
---------------------|----------------------------------------------------
`BrowserStackTunnel` | `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`
`SauceLabsTunnel`    | `SAUCE_USERNAME`, `SAUCE_ACCESS_KEY`
`TestingBotTunnel`   | `TESTINGBOT_KEY`, `TESTINGBOT_SECRET`


## Usage

To create a new tunnel, import the desired tunnel class, create a new instance, and call its `start` method. `start` returns a Promise that resolves when the tunnel has successfully started. For example, to create a new Sauce Labs tunnel:

```js
var SauceLabsTunnel = require('digdug/SauceLabsTunnel');
var tunnel = new SauceLabsTunnel();
tunnel.start().then(function () {
	// interact with the WebDriver server on tunnel.port of localhost
});
```

Once a tunnel has been started, a test runner interacts with it as described in the service's documentation. The Sauce Labs and TestingBot executables start a WebDriver server on localhost that the test client communicates with. To interact with BrowserStack, a test client will connect to `hub.browserstack.com` after the tunnel has started.

The tunnel classes also provide a `sendJobState` convenience method to let the remote service know whether a test session passed or failed. This method accepts a session ID and an object containing service-specific data, and it returns a Promise that resolves if the job state was successfully updated.

```js
tunnel.sendJobState(sessionId, { success: true });
```

When testing is finished, call the tunnel's `stop` method to cleanly shut it down. This method returns a Promise that is resolved when the service tunnel executable has exited.

```js
tunnel.stop().then(function () {
	// the tunnel has been shut down
});
```
