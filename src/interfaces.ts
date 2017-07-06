import Task from '@dojo/core/async/Task';
import { Url } from 'url';

export interface Capabilities {
	_filled?: boolean;
	applicationCacheEnabled?: boolean;
	brokenActiveElement?: boolean;
	brokenClick?: boolean;
	brokenComputedStyles?: boolean;
	brokenCookies?: boolean;
	brokenCssTransformedSize?: boolean;
	brokenDeleteCookie?: boolean;
	brokenDeleteWindow?: boolean;
	brokenDoubleClick?: boolean;
	brokenElementDisplayedOffscreen?: boolean;
	brokenElementDisplayedOpacity?: boolean;
	brokenElementPosition?: boolean;
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
	brokenWhitespaceNormalization?: boolean;
	brokenWindowClose?: boolean;
	brokenWindowPosition?: boolean;
	brokenWindowSize?: boolean;
	brokenWindowSwitch?: boolean;
	brokenZeroTimeout?: boolean;
	browserName?: string;
	browserVersion?: string;
	deviceName?: string;
	dynamicViewport?: boolean;
	fixSessionCapabilities?: 'no-detect' | boolean;
	fixedLogTypes?: false | string[] | Task<string[]>;
	handleAlerts?: boolean;
	handlesAlerts?: boolean;
	hasTouchScreen?: boolean;
	implicitWindowHandles?: boolean;
	initialBrowserUrl?: string;
	isWebDriver?: boolean;
	locationContextEnabled?: boolean;
	mouseEnabled?: boolean;
	nativeEvents?: boolean;
	platform?: string;
	platformName?: string;
	platformVersion?: string;
	remoteFiles?: boolean;
	returnsFromClickImmediately?: boolean;
	rotatable?: boolean;
	scriptedParentFrameCrashesBrowser?: boolean;
	shortcutKey?: any;
	supportsCssTransforms?: boolean;
	supportsExecuteAsync?: boolean;
	supportsKeysCommand?: boolean;
	supportsNavigationDataUris?: boolean;
	supportsWindowRectCommand?: boolean;
	takesScreenshot?: boolean;
	touchEnabled?: boolean;
	version?: string;
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
