import fs from 'fs';
import minimatch from 'minimatch';
import { HTMLElement, parse } from 'node-html-parser';
import nunjucks from 'nunjucks';
import path from 'path';
import { Library, p5Version } from './Library';
import { Script } from './Script';
import { JavascriptSyntaxError } from './script-analysis';

const templateDir = path.join(__dirname, './templates');

export class DirectoryExistsError extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, DirectoryExistsError.prototype);
  }
}

export class Sketch {
  dirPath: string;
  htmlPath: string | null;
  jsSketchPath: string;
  title?: string;
  description?: string;

  constructor(dirPath: string, htmlPath: string | null = 'index.html', jsSketchPath: string = 'sketch.js',
    options: { title?: string, description?: string } = {}) {
    this.dirPath = dirPath;
    this.htmlPath = htmlPath;
    this.jsSketchPath = jsSketchPath;
    this.title = options.title;
    this.description = options.description;
  }

  static fromHtmlFile(htmlPath: string) {
    const dirPath = path.dirname(htmlPath);
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const htmlRoot = parse(htmlContent);
    const title = htmlRoot.querySelector('head title')?.text.trim();
    const description = htmlRoot.querySelector('head meta[name=description]')?.attributes.content.trim();
    const scripts = this.getScriptFiles(htmlRoot);
    return new Sketch(dirPath, path.basename(htmlPath), scripts[0], { title, description });
  }

  static fromJsFile(filePath: string) {
    const dirPath = path.dirname(filePath);
    let description;
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      description = this.getJsDescription(content);
    }
    return new Sketch(dirPath, null, path.basename(filePath), { description });
  }

  static findProjects(dir: string, { exclusions: excludePatterns }: { exclusions?: string[] }) {
    const projects: Sketch[] = [];
    let files = fs.readdirSync(dir).filter(s => !excludePatterns?.some(exclusion => minimatch(s, exclusion)));

    // collect HTML sketches
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (Sketch.isSketchHtml(filePath)) {
        projects.push(Sketch.fromHtmlFile(filePath));
      }
    }

    // collect JS sketches
    for (const file of removeProjectFiles(files)) {
      const filePath = path.join(dir, file);
      if (Sketch.isSketchJs(filePath)) {
        projects.push(Sketch.fromJsFile(filePath));
      }
    }
    return { projects, files, nonProjectFiles: removeProjectFiles(files) };

    function removeProjectFiles(files: string[]) {
      return files.filter(f => !projects.some(p => p.files.includes(f)));
    }
  }

  static isSketchHtml(filePath: string) {
    if (fs.statSync(filePath).isDirectory()) { return false; }
    if (!filePath.endsWith('.htm') && !filePath.endsWith('.html')) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const htmlRoot = parse(content);
    const scriptSrcs = htmlRoot.querySelectorAll('script').map(node => node.attributes.src);
    return scriptSrcs.some(src => src.search(/\bp5(\.min)?\.js$/));
  }

  static isSketchJs(filePath: string) {
    if (fs.statSync(filePath).isDirectory()) { return false; }
    if (!filePath.endsWith('.js')) {
      return false;
    }

    try {
      const { globals, freeVariables } = Script.fromFile(filePath);
      return globals.has('setup') && freeVariables!.has('createCanvas');
    } catch (e) {
      if (e instanceof JavascriptSyntaxError) {
        return /function\s+(setup)\b/.test(e.code) && /\bcreateCanvas\s*\(/.test(e.code);
      }
      throw e;
    }
  }

  private static getScriptFiles(htmlRoot: HTMLElement) {
    return htmlRoot.querySelectorAll('script')
      .map(e => e.attributes.src.replace(/^\.\//, ''))
      .filter(s => !s.match(/https?:/));
  }

  private static getJsDescription(content: string) {
    let text;
    const m1 = content.match(/\n*((?:\/\/.*\n)+)/);
    if (m1) {
      text = m1[1].replace(/^\/\//gm, '').trim();
    }
    const m2 = content.match(/\n*\/\*+(.+?)\*\//s);
    if (m2) {
      text = m2[1].replace(/^\s*\**/gm, '').trim();
    }
    const m3 = text?.match(/^Description:\s*(.+)/s);
    if (m3) {
      return m3[1].replace(/\n\n.+/, '');
    }
  }

  get indexFile() {
    return this.htmlPath || this.jsSketchPath || path.basename(this.dirPath);
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
    return this.indexFile.replace(/\.(html?|js)$/, '');
  }

  get files() {
    let files: string[] = [];
    if (this.htmlPath) {
      files.push(path.basename(this.htmlPath));
    }
    if (this.jsSketchPath) {
      files.push(path.basename(this.jsSketchPath));
    }
    if (this.htmlPath) {
      const filePath = path.join(this.dirPath, this.htmlPath);
      if (fs.existsSync(filePath)) {
        const htmlContent = fs.readFileSync(filePath, 'utf-8');
        const htmlRoot = parse(htmlContent);
        files = [...files, ...Sketch.getScriptFiles(htmlRoot)];
      }
    }
    if (this.jsSketchPath && fs.existsSync(path.join(this.dirPath, this.jsSketchPath))) {
      try {
        const { loadCallArguments } = Script.fromFile(path.join(this.dirPath, this.jsSketchPath));
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

  generate(force = false) {
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

    if (this.htmlPath) { this.writeGeneratedFile('index.html', this.htmlPath) }
    this.writeGeneratedFile('sketch.js', this.jsSketchPath);
  }

  private writeGeneratedFile(templateName: string, relPath: string) {
    const filePath = path.join(this.dirPath, relPath);
    fs.writeFileSync(filePath, this.getGeneratedFileContent(templateName));
    console.log(`Created ${filePath}`);
  }

  get libraries(): Library[] {
    return Library.inferLibraries(
      this.files
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(this.dirPath, f)),
      this.htmlPath && path.join(this.dirPath, this.htmlPath));
  }

  getGeneratedFileContent(base: string) {
    // Don't cache the template. It's not important to performance in this context,
    // and leaving it uncached makes development easier.
    const templatePath = path.join(templateDir, base);
    const libraries = this.libraries;
    const data = {
      title: this.title || this.indexFile?.replace(/_/g, ' ') || 'Sketch',
      sketchPath: `./${this.jsSketchPath}`,
      libraries,
      p5Version
    };
    return nunjucks.render(templatePath, data);
  }
}

export function createSketchHtml(sketchPath: string) {
  const project = new Sketch(path.dirname(sketchPath), null, path.basename(sketchPath));
  return project.getGeneratedFileContent('index.html');
}
