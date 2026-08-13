import { parseNpmSpecifier } from '../p5-analysis/src/models/Cdn.js';

type Compatibility = {
  p5Range: string;
  confidence: 'verified' | 'reported' | 'incompatible';
};

type Defines = { globals?: string[]; p5?: string[] };

export type LibraryRecord = {
  name: string;
  description: string;
  homepage: string;
  repository?: string;
  packageName?: string;
  importPath?: string;
  defines?: Defines;
  lifecycle?: 'active' | 'maintenance' | 'legacy' | 'archived';
  compatibility?: Compatibility[];
  inference?: 'automatic' | 'directive-only';
  lastReviewed?: string;
  replacedBy?: string;
};

export type LibraryLoad =
  | {
      kind: 'npm';
      packageName: string;
      file?: string;
      version?: string;
      provider?: 'jsdelivr' | 'unpkg';
    }
  | { kind: 'github'; repository: string; ref: string; file: string }
  | { kind: 'repository'; file: string }
  | { kind: 'url'; url: string; packageName?: string };

type CuratedFields = Pick<
  LibraryRecord,
  | 'defines'
  | 'lifecycle'
  | 'compatibility'
  | 'inference'
  | 'lastReviewed'
  | 'replacedBy'
> & { load?: LibraryLoad };

export type CatalogOverride = {
  set?: CuratedFields;
  remove?: Array<keyof LibraryRecord>;
};

export type OfficialLibrary = {
  name: string;
  description: string;
  sourceUrl: string;
  websiteUrl?: string;
  npm?: string;
  npmFilePath?: string;
};

type SourceRecord = Omit<LibraryRecord, 'packageName' | 'importPath'> & {
  load?: LibraryLoad;
};

export function compileCommunityCatalog(
  official: OfficialLibrary[],
  overrides: Record<string, CatalogOverride>
): LibraryRecord[] {
  const officialNames = new Set(official.map(({ name }) => name));
  const obsolete = Object.keys(overrides).filter(
    (name) => !officialNames.has(name)
  );
  if (obsolete.length > 0) {
    throw new Error(
      `Overrides refer to missing libraries: ${obsolete.join(', ')}`
    );
  }

  return official
    .map((item) => {
      const homepage = item.websiteUrl ?? item.sourceUrl;
      const base: SourceRecord = removeUndefined({
        name: item.name,
        description: item.description,
        homepage,
        repository: item.sourceUrl === homepage ? undefined : item.sourceUrl,
        load: officialLoad(item),
      });
      const override = overrides[item.name];
      const source = { ...base, ...override?.set };
      const record = renderRecord(source);
      for (const key of override?.remove ?? []) delete record[key];
      record.inference ??=
        record.defines && (record.packageName || record.importPath)
          ? 'automatic'
          : 'directive-only';
      return removeUndefined(record);
    })
    .sort(compareNames);
}

export function validateCatalogs(
  catalogs: Record<string, LibraryRecord[]>
): void {
  const errors: string[] = [];
  const all = Object.values(catalogs).flat();
  const names = new Set<string>();
  for (const record of all) {
    const prefix = record.name || '<unnamed>';
    if (names.has(record.name)) errors.push(`${prefix}: duplicate name`);
    names.add(record.name);
    if (!record.name || !record.description || !record.homepage) {
      errors.push(`${prefix}: name, description, and homepage are required`);
    }
    if (record.packageName && !parseNpmSpecifier(record.packageName)) {
      errors.push(`${prefix}: invalid npm package ${record.packageName}`);
    }
    if (/\b(?:undefined|null)\b/.test(record.importPath ?? '')) {
      errors.push(`${prefix}: invalid import path ${record.importPath}`);
    }
    if (
      record.inference === 'automatic' &&
      (!record.defines || (!record.packageName && !record.importPath))
    ) {
      errors.push(
        `${prefix}: automatic inference requires definitions and a load target`
      );
    }
    for (const symbol of [
      ...(record.defines?.globals ?? []),
      ...(record.defines?.p5 ?? []),
    ]) {
      if (!/^[A-Za-z_$][\w$]*$/.test(symbol)) {
        errors.push(`${prefix}: invalid JavaScript identifier ${symbol}`);
      }
    }
    if (
      record.lastReviewed &&
      !/^\d{4}-\d{2}-\d{2}$/.test(record.lastReviewed)
    ) {
      errors.push(`${prefix}: invalid lastReviewed date`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

export function serializeCatalog(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function officialLoad(item: OfficialLibrary): LibraryLoad | undefined {
  if (!item.npm) return undefined;
  if (!parseNpmSpecifier(item.npm)) {
    throw new Error(`${item.name}: invalid npm package ${item.npm}`);
  }
  return removeUndefined({
    kind: 'npm',
    packageName: item.npm,
    file: item.npmFilePath,
  }) as LibraryLoad;
}

function renderRecord(source: SourceRecord): LibraryRecord {
  const { load, ...record } = source;
  if (!load) return record;
  switch (load.kind) {
    case 'npm': {
      const version = load.version ? `@${load.version}` : '';
      const provider = load.provider ?? 'jsdelivr';
      const base =
        provider === 'unpkg'
          ? `https://unpkg.com/${load.packageName}${version}`
          : `https://cdn.jsdelivr.net/npm/${load.packageName}${version}`;
      return removeUndefined({
        ...record,
        packageName: load.packageName,
        importPath: load.file ? `${base}/${load.file}` : undefined,
      });
    }
    case 'github':
      return {
        ...record,
        importPath: `https://cdn.jsdelivr.net/gh/${load.repository}@${load.ref}/${load.file}`,
      };
    case 'repository':
      return { ...record, importPath: `/${load.file.replace(/^\/+/, '')}` };
    case 'url':
      return removeUndefined({
        ...record,
        packageName: load.packageName,
        importPath: load.url,
      });
  }
}

function compareNames(a: LibraryRecord, b: LibraryRecord): number {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
}

function removeUndefined<T extends object>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as T;
}
