import findDisplayed from './lib/findDisplayed';
import * as fs from 'fs';
import Locator, { Strategy, toW3cLocator } from './lib/Locator';
import waitForDeleted from './lib/waitForDeleted';
import { manualFindByLinkText, sleep } from './lib/util';
import { Task, CancellablePromise } from '../common';
import Session from './Session';
import JSZip from 'jszip';
import { basename } from 'path';

/**
 * The Element class represents a DOM or UI element within the remote
 * environment.
 */
export default class Element extends Locator<
  CancellablePromise<Element>,
  CancellablePromise<Element[]>,
  CancellablePromise<void>
> {
  private _elementId: string;
  private _session: Session;

  /**
   * @constructor module:leadfoot/Element
   *
   * @param elementId
   * The ID of the element, as provided by the remote.
   *
   * @param session
   * The session that the element belongs to.
   */
  constructor(elementId: /*ElementOrElementId*/ any, session: Session) {
    super();

    this._elementId =
      elementId.ELEMENT ||
      elementId.elementId ||
      elementId['element-6066-11e4-a52e-4f735466cecf'] ||
      elementId;
    this._session = session;
  }

  /**
   * The opaque, remote-provided ID of the element.
   *
   * @member elementId
   * @readonly
   */
  get elementId() {
    return this._elementId;
  }

  /**
   * The [[Session]] that the element belongs to.
   * @readonly
   */
  get session() {
    return this._session;
  }

  private _get<T>(
    path: string,
    requestData?: any,
    pathParts?: any
  ): CancellablePromise<T> {
    path = 'element/' + encodeURIComponent(this._elementId) + '/' + path;
    return this._session.serverGet<T>(path, requestData, pathParts);
  }

  private _post<T>(
    path: string,
    requestData?: any,
    pathParts?: any
  ): CancellablePromise<T> {
    path = 'element/' + encodeURIComponent(this._elementId) + '/' + path;
    return this._session.serverPost<T>(path, requestData, pathParts);
  }

  toJSON() {
    // Include both the JSONWireProtocol and W3C element properties
    return {
      ELEMENT: this._elementId,
      'element-6066-11e4-a52e-4f735466cecf': this._elementId
    };
  }

  /**
   * Normalize whitespace in the same way that most browsers generate
   * innerText.
   *
   * @param text text to normalize
   * @returns Text with leading and trailing whitespace removed, with inner
   * runs of spaces changed to a single space, and with "\r\n" pairs
   * converted to "\n".
   */
  private _normalizeWhitespace(text: string): string {
    if (text) {
      text = text
        .replace(/^\s+/gm, '')
        .replace(/\s+$/gm, '')
        .replace(/\s*\r\n\s*/g, '\n')
        .replace(/ +/g, ' ');
    }

    return text;
  }

  /**
   * Uploads a file to a remote Selenium server for use when testing file
   * uploads. This API is not part of the WebDriver specification and should
   * not be used directly. To send a file to a server that supports file
   * uploads, use [[Element.Element.type]] to type the name of the local file
   * into a file input field and the file will be transparently transmitted
   * and used by the server.
   */
  private _uploadFile(filename: string): CancellablePromise<string> {
    return new Task<string>(resolve => {
      const content = fs.readFileSync(filename);

      let zip = new JSZip();
      zip.file(basename(filename), content);
      zip.generateAsync({ type: 'base64' }).then(file => {
        resolve(this.session.serverPost('file', { file }));
      });
    });
  }

  /**
   * Gets the first element within this element that matches the given query.
   *
   * See [[Session.Session.setFindTimeout]] to set the amount of time it the
   * remote environment should spend waiting for an element that does not
   * exist at the time of the `find` call before timing out.
   *
   * @param using The element retrieval strategy to use. See
   * [[Session.Session.find]] for options.
   *
   * @param value The strategy-specific value to search for. See
   * [[Session.Session.find]] for details.
   */
  find(using: Strategy, value: string): CancellablePromise<Element> {
    const session = this._session;
    const capabilities = session.capabilities;

    if (capabilities.usesWebDriverLocators) {
      const locator = toW3cLocator(using, value);
      using = locator.using;
      value = locator.value;
    }

    if (
      using.indexOf('link text') !== -1 &&
      (capabilities.brokenWhitespaceNormalization ||
        capabilities.brokenLinkTextLocator)
    ) {
      return session
        .execute<ElementOrElementId>(manualFindByLinkText, [
          using,
          value,
          false,
          this
        ])
        .then(function(element) {
          if (!element) {
            const error = new Error();
            error.name = 'NoSuchElement';
            throw error;
          }
          return new Element(element, session);
        });
    }

    return this._post<ElementOrElementId>('element', {
      using,
      value
    })
      .then(function(element) {
        return new Element(element, session);
      })
      .catch(function(error) {
        // At least Firefox 49 + geckodriver returns an UnknownCommand
        // error when unable to find elements.
        if (
          error.name === 'UnknownCommand' &&
          error.message.indexOf('Unable to locate element:') !== -1
        ) {
          const newError = new Error();
          newError.name = 'NoSuchElement';
          newError.message = error.message;
          throw newError;
        }
        throw error;
      });
  }

  /**
   * Gets all elements within this element that match the given query.
   *
   * @param using The element retrieval strategy to use. See
   * [[Session.Session.find]] for options.
   *
   * @param value The strategy-specific value to search for. See
   * [[Session.Session.find]] for details.
   */
  findAll(using: Strategy, value: string): CancellablePromise<Element[]> {
    const session = this._session;
    const capabilities = session.capabilities;

    if (capabilities.usesWebDriverLocators) {
      const locator = toW3cLocator(using, value);
      using = locator.using;
      value = locator.value;
    }

    let task: CancellablePromise<ElementOrElementId[]>;
    if (
      using.indexOf('link text') !== -1 &&
      (capabilities.brokenWhitespaceNormalization ||
        capabilities.brokenLinkTextLocator)
    ) {
      task = session.execute<ElementOrElementId[]>(manualFindByLinkText, [
        using,
        value,
        true,
        this
      ]);
    } else {
      task = this._post<ElementOrElementId[]>('elements', {
        using: using,
        value: value
      });
    }

    return task.then(function(elements) {
      return elements.map(function(element) {
        return new Element(element, session);
      });
    });
  }

  /**
   * Clicks the element. This method works on both mouse and touch platforms.
   */
  click() {
    if (this.session.capabilities.brokenClick) {
      return this.session.execute<void>(
        /* istanbul ignore next */ (element: HTMLElement) => {
          element.click();
        },
        [this]
      );
    }

    return this._post<void>('click').then(() => {
      // ios-driver 0.6.6-SNAPSHOT April 2014 and MS Edge Driver 14316 do
      // not wait until the default action for a click event occurs
      // before returning
      if (
        this.session.capabilities.touchEnabled ||
        this.session.capabilities.returnsFromClickImmediately
      ) {
        return sleep(500);
      }
    });
  }

  /**
   * Submits the element, if it is a form, or the form belonging to the
   * element, if it is a form element.
   */
  submit() {
    if (this.session.capabilities.brokenSubmitElement) {
      return this.session.execute<void>(
        /* istanbul ignore next */ (element: any) => {
          if (element.submit) {
            element.submit();
          } else if (element.type === 'submit' && element.click) {
            element.click();
          }
        },
        [this]
      );
    }

    return this._post<void>('submit');
  }

  /**
   * Gets the visible text within the element. `<br>` elements are converted
   * to line breaks in the returned text, and whitespace is normalised per
   * the usual XML/HTML whitespace normalisation rules.
   */
  getVisibleText(): CancellablePromise<string> {
    if (this.session.capabilities.brokenVisibleText) {
      return this.session.execute<string>(
        /* istanbul ignore next */ (element: any) => {
          return element.innerText;
        },
        [this]
      );
    }

    const result = this._get<string>('text');

    if (this.session.capabilities.brokenWhitespaceNormalization) {
      return result.then(text => this._normalizeWhitespace(text));
    }

    return result;
  }

  /**
   * Types into the element. This method works the same as the
   * [[Session.Session.pressKeys]] method except that any modifier keys are
   * automatically released at the end of the command. This method should be
   * used instead of [[Session.Session.pressKeys]] to type filenames into
   * file upload fields.
   *
   * Since 1.5, if the WebDriver server supports remote file uploads, and you
   * type a path to a file on your local computer, that file will be
   * transparently uploaded to the remote server and the remote filename will
   * be typed instead. If you do not want to upload local files, use
   * [[Session.Session.pressKeys]] instead.
   *
   * @param value The text to type in the remote environment. See
   * [[Session.Session.pressKeys]] for more information.
   */
  type(value: string | string[]): CancellablePromise<void> {
    const getPostData = (
      value: string[]
    ): { value?: string[]; text?: string } => {
      if (this.session.capabilities.usesWebDriverElementValue) {
        // At least geckodriver 0.21+ and the WebDriver standard
        // require the `/value` endpoint to take a `text` parameter
        // that is a string.
        return { text: value.join('') };
      } else if (this.session.capabilities.usesFlatKeysArray) {
        // At least Firefox 49+ via Selenium requires the keys value to
        // be a flat array of characters
        return { value: value.join('').split('') };
      } else {
        return { value };
      }
    };

    const handleError = (reason: any) => {
      if (
        reason.detail.error === 'invalid argument' &&
        !this.session.capabilities.usesWebDriverElementValue
      ) {
        this.session.capabilities.usesWebDriverElementValue = true;
        return this.type(value);
      }
      throw reason;
    };

    if (!Array.isArray(value)) {
      value = [value];
    }

    if (this.session.capabilities.remoteFiles) {
      const filename = value.join('');

      // Check to see if the input is a filename; if so, upload the file
      // and then post it's remote name into the field
      try {
        if (fs.statSync(filename).isFile()) {
          return this._uploadFile(filename).then(uploadedFilename => {
            return this._post('value', getPostData([uploadedFilename]))
              .then(noop)
              .catch(handleError);
          });
        }
      } catch (error) {
        // ignore
      }
    }

    // If the input isn't a filename, just post the value directly
    return this._post('value', getPostData(value))
      .then(noop)
      .catch(handleError);
  }

  /**
   * Gets the tag name of the element. For HTML documents, the value is
   * always lowercase.
   */
  getTagName(): CancellablePromise<string> {
    return this._get<string>('name').then(name => {
      if (this.session.capabilities.brokenHtmlTagName) {
        return this.session
          .execute<boolean>(
            'return document.body && document.body.tagName === document.body.tagName.toUpperCase();'
          )
          .then(function(isHtml: boolean) {
            return isHtml ? name.toLowerCase() : name;
          });
      }

      return name;
    });
  }

  /**
   * Clears the value of a form element.
   */
  clearValue(): CancellablePromise<void> {
    return this._post('clear').then(noop);
  }

  /**
   * Returns whether or not a form element is currently selected (for
   * drop-down options and radio buttons), or whether or not the element is
   * currently checked (for checkboxes).
   */
  isSelected(): CancellablePromise<boolean> {
    return this._get<boolean>('selected');
  }

  /**
   * Returns whether or not a form element can be interacted with.
   */
  isEnabled(): CancellablePromise<boolean> {
    if (this.session.capabilities.brokenElementEnabled) {
      return this.session.execute<boolean>(
        /* istanbul ignore next */ function(element: HTMLElement) {
          return !Boolean(element.hasAttribute('disabled'));
        },
        [this]
      );
    }
    return this._get<boolean>('enabled');
  }

  /**
   * Gets a property or attribute of the element according to the WebDriver
   * specification algorithm. Use of this method is not recommended; instead,
   * use [[Element.Element.getAttribute]] to retrieve DOM attributes and
   * [[Element.Element.getProperty]] to retrieve DOM properties.
   *
   * This method uses the following algorithm on the server to determine what
   * value to return:
   *
   * 1. If `name` is 'style', returns the `style.cssText` property of the
   *    element.
   * 2. If the attribute exists and is a boolean attribute, returns 'true' if
   *    the attribute is true, or null otherwise.
   * 3. If the element is an `<option>` element and `name` is 'value',
   *    returns the `value` attribute if it exists, otherwise returns the
   *    visible text content of the option.
   * 4. If the element is a checkbox or radio button and `name` is
   *    'selected', returns 'true' if the element is checked, or null
   *    otherwise.
   * 5. If the returned value is expected to be a URL (e.g. element is `<a>`
   *    and attribute is `href`), returns the fully resolved URL from the
   *    `href`/`src` property of the element, not the attribute.
   * 6. If `name` is 'class', returns the `className` property of the
   *    element.
   * 7. If `name` is 'readonly', returns 'true' if the `readOnly` property is
   *    true, or null otherwise.
   * 8. If `name` corresponds to a property of the element, and the property
   *    is not an Object, return the property value coerced to a string.
   * 9. If `name` corresponds to an attribute of the element, return the
   *    attribute value.
   *
   * @param name The property or attribute name.
   * @returns The value of the attribute as a string, or `null` if no such
   * property or attribute exists.
   */
  getSpecAttribute(name: string): CancellablePromise<string | null> {
    return this._get<string | undefined>('attribute/$0', null, [name])
      .then(value => {
        if (
          this.session.capabilities.brokenNullGetSpecAttribute &&
          (value === '' || value === undefined)
        ) {
          return this.session
            .execute<boolean>(
              /* istanbul ignore next */ function(
                element: HTMLElement,
                name: string
              ) {
                return element.hasAttribute(name);
              },
              [this, name]
            )
            .then(function(hasAttribute: boolean) {
              return hasAttribute ? <string>value : null;
            });
        }

        return value || null;
      })
      .then(function(value) {
        // At least ios-driver 0.6.6-SNAPSHOT violates draft spec and
        // returns boolean attributes as booleans instead of the string
        // "true" or null
        if (typeof value === 'boolean') {
          value = value ? 'true' : null;
        }

        return value;
      });
  }

  /**
   * Gets an attribute of the element.
   *
   * See [[Element.Element.getProperty]] to retrieve an element property.
   *
   * @param name The name of the attribute.
   * @returns The value of the attribute, or `null` if no such attribute
   * exists.
   */
  getAttribute(name: string): CancellablePromise<string | null> {
    if (this.session.capabilities.usesWebDriverElementAttribute) {
      return this._get<string | null>('attribute/$0', null, [name]);
    }

    return this.session.execute<string | null>(
      'return arguments[0].getAttribute(arguments[1]);',
      [this, name]
    );
  }

  /**
   * Gets a property of the element.
   *
   * See [[Element.Element.getAttribute]] to retrieve an element attribute.
   *
   * @param name The name of the property.
   * @returns The value of the property.
   */
  getProperty<T = any>(name: string): CancellablePromise<T> {
    if (this.session.capabilities.brokenElementProperty) {
      return this.session.execute<T>('return arguments[0][arguments[1]];', [
        this,
        name
      ]);
    }

    return this._get<T>('property/$0', null, [name]).catch(() => {
      this.session.capabilities.brokenElementProperty = true;
      return this.getProperty<T>(name);
    });
  }

  /**
   * Determines if this element is equal to another element.
   */
  equals(other: Element): CancellablePromise<boolean> {
    if (this.session.capabilities.noElementEquals) {
      return this.session.execute<boolean>(
        'return arguments[0] === arguments[1];',
        [this, other]
      );
    }

    const elementId = other.elementId || other;
    return this._get<boolean>('equals/$0', null, [elementId]).catch(error => {
      // At least Selendroid 0.9.0 does not support this command;
      // At least ios-driver 0.6.6-SNAPSHOT April 2014 fails
      if (
        !this.session.capabilities.noElementEquals &&
        (error.name === 'UnknownCommand' || error.name === 'UnknownError')
      ) {
        this.session.capabilities.noElementEquals = true;
        return this.equals(other);
      }

      throw error;
    });
  }

  /**
   * Returns whether or not the element would be visible to an actual user.
   * This means that the following types of elements are considered to be not
   * displayed:
   *
   * 1. Elements with `display: none`
   * 2. Elements with `visibility: hidden`
   * 3. Elements positioned outside of the viewport that cannot be scrolled
   *    into view
   * 4. Elements with `opacity: 0`
   * 5. Elements with no `offsetWidth` or `offsetHeight`
   */
  isDisplayed(): CancellablePromise<boolean> {
    return this._get<boolean>('displayed').then(isDisplayed => {
      if (
        isDisplayed &&
        (this.session.capabilities.brokenElementDisplayedOpacity ||
          this.session.capabilities.brokenElementDisplayedOffscreen)
      ) {
        return this.session.execute<boolean>(
          /* istanbul ignore next */ (element: HTMLElement) => {
            const scrollX =
              document.documentElement!.scrollLeft || document.body.scrollLeft;
            const scrollY =
              document.documentElement!.scrollTop || document.body.scrollTop;
            do {
              if (window.getComputedStyle(element).opacity === '0') {
                return false;
              }

              const bbox = element.getBoundingClientRect();
              if (bbox.right + scrollX <= 0 || bbox.bottom + scrollY <= 0) {
                return false;
              }
            } while (
              (element = <HTMLElement>element.parentNode) &&
              element.nodeType === 1
            );
            return true;
          },
          [this]
        );
      }

      return isDisplayed;
    });
  }

  /**
   * Gets the position of the element relative to the top-left corner of the
   * document, taking into account scrolling and CSS transformations (if they
   * are supported).
   */
  getPosition(): CancellablePromise<{ x: number; y: number }> {
    if (this.session.capabilities.brokenElementPosition) {
      /* jshint browser:true */
      return this.session.execute<{
        x: number;
        y: number;
      }>(
        /* istanbul ignore next */ function(element: HTMLElement) {
          const bbox = element.getBoundingClientRect();
          const scrollX =
            document.documentElement!.scrollLeft || document.body.scrollLeft;
          const scrollY =
            document.documentElement!.scrollTop || document.body.scrollTop;

          return { x: scrollX + bbox.left, y: scrollY + bbox.top };
        },
        [this]
      );
    }

    return this._get<{ x: number; y: number }>('location').then(function({
      x,
      y
    }) {
      // At least FirefoxDriver 2.41.0 incorrectly returns an object with
      // additional `class` and `hCode` properties
      return { x, y };
    });
  }

  /**
   * Gets the size of the element, taking into account CSS transformations
   * (if they are supported).
   */
  getSize(): CancellablePromise<{ width: number; height: number }> {
    const getUsingExecute = () => {
      return this.session.execute<{
        width: number;
        height: number;
      }>(
        /* istanbul ignore next */ function(element: HTMLElement) {
          const bbox = element.getBoundingClientRect();
          return {
            width: bbox.right - bbox.left,
            height: bbox.bottom - bbox.top
          };
        },
        [this]
      );
    };

    if (this.session.capabilities.brokenCssTransformedSize) {
      return getUsingExecute();
    }

    return this._get<{ width: number; height: number }>('size')
      .catch(function(error) {
        // At least ios-driver 0.6.0-SNAPSHOT April 2014 does not
        // support this command
        if (error.name === 'UnknownCommand') {
          return getUsingExecute();
        }

        throw error;
      })
      .then(function({ width, height }) {
        // At least ChromeDriver 2.9 incorrectly returns an object with
        // an additional `toString` property
        return { width, height };
      });
  }

  /**
   * Gets a CSS computed property value for the element.
   *
   * @param propertyName The CSS property to retrieve. This argument must be
   * hyphenated, *not* camel-case.
   */
  getComputedStyle(propertyName: string): CancellablePromise<string> {
    const manualGetStyle = () => {
      return this.session.execute<string>(
        /* istanbul ignore next */ (element: any, propertyName: string) => {
          return (<any>window.getComputedStyle(element))[propertyName];
        },
        [this, propertyName]
      );
    };

    let promise: CancellablePromise<string>;

    if (this.session.capabilities.brokenComputedStyles) {
      promise = manualGetStyle();
    } else {
      promise = this._get<string>('css/$0', null, [propertyName]).catch(
        function(error) {
          // At least Selendroid 0.9.0 does not support this command
          if (error.name === 'UnknownCommand') {
            return manualGetStyle();
          } else if (
            error.name === 'UnknownError' &&
            error.message.indexOf('failed to parse value') > -1
          ) {
            // At least ChromeDriver 2.9 incorrectly returns an error
            // for property names it does not understand
            return '';
          }

          throw error;
        }
      );
    }

    return promise.then(function(value) {
      // At least ChromeDriver 2.9 and Selendroid 0.9.0 returns colour
      // values as rgb instead of rgba
      if (value) {
        value = value.replace(/(.*\b)rgb\((\d+,\s*\d+,\s*\d+)\)(.*)/g, function(
          _,
          prefix,
          rgb,
          suffix
        ) {
          return prefix + 'rgba(' + rgb + ', 1)' + suffix;
        });
      }

      // For consistency with Firefox, missing values are always returned
      // as empty strings
      return value != null ? value : '';
    });
  }

  /**
   * Gets the first [[Element.Element.isDisplayed|displayed]] element inside
   * this element matching the given query. This is inherently slower than
   * [[Element.Element.find]], so should only be used in cases where the
   * visibility of an element cannot be ensured in advance.
   *
   * @since 1.6
   *
   * @param using The element retrieval strategy to use. See
   * [[Session.Session.find]] for options.
   *
   * @param value The strategy-specific value to search for. See
   * [[Session.Session.find]] for details.
   */
  findDisplayed(using: Strategy, value: string): CancellablePromise<Element> {
    return findDisplayed(this.session, this, using, value);
  }

  /**
   * Waits for all elements inside this element that match the given query to
   * be destroyed.
   *
   * @param using The element retrieval strategy to use. See
   * [[Session.Session.find]] for options.
   *
   * @param value The strategy-specific value to search for. See
   * [[Session.Session.find]] for details.
   */
  waitForDeleted(strategy: Strategy, value: string) {
    return waitForDeleted(this.session, this, strategy, value);
  }
}

function noop() {
  // At least ios-driver 0.6.6 returns an empty object for methods that are
  // supposed to return no value at all, which is not correct
}

export type ElementOrElementId =
  | { ELEMENT: string }
  | { 'element-6066-11e4-a52e-4f735466cecf': string }
  | Element
  | string;
