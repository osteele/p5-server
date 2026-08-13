import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LibraryIndex } from '../src';

describe('LibraryIndex', () => {
  test('contains the current official directory snapshot', () => {
    const official = LibraryIndex.default.libraries.filter(
      (library) => library.categoryKey === 'community'
    );
    expect(official).toHaveLength(97);
    expect(official.map(({ name }) => name)).toContain('p5.brush');
    expect(official.map(({ name }) => name)).toContain('p5.webserial');
  });

  test('default policy excludes legacy and archived libraries', () => {
    const result = LibraryIndex.default.query();
    expect(result.libraries.map(({ name }) => name)).not.toContain('dat.gui');
    expect(result.libraries.map(({ name }) => name)).not.toContain(
      'p5.asciify'
    );
    expect(result.excluded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'legacy' }),
        expect.objectContaining({ reason: 'archived' }),
      ])
    );
  });

  test('includeLegacy restores legacy libraries', () => {
    const result = LibraryIndex.default.query({
      policy: { includeLegacy: true },
    });
    expect(result.libraries.map(({ name }) => name)).toContain('dat.gui');
  });

  test('verified compatibility excludes unknown compatibility', () => {
    const result = LibraryIndex.default.query({
      p5Version: '2.3.2',
      policy: { compatibility: 'verified' },
    });
    expect(result.libraries.map(({ name }) => name)).toContain('p5.sound');
    expect(result.libraries.map(({ name }) => name)).not.toContain('p5.brush');
  });

  test('resolves distinctive automatic signals', () => {
    const result = LibraryIndex.default.resolve({ globals: ['brush'] });
    expect(result.libraries.map(({ name }) => name)).toEqual(['p5.brush']);
  });

  test('reports ambiguous automatic signals without loading either library', () => {
    const result = LibraryIndex.default.resolve(
      { globals: ['createSprite'] },
      { policy: { includeLegacy: true } }
    );
    expect(result.libraries).toHaveLength(0);
    expect(result.ambiguities).toEqual([
      {
        signal: 'createSprite',
        candidates: expect.arrayContaining([
          expect.objectContaining({ name: 'p5.play' }),
          expect.objectContaining({ name: 'p5play' }),
        ]),
      },
    ]);
  });

  test('directives override soft filters but not deny', () => {
    const allowed = LibraryIndex.default.resolve(
      {},
      {
        directives: ['p5.woff2'],
        policy: { compatibility: 'verified' },
      }
    );
    expect(allowed.libraries.map(({ name }) => name)).toEqual(['p5.woff2']);

    const denied = LibraryIndex.default.resolve(
      {},
      {
        directives: ['p5.woff2'],
        policy: { deny: ['p5.woff2'] },
      }
    );
    expect(denied.libraries).toHaveLength(0);
    expect(denied.excluded[0]).toMatchObject({ reason: 'denied' });
  });

  test('allow enables automatic inference for a directive-only entry', () => {
    const result = LibraryIndex.default.resolve(
      { globals: ['createGui'] },
      { policy: { allow: ['p5.gui'], deny: ['p5.touchgui'] } }
    );
    expect(result.libraries.map(({ name }) => name)).toEqual(['p5.gui']);
  });

  test('parses the documented colon form of library directives', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-library-directive-'));
    const script = path.join(dir, 'sketch.js');
    try {
      fs.writeFileSync(script, '// library: p5.sound\n');
      const result = LibraryIndex.default.resolveScripts([script]);

      expect(result.libraries.map(({ name }) => name)).toEqual(['p5.sound']);
    } finally {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });
});
