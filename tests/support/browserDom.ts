/**
 * Provide a function for creating a new Document in the browser
 */
intern.registerPlugin('createDocument', () => {
  return () => document.implementation.createHTMLDocument('Mock document');
});
