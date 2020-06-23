/**
 * A function for creating a new Document in the browser
 */
export function createDocument() {
  return document.implementation.createHTMLDocument('Mock document');
}
