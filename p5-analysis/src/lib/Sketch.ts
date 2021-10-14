import fs from 'fs';
import { readdir, readFile, writeFile } from 'fs/promises';
import minimatch from 'minimatch';
import { HTMLElement, parse as parseHtml } from 'node-html-parser';
import nunjucks from 'nunjucks';
import path from 'path';
import prettier from 'prettier';
import pug from 'pug';
import { asyncFilter, asyncFind, capitalize } from '../utils';
import { Library, LibraryArray, p5Version } from './Library';
import { JavaScriptSyntaxError, Script } from './Script';

const templateDir = path.join(__dirname, './templates');
const defaultGenerationOptions = { draw: true, examples: true };
const defaultDirectoryExclusions = [
  '.*',
  '*~',
  'node_modules',
  'package.json',
  'package-lock.json',
];

export type SketchStructureType =
  | 'html' /** The main file is an HTML file */
  | 'script'; /** The main file is a script file */

/** Sketch represents a p5.js Sketch. Is an interface to generate sketch files,
 *  find associated files, infer libraries, and scan directories for sketches that
 * they contain.
 *
 * A sketch can be an HTML sketch, or a script sketch.
 */
export abstract class Sketch {
  /** The directory that contains the sketch files. Other xxxFile properties are relative to this. */
  public readonly dir: string;
  /** For an HTML sketch, the pathname of the HTML file, relative to dir. */
  abstract readonly htmlFile: string | null;
  /** The main script file, relative to dir. */
  public readonly scriptFile: string;
  public readonly description?: string;
  protected readonly _title?: string;
  protected _name?: string;

  protected constructor(
    dir: string,
    scriptFile: string = 'sketch.js',
    options: { title?: string; description?: string } = {}
  ) {
    this.dir = dir;
    this.scriptFile = scriptFile;
    this._title = options.title;
    this.description = options.description;
  }

  //#region instantiation

  /**
   * @category Sketch creation
   */
  static create(
    mainFile: string,
    options: { title?: string; description?: string; scriptFile?: string } = {}
  ) {
    if (/\.html?/i.test(mainFile)) {
      return new HtmlSketch(
        path.dirname(mainFile),
        path.basename(mainFile),
        options.scriptFile,
        options
      );
    } else if (/\.js$/i.test(mainFile)) {
      if (mainFile && options.scriptFile) {
        throw new Error(`Cannot specify both a .js file and a scriptPath`);
      }
      return new ScriptSketch(path.dirname(mainFile), path.basename(mainFile), options);
    } else {
      throw new Error(`Unsupported file type: ${mainFile}`);
    }
  }

  /** Create a sketch from an HTML file.
   *
   * @category Sketch creation
   */
  static async fromHtmlFile(htmlFile: string): Promise<Sketch> {
    return HtmlSketch.fromFile(htmlFile);
  }

  /** Create a sketch from a JavaScript file.
   *
   * @category Sketch creation
   */
  static async fromScriptFile(scriptFile: string): Promise<Sketch> {
    return ScriptSketch.fromFile(scriptFile);
  }

  /** Create a sketch from a directory. This method throws an exception if the
   * directory does not contain a sketch index.html file, or contains multiple
   * sketch files.
   *
   * @category Sketch creation
   */
  static async fromDirectory(
    dir: string,
    options?: { exclusions?: string[] }
  ): Promise<Sketch> {
    const sketch = await Sketch.isSketchDir(dir, options);
    if (!sketch) throw new Error(`Directory ${dir} is not a sketch directory`);
    return sketch;
  }

  /** Create a sketch from a file. `filePath` should be path to an HTML sketch
   * file, a JavaScript sketch file, or a directory that contains exactly one
   * sketch file.
   *
   * @category Sketch detection
   */
  static fromFile(filePath: string): Promise<Sketch> {
    if (fs.statSync(filePath).isDirectory()) {
      return Sketch.fromDirectory(filePath);
    } else if (/\.js$/i.test(filePath)) {
      return Sketch.fromScriptFile(filePath);
    } else if (/\.html?$/i.test(filePath)) {
      return Sketch.fromHtmlFile(filePath);
    } else {
      throw new Error(`Unrecognized file type: ${filePath}`);
    }
  }
  //#endregion

  /** Analyze the directory for sketch files. Returns a list of sketches, and
   * files that aren't associated with any sketch.
   *
   * @category Sketch detection
   */
  static async analyzeDirectory(
    dir: string,
    options?: { exclusions?: string[] }
  ): Promise<{ sketches: Sketch[]; allFiles: string[]; unassociatedFiles: string[] }> {
    const sketches: Sketch[] = [];

    const exclusions = options?.exclusions || defaultDirectoryExclusions;
    let files = (await readdir(dir)).filter(
      file => !exclusions.some(pattern => minimatch(file, pattern))
    );

    // collect directory sketches, and remove them from the list of files
    files = await asyncFilter(files, async name => {
      const dirPath = path.join(dir, name);
      const sketch = await Sketch.isSketchDir(dirPath, { exclusions });
      if (sketch) {
        sketch.name = name;
        sketches.push(sketch);
      }
      return !sketch;
    });

    // collect HTML sketches
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (await Sketch.isSketchHtmlFile(filePath)) {
        sketches.push(await Sketch.fromHtmlFile(filePath));
      }
    }

    // collect JS sketches
    for (const file of removeProjectFiles(files)) {
      const filePath = path.join(dir, file);
      if (await Sketch.isSketchScriptFile(filePath)) {
        sketches.push(await Sketch.fromScriptFile(filePath));
      }
    }
    return {
      sketches,
      allFiles: files,
      unassociatedFiles: removeProjectFiles(files),
    };

    function removeProjectFiles(files: string[]) {
      return files.filter(f => !sketches.some(s => s.files.includes(f)));
    }
  }

  //#region detection

  /** Tests whether a file is an HTML sketch file. It is a sketch file if it
   * includes the `p5.min.js` or `p5.js` script.
   *
   * @category Sketch detection
   */
  static async isSketchHtmlFile(htmlFile: string): Promise<boolean> {
    return HtmlSketch.isSketchHtmlFile(htmlFile);
  }

  /** Tests whether a file is a JavaScript sketch file. It is recognized as a
   * sketch file if it includes a definition of the `setup()` function and a
   * call to the p5.js `createCanvas()`.
   *
   * @category Sketch detection
   */
  static async isSketchScriptFile(file: string): Promise<boolean> {
    return ScriptSketch.isSketchScriptFile(file);
  }

  /** Tests whether a file is an HTML or JavaScript sketch file.
   *
   * @category Sketch detection
   */
  static async isSketchFile(file: string) {
    return (
      (await Sketch.isSketchHtmlFile(file)) || (await Sketch.isSketchScriptFile(file))
    );
  }

  /** Tests whether the directory is a sketch directory. It is a sketch
   * directory if it contains a single JavaScript sketch file, or a single HTML
   * sketch file named `index.html` that includes this file.
   *
   * @category Sketch detection
   */
  static async isSketchDir(
    dir: string,
    options?: { exclusions?: string[] }
  ): Promise<Sketch | null> {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return null;
    }
    const { sketches } = await Sketch.analyzeDirectory(dir, options);
    const [sketch] = sketches;
    return sketches.length === 1 &&
      (sketch.structureType === 'script' || /^index\.html?$/i.test(sketch.mainFile))
      ? sketch
      : null;
  }

  //#endregion

  //#region properties

  /** The file structure of the sketch. */
  abstract get structureType(): SketchStructureType;

  /** For an HTML sketch, this is the HTML file. For a JavaScript sketch, this is
   * the JavaScript file. In either case, it is relative to dir.
   */
  abstract get mainFile(): string;

  get mainFilePath() {
    return path.join(this.dir, this.mainFile);
  }

  get htmlFilePath() {
    return this.htmlFile ? path.join(this.dir, this.htmlFile) : null;
  }

  get scriptFilePath() {
    return path.join(this.dir, this.scriptFile);
  }

  get name() {
    return (
      this._name ||
      this.mainFile.replace(/\.(html?|js)$/i, '').replace(/\s*[-_]\s*/g, ' ')
    );
  }

  set name(value: string) {
    this._name = value;
  }

  /** For an HTML sketch, this is the <title> element. Otherwise it is the base
   * name of the main file.
   */
  get title() {
    if (this._title) {
      return this._title;
    }

    const title = this.getTitleFromFile();
    if (title) {
      return title;
    }

    // otherwise, return the basename of either the HTML file or the JavaScript
    // file
    const basename = path.basename(this.mainFile);
    return capitalize(basename.replace(/\.(html?|js)$/i, '')).replace(
      /\s*[-_]\s*/g,
      ' '
    );
  }

  // HtmlSketch overrides this to read from the HTML
  protected getTitleFromFile(): string | null {
    return null;
  }

  /** The HTML file (for an HTML sketch); any JavaScript files; any files that
   * the HTML file includes; and any files that the JavaScript files include,
   * to the extent that this can be determined by static inspection.
   *
   * File names are relative to sketch.dirPath.
   */
  abstract get files(): string[];

  //#endregion

  //#region libraries

  /** The list of libraries. For a JavaScript sketch, this is the list of
   * libraries inferred from the undefined global variables that it references.
   * For an HTML sketch, this is the list of libraries named in the HTML file.
   *
   * @category Libraries
   */
  get libraries(): LibraryArray {
    return this.htmlFile ? this.explicitLibraries() : this.impliedLibraries();
  }

  protected explicitLibraries(): LibraryArray {
    const htmlPath = this.htmlFilePath;
    return htmlPath && fs.existsSync(htmlPath)
      ? Library.inHtml(htmlPath)
      : new LibraryArray();
  }

  protected impliedLibraries(): LibraryArray {
    return Library.inferFromScripts(
      this.files
        .filter(name => /\.js$/i.test(name))
        .map(name => path.join(this.dir, name))
    );
  }

  //#endregion

  //#region file generation

  protected static readonly indexTemplateName = 'index.pug';

  /** Create and save the files for this sketch. This includes the script file;
   * for an HTML sketch, this also includes the HTML file.
   *
   *
   * @category file generation
   */
  async generate(
    force = false,
    options: Record<string, unknown> = {}
  ): Promise<string[]> {
    const files = new Map<string, string>();
    if (this.htmlFile) files.set(this.htmlFile, Sketch.indexTemplateName);
    files.set(this.scriptFile, 'sketch.js.njk');

    // Don't create any files unless we can create them all.
    // This allows a race condition if two calls to generate() occur run in parallel.
    if (!force) {
      [...files.keys()].filter(fs.existsSync).forEach(filename => {
        writeFile(filename, ''); // force the error to be thrown
        // if it raced away, remove it before moving onto the next extant file (if there is one)
        fs.unlinkSync(filename);
      });
    }

    for (const [filename, templateName] of files) {
      await this.writeGeneratedFile(templateName, filename, force, options);
    }
    return [...files.keys()];
  }

  protected async writeGeneratedFile(
    templateName: string,
    filename: string,
    force: boolean,
    templateOptions: Record<string, unknown>
  ) {
    const filepath = path.join(this.dir, filename);
    const content = await this.getGeneratedFileContent(templateName, templateOptions);
    await writeFile(filepath, content, force ? {} : { flag: 'wx' });
    return filepath;
  }

  //#endregion

  //#region templates (file generation)
  private async getGeneratedFileContent(
    base: string,
    options: Record<string, unknown>
  ): Promise<string> {
    const libraries = this.libraries;
    const data = {
      title: this.title,
      libraries,
      p5Version,
      scriptFile: this.scriptFile,
      ...defaultGenerationOptions,
      ...options,
    };
    const templatePath = path.join(templateDir, base);
    if (templatePath.endsWith('.njk')) {
      // replacing the following two lines by `nunjucks.render` passes the test
      // suite, but the code fails to find the file when imported from another
      // package
      const template = nunjucks.compile(await readFile(templatePath, 'utf-8'));
      return template.render(data).trim() + '\n';
    }
    if (templatePath.endsWith('.pug')) {
      const html = pug
        .renderFile(templatePath, { pretty: false, ...data })
        .replace(/(<!-- .*?\S)(-->)/g, '$1 $2')
        .replace(/<!-- pug: newline\s*-->/g, '\n\n');
      return prettier.format(html, { parser: 'html', printWidth: 120 });
    }
    throw new Error(`Unknown template extension: ${templatePath}`);
  }

  public async getHtmlContent(): Promise<string> {
    return this.htmlFilePath
      ? await readFile(this.htmlFilePath, 'utf-8')
      : this.getGeneratedFileContent(Sketch.indexTemplateName, {});
  }
  //#endregion

  /** Convert an HTML sketch to a JavaScript-only sketch (by removing the HTML file),
   * or a JavaScript sketch to an HTML sketch (by adding the HTML file).
   *
   * Before modifying the file system, this method verifies that the set of libraries
   * will remain the same. Before removing an HTML file, it also verifies that the file
   * included only the single script file, and no other non-library files.
   *
   * @category Sketch conversion
   */
  public abstract convert(options: { type: SketchStructureType }): Promise<void>;
}

class HtmlSketch extends Sketch {
  public readonly htmlFile: string;

  constructor(
    dir: string,
    htmlFile: string = 'index.html',
    scriptFile: string = 'sketch.js',
    options: { title?: string; description?: string } = {}
  ) {
    super(dir, scriptFile, options);
    this.htmlFile = htmlFile;
  }

  static async fromFile(htmlFile: string): Promise<Sketch> {
    const dir = path.dirname(htmlFile);
    const htmlContent = await readFile(htmlFile, 'utf-8');
    const htmlRoot = parseHtml(htmlContent);
    const description = htmlRoot
      .querySelector('head meta[name=description]')
      ?.attributes.content.trim();
    const scripts = this.getLocalScriptFiles(htmlRoot);
    const scriptFile =
      (await asyncFind(scripts, name =>
        Sketch.isSketchScriptFile(path.join(dir, name))
      )) || scripts[0];
    return new HtmlSketch(dir, path.basename(htmlFile), scriptFile, { description });
  }

  static async isSketchHtmlFile(htmlFilepath: string): Promise<boolean> {
    if (!fs.existsSync(htmlFilepath) || fs.statSync(htmlFilepath).isDirectory()) {
      return false;
    }
    if (!/\.html?$/i.test(htmlFilepath)) {
      return false;
    }

    const html = await readFile(htmlFilepath, 'utf-8');
    const htmlRoot = parseHtml(html);
    const scriptSrcs = htmlRoot
      .querySelectorAll('script[src]')
      .map(node => node.attributes.src);
    // TODO: also require that a script contains setup()
    return scriptSrcs.some(src => src.search(/\bp5(\.min)?\.js$/));
  }

  get structureType(): SketchStructureType {
    return 'html';
  }

  get mainFile() {
    return this.htmlFile;
  }

  get files() {
    const files = [this.htmlFile, this.scriptFile, ...this.getAssociatedFiles()];
    return [...new Set(files)];
  }

  protected getTitleFromFile() {
    const filePath = this.htmlFilePath!;
    if (fs.existsSync(filePath)) {
      const htmlContent = fs.readFileSync(filePath, 'utf-8');
      const htmlRoot = parseHtml(htmlContent);
      const title = htmlRoot.querySelector('head title')?.text?.trim();
      if (title) return title;
    }
    return null;
  }

  private getAssociatedFiles() {
    const htmlFile = this.htmlFilePath!;
    if (fs.existsSync(htmlFile)) {
      const html = fs.readFileSync(htmlFile, 'utf-8');
      const htmlRoot = parseHtml(html);
      const scriptFiles = this.getLocalScriptFiles(htmlRoot);
      return [
        ...this.getLocalScriptFiles(htmlRoot),
        ...htmlRoot
          .querySelectorAll('head link[href]')
          .map(e => e.attributes.href.replace(/^\.\//, ''))
          .filter(s => !s.match(/https?:/)),
        ...scriptFiles.flatMap(name =>
          Script.getAssociatedFiles(path.join(this.dir, name))
        ),
      ];
    } else {
      return [];
    }
  }

  protected getLocalScriptFiles(htmlRoot?: HTMLElement) {
    if (!htmlRoot) {
      const html = fs.readFileSync(this.htmlFilePath!, 'utf-8');
      htmlRoot = parseHtml(html);
    }
    return HtmlSketch.getLocalScriptFiles(htmlRoot);
  }

  private static getLocalScriptFiles(htmlRoot: HTMLElement) {
    return htmlRoot
      .querySelectorAll('script[src]')
      .map(e => e.attributes.src.replace(/^\.\//, ''))
      .filter(s => !s.match(/https?:/));
  }

  public async convert(options: { type: SketchStructureType }) {
    switch (options.type) {
      case 'script': {
        // html -> javascript
        const htmlPath = this.htmlFilePath!;

        // there must be only one script file, and no inline scripts
        const html = await readFile(htmlPath, 'utf-8');
        const htmlRoot = parseHtml(html);
        const scriptSrcs = htmlRoot
          .querySelectorAll('script')
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
            if (!/\.js$/i.test(localScripts[0])) {
              throw new Error(
                `${htmlPath} refers to a script file with the wrong extension`
              );
            }
            if (!fs.existsSync(path.join(this.dir, localScripts[0]))) {
              throw new Error(
                `${htmlPath} refers to a script file that does not exist`
              );
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
        const htmlNotScript = htmlLibs.filter(
          lib => !scriptLibs.some(s => s.name === lib.name)
        );
        const scriptNotHtml = scriptLibs.filter(
          lib => !htmlLibs.some(h => h.name === lib.name)
        );
        if (htmlNotScript.length) {
          throw new Error(
            `${this.htmlFile} contains libraries that are not implied by ${
              this.scriptFile
            }: ${htmlLibs.map(lib => lib.name)}`
          );
        }
        if (scriptNotHtml.length) {
          throw new Error(
            `${this.scriptFile} implies libraries that are not in ${
              this.htmlFile
            }: ${scriptNotHtml.map(lib => lib.name)}`
          );
        }

        fs.unlinkSync(htmlPath);
      }
    }
  }
}

class ScriptSketch extends Sketch {
  static async fromFile(scriptFile: string): Promise<Sketch> {
    const dir = path.dirname(scriptFile);
    let description;
    if (fs.existsSync(scriptFile)) {
      const source = await readFile(scriptFile, 'utf-8');
      description = this.getDescriptionFromScript(source);
    }
    return new ScriptSketch(dir, path.basename(scriptFile), { description });
  }

  static async isSketchScriptFile(file: string) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return false;
    }
    if (!/\.js/i.test(file)) {
      return false;
    }

    try {
      const { globals, freeVariables } = Script.fromFile(file);
      return globals.get('setup') === 'function' && freeVariables.has('createCanvas');
    } catch (e) {
      if (e instanceof JavaScriptSyntaxError || e instanceof SyntaxError) {
        const source = await readFile(file, 'utf-8');
        return (
          /function\s+(setup)\b/.test(source) && /\bcreateCanvas\s*\(/.test(source)
        );
      }
      throw e;
    }
  }

  get structureType(): SketchStructureType {
    return 'script';
  }

  get mainFile() {
    return this.scriptFile;
  }

  get htmlFile() {
    return null;
  }

  get files() {
    const files = [
      this.scriptFile,
      ...Script.getAssociatedFiles(path.join(this.dir, this.scriptFile)),
    ];
    return [...new Set(files)];
  }

  public async convert(options: { type: SketchStructureType }) {
    switch (options.type) {
      case 'html': {
        // javascript -> html
        const htmlName = this.mainFile.replace(/\.js$/, '') + '.html';
        const htmlPath = path.join(this.dir, htmlName);
        if (fs.existsSync(htmlPath)) {
          throw new Error(`${htmlPath} already exists`);
        }
        await this.writeGeneratedFile(Sketch.indexTemplateName, htmlName, false, {});
      }
    }
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
    return undefined;
  }
}
