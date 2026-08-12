import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

type Compatibility = {
  p5Range: string;
  confidence: 'verified' | 'reported' | 'incompatible';
};

type LibraryRecord = {
  name: string;
  description: string;
  homepage: string;
  repository?: string;
  packageName?: string;
  importPath?: string;
  defines?: { globals?: string[]; p5?: string[] };
  lifecycle?: 'active' | 'maintenance' | 'legacy' | 'archived';
  compatibility?: Compatibility[];
  inference?: 'automatic' | 'directive-only';
  lastReviewed?: string;
  replacedBy?: string;
};

type OfficialLibrary = {
  name: string;
  description: string;
  sourceUrl: string;
  websiteUrl?: string;
  npm?: string;
  npmFilePath?: string;
};

const repoRoot = path.resolve(import.meta.dirname, '..');
const catalogDir = path.join(repoRoot, 'p5-analysis/src/models/libraries');
const officialDirectoryApi =
  'https://api.github.com/repos/processing/p5.js-website/contents/src/content/libraries/en?ref=main';
const reviewed = '2026-08-12';

const automaticOverrides: Record<string, LibraryRecord['defines']> = {
  'p5.asciify': { globals: ['p5asciify'] },
  'p5.brush': { globals: ['brush'] },
  'p5.capture': { globals: ['P5Capture'] },
  'p5.grain': { globals: ['p5grain'] },
  'p5.party': { globals: ['partyConnect', 'partyLoadShared'] },
  'p5.plotSvg': {
    globals: ['beginRecordSvg', 'endRecordSvg', 'p5plotSvg'],
  },
  'p5.Utils': { p5: ['Utils'] },
  'p5.webserial': { globals: ['createSerial'] },
  'p5.tween': { p5: ['tween'] },
  p5play: { globals: ['createSprite', 'loadAnimation'] },
  número: { globals: ['createTensor'] },
};

const officialOverrides: Record<string, Partial<LibraryRecord>> = {
  'p5.asciify': {
    lifecycle: 'archived',
    compatibility: [
      { p5Range: '>=1.8.0 <2.0.0', confidence: 'reported' },
      { p5Range: '>=2.0.2 <3.0.0', confidence: 'reported' },
    ],
    replacedBy: 'textmode.js',
  },
  'p5.capture': {
    importPath:
      'https://cdn.jsdelivr.net/npm/p5.capture/dist/p5.capture.umd.js',
  },
  'p5.geolocation': {
    importPath:
      'https://cdn.jsdelivr.net/gh/bmoren/p5.geolocation@master/p5.geolocation.js',
  },
  'p5.grain': {
    importPath: 'https://cdn.jsdelivr.net/npm/p5.grain/dist/p5.grain.min.js',
  },
  'p5.plotSvg': {
    compatibility: [
      { p5Range: '>=1.4.2 <2.0.0', confidence: 'reported' },
      { p5Range: '>=2.3.0 <3.0.0', confidence: 'reported' },
    ],
  },
  'p5.tree': {
    compatibility: [
      { p5Range: '<2.0.0', confidence: 'incompatible' },
      { p5Range: '>=2.0.0 <3.0.0', confidence: 'reported' },
    ],
  },
  p5play: {
    lifecycle: 'maintenance',
    replacedBy: 'q5play',
  },
  'p5.woff2': {
    compatibility: [
      { p5Range: '<2.0.0', confidence: 'incompatible' },
      { p5Range: '>=2.0.0 <3.0.0', confidence: 'reported' },
    ],
    inference: 'directive-only',
  },
};

const legacyOverrides: Record<string, Partial<LibraryRecord>> = {
  'p5.js-SVG': {
    compatibility: [
      { p5Range: '>=1.11.0 <2.0.0', confidence: 'reported' },
      { p5Range: '>=2.0.0', confidence: 'incompatible' },
    ],
  },
  'p5.gui': { inference: 'directive-only' },
  'Rotating Knobs': {
    lifecycle: 'archived',
    inference: 'directive-only',
  },
};

const response = await fetch(officialDirectoryApi, {
  headers: { Accept: 'application/vnd.github+json' },
});
if (!response.ok) {
  throw new Error(
    `Unable to read the p5.js library directory: ${response.status} ${response.statusText}`
  );
}
const files = (await response.json()) as Array<{
  download_url: string;
  name: string;
}>;
const official = await Promise.all(
  files
    .filter(({ name }) => name.endsWith('.yaml'))
    .map(async ({ download_url }) => {
      const yamlResponse = await fetch(download_url);
      if (!yamlResponse.ok) {
        throw new Error(`Unable to read ${download_url}`);
      }
      const source = (await yamlResponse.text()).replace(
        /description: '([^\n]*)\n\n'\n/,
        'description: "$1"\n'
      );
      return parse(source) as OfficialLibrary;
    })
);

const oldCommunity = readCatalog('community');
const oldLegacy = fs.existsSync(path.join(catalogDir, 'legacy-libraries.json'))
  ? readCatalog('legacy')
  : [];
const oldRecommended = readCatalog('recommended');
const oldRecords = [...oldCommunity, ...oldLegacy, ...oldRecommended];
const claimed = new Set<LibraryRecord>();

const community = official
  .map((item): LibraryRecord => {
    const previous = findPrevious(item.name);
    if (previous) claimed.add(previous);
    const homepage = item.websiteUrl ?? item.sourceUrl;
    const record: LibraryRecord = {
      ...(previous ?? {}),
      name: item.name,
      description: item.description,
      homepage,
      repository: item.sourceUrl === homepage ? undefined : item.sourceUrl,
      packageName: item.npm,
      importPath: item.npmFilePath
        ? `https://cdn.jsdelivr.net/npm/${item.npm}/${item.npmFilePath}`
        : previous?.importPath,
      defines: previous?.defines ?? automaticOverrides[item.name],
      lastReviewed: reviewed,
      ...officialOverrides[item.name],
    };
    if (item.name === 'p5.geolocation') delete record.packageName;
    record.inference ??=
      record.defines && (record.packageName || record.importPath)
        ? 'automatic'
        : 'directive-only';
    return removeUndefined(record);
  })
  .sort(compareNames);

const legacy = [...oldLegacy, ...oldCommunity]
  .filter((record) => !claimed.has(record))
  .map((record): LibraryRecord => {
    const updated = removeUndefined({
      ...record,
      lifecycle: 'legacy',
      lastReviewed: reviewed,
      ...legacyOverrides[record.name],
    });
    if (record.name === 'Rotating Knobs') delete updated.importPath;
    return updated;
  })
  .filter(
    (record, index, records) =>
      records.findIndex(({ name }) => name === record.name) === index
  )
  .sort(compareNames);

const recommended = oldRecommended
  .filter((record) => !claimed.has(record))
  .sort(compareNames);

writeCatalog('community', community);
writeCatalog('legacy', legacy);
writeCatalog('recommended', recommended);

console.log(
  `Updated ${community.length} official, ${legacy.length} legacy, and ${recommended.length} recommended library records.`
);

function readCatalog(key: string): LibraryRecord[] {
  return JSON.parse(
    fs.readFileSync(path.join(catalogDir, `${key}-libraries.json`), 'utf8')
  ) as LibraryRecord[];
}

function writeCatalog(key: string, records: LibraryRecord[]): void {
  fs.writeFileSync(
    path.join(catalogDir, `${key}-libraries.json`),
    `${JSON.stringify(records, null, 2)}\n`
  );
}

function findPrevious(name: string): LibraryRecord | undefined {
  const exact = oldRecords.find((record) => record.name === name);
  if (exact) return exact;
  if (name === 'p5play') return undefined;
  return oldRecords.find(
    (record) => normalized(record.name) === normalized(name)
  );
}

function normalized(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.js$/, '')
    .replace(/[^a-z0-9]/g, '');
}

function compareNames(a: LibraryRecord, b: LibraryRecord): number {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
}

function removeUndefined(record: LibraryRecord): LibraryRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as LibraryRecord;
}
