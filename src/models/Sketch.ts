import fs from 'fs';
import minimatch from 'minimatch';
import { HTMLElement, parse } from 'node-html-parser';
import nunjucks from 'nunjucks';
import path from 'path';
import { Library, LibraryArray, p5Version } from './Library';
import { Script } from './Script';
import { JavascriptSyntaxError } from './script-analysis';

const templateDir = path.join(__dirname, './templates');
const defaultGenerationOptions = { draw: true, examples: true }
const defaultDirectoryExclusions = ['.*', '*~', 'node_modules', 'package.json', 'package-lock.json'];

export type SketchType = 'html' | 'javascript';

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
  public readonly description?: string;
  protected readonly _title?: string;
  protected _name?: string;

  protected constructor(dirPath: string, htmlPath: string | null = 'index.html', scriptPath: string = 'sketch.js',
    options: { title?: string, description?: string } = {}) {
    this.dirPath = dirPath;
    this.htmlPath = htmlPath;
    this.scriptPath = scriptPath;
    this._title = options.title;
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

  /** Create a sketch from an HTML file. */
  static fromHtmlFile(htmlPath: string) {
    const dirPath = path.dirname(htmlPath);
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const htmlRoot = parse(htmlContent);
    const description = htmlRoot.querySelector('head meta[name=description]')?.attributes.content.trim();
    const scripts = this.getLocalScriptFilesFromHtml(htmlRoot, '');
    return new Sketch(dirPath, path.basename(htmlPath), scripts[0], { description });
  }

  /** Create a sketch from a JavaScript file. */
  static fromScriptFile(filePath: string) {
    const dirPath = path.dirname(filePath);
    let description;
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      description = this.getDescriptionFromScript(content);
    }
    return new Sketch(dirPath, null, path.basename(filePath), { description });
  }

  /** Create a sketch from a directory. This method throws an exception if the
   * directory does not contain exactly one sketch file. */
  static fromDirectory(dirPath: string, options?: { exclusions?: string[] }) {
    const sketch = Sketch.isSketchDir(dirPath, options);
    if (!sketch) {
      throw new Error(`Directory ${dirPath} is not a sketch directory`);
    }
    return sketch;
  }

  /** Create a sketch from a file. `filePath` should be path to an HTML sketch
   * file, a JavaScript sketch file, or a directory that contains exactly one
   * sketch file. */
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

  /** Analyze the directory for sketch files. Returns a list of sketches, and
   * files that aren't associated with any sketch. */
  static analyzeDirectory(dir: string, options?: { exclusions?: string[] }) {
    const sketches: Sketch[] = [];

    const exclusions = options?.exclusions || defaultDirectoryExclusions;
    let files = fs.readdirSync(dir)
      .filter(s => !exclusions.some(exclusion => minimatch(s, exclusion)));

    // collect directory sketches, and remove them from the list of files
    files = files.filter(name => {
      const dirPath = path.join(dir, name);
      const sketch = Sketch.isSketchDir(dirPath, { exclusions });
      if (sketch) {
        sketch.name = name;
        sketches.push(sketch);
      }
      return !sketch;
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
      return files.filter(f => !sketches.some(s => s.files.includes(f)));
    }
  }

  /** Tests whether the file is an HTML sketch file. It is a sketch file if it includes
   * the `p5.min.js` or `p5.js` script.
  */
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

  /** Tests whether the file is a JavaScript sketch file. It is a sketch file if it includes
   * a definition of the `set()` function and a call to `createCanvas()`.
   */
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

  /** Tests whether the directory is a sketch directory. It is a sketch
   * directory if it contains a single JavaScript sketch file or a single HTML
   * sketch file that includes this file, and if all non-README files in the
   * directory are associated with these files. */
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

  get sketchType(): SketchType { return this.htmlPath ? 'html' : 'javascript'; }

  /** For an HTML sketch, this is the HTML file. For a JavaScript sketch, this is
   * the JavaScript file. */
  get mainFile() {
    return this.htmlPath || this.scriptPath || path.basename(this.dirPath);
  }

  get name() {
    return this._name || this.mainFile.replace(/\.(html?|js)$/, '');
  }

  set name(value: string) { this._name = value; }

  /** For an HTML sketch, this is the <title> element. Otherwise it is the base
   * name of the main file. */
  get title() {
    if (this._title) {
      return this._title;
    }

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
    const basename = path.basename(this.mainFile);
    return capitalize(basename.replace(/\.(html?|js)$/, '')).replace(/[-_]/g, ' ');

    function capitalize(str: string) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
  }

  /** The HTML file (for an HTML sketch); any JavaScript files; any files that
   * the HTML file includes; and any files that the JavaScript files include,
   * to the extent that this can be determined by static inspection. */
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

  /** Create and save the files for this sketch. This includes the script file;
   * for an HTML sketch, this also includes the HTML file. */
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

  /** The list of libraries. For a JavaScript sketch, this is the list of
   * libraries inferred from the undefined global variables that it references.
   * For an HTML sketch, this is the list of libraries named in the HTML file.
   */
  get libraries(): LibraryArray {
    return this.htmlPath
      ? this.explicitLibraries()
      : this.impliedLibraries();
  }

  private explicitLibraries(): LibraryArray {
    const htmlPath = this.htmlPath && path.join(this.dirPath, this.htmlPath);
    return htmlPath && fs.existsSync(htmlPath)
      ? Library.inHtml(htmlPath)
      : new LibraryArray();
  }

  private impliedLibraries(): LibraryArray {
    return Library.inferFromScripts(
      this.files
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(this.dirPath, f)));
  }

  protected getGeneratedFileContent(base: string, options: Record<string, unknown>) {
    const templatePath = path.join(templateDir, base);
    const libraries = this.libraries;
    const data = {
      title: this.title,
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

  /** Convert an HTML sketch to a JavaScript-only sketch (by removing the HTML file),
   * or a JavaScript sketch to an HTML sketch (by adding the HTML file).
   *
   * Before modifying the file system, this method verifies that the set of libraries
   * will remain the same. Before removing an HTML file, it also verifies that the file
   * included only the single script file, and no other non-library files.
   */
  convert(options: { type: SketchType }) {
    if (this.sketchType === options.type) {
      return;
    }
    switch (options.type) {
      case 'html': {
        // html -> javascript
        const htmlName = this.mainFile.replace(/\.js$/, '') + '.html';
        const htmlPath = path.join(this.dirPath, htmlName);
        if (fs.existsSync(htmlPath)) {
          throw new Error(`${htmlPath} already exists`);
        }
        this.writeGeneratedFile('index.html', htmlName, false, {});
        break;
      }
      case 'javascript': {
        if (!this.htmlPath) {
          return;
        }

        // html -> javascript
        const htmlPath = path.join(this.dirPath, this.htmlPath);

        // there must be only one script file, and no inline scripts
        const content = fs.readFileSync(htmlPath, 'utf-8');
        const htmlRoot = parse(content);
        const scriptSrcs = htmlRoot.querySelectorAll('script')
          .map(e => e.attributes.src);
        // if scriptSrcs contains a null, it means there's an inline script
        if (scriptSrcs.some(s => !s)) {
          throw new Error(`${htmlPath} contains an inline script`);
        }
        const localScripts = scriptSrcs.filter(s => !/^https?:/.test(s));
        switch (localScripts.length) {
          case 0:
            throw new Error(`${htmlPath} does not contain any local scripts`);
          case 1:
            if (!localScripts[0].endsWith('.js')) {
              throw new Error(`${htmlPath} refers to a script file with the wrong extension`);
            }
            if (!fs.existsSync(path.join(this.dirPath, localScripts[0]))) {
              throw new Error(`${htmlPath} refers to a script file that does not exist`);
            }
            break;
          default:
            if (localScripts.length > 1) {
              throw new Error(`${htmlPath} contains multiple script tags`);
            }
        }

        // check that explicit and inferred libraries match
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

        fs.unlinkSync(htmlPath);
      }
    }
  }
}

export function createSketchHtml(scriptPath: string) {
  const sketch = Sketch.fromFile(scriptPath);
  return sketch.generateHtmlContent();
}
