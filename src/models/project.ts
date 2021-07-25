import fs from 'fs';
import { glob } from 'glob';
import { parse } from 'node-html-parser';
import nunjucks from 'nunjucks';
import path from 'path';
import { analyzeScriptFile, JavascriptSyntaxError } from './program';

const p5Version = '1.4.0';
const templateDir = path.join(__dirname, './templates');

export class DirectoryExistsError extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, DirectoryExistsError.prototype);
  }
}

export class Project {
  dirPath: string;
  htmlIndexPath: string | null;
  jsSketchPath: string;
  title: string | null;

  constructor(dirPath: string, htmlIndexPath: string | null = 'index.html', jsSketchPath: string = 'sketch.js',
    options: { title: string | null } = { title: null }) {
    this.dirPath = dirPath;
    this.htmlIndexPath = htmlIndexPath;
    this.jsSketchPath = jsSketchPath;
    this.title = options?.title;
  }

  get indexFile() {
    return this.htmlIndexPath || this.jsSketchPath || path.basename(this.dirPath);
  }

  get name() {
    if (this.title) return this.title;
    // if there's an index file with a <title> element, read the name from that
    if (this.htmlIndexPath) {
      const filePath = path.join(this.dirPath, this.htmlIndexPath);
      if (fs.existsSync(filePath)) {
        const htmlContent = fs.readFileSync(filePath, 'utf-8');
        // TODO: replace this with HTML parser
        const m = htmlContent.match(/.*<title>(.+)<\/title>/s);
        if (m) {
          return m[1].trim();
        }
      }
    }
    // otherwise, return the basename of either the HTML file or the JavaScript
    // file
    return this.indexFile.replace(/\.(html?|js)$/, '');
  }

  get files() {
    let files: Array<string> = [];
    if (this.htmlIndexPath) {
      files.push(path.basename(this.htmlIndexPath));
    }
    if (this.jsSketchPath) {
      files.push(path.basename(this.jsSketchPath));
    }
    if (this.jsSketchPath && fs.existsSync(path.join(this.dirPath, this.jsSketchPath))) {
      try {
        const { loadCallArguments } = analyzeScriptFile(path.join(this.dirPath, this.jsSketchPath));
        const paths = [...loadCallArguments!].map(s => s.replace(/^\.\//, ''));
        files = [...files, ...paths];
      } catch (e) {
        if (!(e instanceof JavascriptSyntaxError)) {
          throw e;
        }
      }
    }
    return files;
  }

  generate(force = false) {
    const name = this.dirPath;
    try {
      fs.mkdirSync(name);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw e;
      }
      if (!fs.statSync(name).isDirectory()) {
        throw new DirectoryExistsError(`${name} already exists and is not a directory`);
      }
      if (fs.readdirSync(name).length && !force) {
        throw new DirectoryExistsError(`${name} already exists and is not empty`);
      }
    }

    this.writeGeneratedFile('index.html');
    this.writeGeneratedFile('sketch.js');
  }

  private writeGeneratedFile(base: string) {
    fs.writeFileSync(path.join(this.dirPath, base), this.getGeneratedFileContent(base));
  }

  get libraries(): LibrarySpec[] {
    if (this.jsSketchPath && fs.existsSync(path.join(this.dirPath, this.jsSketchPath))) {
      try {
        const { freeVariables, p5properties } = analyzeScriptFile(path.join(this.dirPath, this.jsSketchPath));
        return librarySpecs.filter(spec => {
          return spec.globals && spec.globals.some(name => freeVariables!.has(name)) ||
            spec.props && spec.props.some(name => p5properties!.has(name));
        }).map(spec => ({
          ...spec,
          path: spec.path?.replace("$(P5Version)", p5Version)
        }));
      } catch (e) {
        if (!(e instanceof JavascriptSyntaxError)) {
          throw e;
        }
      }
    }
    return [];
  }

  getGeneratedFileContent(base: string) {
    // Don't cache the template. It's not important to performance in this context,
    // and leaving it uncached makes development easier.
    const templatePath = path.join(templateDir, base);
    const libraries = this.libraries;
    const data = {
      title: this.title || this.dirPath.replace(/_/g, ' '),
      sketchPath: `./${this.jsSketchPath}`,
      libraries,
      p5Version
    };
    return nunjucks.render(templatePath, data);
  }
}

type LibrarySpec = {
  name: string,
  homepage: string,
  path?: string,
  version?: string,
  globals?: string[],
  props?: string[],
}

const librarySpecs: LibrarySpec[] =
  JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/libraries.json'), 'utf-8'));

export function createSketchHtml(sketchPath: string) {
  const project = new Project(path.dirname(sketchPath), null, path.basename(sketchPath));
  return project.getGeneratedFileContent('index.html');
}

export function findProjects(dir: string) {
  const projects: Array<Project> = [];
  for (const file of glob.sync('*.@(html|html)', { cwd: dir })) {
    const htmlPath = path.join(dir, file);
    if (isSketchHtml(htmlPath)) {
      const project = new Project(dir, file);
      projects.push(project);
    }
  }

  let files = fs.readdirSync(dir);
  for (const file of removeProjectFiles()) {
    const filePath = path.join(dir, file);
    if (isSketchJs(filePath)) {
      const project = new Project(dir, null, file);
      projects.push(project);
    }
  }
  return { files: removeProjectFiles(), projects };

  function removeProjectFiles() {
    return files.filter(f => !projects.some(p => p.files.includes(f)));
  }
}

function isSketchHtml(filePath: string) {
  if (fs.statSync(filePath).isDirectory()) { return false; }
  if (!filePath.endsWith('.htm') && !filePath.endsWith('.html')) {
    return false;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const root = parse(content);
  const scriptSrcs = root.querySelectorAll('script').map(node => node.attributes.src);
  return scriptSrcs.some(src => src.search(/\bp5(\.min)?\.js$/));
}

export function isSketchJs(filePath: string) {
  if (fs.statSync(filePath).isDirectory()) { return false; }
  if (!filePath.endsWith('.js')) {
    return false;
  }

  try {
    const { globals } = analyzeScriptFile(filePath, { deep: false });
    return globals.has('setup') || globals.has('draw');
  } catch (e) {
    if (e instanceof JavascriptSyntaxError) {
      return e.code.search(/function\s+(setup|draw)\b/) >= 0;
    }
    throw e;
  }
}
