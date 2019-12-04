import * as path from 'src/core/lib/common/path';

registerSuite('lib/common/path', {
  dirname() {
    assert.equal(
      path.dirname('foo'),
      '',
      'dirname of simple element should be empty'
    );
    assert.equal(
      path.dirname('/foo'),
      '/',
      'dirname of single element should be root'
    );
    assert.equal(
      path.dirname('C:\\foo\\bar'),
      'C:\\foo',
      'dirname of a Windows path should work'
    );
  },

  getPathSep() {
    assert.equal(path.getPathSep('foo', '/bar'), '/');
    assert.equal(path.getPathSep('C:\\bar', '/bar'), '\\');
  },

  join() {
    // Join a simple path to an absolute path
    assert.equal(path.join('/', 'foo'), '/foo');
    // Join a relative path to an absolute path
    assert.equal(path.join('/foo', '../bar'), '/bar');
    // Join a relative path to a Windows path
    assert.equal(path.join('C:\\foo\\bar', '../baz'), 'C:\\foo\\baz');
  },

  normalize() {
    assert.equal(path.normalize('/foo'), '/foo');
    assert.equal(path.normalize('C:\\foo'), 'C:/foo');
    assert.equal(path.normalize('C:\\foo/bar'), 'C:/foo/bar');
  },

  normalizePathEnding() {
    assert.equal(
      path.normalizePathEnding('foo'),
      'foo/',
      'path not ending in / should have /'
    );
    assert.equal(
      path.normalizePathEnding('bar/'),
      'bar/',
      'path ending in / should be unmodified'
    );
    assert.equal(
      path.normalizePathEnding(''),
      '',
      'empty path should be unmodified'
    );
  }
});
