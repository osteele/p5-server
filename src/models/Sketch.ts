import fs from 'fs';
import minimatch from 'minimatch';
import { HTMLElement, parse } from 'node-html-parser';
import nunjucks from 'nunjucks';
import path from 'path';
import { Library, p5Version } from './Library';
import { Script } from './Script';
import { JavascriptSyntaxError } from './script-analysis';

const templateDir = path.join(__dirname, './templates');
const defaultGenerationOptions = { draw: true, examples: true }
const defaultDirectoryExclusions = ['.*', '*~', 'node_modules', 'package.json', 'package-lock.json'];

export class DirectoryExistsError extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, DirectoryExistsError.prototype);
  }
}

export class Sketch {
  public readonly dirPath: string;
  public readonly htmlPath: string | null;
  public readonly scriptPath: string;
  public readonly title?: string;
  public readonly description?: string;

  protected constructor(dirPath: string, htmlPath: string | null = 'index.html', scriptPath: string = 'sketch.js',
    options: { title?: string, description?: string } = {}) {
    this.dirPath = dirPath;
    this.htmlPath = htmlPath;
    this.scriptPath = scriptPath;
    this.title = options.title;
    this.description = options.description;
  }

  static create(mainFile: string, options: { title?: string, description?: string, scriptPath?: string } = {}) {
    if (mainFile.endsWith('.html') || mainFile.endsWith('.htm')) {
      return new Sketch(path.dirname(mainFile), path.basename(mainFile), options.scriptPath, options);
    } else if (mainFile.endsWith('.js')) {
      if (mainFile && options.scriptPath) {
        throw new Error(`Cannot specify both a .js file and a scriptPath`);
      }
      return new Sketch(path.dirname(mainFile), null, path.basename(mainFile), options);
    } else {
      throw new Error(`Unsupported file type: ${mainFile}`);
    }
  }

  static fromHtmlFile(htmlPath: string) {
    const dirPath = path.dirname(htmlPath);
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const htmlRoot = parse(htmlContent);
    const title = htmlRoot.querySelector('head title')?.text.trim();
    const description = htmlRoot.querySelector('head meta[name=description]')?.attributes.content.trim();
    const scripts = this.getLocalScriptFilesFromHtml(htmlRoot, '');
    return new Sketch(dirPath, path.basename(htmlPath), scripts[0], { title, description });
  }

  static fromScriptFile(filePath: string) {
    const dirPath = path.dirname(filePath);
    let description;
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      description = this.getDescriptionFromScript(content);
    }
    return new Sketch(dirPath, null, path.basename(filePath), { description });
  }

  static fromFile(filePath: string) {
    if (fs.statSync(filePath).isDirectory()) {
      return Sketch.fromDirectory(filePath);
    } else if (/\.js$/.test(filePath)) {
      return Sketch.fromScriptFile(filePath);
    } else if (/\.html$/.test(filePath)) {
      return Sketch.fromHtmlFile(filePath);
    } else {
      throw new Error(`Unrecognized file type: ${filePath}`);
    }
  }

  static fromDirectory(dirPath: string, options?: { exclusions?: string[] }) {
    const sketch = Sketch.isSketchDir(dirPath, options);
    if (!sketch) {
      throw new Error(`Directory ${dirPath} is not a sketch directory`);
    }
    return sketch;
  }

  static analyzeDirectory(dir: string, options?: { exclusions?: string[] }) {
    const sketches: Sketch[] = [];

    const exclusions = options?.exclusions || defaultDirectoryExclusions;
    let files = fs.readdirSync(dir)
      .filter(s => !exclusions.some(exclusion => minimatch(s, exclusion)));

    files = files.filter(name => {
      const dirPath = path.join(dir, name);
      const project = Sketch.isSketchDir(dirPath, { exclusions });
      if (project) {
        // Re-create the project so that all the file names are relative to this
        // directory, not the project directory; and name it after the directory
        // so that it can be distinguished from other directory sketches (which
        // all tend to have the same name).

        // FIXME: the following works but is terrible code.
        sketches.push(new Sketch(dir,
          project.htmlPath && path.join(name, project.htmlPath),
          project.scriptPath && path.join(name, project.scriptPath),
          { title: name + '/', description: project.description }));
      }
      return !project;
    });

    // collect HTML sketches
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (Sketch.isSketchHtmlFile(filePath)) {
        sketches.push(Sketch.fromHtmlFile(filePath));
      }
    }

    // collect JS sketches
    for (const file of removeProjectFiles(files)) {
      const filePath = path.join(dir, file);
      if (Sketch.isSketchScriptFile(filePath)) {
        sketches.push(Sketch.fromScriptFile(filePath));
      }
    }
    return { sketches, allFiles: files, unaffiliatedFiles: removeProjectFiles(files) };

    function removeProjectFiles(files: string[]) {
      return files.filter(f => !sketches.some(p => p.files.includes(f)));
    }
  }

  static isSketchHtmlFile(filePath: string) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { return false; }
    if (!filePath.endsWith('.htm') && !filePath.endsWith('.html')) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const htmlRoot = parse(content);
    const scriptSrcs = htmlRoot.querySelectorAll('script[src]').map(node => node.attributes.src);
    return scriptSrcs.some(src => src.search(/\bp5(\.min)?\.js$/));
  }

  static isSketchScriptFile(filePath: string) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { return false; }
    if (!filePath.endsWith('.js')) {
      return false;
    }

    try {
      const { globals, freeVariables } = Script.fromFile(filePath);
      return globals.get('setup') === 'FunctionDeclaration' && freeVariables.has('createCanvas');
    } catch (e) {
      if (e instanceof JavascriptSyntaxError) {
        return /function\s+(setup)\b/.test(e.code) && /\bcreateCanvas\s*\(/.test(e.code);
      }
      throw e;
    }
  }

  static isSketchDir(dirPath: string, options?: { exclusions?: string[] }): Sketch | null {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) { return null; }
    const { sketches, unaffiliatedFiles } = Sketch.analyzeDirectory(dirPath, options);
    return (sketches.length === 1 &&
      unaffiliatedFiles.every(file => /^readme($|\.)/i.test(file)))
      ? sketches[0]
      : null;
  }

  private static getLocalScriptFilesFromHtml(htmlRoot: HTMLElement, dir: string) {
    return htmlRoot.querySelectorAll('script[src]')
      .map(e => e.attributes.src.replace(/^\.\//, ''))
      .filter(s => !s.match(/https?:/))
      .map(s => path.join(dir, s));
  }

  private static getDescriptionFromScript(content: string) {
    let text;
    let m = content.match(/\n*((?:\/\/.*\n)+)/);
    if (m) {
      text = m[1].replace(/^\/\//gm, '').trim();
    }
    m = content.match(/\n*\/\*+(.+?)\*\//s);
    if (m) {
      text = m[1].replace(/^\s*\**/gm, '').trim();
    }
    m = text?.match(/^Description:\s*(.+)/s) || null;
    if (m) {
      return m[1].replace(/\n\n.+/, '');
    }
  }

  get mainFile() {
    return this.htmlPath || this.scriptPath || path.basename(this.dirPath);
  }

  get name() {
    if (this.title) return this.title;

    // if there's an index file with a <title> element, read the name from that
    if (this.htmlPath) {
      const filePath = path.join(this.dirPath, this.htmlPath);
      if (fs.existsSync(filePath)) {
        const htmlContent = fs.readFileSync(filePath, 'utf-8');
        const htmlRoot = parse(htmlContent);
        const title = htmlRoot.querySelector('head title')?.text?.trim();
        if (title) return title;
      }
    }

    // otherwise, return the basename of either the HTML file or the JavaScript
    // file
    return this.mainFile.replace(/\.(html?|js)$/, '');
  }

  get files() {
    let files: string[] = [];
    if (this.htmlPath) {
      files.push(this.htmlPath);
    }
    if (this.scriptPath) {
      files.push(this.scriptPath);
    }
    if (this.htmlPath) {
      const filePath = path.join(this.dirPath, this.htmlPath);
      if (fs.existsSync(filePath)) {
        const htmlContent = fs.readFileSync(filePath, 'utf-8');
        const htmlRoot = parse(htmlContent);
        const dir = path.dirname(this.htmlPath);
        files = [
          ...files,
          ...Sketch.getLocalScriptFilesFromHtml(htmlRoot, dir),
          ...htmlRoot.querySelectorAll('head link[href]')
            .map(e => e.attributes.href.replace(/^\.\//, ''))
            .filter(s => !s.match(/https?:/))
            .map(s => dir != '' ? path.join(dir, s) : s)
        ];
      }
    }
    if (this.scriptPath && fs.existsSync(path.join(this.dirPath, this.scriptPath))) {
      try {
        const { loadCallArguments } = Script.fromFile(path.join(this.dirPath, this.scriptPath));
        const paths = [...loadCallArguments!].map(s => s.replace(/^\.\//, ''));
        files = [...files, ...paths];
      } catch (e) {
        if (!(e instanceof JavascriptSyntaxError)) {
          throw e;
        }
      }
    }
    return [...new Set(files)];
  }

  generate(force = false, options: Record<string, unknown> = {}) {
    const dirPath = this.dirPath;
    try {
      fs.mkdirSync(dirPath);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw e;
      }
      if (!fs.statSync(dirPath).isDirectory()) {
        throw new DirectoryExistsError(`${dirPath} already exists and is not a directory`);
      }
      if (fs.readdirSync(dirPath).length && !force && this.htmlPath) {
        throw new DirectoryExistsError(`${dirPath} already exists and is not empty`);
      }
    }

    if (this.htmlPath) { this.writeGeneratedFile('index.html', this.htmlPath, force, options) }
    this.writeGeneratedFile('sketch.js.njk', this.scriptPath, force, options);
  }

  private writeGeneratedFile(templateName: string, relPath: string, force: boolean, options: Record<string, unknown>) {
    const filePath = path.join(this.dirPath, relPath);
    if (!force && fs.existsSync(filePath)) {
      throw new Error(`${filePath} already exists`);
    }
    fs.writeFileSync(filePath, this.getGeneratedFileContent(templateName, options));
  }

  get libraries(): Library[] {
    return this.htmlPath
      ? this.explicitLibraries()
      : this.impliedLibraries();
  }

  private explicitLibraries(): Library[] {
    const htmlPath = this.htmlPath && path.join(this.dirPath, this.htmlPath);
    return htmlPath && fs.existsSync(htmlPath)
      ? Library.findLibrariesInHtml(htmlPath)
      : [];
  }

  private impliedLibraries(): Library[] {
    return Library.inferLibrariesFromScripts(
      this.files
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(this.dirPath, f)));
  }

  protected getGeneratedFileContent(base: string, options: Record<string, unknown>) {
    // Don't cache the template. It's not important to performance in this context,
    // and leaving it uncached makes development easier.
    const templatePath = path.join(templateDir, base);
    const libraries = this.libraries;
    const data = {
      title: this.title || this.mainFile?.replace(/_/g, ' ') || 'Sketch',
      sketchPath: `./${this.scriptPath}`,
      libraries,
      p5Version,
      ...defaultGenerationOptions,
      ...options
    };
    return nunjucks.render(templatePath, data).trim() + '\n';
  }

  generateHtmlContent() {
    return this.getGeneratedFileContent('index.html', {});
  }

  convert(options: { type: 'html' | 'javascript' }) {
    switch (options.type) {
      case 'html': {
        if (this.htmlPath) {
          // it's already an HTML sketch
          return;
        }
        const htmlName = this.mainFile.replace(/\.js$/, '') + '.html';
        const htmlPath = path.join(this.dirPath, htmlName);
        if (fs.existsSync(htmlPath)) {
          throw new Error(`${htmlPath} already exists`);
        }
        this.writeGeneratedFile('index.html', htmlName, false, {});
      }
        break;
      case 'javascript': {
        if (!this.htmlPath) {
          // it's already a JavaScript sketch
          return;
        }
        const htmlLibs = this.explicitLibraries();
        const scriptLibs = this.impliedLibraries();
        const htmlNotScript = htmlLibs.filter(lib => !scriptLibs.some(s => s.name === lib.name));
        const scriptNotHtml = scriptLibs.filter(lib => !htmlLibs.some(h => h.name === lib.name));
        if (htmlNotScript.length) {
          throw new Error(`${path.join(this.dirPath, this.htmlPath)} contains libraries that are not implied by ${this.scriptPath}: ${htmlLibs.map(lib => lib.name)}`);
        }
        if (scriptNotHtml.length) {
          throw new Error(`${path.join(this.dirPath, this.scriptPath)} implies libraries that are not in ${this.htmlPath}: ${scriptNotHtml.map(lib => lib.name)}`);
        }

        const htmlPath = path.join(this.dirPath, this.htmlPath);
        fs.unlinkSync(htmlPath);
      }
    }
  }
}

export function createSketchHtml(scriptPath: string) {
  const sketch = Sketch.fromFile(scriptPath);
  return sketch.generateHtmlContent();
}
