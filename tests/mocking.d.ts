declare namespace mocking {
	export interface Mocking {
		removeMocks(): void;
		requireWithMocks(require: (id: string) => any, mod: string, mocks: { [key: string]: any }): Promise<any>;
	}
}
