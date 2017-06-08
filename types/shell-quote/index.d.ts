declare module 'shell-quote' {
	export function quote(args: string[]): string;
	export function parse(args: string): string[];
}
