import fs from 'node:fs';
import path from 'node:path';
import { type LibraryRecord, validateCatalogs } from './library-catalog.js';

const catalogDir = path.resolve(
  import.meta.dirname,
  '../p5-analysis/src/models/libraries'
);
const keys = ['core', 'peer', 'community', 'legacy', 'recommended'];
const catalogs = Object.fromEntries(
  keys.map((key) => [
    key,
    JSON.parse(
      fs.readFileSync(path.join(catalogDir, `${key}-libraries.json`), 'utf8')
    ) as LibraryRecord[],
  ])
);

validateCatalogs(catalogs);
console.log(
  `Validated ${Object.values(catalogs).flat().length} library records.`
);
