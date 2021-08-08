import fs from 'fs';
import { parse } from 'node-html-parser';
import path from 'path';
import { JavaScriptSyntaxError, Script } from './Script';

export const p5Version = '1.4.0';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Library {
  export type Properties = {
    name: string;
    description: string;
    homepage: string;
    packageName?: string;
    importPath?: string;
    defines?: Record<'globals' | 'p5', string[]>;
  };
}

/** A library that can be used with p5.js sketches. */
export class Library implements Library.Properties {
  static all: Library[] = [];
  /** The human-readable name of the library. */
  public readonly name: string;
  /** The human-readable description of the library. */
  public readonly description: string;
  /**  The library's home page. */
  public readonly homepage: string;
  /** The npm package name of the library. */
  public readonly packageName?: string;
  /** Global variables (functions and classes) and p5.* properties that the
   * library defines. */
  public readonly defines?: Record<'globals' | 'p5', string[]>;
  private _importPath?: string;

  constructor(spec: Library.Properties) {
    this.name = spec.name;
    this.description = spec.description;
    this.homepage = spec.homepage;
    this._importPath = spec.importPath;
    Object.assign(this, spec);
  }

  static fromSpec(spec: Library.Properties): Library {
    return new Library(spec);
  }

  /** Adds a library from a record in a library.json file. */
  static add(spec: Library.Properties) {
    Library.all.push(new Library(spec));
  }

  /** Adds all the libraries in the given library specification JSON file to the
   * global library array in Library.all. */
  static addFromJson(jsonPath: string) {
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    json.forEach(Library.add);
  }

  /** Finds a library by its name. */
  static find(name: string): Library | null {
    return this.all.find(lib => lib.name === name) || null;
  }

  static inferFromScripts(scriptPaths: string[]): LibraryArray {
    let libs: LibraryArray = new LibraryArray();
    // TODO: remove each script's global from other scripts' free variables.
    //
    // This doesn't make a functional difference with the current usage, because
    // inference is only used for JavaScript-only sketches, which can only be a
    // single script.
    for (const scriptFile of scriptPaths) {
      if (fs.existsSync(scriptFile)) {
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
          if (!(e instanceof JavaScriptSyntaxError)) {
            throw e;
          }
        }
      }
    }
    return libs;
  }

  static inHtml(htmlPath: string): LibraryArray {
    let libs: LibraryArray = new LibraryArray();
    const content = fs.readFileSync(htmlPath, 'utf-8');
    const htmlRoot = parse(content);
    const scriptSrcs = htmlRoot.querySelectorAll('script[src]').map(node => node.attributes.src);
    const inferredLibs = libs;
    libs = new LibraryArray();
    scriptSrcs.forEach(src => {
      const lib = this.all.find(lib => lib.matchesPath(src));
      if (lib) {
        libs.push(lib);
      }
    });
    libs.inferredFromScripts = inferredLibs.filter(lib => !libs.includes(lib));
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

  /** A path that can be used to load the library. */
  get importPath() {
    let path = this._importPath;
    if (path) {
      if (path.startsWith('/')) {
        let homepage = this.homepage;
        // if it's a GitHub Pages page, derive the corresponding repo URL
        homepage = homepage.replace(/^https:\/\/([^.]+)\.github\.io\/([^/]+).*/, 'https://github.com/$1/$2');
        path = `${homepage.replace(/\/$/, '')}${path}`;
      }
      // If it's a repo file, derive the corresponding raw location. This is
      // outside the above conditional because it should apply to absolute paths
      // too.
      path = path.replace(/^https:\/\/github.com\//, 'https://raw.githubusercontent.com/');
      path = path.replace('$(P5Version)', p5Version);
    } else if (this.packageName) {
      path = `https://unpkg.com/${this.packageName}`;
    }
    return path;
  }

  private set importPath(value: string | undefined) {
    this._importPath = value;
  }

  protected matchesPath(path: string) {
    if (!this.importPath) return false;
    return this.importPath === path || (this.packageName && getPackageName(path) === this.packageName);

    function getPackageName(s: string) {
      const m = s.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/([^/]+)/) || s.match(/^https:\/\/unpkg\.com\/([^/]+)/);
      return m ? m[1] : undefined;
    }
  }
}

export class LibraryArray extends Array<Library> {
  inferredFromScripts?: Library[];

  get withImportPaths() {
    return this.filter(lib => lib.importPath);
  }
  get withoutImportPaths() {
    return this.filter(lib => !lib.importPath);
  }

  map<U>(fn: (lib: Library, index: number, array: Library[]) => U): U[] {
    return Array.from(Array.prototype.map.call(this, fn)) as U[];
  }
}

Library.addFromJson(path.join(__dirname, './libraries.json'));
