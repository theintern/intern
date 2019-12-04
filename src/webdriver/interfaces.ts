import { CancellablePromise } from '../common';
import { Url } from 'url';

export { CancellablePromise };

/**
 * These interface describes the capabilities that may be implemented by a
 * WebDriver server. Many of these are standard
 * [[https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities|WebDriver capabilities]],
 * but the interface also includes a number of Leadfoot-specific feature and
 * defect indicators. For example, the [[interfaces.Capabilities.brokenClick]]
 * capability indicates that the remote doesn't properly support the 'click'
 * action.
 */
export interface Capabilities {
  _filled?: boolean;

  /**
   * Whether the session can interact with the remote browser's application
   * cache.
   */
  applicationCacheEnabled?: boolean;

  /** The remote doesn't implement element/active */
  brokenActiveElement?: boolean;

  /** The remote doesn't properly implement native mouse clicks */
  brokenClick?: boolean;

  /** The remote may not return correct computed styles */
  brokenComputedStyles?: boolean;

  /** Native cookie manipulation doesn't work */
  brokenCookies?: boolean;

  /** Transformed CSS sizes may be reported incorrectly */
  brokenCssTransformedSize?: boolean;

  /** Native cookie deletion doesn't work */
  brokenDeleteCookie?: boolean;

  /** Native window deletion doesn't work */
  brokenDeleteWindow?: boolean;

  /** The double-click event doesn't work */
  brokenDoubleClick?: boolean;

  brokenElementDisplayedOffscreen?: boolean;
  brokenElementDisplayedOpacity?: boolean;
  brokenElementEnabled?: boolean;
  brokenElementPosition?: boolean;
  brokenElementProperty?: boolean;
  brokenElementSerialization?: boolean;
  brokenEmptyPost?: boolean;
  brokenExecuteElementReturn?: boolean;
  brokenExecuteForNonHttpUrl?: boolean;
  brokenExecuteUndefinedReturn?: boolean;
  brokenFileSendKeys?: boolean;
  brokenFlickFinger?: boolean;
  brokenHtmlMouseMove?: boolean;
  brokenHtmlTagName?: boolean;
  brokenLinkTextLocator?: boolean;
  brokenLongTap?: boolean;
  brokenMouseEvents?: boolean;
  brokenMoveFinger?: boolean;
  brokenNavigation?: boolean;
  brokenNullGetSpecAttribute?: boolean;
  brokenOptionSelect?: boolean;
  brokenPageSource?: boolean;
  brokenParentFrameSwitch?: boolean;
  brokenRefresh?: boolean;
  brokenSendKeys?: boolean;
  brokenSessionList?: boolean;
  brokenSubmitElement?: boolean;
  brokenTouchScroll?: boolean;

  /** "Visible" text includes text that should be hidden */
  brokenVisibleText?: boolean;

  brokenWhitespaceNormalization?: boolean;
  brokenWindowClose?: boolean;
  brokenWindowPosition?: boolean;
  brokenWindowSize?: boolean;
  brokenWindowSwitch?: boolean;
  brokenZeroTimeout?: boolean;

  /** The name of the remote browser (e.g., 'safari') */
  browserName?: string;

  /**
   * The remote browser version. This may or may not correspond to the
   * publicly visible version.
   */
  browserVersion?: string;

  /**
   * The name of the remote mobile device
   */
  deviceName?: string;

  /** Whether the remote browser can be resized */
  dynamicViewport?: boolean;

  /** Whether or not to run capability tests */
  fixSessionCapabilities?: 'no-detect' | boolean;

  /** The actual log types supported by a remote */
  fixedLogTypes?: false | string[] | CancellablePromise<string[]>;

  /** Whether the remote can handle modal alerts */
  handlesAlerts?: boolean;

  /** Whether the remote has a touch screen */
  hasTouchScreen?: boolean;

  /** Allows the user to specify the initial URL loaded when IE starts. */
  initialBrowserUrl?: string;

  /** Whether the session can set and query the browser's location context. */
  locationContextEnabled?: boolean;

  /** Whether mouse actions are enabled */
  mouseEnabled?: boolean;

  /** Whether the remote browser supports native events */
  nativeEvents?: boolean;

  /** If true, the remote doesn't support the JWP /displayed endpoint */
  noElementDisplayed?: boolean;

  /** If true, the remote doesn't support the JWP /equals endpoint */
  noElementEquals?: boolean;

  /** If true, the remote doesn't support the JWP /keys endpoint */
  noKeysCommand?: boolean;

  /**
   * The base platform the remote browser is running on, typically one of
   * WINDOWS, XP, VISTA, MAC, LINUX, UNIX, ANDROID.
   */
  platform?: string;

  /**
   * The platform the remote browser is running on. This is typically more
   * specifc than [[interfaces.Capabilities.platform]].
   */
  platformName?: string;

  /**
   * The version of the platform the remote browser is runnign no.
   */
  platformVersion?: string;

  /**
   * Whether the remote browser supports file uploads
   */
  remoteFiles?: boolean;

  /**
   * Whether the remote browser returns immediately after a click or waits
   * for the click action to occur
   */
  returnsFromClickImmediately?: boolean;

  /**
   * Whether the remote viewport is rotatable between portrait and landscape
   * views
   */
  rotatable?: boolean;

  /**
   * This indicates that trying to return a reference to a parent frame from
   * a script will crash the remote browser
   */
  scriptedParentFrameCrashesBrowser?: boolean;

  /**
   * The [[keys.keys|key]] used to run shortcuts, typically Cmd (Mac) or Control
   * (Windows, Linux)
   */
  shortcutKey?: any;

  /** Whether the remote browser supports CSS transforms */
  supportsCssTransforms?: boolean;

  /** Whether scripts can be executed asynchronously in the remote browser */
  supportsExecuteAsync?: boolean;

  /** Whether the server supports the GET /timeouts endpoint */
  supportsGetTimeouts?: boolean;

  /** Whether the remote browser allows navigation via data URIs */
  supportsNavigationDataUris?: boolean;

  /** Whether the remote supports session commands */
  supportsSessionCommands?: boolean;

  /** Whether the remote browser can take screenshots */
  takesScreenshot?: boolean;

  /** Whether the remote browser supports touch events */
  touchEnabled?: boolean;

  /**
   * Whether the remote server requires element keys to be sent as a flat array
   */
  usesFlatKeysArray?: boolean;

  /** Whether window commands use 'handle' instead of 'name' */
  usesHandleParameter?: boolean;

  /** Whether the Element '/attribute' endpoint uses W3C semantics */
  usesWebDriverElementAttribute?: boolean;

  /** Whether the Element '/value' endpoint uses a 'text' property */
  usesWebDriverElementValue?: boolean;

  /**
   * Whether getActiveElement uses a POST or GET
   */
  usesWebDriverActiveElement?: boolean;

  /**
   * Whether the remote uses `/execute/async` rathern than `/execute_async` for
   * asynchronous execution
   */
  usesWebDriverExecuteASync?: boolean;

  /**
   * Whether the remote uses `/execute/sync` rathern than `/execute` for
   * synchronous execution
   */
  usesWebDriverExecuteSync?: boolean;

  /**
   * Whether find commands should use WebDriver (vs JsonWireProtocol) locators
   */
  usesWebDriverLocators?: boolean;

  /**
   * Whether the remote browser uses WebDriver-style timeouts
   */
  usesWebDriverTimeouts?: boolean;

  /**
   * Whether the remote browser uses WebDriver-style window handle command (/window)
   */
  usesWebDriverWindowHandleCommands?: boolean;

  /**
   * Whether the remote browser uses WebDriver-style window commands (/rect, implicit handles)
   */
  usesWebDriverWindowCommands?: boolean;

  /** The remote browser version */
  version?: string;

  /** Whether the session supports interactions with storage objects */
  webStorageEnabled?: boolean;

  [key: string]: any;
}

export interface Geolocation {
  altitude?: number;
  latitude?: number;
  longitude?: number;
}

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
}

export interface WebDriverCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  secure?: boolean;
  expiry?: string | Date | number;
}

export interface LeadfootURL extends Url {
  username?: string;
  password?: string;
  accessKey?: string;
}

export interface LeadfootError extends Error {
  response?: { text: string };
}

export interface WebDriverResponse {
  value: any;
}
