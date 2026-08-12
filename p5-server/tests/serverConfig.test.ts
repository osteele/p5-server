import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadServerConfig } from '../src/serverConfig';

describe('loadServerConfig', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-server-config-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true });
  });

  test('loads the conventional configuration file', () => {
    fs.writeFileSync(
      path.join(directory, 'p5-server.config.json'),
      JSON.stringify({
        p5Version: '2.3.2',
        libraries: {
          compatibility: 'verified',
          includeLegacy: true,
          deny: ['dat.gui'],
        },
      })
    );
    expect(loadServerConfig(directory)).toEqual({
      p5Version: '2.3.2',
      libraries: {
        compatibility: 'verified',
        includeLegacy: true,
        deny: ['dat.gui'],
      },
    });
  });

  test('rejects unknown policy keys', () => {
    const filename = path.join(directory, 'custom.json');
    fs.writeFileSync(filename, JSON.stringify({ libraries: { recent: true } }));
    expect(() => loadServerConfig(directory, filename)).toThrow(
      'unknown option recent'
    );
  });
});
