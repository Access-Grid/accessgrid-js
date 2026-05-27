const fs = require('fs');
const path = require('path');

// Asserts the package version is consistent across every spot it appears.
// Drift has shipped before: a 1.4.0 package.json with a 1.2.1 package-lock.json
// and a hardcoded "1.3.0" version inside src/index.js. This test fails the
// build the next time any of them disagree.

const root = path.resolve(__dirname, '..', '..');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf-8'));
const src = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf-8');

describe('version consistency', () => {
  test('package-lock.json root version matches package.json', () => {
    expect(lock.version).toBe(pkg.version);
  });

  test('package-lock.json packages[""] version matches package.json', () => {
    expect(lock.packages[''].version).toBe(pkg.version);
  });

  test('src/index.js BaseApi this.version matches package.json', () => {
    const match = src.match(/this\.version = "([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe(pkg.version);
  });
});
