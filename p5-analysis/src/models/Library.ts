import fs from 'fs';
import { removeSetElements, setUnion } from '../helpers/set-helpers';
import { Category } from './Category';
import { Cdn } from './Cdn';
import { Script } from './Script';

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
  private static _all: Library[] = [];

  public static get categories(): readonly Category[] {
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

  toJSON(): unknown {
    return {
      name: this.name,
      description: this.description,
      homepage: this.homepage,
      packageName: this.packageName,
      repository: this.repository,
      importPath: this.importPath,
      defines: this.defines
    };
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

  static fromUrl(importPath: string): Library {
    // TODO: if it's a CDN URL, recognize the package name
    // TODO: if it's a GitHub URL, infer the homepage
    return Library.fromProperties({
      name: '<library named in comment directive>',
      description: 'Library specified in script file comment directive',
      homepage: '',
      importPath
    });
  }

  static fromPackageName(packageName: string): Library {
    return Library.fromProperties({
      name: packageName,
      description: 'Library specified in script file comment directive',
      homepage: '',
      packageName
    });
  }

  //#endregion

  static get all(): readonly Library[] {
    return this._all;
  }

  /** Find a library by its name or import path. */
  static find({
    name,
    importPath,
    packageName
  }: {
    name?: string;
    importPath?: string;
    packageName?: string;
  }): Library | null {
    let libs = this.all;
    if (libs.length === 0) {
      // This has cost me a lot of debugging time a couple of times, so check
      // for it.
      console.warn('Library.all has not been initialized');
    }
    if (name) {
      libs = libs.filter(lib => lib.name === name);
    }
    if (packageName) {
      libs = libs.filter(lib => lib.packageName === packageName);
    }
    if (importPath) {
      libs = libs.filter(lib => lib.matchesImportPath(importPath));
    }
    return libs.length === 1 ? libs[0] : null;
  }

  static inferFromScripts(
    scriptPaths: string[],
    { ifNotExists = 'skip' } = {}
  ): readonly Library[] {
    if (ifNotExists === 'skip') {
      scriptPaths = scriptPaths.filter(path => fs.existsSync(path));
    }
    const scripts = scriptPaths
      .map(Script.fromFile)
      .filter(script => script.getErrors().length === 0);
    const defs = setUnion(...scripts.map(script => new Set(script.defs.keys())));
    const refs = setUnion(...scripts.map(script => script.refs));
    const p5Properties = setUnion(...scripts.map(script => script.p5propRefs));
    removeSetElements(refs, defs);

    const libs = this.all.filter(
      lib =>
        lib.defines?.globals?.some(name => refs.has(name)) ||
        lib.defines?.p5?.some(name => p5Properties.has(name))
    );

    const libraryPattern = /^library:?\b\s*(.+)/;
    const directives = scripts.flatMap(script =>
      script.findMatchingComments(libraryPattern)
    );
    const libSpecs = directives.flatMap(directive =>
      directive.match(libraryPattern)![1].split(/,?\s+/)
    );
    const newLibs = libSpecs.map(
      spec =>
        Library.find({ name: spec }) ||
        Library.find({ packageName: spec }) ||
        Library.find({ importPath: spec }) ||
        createLibraryFromSpec(spec)
    );
    libs.push(...newLibs.filter(lib => !libs.includes(lib)));

    return libs;

    function createLibraryFromSpec(spec: string) {
      if (/^https?:\/\//.test(spec)) {
        return Library.fromUrl(spec);
      } else {
        return Library.fromPackageName(spec);
      }
    }
  }

  get globals(): readonly string[] {
    return Object.entries(this.defines || {}).flatMap(([key, symbols]) =>
      key === 'globals' ? symbols : symbols.map(s => `${key}.${s}`)
    );
    // return [
    //   ...this.defines?.globals || [],
    //   ...this.defines?.p5?.map(s => `p5.${s}`) || []
    // ];
  }

  get repositoryUrl(): string | null {
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
  get importPath(): string | undefined {
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
    let importPath = this.importPath;
    if (!importPath) {
      return false;
    }
    importPath = importPath.replace(/\.min\.js$/, '.js');
    path = path.replace(/\.min\.js$/, '.js');
    if (path === importPath) {
      return true;
    }
    const { packageName } = this;
    if (packageName) {
      const parsed = Cdn.parseUrl(path);
      if (packageName === parsed?.packageName) {
        return true;
      }
    }
    return false;
  }
}
