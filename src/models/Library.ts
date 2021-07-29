import fs from 'fs';
import { parse } from 'node-html-parser';
import path from 'path';
import { Script } from './Script';
import { JavascriptSyntaxError } from './script-analysis';

export const p5Version = '1.4.0';

type LibrarySpec = {
  name: string;
  homepage: string;
  packageName?: string;
  path?: string;
  globals?: string[];
  props?: string[];
};

export class Library implements LibrarySpec {
  name: string;
  homepage: string;
  packageName?: string;
  _path?: string;
  globals?: string[];
  props?: string[];

  constructor(spec: LibrarySpec) {
    this.name = spec.name;
    this.homepage = spec.homepage;
    this._path = spec.path;
    Object.assign(this, spec);
  }

  static fromSpec(spec: LibrarySpec): Library {
    return new Library(spec);
  }

  static inferLibraries(scriptPaths: string[], htmlPath?: string | null): LibraryArray {
    let libs: LibraryArray = new LibraryArray();
    for (const scriptFile of scriptPaths) {
      if (fs.existsSync(scriptFile)) {
        try {
          const { freeVariables, p5properties } = Script.fromFile(scriptFile);
          for (const lib of libraries) {
            if (lib.globals?.some(name => freeVariables!.has(name)) || lib.props?.some(name => p5properties!.has(name))) {
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
    if (htmlPath && fs.existsSync(htmlPath)) {
      const content = fs.readFileSync(htmlPath, 'utf-8');
      const htmlRoot = parse(content);
      const scriptSrcs = htmlRoot.querySelectorAll('script').map(node => node.attributes.src);
      const inferredLibs = libs;
      libs = new LibraryArray();
      scriptSrcs.forEach(src => {
        const lib = libraries.find(lib => lib.matchesPath(src));
        if (lib) {
          libs.push(lib);
        }
      });
      libs.inferredFromScripts = inferredLibs.filter(lib => !libs.includes(lib));
    }
    return libs;
  }


  get path() {
    if (this._path) {
      return this._path.replace("$(P5Version)", p5Version);
    }
    if (this.packageName) {
      return `https://unpkg.com/${this.packageName}`
    }
  }

  set path(value: string | undefined) {
    this._path = value;
  }

  matchesPath(path: string) {
    return this.path === path || this.packageName && getPackageName(path) === this.packageName;
    function getPackageName(s: string) {
      const m = s.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/([^/]+)/)
        || s.match(/^https:\/\/unpkg\.com\/([^/]+)/);
      return m ? m[1] : undefined;
    }
  }
}

class LibraryArray extends Array<Library> {
  inferredFromScripts?: Library[];

  get withImportPaths() {
    return this.filter(lib => lib.path);
  }
  get withoutImportPaths() {
    return this.filter(lib => !lib.path);
  }
}


const librarySpecs: LibrarySpec[] =
  JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/libraries.json'), 'utf-8'))

export const libraries: Library[] =
  librarySpecs.map(Library.fromSpec);
