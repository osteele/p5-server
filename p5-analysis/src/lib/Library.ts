import fs from 'fs';
import { JavaScriptSyntaxError, Script } from './Script';
import { Category } from './Category';

export const p5Version = '1.4.0';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Library {
  export type Properties = {
    name: string;
    categoryKey?: string;
    description: string;
    homepage: string;
    packageName?: string;
    repository?: string;
    importPath?: string;
    defines?: Record<'globals' | 'p5', string[]>;
  };
}

/** A library that can be used with p5.js sketches. */
export class Library implements Library.Properties {
  static _all: Library[] = [];
  public static get categories() {
    return Category.all;
  }

  /** The human-readable name of the library. */
  public readonly name: string;
  /** The human-readable description of the library. */
  public readonly description: string;
  /**  The library's home page. */
  public readonly homepage: string;
  /** The npm package name of the library. */
  public readonly packageName?: string;
  public readonly repository?: string;
  public readonly categoryKey?: string;
  /** Global variables (functions and classes) and p5.* properties that the
   * library defines. */
  public readonly defines?: Record<'globals' | 'p5', string[]>;
  private _importPath?: string;

  private constructor(spec: Library.Properties) {
    this.name = spec.name;
    this.description = spec.description;
    this.homepage = spec.homepage;
    this.repository = spec.repository;
    this.categoryKey = spec.categoryKey;
    this._importPath = spec.importPath;
    Object.assign(this, spec);
  }

  //#region instantation
  /** Adds a library from a record in a library.json file. */
  static fromProperties(
    props: Library.Properties,
    { ifExists = 'error' }: { ifExists?: 'error' | 'replace' } = {}
  ): Library {
    const lib = new Library(props);
    const ix = Library.all.findIndex(l => l.name === lib.name);
    if (ifExists === 'error' && ix >= 0) {
      throw new Error(`Library ${lib.name} already exists.`);
    } else if (ix >= 0) {
      Library._all.splice(ix, 1, lib);
    } else {
      Library._all.push(lib);
    }
    return lib;
  }

  /** Adds all the libraries in the given library specification JSON file to the
   * global library array `Library.all`.
   */
  static addFromJsonFile(
    jsonPath: string,
    defaultProps: Partial<Library.Properties>
  ): readonly Library[] {
    const properties = JSON.parse(
      fs.readFileSync(jsonPath, 'utf-8')
    ) as Library.Properties[];
    const libs = properties.map(props =>
      Library.fromProperties({ ...defaultProps, ...props })
    );
    return libs;
  }
  //#endregion

  static get all(): readonly Library[] {
    return this._all;
  }

  /** Find a library by its name or import path. */
  static find({
    name,
    importPath,
  }: {
    name?: string;
    importPath?: string;
  }): Library | null {
    const libs = this.all;
    if (libs.length === 0) {
      // This has cost me a lot of debugging a couple of times.
      console.warn('Library.all has not been initialized');
    }
    if (name) {
      return libs.find(lib => lib.name === name) || null;
    } else if (importPath) {
      return libs.find(lib => lib.matchesImportPath(importPath)) || null;
    }
    return null;
  }

  static inferFromScripts(
    scriptPaths: string[],
    { ifNotExists = 'skip' } = {}
  ): readonly Library[] {
    const libs: Library[] = [];
    // TODO: remove each script's global from other scripts' free variables.
    //
    // This doesn't make a functional difference with the current usage, because
    // inference is only used for JavaScript-only sketches, which can only be a
    // single script.
    for (const scriptFile of scriptPaths) {
      if (ifNotExists === 'skip' && !fs.existsSync(scriptFile)) continue;
      try {
        const { freeVariables, p5properties } = Script.fromFile(scriptFile);
        for (const lib of this.all) {
          if (
            lib.defines?.globals?.some(name => freeVariables!.has(name)) ||
            lib.defines?.p5?.some(name => p5properties!.has(name))
          ) {
            libs.push(lib);
          }
        }
      } catch (e) {
        if (!(e instanceof JavaScriptSyntaxError || e instanceof SyntaxError)) {
          throw e;
        }
      }
    }
    return libs;
  }

  get globals() {
    return Object.entries(this.defines || {}).flatMap(([key, symbols]) =>
      key === 'globals' ? symbols : symbols.map(s => `${key}.${s}`)
    );
    // return [
    //   ...this.defines?.globals || [],
    //   ...this.defines?.p5?.map(s => `p5.${s}`) || []
    // ];
  }

  get repositoryUrl() {
    if (this.repository) {
      return this.repository;
    }
    // if it's a GitHub Pages page, derive the corresponding repo URL
    const homepage = this.homepage.replace(
      /^https:\/\/([^.]+)\.github\.io\/([^/]+).*/,
      'https://github.com/$1/$2'
    );
    if (homepage.startsWith('https://github.com/')) {
      return homepage;
    }
    return null;
  }

  /** A path that can be used to load the library. */
  get importPath() {
    let path = this._importPath;
    if (path) {
      path = path.replace(/^@/, '/');
      if (path.startsWith('/')) {
        path = `${this.repositoryUrl!.replace(/\/$/, '')}${path}`;
      }
      // If it's a repo file, derive the corresponding raw location. This is
      // outside the above conditional because it should apply to absolute paths
      // too.
      path = path.replace(/^https:\/\/github.com\//, 'https://ghcdn.rawgit.org/');
      path = path.replace('$(P5Version)', p5Version);
    } else if (this.packageName) {
      path = `https://unpkg.com/${this.packageName}`;
    }
    return path;
  }

  private set importPath(value: string | undefined) {
    this._importPath = value;
  }

  private matchesImportPath(path: string): boolean {
    return Boolean(
      this.importPath &&
        (this.importPath === path ||
          (this.packageName && Library.getCdnUrlPackageName(path) === this.packageName))
    );
  }

  private static getCdnUrlPackageName(urlString: string) {
    return (urlString.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/([^/]+)/) ||
      urlString.match(/^https:\/\/unpkg\.com\/([^/@]+)/))?.[1];
  }
}
