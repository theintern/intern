import { JSDOM } from 'jsdom';

export function createDocument() {
  if (typeof document !== 'undefined') {
    return document.implementation.createHTMLDocument('Mock document');
  } else {
    return new JSDOM().window.document;
  }
}
