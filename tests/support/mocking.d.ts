declare namespace mocking {
	export interface MockedResource<T = any> {
		module: T;
		remove: () => void;
	}

	export interface MockRequire {
		<T = any>(
			require: (id: string) => any,
			mod: string,
			mocks: { [key: string]: any }
		): Promise<MockedResource<T>>;
	}

	export interface DocCreator {
		(): Document;
	}

	export interface LocCreator {
		(): Location;
	}
}
