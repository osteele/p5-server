import fs from 'fs';
import { parse } from 'node-html-parser';
import path from 'path';
import { Script } from './Script';
import { JavascriptSyntaxError } from './script-analysis';

export const p5Version = '1.4.0';

type LibraryProperties = {
  /** The human-readable name of the library. */
  name: string;
  /** The human-readable description of the library. */
  description: string;
  /**  The library's home page. */
  homepage: string;
  /** The npm package name of the library. */
  packageName?: string;
  /** A path that can be used to load the library. */
  importPath?: string;
  /** Global variables (functions and classes) and p5.* properties that the
   * library defines. */
  defines?: Record<'globals' | 'p5', string[]>;
};

export class Library implements LibraryProperties {
  public readonly name: string;
  public readonly homepage: string;
  public readonly packageName?: string;
  public readonly description: string;
  public readonly defines?: Record<'globals' | 'p5', string[]>;
  private _importPath?: string;

  constructor(spec: LibraryProperties) {
    this.name = spec.name;
    this.description = spec.description;
    this.homepage = spec.homepage;
    this._importPath = spec.importPath;
    Object.assign(this, spec);
  }

  static fromSpec(spec: LibraryProperties): Library {
    return new Library(spec);
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
          for (const lib of libraries) {
            if (lib.defines?.globals?.some(name => freeVariables!.has(name))
              || lib.defines?.p5?.some(name => p5properties!.has(name))) {
              libs.push(lib);
            }
          }
        } catch (e) {
          if (!(e instanceof JavascriptSyntaxError)) {
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
    const scriptSrcs = htmlRoot.querySelectorAll('script[src]')
      .map(node => node.attributes.src);
    const inferredLibs = libs;
    libs = new LibraryArray();
    scriptSrcs.forEach(src => {
      const lib = libraries.find(lib => lib.matchesPath(src));
      if (lib) {
        libs.push(lib);
      }
    });
    libs.inferredFromScripts = inferredLibs.filter(lib => !libs.includes(lib));
    return libs;
  }

  get importPath() {
    if (this._importPath) {
      return this._importPath.replace("$(P5Version)", p5Version);
    }
    if (this.packageName) {
      return `https://unpkg.com/${this.packageName}`
    }
  }

  private set importPath(value: string | undefined) {
    this._importPath = value;
  }

  protected matchesPath(path: string) {
    if (!this.importPath) return false;
    return this.importPath === path || this.packageName && getPackageName(path) === this.packageName;

    function getPackageName(s: string) {
      const m =
        s.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/([^/]+)/) ||
        s.match(/^https:\/\/unpkg\.com\/([^/]+)/);
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

const librarySpecs: LibraryProperties[] =
  JSON.parse(fs.readFileSync(path.join(__dirname, '../libraries.json'), 'utf-8'))

export const libraries: Library[] =
  librarySpecs.map(Library.fromSpec);
