/**
 * Provide a function for creating a new Document in Node
 */
import { JSDOM } from 'jsdom';

intern.registerPlugin('createDocument', () => {
	return () => new JSDOM().window.document;
});
