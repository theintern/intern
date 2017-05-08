declare module 'istanbul-lib-hook' {
	export function hookRequire(matcher: Matcher, transformer: Transformer, options?: any): () => void;

	export function hookCreateScript(matcher: Matcher, transformer: Transformer, options?: any): void;
	export function unhookCreateScript(): void;

	export function hookRunInThisContext(matcher: Matcher, transformer: Transformer, options?: any): void;
	export function unhookRunInThisContext(): void;

	export function unloadRequireCache(matcher: Matcher): void;

	export interface Matcher {
		(filename: string): boolean;
	}

	export interface Transformer {
		(code: string, filepath: string): string;
	}
}
