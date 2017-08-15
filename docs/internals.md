# Internals

<!-- vim-markdown-toc GFM -->
* [The Suite object](#the-suite-object)
* [The Test object](#the-test-object)
* [The BenchmarkTest object](#the-benchmarktest-object)

<!-- vim-markdown-toc -->

## The Suite object

The [Suite object](https://github.com/theintern/intern/blob/3.4/lib/Suite.js) represents a logical grouping of tests within a test run. When inside a setup (a.k.a. “before”), beforeEach, afterEach, or teardown (a.k.a. “after”) method, the `this` object will be the Suite object that represents that suite.

The following properties and methods are available on all Suite objects:

| Property                                              | Description                                                                                                                                                                                                                                                                                                                                                                      |
|-------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| error                                                 | An Error object containing any error thrown from one of the suite lifecycle methods.                                                                                                                                                                                                                                                                                             |
| grep                                                  | A RegExp that will be used to skip tests. This value will be inherited from the parent suite. See the [grep configuration option](https://theintern.github.io/intern/#option-grep) for more information.                                                                                                                                                                         |
| id                                                    | The unique identifier string for this suite. This property is read-only.                                                                                                                                                                                                                                                                                                         |
| name                                                  | A string representing the human-readable name of the suite.                                                                                                                                                                                                                                                                                                                      |
| numTests                                              | The total number of tests registered in this suite and its sub-suites. (To get just the number of tests for this suite, use `tests.length`.)                                                                                                                                                                                                                                     |
| numFailedTests                                        | The number of failed tests in this suite and its sub-suites.                                                                                                                                                                                                                                                                                                                     |
| numSkippedTests                                       | The number of skipped tests in this suite and its sub-suites.                                                                                                                                                                                                                                                                                                                    |
| parent                                                | The parent suite, if this suite is a sub-suite. This property will be `null` for unit tests that have been sent from a client back to the test runner.                                                                                                                                                                                                                           |
| publishAfterSetup                                     | When set to `false` (the default), the suiteStart event is sent before the setup method runs and the suiteEnd event is sent after the teardown method has finished running. Setting this value to `true` flips when the suiteStart and suiteEnd events are sent to reporters so suiteStart is sent *after* setup is finished and suiteEnd is sent *before* teardown is finished. |
| remote                                                | A [Leadfoot Command object](https://theintern.github.io/leadfoot/module-leadfoot_Command.html) that can be used to drive a remote environment. This value will be inherited from the parent suite. Only available to suites that are loaded from [functionalSuites](https://theintern.github.io/intern/#option-functionalSuites).                                                |
| reporterManager <span class="versionBadge">3.0</span> | The event hub that can be used to send result data and other information to [reporters](https://theintern.github.io/intern/#reporter-overview). This value will be inherited from the parent suite.                                                                                                                                                                              |
| sessionId                                             | A unique identifier for a remote environment session. This value will be inherited from the parent suite. Only available to suites that are loaded from [functionalSuites](https://theintern.github.io/intern/#option-functionalSuites).                                                                                                                                         |
| timeElapsed                                           | Time, in milliseconds, that the suite took to execute. Only available once all tests in the suite have finished running.                                                                                                                                                                                                                                                         |
| tests                                                 | An array of Test or Suite objects. Push more tests/suites onto this object before a test run begins to populate the test system with tests. The behaviour of adding tests after a test run has begun is undefined.                                                                                                                                                               |

<table>
<thead>
<tr class="header">
<th>Method</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>afterEach(test: Test <span class="versionBadge">3.0</span>):<br />
  Promise&lt;void&gt;</td>
<td>A function which will be executed after each test in the suite, including nested, skipped, and failed tests. If a Promise is returned, the suite will wait until the Promise is resolved before continuing. If the Promise rejects, the test will be considered failed and the error from the Promise will be used as the error for the Test.</td>
</tr>
<tr class="even">
<td>afterEachLoop(test: Test):<br />
  Promise&lt;void&gt; <span class="versionBadge">3.4</span></td>
<td>A function added to suites of BenchmarkTests that will be executed after each execution of the test function during a benchmarking run.</td>
</tr>
<tr class="odd">
<td>beforeEach(test: Test <span class="versionBadge">3.0</span>):<br />
  Promise&lt;void&gt;</td>
<td>A function which will be executed before each test in the suite, including nested tests. If a Promise is returned, the suite will wait until the Promise is resolved before continuing. If the Promise rejects, the test will be considered failed and the error from the Promise will be used as the error for the Test.</td>
</tr>
<tr class="even">
<td>beforeEachLoop(test: Test):<br />
  Promise&lt;void&gt; <span class="versionBadge">3.4</span></td>
<td>A function added to suites of BenchmarkTests that will be executed before each execution of the test function during a benchmarking run.</td>
</tr>
<tr class="odd">
<td>run(): Promise&lt;number&gt;</td>
<td>Runs the test suite. Returns a Promise that resolves to the number of failed tests after all tests in the suite have finished running.</td>
</tr>
<tr class="even">
<td>setup(): Promise&lt;void&gt;</td>
<td>A function which will be executed once when the suite starts running. If a Promise is returned, the suite will wait until the Promise is resolved before continuing. If the Promise rejects, the suite will be considered failed and the error from the Promise will be used as the error for the Suite.</td>
</tr>
<tr class="odd">
<td>teardown(): Promise&lt;void&gt;</td>
<td>A function which will be executed once after all tests in the suite have finished running. If a Promise is returned, the suite will wait until the Promise is resolved before continuing. If the Promise rejects, the suite will be considered failed and the error from the Promise will be used as the error for the Suite.</td>
</tr>
<tr class="even">
<td>toJSON(): Object</td>
<td>Returns an object that can be safely serialised to JSON. This method normally does not need to be called directly; <code>JSON.stringify</code> will use the <code>toJSON</code> method automatically if you try to serialise the Suite object.</td>
</tr>
</tbody>
</table>

<span class="versionBadge">3.1</span> Within the lifecycle methods (`setup/before`, `beforeEach`, `afterEach`, `teardown/after`), an `async` method is available that can be used in lieu of returning a Promise. For example:

    setup: function () {
      var dfd = this.async(1000); 
      fs.readFile(filename, function (data) {
        testData = data;
        dfd.resolve();
      });
    }

`async` returns an augmented Deferred object (see [asynchronous tests](https://theintern.github.io/intern/#async-tests) for more information). The lifecycle method in which `async` was called will wait for the Deferred to resolve, just as if a Promise were returned. The main difference between using the `async` method and returning a Promise is that `async` allows the method’s timeout to be configured with an optional number of milliseconds.

## The Test object

The [Test object](https://github.com/theintern/intern/blob/3.4/lib/Test.js) represents a single test within a test run. When inside a test function, the `this` object will be the Test object that represents that test.

The following properties and methods are available on all Test objects:

| Property                                              | Description                                                                                                                                                                                                                                                                                                                       |
|-------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| error                                                 | If a test fails, the error that caused the failure will be available here.                                                                                                                                                                                                                                                        |
| id                                                    | The unique identifier string for this test. This property is read-only.                                                                                                                                                                                                                                                           |
| isAsync                                               | A flag representing whether or not this test is asynchronous. This flag will not be set until the test function actually runs.                                                                                                                                                                                                    |
| name                                                  | A string representing the human-readable name of the suite.                                                                                                                                                                                                                                                                       |
| parent                                                | The parent suite for the test. This property must be set by the test interface that instantiates the Test object. This property will be `null` for unit tests that have been sent from a client back to the test runner.                                                                                                          |
| remote                                                | A [Leadfoot Command object](https://theintern.github.io/leadfoot/module-leadfoot_Command.html) that can be used to drive a remote environment. This value will be inherited from the parent suite. Only available to suites that are loaded from [functionalSuites](https://theintern.github.io/intern/#option-functionalSuites). |
| reporterManager <span class="versionBadge">3.0</span> | The event hub that can be used to send result data and other information to [reporters](https://theintern.github.io/intern/#reporter-overview). This value will be inherited from the parent suite.                                                                                                                               |
| sessionId                                             | A unique identifier for a remote environment session. This value will be inherited from the parent suite. Only available to suites that are loaded from [functionalSuites](https://theintern.github.io/intern/#option-functionalSuites).                                                                                          |
| skipped                                               | If a test is skipped, the reason for the skip will be available here.                                                                                                                                                                                                                                                             |
| timeElapsed                                           | Time, in milliseconds, that the test took to execute. Only available once the test has finished running.                                                                                                                                                                                                                          |
| timeout                                               | The maximum time, in milliseconds, that an asynchronous test can take to finish before it is considered timed out. Once the test function has finished executing, changing this value has no effect.                                                                                                                              |

<table>
<thead>
<tr class="header">
<th>Method</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>async(<br />
  timeout?: number,<br />
  numCallsUntilResolution?: number<br />
): Deferred</td>
<td>Makes the test asynchronous. This method is idempotent and will always return the same Deferred object. See <a href="https://theintern.github.io/intern/#async-tests">asynchronous tests</a> for more information.</td>
</tr>
<tr class="even">
<td>skip(reason?: string): void</td>
<td>Causes the test to be skipped.</td>
</tr>
<tr class="odd">
<td>test(): Promise&lt;void&gt;</td>
<td>The test function for this test. If a Promise is returned, the test will wait until the Promise is resolved before passing. If the Promise rejects, the test will be considered failed and the error from the Promise will be used as the error for the Test.</td>
</tr>
<tr class="even">
<td>toJSON(): Object</td>
<td>Returns an object that can be safely serialised to JSON. This method normally does not need to be called directly; <code>JSON.stringify</code> will use the <code>toJSON</code> method automatically if you try to serialise the Test object.</td>
</tr>
<tr class="odd">
<td>run(): Promise&lt;void&gt;</td>
<td>Runs the test. Returns a Promise that resolves to <code>undefined</code> after the test finishes successfully, or rejects with an error if the test failed.</td>
</tr>
</tbody>
</table>

## The BenchmarkTest object

The [BenchmarkTest object](https://github.com/theintern/intern/blob/3.4/lib/BenchmarkTest.js) is an extension of the [Test object](https://theintern.github.io/intern/#test-object) that represents a single benchmark test within a test run. It manages the execution of benchmark its test using the [Benchmark.js](https://benchmarkjs.com/) library. It supports the Test API, barring the `async` and `skip` methods.

