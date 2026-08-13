import fs from 'node:fs';
import semver from 'semver';
import { removeSetElements, setUnion } from '../helpers/set-helpers.js';
import { p5Version as defaultP5Version, Library } from './Library.js';
import { Script } from './Script.js';

export type LibraryCompatibilityPolicy = 'verified' | 'allow-unknown' | 'any';

export type LibraryPolicy = {
  compatibility?: LibraryCompatibilityPolicy;
  includeLegacy?: boolean;
  collections?: string[];
  allow?: string[];
  deny?: string[];
};

export type EffectiveLibraryPolicy = Required<LibraryPolicy>;

export type LibraryExclusionReason =
  | 'archived'
  | 'collection-disabled'
  | 'compatibility-unknown'
  | 'denied'
  | 'directive-only'
  | 'incompatible'
  | 'legacy';

export type LibraryExclusion = {
  library: Library;
  reason: LibraryExclusionReason;
};

export type LibraryAmbiguity = {
  signal: string;
  candidates: Library[];
};

export type LibraryQuery = {
  p5Version?: string;
  policy?: LibraryPolicy;
};

export type LibraryQueryResult = {
  libraries: Library[];
  excluded: LibraryExclusion[];
  p5Version: string;
  policy: EffectiveLibraryPolicy;
};

export type LibraryResolution = LibraryQueryResult & {
  ambiguities: LibraryAmbiguity[];
};

export type LibrarySignals = {
  globals?: Iterable<string>;
  p5?: Iterable<string>;
};

const defaultPolicy: EffectiveLibraryPolicy = {
  compatibility: 'allow-unknown',
  includeLegacy: false,
  collections: ['core', 'community', 'recommended', 'peer'],
  allow: [],
  deny: [],
};

/** An immutable view of a library catalog that can be queried and used to
 * resolve the library references in a sketch under a user-supplied policy. */
export class LibraryIndex {
  public readonly libraries: readonly Library[];

  constructor(libraries: readonly Library[] = Library.all) {
    this.libraries = [...libraries];
  }

  static get default(): LibraryIndex {
    return new LibraryIndex(Library.all);
  }

  static effectivePolicy(policy: LibraryPolicy = {}): EffectiveLibraryPolicy {
    const collections = policy.collections ?? [...defaultPolicy.collections];
    if (policy.includeLegacy && !policy.collections) collections.push('legacy');
    return {
      ...defaultPolicy,
      ...policy,
      collections,
      allow: policy.allow ?? [],
      deny: policy.deny ?? [],
    };
  }

  query({
    p5Version = defaultP5Version,
    policy: requestedPolicy = {},
  }: LibraryQuery = {}): LibraryQueryResult {
    const policy = LibraryIndex.effectivePolicy(requestedPolicy);
    const libraries: Library[] = [];
    const excluded: LibraryExclusion[] = [];

    for (const library of this.libraries) {
      const reason = this.exclusionReason(library, p5Version, policy);
      if (reason) {
        excluded.push({ library, reason });
      } else {
        libraries.push(library);
      }
    }
    return { libraries, excluded, p5Version, policy };
  }

  resolve(
    signals: LibrarySignals,
    { directives = [], ...query }: LibraryQuery & { directives?: string[] } = {}
  ): LibraryResolution {
    const queryResult = this.query(query);
    const eligible = new Set(queryResult.libraries);
    const libraries = new Set<Library>();
    const ambiguities: LibraryAmbiguity[] = [];
    const relevantExclusions = new Map<Library, LibraryExclusion>();

    const signalGroups = [
      ...[...(signals.globals ?? [])].map((signal) => ({
        signal,
        candidates: this.libraries.filter((library) =>
          library.defines?.globals?.includes(signal)
        ),
      })),
      ...[...(signals.p5 ?? [])].map((signal) => ({
        signal: `p5.${signal}`,
        candidates: this.libraries.filter((library) =>
          library.defines?.p5?.includes(signal)
        ),
      })),
    ];

    for (const { signal, candidates } of signalGroups) {
      for (const library of candidates) {
        if (!eligible.has(library)) {
          const exclusion = queryResult.excluded.find(
            ({ library: item }) => item === library
          );
          if (exclusion) relevantExclusions.set(library, exclusion);
        }
      }
      const automatic = candidates.filter(
        (library) =>
          eligible.has(library) &&
          (library.inference === 'automatic' ||
            queryResult.policy.allow.includes(library.name))
      );
      if (automatic.length === 1) {
        libraries.add(automatic[0]);
      } else if (automatic.length > 1) {
        ambiguities.push({ signal, candidates: automatic });
      }
    }

    for (const directive of directives) {
      const library =
        this.findDirective(directive) ??
        (/^https?:\/\//.test(directive)
          ? Library.fromUrl(directive)
          : Library.fromPackageName(directive));
      if (queryResult.policy.deny.includes(library.name)) {
        relevantExclusions.set(library, { library, reason: 'denied' });
      } else {
        libraries.add(library);
        relevantExclusions.delete(library);
      }
    }

    return {
      ...queryResult,
      libraries: [...libraries],
      excluded: [...relevantExclusions.values()],
      ambiguities,
    };
  }

  resolveScripts(
    scriptPaths: string[],
    options: LibraryQuery & { ifNotExists?: 'skip' | 'error' } = {}
  ): LibraryResolution {
    const { ifNotExists = 'skip', ...query } = options;
    const paths =
      ifNotExists === 'skip'
        ? scriptPaths.filter((scriptPath) => fs.existsSync(scriptPath))
        : scriptPaths;
    const scripts = paths
      .map(Script.fromFile)
      .filter((script) => script.getErrors().length === 0);
    const defs = setUnion(
      ...scripts.map((script) => new Set(script.defs.keys()))
    );
    const globals = setUnion(...scripts.map((script) => script.refs));
    removeSetElements(globals, defs);
    const p5 = setUnion(...scripts.map((script) => script.p5propRefs));
    const libraryPattern = /^library(?:\s*:\s*|\s+)(.+)/;
    const directives = scripts
      .flatMap((script) => script.findMatchingComments(libraryPattern))
      .flatMap((directive) =>
        directive.match(libraryPattern)![1].split(/,?\s+/)
      );
    return this.resolve({ globals, p5 }, { ...query, directives });
  }

  private exclusionReason(
    library: Library,
    p5Version: string,
    policy: EffectiveLibraryPolicy
  ): LibraryExclusionReason | null {
    if (policy.deny.includes(library.name)) return 'denied';
    if (policy.allow.includes(library.name)) return null;
    if (!policy.collections.includes(library.categoryKey ?? '')) {
      return 'collection-disabled';
    }
    if (!policy.includeLegacy && library.lifecycle === 'archived') {
      return 'archived';
    }
    if (!policy.includeLegacy && library.lifecycle === 'legacy') {
      return 'legacy';
    }
    if (policy.compatibility === 'any') return null;

    const version = semver.coerce(p5Version)?.version;
    const match = version
      ? library.compatibility.find(({ p5Range }) =>
          semver.satisfies(version, p5Range)
        )
      : undefined;
    if (match?.confidence === 'incompatible') return 'incompatible';
    if (!match && policy.compatibility === 'verified') {
      return 'compatibility-unknown';
    }
    if (
      match?.confidence === 'reported' &&
      policy.compatibility === 'verified'
    ) {
      return 'compatibility-unknown';
    }
    return null;
  }

  private findDirective(spec: string): Library | null {
    const matches = this.libraries.filter(
      (library) =>
        library.name === spec ||
        library.packageName === spec ||
        library.importPath === spec
    );
    return matches.length === 1 ? matches[0] : null;
  }
}
