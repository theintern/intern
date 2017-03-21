# ディグダグ

[![Build Status](https://travis-ci.org/theintern/digdug.svg?branch=master)](https://travis-ci.org/theintern/digdug)
[![npm version](https://badge.fury.io/js/digdug.svg)](https://badge.fury.io/js/digdug)
[![Average time to resolve an issue](http://isitmaintained.com/badge/resolution/theintern/digdug.svg)](http://isitmaintained.com/project/theintern/digdug "Average time to resolve an issue")
[![Percentage of issues still open](http://isitmaintained.com/badge/open/theintern/digdug.svg)](http://isitmaintained.com/project/theintern/digdug "Percentage of issues still open")

Dig Dug is a simple abstraction library for downloading and launching WebDriver service tunnels and interacting with
the REST APIs of these services.

Dig Dug can run a local Selenium server, and it supports the following cloud testing services:

* [BrowserStack](http://www.browserstack.com)
* [CrossBrowserTesting](http://www.crossbrowsertesting.com)
* [Sauce Labs](http://www.saucelabs.com)
* [TestingBot](http://www.testingbot.com)

## Configuration

In many cases, the only configuration you'll need to do to create a tunnel is provide authentication data. This can be provided by setting properties on tunnels or via environment variables. The tunnels use the following environment variables:

Tunnel class                | Environment variables
----------------------------|----------------------------------------------------
`BrowserStackTunnel`        | `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`
`CrossBrowserTestingTunnel` | `CBT_USERNAME`, `CBT_APIKEY`
`SauceLabsTunnel`           | `SAUCE_USERNAME`, `SAUCE_ACCESS_KEY`
`TestingBotTunnel`          | `TESTINGBOT_KEY`, `TESTINGBOT_SECRET`

Other properties, such as the local port the tunnel should serve on or the URL of a proxy server the tunnel should go through, can be passed to a tunnel constructor or set on a tunnel instance. See the pages for [Tunnel](Tunnel.html) and the tunnel subclasses for available properties.


## Usage

To create a new tunnel, import the desired tunnel class, create a new instance, and call its `start` method. `start` returns a Promise that resolves when the tunnel has successfully started. For example, to create a new Sauce Labs tunnel:

```js
var SauceLabsTunnel = require('digdug/SauceLabsTunnel');
var tunnel = new SauceLabsTunnel();
tunnel.start().then(function () {
	// interact with the WebDriver server at tunnel.clientUrl
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

## Utilities

Dig Dug includes a utility script, `digdugEnvironmnents`. After the digdug package has been installed, run this script to get a list of environments provided by a particular testing service.

```
$ ./node_modules/.bin/digdugEnvironments SauceLabsTunnel
{"platform":"OS X 10.9","browserName":"firefox","version":"4"}
{"platform":"OS X 10.9","browserName":"firefox","version":"5"}
{"platform":"OS X 10.9","browserName":"firefox","version":"6"}
{"platform":"OS X 10.9","browserName":"firefox","version":"7"}
{"platform":"OS X 10.9","browserName":"firefox","version":"8"}
{"platform":"OS X 10.9","browserName":"firefox","version":"9"}
{"platform":"OS X 10.9","browserName":"firefox","version":"10"}
...
```

Note that BrowserStackTunnel requires that the `BROWSERSTACK_ACCESS_KEY` and `BROWSERSTACK_USERNAME` environment variables exist and are set to a user's account access key and username. The other tunnels do not (currently) require authentication to request an environment list.

## API documentation

[View API documentation](https://theintern.github.io/digdug/)

## License

Dig Dug is a JS Foundation project offered under the [New BSD](LICENSE) license.

© [SitePen, Inc.](http://sitepen.com) and its [contributors](https://github.com/theintern/digdug/graphs/contributors)
