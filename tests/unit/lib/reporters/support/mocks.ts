import { spy } from 'sinon';

export function createMockNode(tagName: string, parent: any, content?: string) {
  const mockNode = {
    content,
    tagName,
    parentNode: parent,
    style: {},
    children: <any[]>[],
    appendChild: spy((node: any) => {
      mockNode.children.push(node);
      node.parentNode = mockNode;
    }),
    scrollHeight: 0,
    textContent() {
      if (mockNode.children.length > 0) {
        return mockNode.children.map(child => child.textContent()).join('');
      }
      return mockNode.content || '';
    }
  };
  return mockNode;
}

export function createMockDocument() {
  const body = createMockNode('body', createMockNode('html', undefined));
  const doc = {
    body,
    documentElement: body,
    createDocumentFragment: spy(() => createMockNode('#fragment', undefined)),
    createElement: spy((tagName: string) => createMockNode(tagName, undefined)),
    createTextNode: spy((text: string) => createMockNode('', undefined, text))
  };
  return doc;
}

export function createLocation(): Location {
  return <any>{
    hash: '',
    host: '',
    hostname: '',
    href: '',
    origin: '',
    pathname: '',
    port: '',
    protocol: '',
    search: '',
    assign: function() {},
    reload: function() {},
    replace: function() {},
    toString: function(): string {
      return '';
    }
  };
}
