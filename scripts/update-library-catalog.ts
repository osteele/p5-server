import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import {
  type CatalogOverride,
  compileCommunityCatalog,
  type LibraryRecord,
  type OfficialLibrary,
  serializeCatalog,
  validateCatalogs,
} from './library-catalog.js';

type SourceLock = {
  repository: string;
  branch: string;
  commit: string;
  directory: string;
};

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourceDir = path.join(import.meta.dirname, 'catalog');
const catalogDir = path.join(repoRoot, 'p5-analysis/src/models/libraries');
const sourcePath = path.join(sourceDir, 'source.json');
const refreshSource = process.argv.includes('--refresh-source');
const source = readJson<SourceLock>(sourcePath);

if (refreshSource) source.commit = await resolveBranch(source);

const official = await readOfficialLibraries(source);
const overrides = readJson<Record<string, CatalogOverride>>(
  path.join(sourceDir, 'community-overrides.json')
);
const legacy = readJson<LibraryRecord[]>(
  path.join(sourceDir, 'legacy-libraries.json')
);
const community = compileCommunityCatalog(official, overrides);
const output = { community, legacy };
const repeated = {
  community: compileCommunityCatalog(official, overrides),
  legacy,
};

validateCatalogs({
  core: readRuntimeCatalog('core'),
  peer: readRuntimeCatalog('peer'),
  recommended: readRuntimeCatalog('recommended'),
  ...output,
});
if (serializeCatalog(output) !== serializeCatalog(repeated)) {
  throw new Error('Catalog generation is not deterministic');
}

writeCatalogs(output);
if (refreshSource) writeJson(sourcePath, source);
formatGeneratedFiles([
  ...Object.keys(output).map((key) =>
    path.join(catalogDir, `${key}-libraries.json`)
  ),
  ...(refreshSource ? [sourcePath] : []),
]);

console.log(
  `Generated ${community.length} community and ${legacy.length} legacy library records from p5.js-website ${source.commit}.`
);

async function resolveBranch(lock: SourceLock): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${lock.repository}/commits/${lock.branch}`,
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (!response.ok) {
    throw new Error(
      `Unable to resolve ${lock.repository}#${lock.branch}: ${response.status} ${response.statusText}`
    );
  }
  const result = (await response.json()) as { sha?: string };
  if (!result.sha) throw new Error('GitHub response did not include a commit');
  return result.sha;
}

async function readOfficialLibraries(
  lock: SourceLock
): Promise<OfficialLibrary[]> {
  const api = `https://api.github.com/repos/${lock.repository}/contents/${lock.directory}?ref=${lock.commit}`;
  const response = await fetch(api, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) {
    throw new Error(
      `Unable to read the p5.js library directory: ${response.status} ${response.statusText}`
    );
  }
  const files = (await response.json()) as Array<{
    download_url: string | null;
    name: string;
  }>;
  return Promise.all(
    files
      .filter(({ name }) => name.endsWith('.yaml'))
      .map(async ({ download_url, name }) => {
        if (!download_url) throw new Error(`${name} has no download URL`);
        const yamlResponse = await fetch(download_url);
        if (!yamlResponse.ok) {
          throw new Error(`Unable to read ${download_url}`);
        }
        const yaml = (await yamlResponse.text()).replace(
          /description: '([^\n]*)\n\n'\n/,
          'description: "$1"\n'
        );
        return parse(yaml) as OfficialLibrary;
      })
  );
}

function writeCatalogs(catalogs: Record<string, LibraryRecord[]>): void {
  const pending = Object.entries(catalogs).map(([key, records]) => {
    const destination = path.join(catalogDir, `${key}-libraries.json`);
    const temporary = `${destination}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, serializeCatalog(records));
    return { destination, temporary };
  });
  try {
    for (const { destination, temporary } of pending) {
      fs.renameSync(temporary, destination);
    }
  } finally {
    for (const { temporary } of pending) {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
}

function readJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as T;
}

function readRuntimeCatalog(key: string): LibraryRecord[] {
  return readJson<LibraryRecord[]>(
    path.join(catalogDir, `${key}-libraries.json`)
  );
}

function writeJson(filename: string, value: unknown): void {
  fs.writeFileSync(filename, serializeCatalog(value));
}

function formatGeneratedFiles(filenames: string[]): void {
  const result = Bun.spawnSync(
    ['bun', 'x', 'biome', 'format', '--write', ...filenames],
    { cwd: repoRoot, stdout: 'inherit', stderr: 'inherit' }
  );
  if (!result.success) throw new Error('Unable to format generated catalogs');
}
