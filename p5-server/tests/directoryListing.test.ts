import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'node-html-parser';
import { createDirectoryListing } from '../src/server/directoryListing';

test('directory listings encode filesystem names in links', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-directory-links-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'demo#one.js'),
      'function setup() { createCanvas(10, 10); }'
    );
    fs.writeFileSync(path.join(dir, 'notes%.txt'), 'notes');

    const html = await createDirectoryListing(dir, '/', {
      templateName: 'grid',
    });
    const hrefs = parse(html)
      .querySelectorAll('a[href]')
      .map((anchor) => anchor.attributes.href);

    expect(hrefs).toContain('demo%23one.js');
    expect(hrefs).toContain('demo%23one.js?fmt=view');
    expect(hrefs).toContain('notes%25.txt');
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

test('directory listings do not read README files through symlinks', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-directory-root-'));
  const dir = path.join(parent, 'root');
  const outside = path.join(parent, 'outside.md');
  try {
    fs.mkdirSync(dir);
    fs.writeFileSync(outside, 'OUTSIDE SENTINEL');
    fs.symlinkSync(outside, path.join(dir, 'README.md'));

    const html = await createDirectoryListing(dir, '/', {
      templateName: 'grid',
    });

    expect(html).not.toContain('OUTSIDE SENTINEL');
  } finally {
    fs.rmSync(parent, { force: true, recursive: true });
  }
});
