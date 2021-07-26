import fs from 'fs';
import path from 'path';

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
}

const librarySpecs: LibrarySpec[] =
  JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/libraries.json'), 'utf-8'))

export const libraries: Library[] =
  librarySpecs.map((spec: LibrarySpec) => new Library(spec));
