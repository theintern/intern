/**
 * Locator is a class that supports searching for specific element (E), list
 * (L), and void (V) types by various strategies.
 *
 * Note that this class includes JSONWireProtocol strategies. W3C Webdriver
 * only understands 4 strategies:
 *
 * 1. css selector
 * 2. link text
 * 3. partial link text
 * 4. xpath
 */
abstract class Locator<E, L, V> {
  abstract find(strategy: Strategy, value: string): E;

  abstract findAll(strategy: Strategy, value: string): L;

  abstract findDisplayed(strategy: Strategy, value: string): E;

  abstract waitForDeleted(strategy: Strategy, value: string): V;

  /**
   * Gets the first element inside this element matching the given CSS class
   * name.
   *
   * @param className The CSS class name to search for.
   */
  findByClassName(className: string) {
    return this.find('class name', className);
  }

  /**
   * Gets the first element inside this element matching the given CSS
   * selector.
   *
   * @param selector The CSS selector to search for.
   */
  findByCssSelector(selector: string) {
    return this.find('css selector', selector);
  }

  /**
   * Gets the first element inside this element matching the given ID.
   *
   * @param id The ID of the element.
   */
  findById(id: string) {
    return this.find('id', id);
  }

  /**
   * Gets the first element inside this element matching the given name
   * attribute.
   *
   * @param name The name of the element.
   */
  findByName(name: string) {
    return this.find('name', name);
  }

  /**
   * Gets the first element inside this element matching the given
   * case-insensitive link text.
   *
   * @param text The link text of the element.
   */
  findByLinkText(text: string) {
    return this.find('link text', text);
  }

  /**
   * Gets the first element inside this element partially matching the given
   * case-insensitive link text.
   *
   * @param text The partial link text of the element.
   */
  findByPartialLinkText(text: string) {
    return this.find('partial link text', text);
  }

  /**
   * Gets the first element inside this element matching the given HTML tag
   * name.
   *
   * @param tagName The tag name of the element.
   */
  findByTagName(tagName: string) {
    return this.find('tag name', tagName);
  }

  /**
   * Gets the first element inside this element matching the given XPath
   * selector.
   *
   * @param path The XPath selector to search for.
   */
  findByXpath(path: string) {
    return this.find('xpath', path);
  }

  /**
   * Gets all elements inside this element matching the given CSS class name.
   *
   * @param className The CSS class name to search for.
   */
  findAllByClassName(className: string) {
    return this.findAll('class name', className);
  }

  /**
   * Gets all elements inside this element matching the given CSS selector.
   *
   * @param selector The CSS selector to search for.
   */
  findAllByCssSelector(selector: string) {
    return this.findAll('css selector', selector);
  }

  /**
   * Gets all elements inside this element matching the given name attribute.
   *
   * @param name The name of the element.
   */
  findAllByName(name: string) {
    return this.findAll('name', name);
  }

  /**
   * Gets all elements inside this element matching the given
   * case-insensitive link text.
   *
   * @param text The link text of the element.
   */
  findAllByLinkText(text: string) {
    return this.findAll('link text', text);
  }

  /**
   * Gets all elements inside this element partially matching the given
   * case-insensitive link text.
   *
   * @param text The partial link text of the element.
   */
  findAllByPartialLinkText(text: string) {
    return this.findAll('partial link text', text);
  }

  /**
   * Gets all elements inside this element matching the given HTML tag name.
   *
   * @param tagName The tag name of the element.
   */
  findAllByTagName(tagName: string) {
    return this.findAll('tag name', tagName);
  }

  /**
   * Gets all elements inside this element matching the given XPath selector.
   *
   * @param path The XPath selector to search for.
   */
  findAllByXpath(path: string) {
    return this.findAll('xpath', path);
  }

  /**
   * Gets the first [[Element.isDisplayed|displayed]] element inside this
   * element matching the given CSS class name. This is inherently slower
   * than [[Element.find]], so should only be used in cases where the
   * visibility of an element cannot be ensured in advance.
   *
   * @since 1.6
   * @param className The CSS class name to search for.
   */
  findDisplayedByClassName(className: string) {
    return this.findDisplayed('class name', className);
  }

  /**
   * Gets the first [[Element.isDisplayed|displayed]] element inside this
   * element matching the given CSS selector. This is inherently slower than
   * [[Element.find]], so should only be used in cases where the visibility
   * of an element cannot be ensured in advance.
   *
   * @since 1.6
   * @param selector The CSS selector to search for.
   */
  findDisplayedByCssSelector(selector: string) {
    return this.findDisplayed('css selector', selector);
  }

  /**
   * Gets the first [[Element.isDisplayed|displayed]] element inside this
   * element matching the given ID. This is inherently slower than
   * [[Element.find]], so should only be used in cases where the visibility
   * of an element cannot be ensured in advance.
   *
   * @since 1.6
   * @param id The ID of the element.
   */
  findDisplayedById(id: string) {
    return this.findDisplayed('id', id);
  }

  /**
   * Gets the first [[Element.isDisplayed|displayed]] element inside this
   * element matching the given name attribute. This is inherently slower
   * than [[Element.find]], so should only be used in cases where the
   * visibility of an element cannot be ensured in advance.
   *
   * @since 1.6
   * @param name The name of the element.
   */
  findDisplayedByName(name: string) {
    return this.findDisplayed('name', name);
  }

  /**
   * Gets the first [[Element.isDisplayed|displayed]] element inside this
   * element matching the given case-insensitive link text. This is
   * inherently slower than [[Element.find]], so should only be used in cases
   * where the visibility of an element cannot be ensured in advance.
   *
   * @since 1.6
   * @param text The link text of the element.
   */
  findDisplayedByLinkText(text: string) {
    return this.findDisplayed('link text', text);
  }

  /**
   * Gets the first [[Element.isDisplayed|displayed]] element inside this
   * element partially matching the given case-insensitive link text. This is
   * inherently slower than [[Element.find]], so should only be used in cases
   * where the visibility of an element cannot be ensured in advance.
   *
   * @since 1.6
   * @param text The partial link text of the element.
   */
  findDisplayedByPartialLinkText(text: string) {
    return this.findDisplayed('partial link text', text);
  }

  /**
   * Gets the first [[Element.isDisplayed|displayed]] element inside this
   * element matching the given HTML tag name. This is inherently slower than
   * [[Element.find]], so should only be used in cases where the visibility
   * of an element cannot be ensured in advance.
   *
   * @since 1.6
   * @param tagName The tag name of the element.
   */
  findDisplayedByTagName(tagName: string) {
    return this.findDisplayed('tag name', tagName);
  }

  /**
   * Gets the first [[Element.isDisplayed|displayed]] element inside this
   * element matching the given XPath selector. This is inherently slower
   * than [[Element.find]], so should only be used in cases where the
   * visibility of an element cannot be ensured in advance.
   *
   * @since 1.6
   * @param path The XPath selector to search for.
   */
  findDisplayedByXpath(path: string) {
    return this.findDisplayed('xpath', path);
  }

  /**
   * Waits for all elements inside this element matching the given CSS class
   * name to be destroyed.
   *
   * @param className The CSS class name to search for.
   */
  waitForDeletedByClassName(className: string) {
    return this.waitForDeleted('class name', className);
  }

  /**
   * Waits for all elements inside this element matching the given CSS
   * selector to be destroyed.
   *
   * @param selector The CSS selector to search for.
   */
  waitForDeletedByCssSelector(selector: string) {
    return this.waitForDeleted('css selector', selector);
  }

  /**
   * Waits for all elements inside this element matching the given ID to be
   * destroyed.
   *
   * @param id The ID of the element.
   */
  waitForDeletedById(id: string) {
    return this.waitForDeleted('id', id);
  }

  /**
   * Waits for all elements inside this element matching the given name
   * attribute to be destroyed.
   *
   * @param name The name of the element.
   */
  waitForDeletedByName(name: string) {
    return this.waitForDeleted('name', name);
  }

  /**
   * Waits for all elements inside this element matching the given
   * case-insensitive link text to be destroyed.
   *
   * @param text The link text of the element.
   */
  waitForDeletedByLinkText(text: string) {
    return this.waitForDeleted('link text', text);
  }

  /**
   * Waits for all elements inside this element partially matching the given
   * case-insensitive link text to be destroyed.
   *
   * @param text The partial link text of the element.
   */
  waitForDeletedByPartialLinkText(text: string) {
    return this.waitForDeleted('partial link text', text);
  }

  /**
   * Waits for all elements inside this element matching the given HTML tag
   * name to be destroyed.
   *
   * @param tagName The tag name of the element.
   */
  waitForDeletedByTagName(tagName: string) {
    return this.waitForDeleted('tag name', tagName);
  }

  /**
   * Waits for all elements inside this element matching the given XPath
   * selector to be destroyed.
   *
   * @param path The XPath selector to search for.
   */
  waitForDeletedByXpath(path: string) {
    return this.waitForDeleted('xpath', path);
  }
}

export default Locator;

export const w3cStrategies = {
  'css selector': true,
  'link text': true,
  'partial link text': true,
  xpath: true
};

export type W3cStrategy = keyof typeof w3cStrategies;

export interface W3cLocator {
  using: W3cStrategy;
  value: string;
}

export const strategies = {
  ...w3cStrategies,
  'class name': true,
  id: true,
  name: true,
  'partial link text': true,
  'tag name': true
};

export type Strategy = keyof typeof strategies;

export function toW3cLocator(using: Strategy, value: string): W3cLocator {
  switch (using) {
    case 'id':
      using = 'css selector';
      value = `#${value}`;
      break;
    case 'class name':
      using = 'css selector';
      value = `.${value}`;
      break;
    case 'name':
      using = 'css selector';
      value = `[name="${value}"]`;
      break;
    case 'tag name':
      using = 'css selector';
      break;
  }

  return { using, value };
}
