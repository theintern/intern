export type BrowserName =
  | 'node'
  | 'chrome'
  | 'firefox'
  | 'ie'
  | 'internet explorer'
  | 'edge'
  | 'edgeChromium'
  | 'MicrosoftEdge'
  | 'MicrosoftEdgeChromium';

export type DriverDescriptor = BrowserName | DriverFile | WebDriver;

export interface DriverFile extends RemoteFile {
  seleniumProperty: string;
}

export interface JobState {
  /**
   * The build number of the software being tested by the job. Supported by
   * Sauce Labs.
   */
  buildId?: number;

  /**
   * Additional arbitrary data to be stored alongside the job. Supported by
   * TestingBot and Sauce Labs.
   */
  extra?: {};

  /**
   * A descriptive name for the job. Supported by TestingBot and Sauce Labs.
   */
  name?: string;

  /**
   * A status message to provide alongside a test. Supported by TestingBot.
   */
  status?: string;

  /**
   * Whether or not the job should be listed as successful. Supported by
   * BrowserStack, TestingBot, and Sauce Labs.
   */
  success: boolean;

  /**
   * An array of tags for the job. Supported by TestingBot and Sauce Labs.
   */
  tags?: string[];

  /**
   * The public visibility of test results. May be one of 'public', 'public
   * restricted', 'share', 'team', or 'private'. Supported by Sauce Labs.
   */
  visibility?: string;
}
/**
 * A normalized environment descriptor.
 *
 * A NormalizedEnvironment contains a mix of W3C WebDriver and JSONWireProtocol
 * capabilities, as well as a set of standardized capabilities that can be used
 * to specify the given environment in an Intern `environments` descriptor.
 */
export interface NormalizedEnvironment {
  browserName: string;
  browserVersion?: string;
  descriptor: Record<string, any>;
  platform: string;
  platformName?: string;
  platformVersion?: string;
  version: string;

  intern: {
    platform: string;
    browserName: string;
    version: string;
  };
}

export interface RemoteFile {
  dontExtract?: boolean;
  directory?: string;
  executable: string;
  url: string;
}

export interface WebDriver {
  browserName: BrowserName;
  version?: string;
}

/**
 * Return true if a give value is a webdriver descriptor
 */
export function isWebDriver(value: DriverDescriptor): value is WebDriver {
  return Boolean(
    value && typeof value === 'object' && (value as WebDriver).browserName
  );
}
