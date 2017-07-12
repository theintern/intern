# Testing native apps

<!-- vim-markdown-toc GFM -->
* [Appium](#appium)
* [ios-driver](#ios-driver)
* [Selendroid](#selendroid)

<!-- vim-markdown-toc -->

Native mobile application UIs can be tested by Intern using an [Appium](http://appium.io/), [ios-driver](http://ios-driver.github.io/ios-driver/), or [Selendroid](http://selendroid.io/) server. Each server has slightly different support for WebDriver, so make sure to read each project’s documentation to pick the right one for you.

⚠️  Always be sure to set `fixSessionCapabilities: false` in your environment capabilities when testing a native app to bypass feature detection code that only works for Web apps.

## Appium

To test a native app with Appium, one method is to pass the path to a valid IPA or APK using the app key in your [environments] configuration:

```js
{
    environments: [
        {
            platformName: 'iOS',
            app: 'testapp.ipa',
            fixSessionCapabilities: false
        }
    ]
}
```

You can also use `appPackage` and `appActivity` for Android, or `bundleId` and `udid` for iOS, to run an application that is already installed on a test device:

```js
{
    environments: [
        {
            platformName: 'iOS',
            bundleId: 'com.example.TestApp',
            udid: 'da39a3ee5e…',
            fixSessionCapabilities: false
        },
        {
            platformName: 'Android',
            appActivity: 'MainActivity',
            appPackage: 'com.example.TestApp',
            fixSessionCapabilities: false
        }
    ]
}
```

The available capabilities for Appium are complex, so review the [Appium capabilities documentation](http://appium.io/slate/en/master/?javascript#appium-server-capabilities) to understand all possible execution modes.

Once the application has started successfully, you can interact with it using any of the supported [WebDriver APIs](http://appium.io/slate/en/master/?javascript#finding-and-interacting-with-elements).

## ios-driver

To test a native app with ios-driver, first run ios-driver, passing one or more app bundles for the applications you want to test:

```
java -jar ios-driver.jar -aut TestApp.app
```

Then, pass the bundle ID and version using the `CFBundleName` and `CFBundleVersion` keys in your [environments] configuration:

```js
{
    environments: [
        {
            device: 'iphone',
            CFBundleName: 'TestApp',
            CFBundleVersion: '1.0.0',
            // required for ios-driver to use iOS Simulator
            simulator: true,
            fixSessionCapabilities: false
        }
    ]
}
```

Once the application has started successfully, you can interact with it using any of the [supported WebDriver APIs](https://ios-driver.github.io/ios-driver/?page=native).

## Selendroid

To test a native app with Selendroid, first run Selendroid, passing one or more APKs for the applications you want to test:

```
java -jar selendroid.jar -app testapp-1.0.0.apk
```

Then, pass the Android app ID of the application using the aut key in your [environments] configuration:

```js
{
    environments: [
        {
            automationName: 'selendroid',
            aut: 'com.example.testapp:1.0.0',
            fixSessionCapabilities: false
        }
    ]
}
```

Once the application has started successfully, you can interact with it using any of the supported WebDriver APIs.

[environments]: ./configuration.md#environments
