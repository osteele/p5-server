import fs, { type Dirent } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import beautify from 'js-beautify';
import { minimatch } from 'minimatch';
import { type HTMLElement, parse as parseHtml } from 'node-html-parser';
import nunjucks from 'nunjucks';
import pug from 'pug';
import {
  asyncFilter,
  asyncFind,
  asyncSome,
  capitalize,
  isHtmlPathname,
  isScriptPathname,
} from '../helpers/index.js';
import { Cdn } from './Cdn.js';
import { Library, p5Version } from './Library.js';
import {
  LibraryIndex,
  type LibraryPolicy,
  type LibraryQuery,
  type LibraryResolution,
} from './LibraryIndex.js';
import { Script } from './Script.js';

const templateDir = fileURLToPath(new URL('./templates', import.meta.url));
const defaultGenerationOptions = { draw: true, examples: true };
const defaultDirectoryExclusions = [
  '.*',
  '*~', // editor backup file
  '*.log',
  'node_modules',
  'package.json',
  'package-lock.json',
  'p5-server.config.json',

  // Linux
  '~*', // backup file

  // macOS
  'Icon\r', // Custom Finder icon

  // Windows
  'Thumbs.db',
];

export type SketchStructureType =
  | 'html' /** The main file is an HTML file */
  | 'script'; /** The main file is a script file */

export type SketchRenderOptions = {
  libraryPolicy?: LibraryPolicy;
  p5Version?: string;
};

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
  ): Sketch {
    if (isHtmlPathname(mainFile)) {
      return new HtmlSketch(
        path.dirname(mainFile),
        path.basename(mainFile),
        options.scriptFile,
        options
      );
    } else if (isScriptPathname(mainFile)) {
      if (mainFile && options.scriptFile) {
        throw new Error(
          `Cannot specify both a JavaScript mainFile and options.scriptFile`
        );
      }
      return new ScriptSketch(
        path.dirname(mainFile),
        path.basename(mainFile),
        options
      );
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
    options?: { exclusions?: string[]; depth?: number }
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
    } else if (isScriptPathname(filePath)) {
      return Sketch.fromScriptFile(filePath);
    } else if (isHtmlPathname(filePath)) {
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
    options?: { excludeSymbolicLinks?: boolean; exclusions?: string[] }
  ): Promise<{
    sketches: Sketch[];
    allFiles: string[];
    unassociatedFiles: string[];
  }> {
    const sketches: Sketch[] = [];

    const exclusions = options?.exclusions || defaultDirectoryExclusions;
    const entries = (await readdir(dir, { withFileTypes: true })).filter(
      (entry) =>
        !(options?.excludeSymbolicLinks && entry.isSymbolicLink()) &&
        !exclusions.some((pattern) => minimatch(entry.name, pattern))
    );
    let files = entries.map((entry) => entry.name);

    // collect directory sketches, and remove them from the list of files
    const directoryNames = new Set(
      entries
        .filter((entry) => isDirectoryEntry(dir, entry))
        .map((entry) => entry.name)
    );
    files = await asyncFilter(files, async (name) => {
      if (!directoryNames.has(name)) return true;
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
      const sketch = await HtmlSketch.fromSketchFile(filePath);
      if (sketch) sketches.push(sketch);
    }

    const associatedFiles = new Set<string>();
    const resolvedDir = path.resolve(dir);
    collectAssociatedFiles();

    // collect JS sketches
    for (const file of files.filter((file) => !associatedFiles.has(file))) {
      const filePath = path.join(dir, file);
      if (await Sketch.isSketchScriptFile(filePath)) {
        const sketch = await Sketch.fromScriptFile(filePath);
        sketches.push(sketch);
        addAssociatedFiles(sketch);
      }
    }
    return {
      sketches,
      allFiles: files,
      unassociatedFiles: files.filter((file) => !associatedFiles.has(file)),
    };

    function collectAssociatedFiles() {
      for (const sketch of sketches) addAssociatedFiles(sketch);
    }

    function addAssociatedFiles(sketch: Sketch) {
      if (path.resolve(sketch.dir) !== resolvedDir) return;
      for (const file of sketch.files) associatedFiles.add(file);
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
  static async isSketchFile(file: string): Promise<boolean> {
    return (
      (await Sketch.isSketchHtmlFile(file)) ||
      (await Sketch.isSketchScriptFile(file))
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
    { exclusions = defaultDirectoryExclusions, depth = 10 } = {}
  ): Promise<Sketch | null> {
    // This implementation is functionally equivalent to testing whether `(await
    // Sketch.analyzeDirectory(dir)).sketches.length === 1`, but it is more
    // efficient. This is especially important in the context of the VS Code
    // extension.

    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return null;
    }

    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(
        (entry) => !exclusions.some((pattern) => minimatch(entry.name, pattern))
      );
    const files = entries
      .filter((entry) => !isDirectoryEntry(dir, entry))
      .map((entry) => path.join(dir, entry.name));

    // is there an index.html file?
    const indexFiles = await asyncFilter(
      files.filter((file) => /^index\.html?$/i.test(path.basename(file))),
      Sketch.isSketchHtmlFile
    );
    if (indexFiles.length > 1) {
      return null;
    }

    // are there other HTML sketch files?
    const [indexFile] = indexFiles;
    const otherHtmlSketches = await asyncFilter(
      files.filter((file) => file !== indexFile),
      Sketch.isSketchHtmlFile
    );
    if (otherHtmlSketches.length > 0) {
      return null;
    }

    // are there JavaScript sketch files that aren't associated with the index.html sketch?
    const sketch = indexFile ? await Sketch.fromHtmlFile(indexFile) : null;
    const associatedScripts = new Set(
      sketch ? sketch.files.map((file) => path.join(sketch.dir, file)) : []
    );
    const scriptSketches = await asyncFilter(
      files.filter((file) => !associatedScripts.has(file)),
      Sketch.isSketchScriptFile
    );
    if (indexFiles.length + scriptSketches.length !== 1) {
      return null;
    }

    // are there subdirectories that contain sketch files?
    if (await subdirectoriesContainSketchFiles(dir, depth)) {
      return null;
    }

    const result = sketch || (await Sketch.fromFile(scriptSketches[0]));
    const associatedFiles = new Set(
      result.files.map((file) => path.resolve(result.dir, file))
    );
    const hasLooseFile = files.some(
      (file) =>
        !/^readme\.(md|mkd|mkdn|mdwn|mdown|markdown)$/i.test(
          path.basename(file)
        ) && !associatedFiles.has(path.resolve(file))
    );
    return hasLooseFile ? null : result;

    async function subdirectoriesContainSketchFiles(
      dir: string,
      depth: number,
      includeFiles = false
    ): Promise<boolean> {
      if (depth <= 0) {
        return false;
      }
      const entries = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter(
          (entry) =>
            !exclusions.some((pattern) => minimatch(entry.name, pattern))
        );
      return asyncSome(entries, (entry) => {
        const file = path.join(dir, entry.name);
        return isDirectoryEntry(dir, entry)
          ? subdirectoriesContainSketchFiles(file, depth - 1, true)
          : includeFiles
            ? Sketch.isSketchFile(file)
            : Promise.resolve(false);
      });
    }
  }

  //#endregion

  //#region properties

  /** The file structure of the sketch. */
  abstract get structureType(): SketchStructureType;

  /** For an HTML sketch, this is the HTML file. For a JavaScript sketch, this is
   * the JavaScript file. In either case, it is relative to dir.
   */
  abstract get mainFile(): string;

  get mainFilePath(): string {
    return path.join(this.dir, this.mainFile);
  }

  get htmlFilePath(): string | null {
    return this.htmlFile ? path.join(this.dir, this.htmlFile) : null;
  }

  get scriptFilePath(): string {
    return path.join(this.dir, this.scriptFile);
  }

  get name(): string {
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
  get title(): string {
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
  abstract get files(): readonly string[];

  //#endregion

  //#region libraries

  /** The list of libraries. For a JavaScript sketch, this is the list of
   * libraries inferred from the undefined global variables that it references.
   * For an HTML sketch, this is the list of libraries named in the HTML file.
   *
   * @category Libraries
   */
  get libraries(): readonly Library[] {
    return this.resolveLibraries().libraries;
  }

  protected impliedLibraries(): readonly Library[] {
    return LibraryIndex.default.resolveScripts(
      this.files
        .filter((name) => isScriptPathname(name))
        .map((name) => path.join(this.dir, name))
    ).libraries;
  }

  /** Resolve libraries and report policy exclusions and ambiguous signals. */
  public resolveLibraries(options: LibraryQuery = {}): LibraryResolution {
    return LibraryIndex.default.resolveScripts(
      this.files
        .filter((name) => isScriptPathname(name))
        .map((name) => path.join(this.dir, name)),
      options
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
    const files: [filename: string, templateName: string][] = [];
    if (this.htmlFile) files.push([this.htmlFile, Sketch.indexTemplateName]);
    files.push([this.scriptFile, 'sketch.js.njk']);

    const outputs = await Promise.all(
      files.map(async ([filename, templateName]) => ({
        content: await this.getGeneratedFileContent(templateName, options),
        filename,
        filepath: resolvePathInDirectory(this.dir, filename),
      }))
    );
    const portableOutputs = new Set<string>();
    for (const { filename, filepath } of outputs) {
      const key = portablePathKey(filepath);
      if (portableOutputs.has(key)) {
        throw new Error(`Generated file output collision: ${filepath}`);
      }
      assertPortableRelativePath(filename);
      portableOutputs.add(key);
    }
    if (!force) {
      const existing = outputs.find(({ filepath }) => fs.existsSync(filepath));
      if (existing) {
        const error = new Error(
          `File already exists: ${existing.filepath}`
        ) as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        error.path = existing.filepath;
        throw error;
      }
    }

    for (const { filepath } of outputs) {
      assertPathHasNoSymbolicLinks(this.dir, filepath);
      if (!fs.existsSync(filepath)) continue;
      const stat = fs.lstatSync(filepath);
      if (!stat.isFile()) {
        const error = new Error(
          `Generated file target is not a regular file: ${filepath}`
        ) as NodeJS.ErrnoException;
        error.code = stat.isDirectory() ? 'EISDIR' : 'EINVAL';
        error.path = filepath;
        throw error;
      }
      if (!force) {
        const error = new Error(
          `File already exists: ${filepath}`
        ) as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        error.path = filepath;
        throw error;
      }
    }

    const stagingDir = fs.mkdtempSync(
      path.join(path.resolve(this.dir), '.p5-generate-')
    );
    let retainStaging = false;
    try {
      const transactions = outputs.map(({ filepath }, index) => ({
        filepath,
        staged: path.join(stagingDir, `output-${index}`),
        backup: path.join(stagingDir, `backup-${index}`),
        backupMoved: false,
        installed: false,
      }));
      for (let index = 0; index < outputs.length; index++) {
        await writeFile(transactions[index].staged, outputs[index].content, {
          flag: 'wx',
        });
      }

      try {
        for (const transaction of transactions) {
          if (!force) {
            fs.linkSync(transaction.staged, transaction.filepath);
            transaction.installed = true;
            continue;
          }
          if (fs.existsSync(transaction.filepath)) {
            fs.renameSync(transaction.filepath, transaction.backup);
            transaction.backupMoved = true;
          }
          fs.renameSync(transaction.staged, transaction.filepath);
          transaction.installed = true;
        }
      } catch (error) {
        const rollbackErrors: unknown[] = [];
        for (const transaction of transactions.reverse()) {
          if (transaction.installed) {
            try {
              if (force) {
                fs.renameSync(transaction.filepath, transaction.staged);
              } else {
                fs.rmSync(transaction.filepath);
              }
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError);
            }
          }
          if (transaction.backupMoved) {
            try {
              fs.renameSync(transaction.backup, transaction.filepath);
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError);
            }
          }
        }
        if (rollbackErrors.length) {
          retainStaging = true;
          throw new AggregateError(
            [error, ...rollbackErrors],
            `Could not restore every generated file; recovery files retained in ${stagingDir}`
          );
        }
        throw error;
      }
    } finally {
      if (!retainStaging) {
        fs.rmSync(stagingDir, { force: true, recursive: true });
      }
    }
    return files.map(([filename]) => filename);
  }

  protected async writeGeneratedFile(
    templateName: string,
    filename: string,
    force: boolean,
    templateOptions: Record<string, unknown>
  ): Promise<string> {
    const filepath = resolvePathInDirectory(this.dir, filename);
    assertPathHasNoSymbolicLinks(this.dir, filepath);
    const content = await this.getGeneratedFileContent(
      templateName,
      templateOptions
    );
    await writeFile(filepath, content, force ? {} : { flag: 'wx' });
    return filepath;
  }

  //#endregion

  //#region templates (file generation)
  private async getGeneratedFileContent(
    base: string,
    options: Record<string, unknown>
  ): Promise<string> {
    const selectedP5Version =
      typeof options.p5Version === 'string' ? options.p5Version : p5Version;
    const libraryPolicy =
      typeof options.libraryPolicy === 'object' && options.libraryPolicy
        ? (options.libraryPolicy as LibraryPolicy)
        : undefined;
    const libraries = this.resolveLibraries({
      p5Version: selectedP5Version,
      policy: libraryPolicy,
    }).libraries;
    const data = {
      title: this.title,
      libraries,
      p5Version: selectedP5Version,
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
      return `${template.render(data).trim()}\n`;
    }
    if (templatePath.endsWith('.pug')) {
      const html = pug
        .renderFile(templatePath, { pretty: false, ...data })
        .replace(/(<!-- .*?\S)(-->)/g, '$1 $2')
        .replace(/<!-- pug: newline\s*-->/g, '\n\n');
      return beautify.html(html, { indent_size: 4, end_with_newline: true });
    }
    throw new Error(`Unknown template extension: ${templatePath}`);
  }

  public async getHtmlContent(
    options: SketchRenderOptions = {}
  ): Promise<string> {
    return this.htmlFilePath
      ? await readFile(this.htmlFilePath, 'utf-8')
      : this.getGeneratedFileContent(Sketch.indexTemplateName, options);
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
  public abstract convert(options: {
    discardHtml?: boolean;
    type: SketchStructureType;
  }): Promise<void>;
}

export class HtmlSketch extends Sketch {
  public readonly htmlFile: string;
  private _htmlRoot: HTMLElement | null | undefined;
  private _files?: readonly string[];
  private _libraries?: readonly Library[];

  constructor(
    dir: string,
    htmlFile: string = 'index.html',
    scriptFile: string = 'sketch.js',
    options: { title?: string; description?: string } = {}
  ) {
    super(dir, scriptFile, options);
    this.htmlFile = htmlFile;
  }

  static async fromFile(htmlFilePath: string): Promise<HtmlSketch> {
    const htmlContent = await readFile(htmlFilePath, 'utf-8');
    const htmlRoot = parseHtml(htmlContent);
    if (!HtmlSketch.isSketchHtmlRoot(htmlRoot)) {
      throw new Error(
        `HTML sketch does not reference p5.js and a local script file: ${htmlFilePath}`
      );
    }
    return HtmlSketch.fromHtmlRoot(htmlFilePath, htmlRoot);
  }

  static async fromSketchFile(
    htmlFilePath: string
  ): Promise<HtmlSketch | null> {
    if (!HtmlSketch.isHtmlFile(htmlFilePath)) return null;
    const htmlContent = await readFile(htmlFilePath, 'utf-8');
    const htmlRoot = parseHtml(htmlContent);
    if (!HtmlSketch.isSketchHtmlRoot(htmlRoot)) return null;
    return HtmlSketch.fromHtmlRoot(htmlFilePath, htmlRoot);
  }

  private static async fromHtmlRoot(
    htmlFilePath: string,
    htmlRoot: HTMLElement
  ): Promise<HtmlSketch> {
    const dir = path.dirname(htmlFilePath);
    const description = htmlRoot
      .querySelector('head meta[name=description]')
      ?.attributes.content.trim();
    const scripts = HtmlSketch.getLocalScriptFiles(htmlRoot);
    const scriptFile =
      (await asyncFind(scripts, (name) =>
        Sketch.isSketchScriptFile(path.join(dir, name))
      )) || scripts[0];
    const sketch = new HtmlSketch(
      dir,
      path.basename(htmlFilePath),
      scriptFile,
      {
        description,
      }
    );
    sketch._htmlRoot = htmlRoot;
    return sketch;
  }

  static async isSketchHtmlFile(htmlFilePath: string): Promise<boolean> {
    if (!HtmlSketch.isHtmlFile(htmlFilePath)) return false;

    const html = await readFile(htmlFilePath, 'utf-8');
    const htmlRoot = parseHtml(html);
    return HtmlSketch.isSketchHtmlRoot(htmlRoot);
  }

  private static isHtmlFile(htmlFilePath: string): boolean {
    return (
      isHtmlPathname(htmlFilePath) &&
      fs.existsSync(htmlFilePath) &&
      !fs.statSync(htmlFilePath).isDirectory()
    );
  }

  private static isSketchHtmlRoot(htmlRoot: HTMLElement): boolean {
    const sources = htmlRoot
      .querySelectorAll('script[src]')
      .map((node) => node.attributes.src);
    const hasP5 = sources.some((source) =>
      /(?:^|\/)p5(\.min)?\.js$/i.test(sourcePathname(source))
    );
    const hasLocalSketchScript = sources.some((source) => {
      const local = localSourcePath(source);
      return (
        local !== null &&
        !/(?:^|\/)p5(\.min)?\.js$/i.test(sourcePathname(local))
      );
    });
    return hasP5 && hasLocalSketchScript;
  }

  get structureType(): SketchStructureType {
    return 'html';
  }

  get mainFile(): string {
    return this.htmlFile;
  }

  get files(): readonly string[] {
    if (this._files) return this._files;
    const files = [
      this.htmlFile,
      this.scriptFile,
      ...this.getAssociatedFiles(),
    ];
    this._files = [...new Set(files)];
    return this._files;
  }

  get libraries(): readonly Library[] {
    if (!this._libraries) this._libraries = this.explicitLibraries();
    return this._libraries;
  }

  public resolveLibraries({
    p5Version: selectedP5Version = p5Version,
    policy,
  }: LibraryQuery = {}): LibraryResolution {
    return {
      libraries: [...this.libraries],
      excluded: [],
      ambiguities: [],
      p5Version: selectedP5Version,
      policy: LibraryIndex.effectivePolicy(policy),
    };
  }

  private explicitLibraries(): Library[] {
    const htmlRoot = this.getHtmlRoot();
    if (!htmlRoot) return [];
    const libs: (Library | null)[] = htmlRoot
      .querySelectorAll('script[src]')
      .map((node) => node.attributes.src)
      .map((importPath) => Library.find({ importPath }));
    return libs.filter((library) => library !== null);
  }

  protected getTitleFromFile(): string | null {
    return (
      this.getHtmlRoot()?.querySelector('head title')?.text?.trim() || null
    );
  }

  private getAssociatedFiles() {
    const htmlRoot = this.getHtmlRoot();
    if (htmlRoot) {
      const scriptFiles = this.getLocalScriptFiles(htmlRoot);
      return [
        ...scriptFiles,
        ...htmlRoot
          .querySelectorAll('head link[href]')
          .map((e) => e.attributes.href.replace(/^\.\//, ''))
          .filter((s) => !s.match(/https?:/)),
        ...scriptFiles.flatMap((name) =>
          Script.getAssociatedFiles(path.join(this.dir, name))
        ),
      ];
    } else {
      return [];
    }
  }

  protected getLocalScriptFiles(htmlRoot?: HTMLElement): readonly string[] {
    if (!htmlRoot) {
      htmlRoot = this.getHtmlRoot() || undefined;
    }
    return htmlRoot ? HtmlSketch.getLocalScriptFiles(htmlRoot) : [];
  }

  private getHtmlRoot(): HTMLElement | null {
    if (this._htmlRoot !== undefined) return this._htmlRoot;
    const htmlFile = this.htmlFilePath!;
    this._htmlRoot = fs.existsSync(htmlFile)
      ? parseHtml(fs.readFileSync(htmlFile, 'utf-8'))
      : null;
    return this._htmlRoot;
  }

  private static getLocalScriptFiles(htmlRoot: HTMLElement) {
    return htmlRoot
      .querySelectorAll('script[src]')
      .map((element) => localSourcePath(element.attributes.src))
      .filter((source): source is string => source !== null);
  }

  public async convert(options: {
    discardHtml?: boolean;
    type: SketchStructureType;
  }): Promise<void> {
    switch (options.type) {
      case 'script': {
        // html -> javascript
        const htmlPath = this.htmlFilePath!;

        // there must be only one script file, and no inline scripts
        const html = await readFile(htmlPath, 'utf-8');
        const htmlRoot = parseHtml(html);
        const scriptSrcs = htmlRoot
          .querySelectorAll('script')
          .map((e) => e.attributes.src);
        // if scriptSrcs contains a null, it means there's an inline script
        if (scriptSrcs.some((s) => !s)) {
          throw new Error(`${htmlPath} contains an inline script`);
        }
        const localScripts = scriptSrcs
          .map(localSourcePath)
          .filter((source): source is string => source !== null);
        switch (localScripts.length) {
          case 0:
            throw new Error(`${htmlPath} does not contain any local scripts`);
          case 1: {
            if (!isScriptPathname(localScripts[0])) {
              throw new Error(
                `${htmlPath} refers to a script file with the wrong extension`
              );
            }
            const localScriptPath = resolvePathInDirectory(
              this.dir,
              localScripts[0]
            );
            assertPathHasNoSymbolicLinks(this.dir, localScriptPath);
            if (
              !fs.existsSync(localScriptPath) ||
              !fs.lstatSync(localScriptPath).isFile()
            ) {
              throw new Error(
                `${htmlPath} refers to a script file that does not exist`
              );
            }
            break;
          }
          default:
            if (localScripts.length > 1) {
              throw new Error(`${htmlPath} contains multiple script tags`);
            }
        }

        const unrecognizedExternalScripts = scriptSrcs.filter(
          (src) =>
            isExternalScriptSource(src) &&
            !isP5ScriptSource(src) &&
            !Library.find({ importPath: src })
        );
        if (unrecognizedExternalScripts.length && !options.discardHtml) {
          throw new Error(
            `${htmlPath} contains unrecognized external scripts: ${unrecognizedExternalScripts.join(', ')}`
          );
        }

        // check that explicit and inferred libraries match
        const htmlLibs = this.explicitLibraries();
        const scriptLibs = this.impliedLibraries();
        const htmlNotScript = htmlLibs.filter(
          (lib) => !scriptLibs.some((s) => s.name === lib.name)
        );
        const scriptNotHtml = scriptLibs.filter(
          (lib) => !htmlLibs.some((h) => h.name === lib.name)
        );
        if (htmlNotScript.length) {
          throw new Error(
            `${this.htmlFile} contains libraries that are not implied by ${
              this.scriptFile
            }: ${htmlLibs.map((lib) => lib.name)}`
          );
        }
        if (scriptNotHtml.length) {
          throw new Error(
            `${this.scriptFile} implies libraries that are not in ${
              this.htmlFile
            }: ${scriptNotHtml.map((lib) => lib.name)}`
          );
        }

        if (!options.discardHtml) {
          const reason = nonDisposableHtmlReason(htmlRoot);
          if (reason) {
            throw new Error(
              `${this.htmlFile} contains ${reason}; use discardHtml to remove it anyway`
            );
          }
        }

        assertPathHasNoSymbolicLinks(this.dir, htmlPath);
        fs.unlinkSync(htmlPath);
        this._htmlRoot = null;
        this._files = undefined;
        this._libraries = undefined;
      }
    }
  }
}

function isDirectoryEntry(parent: string, entry: Dirent): boolean {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  const file = path.join(parent, entry.name);
  return fs.existsSync(file) && fs.statSync(file).isDirectory();
}

function resolvePathInDirectory(dir: string, filename: string): string {
  const resolvedDir = path.resolve(dir);
  const filepath = path.resolve(resolvedDir, filename);
  const relative = path.relative(resolvedDir, filepath);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`File path escapes the sketch directory: ${filename}`);
  }
  return filepath;
}

function portablePathKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  const { root } = path.parse(resolved);
  const relative = resolved.slice(root.length);
  return (
    root.toLowerCase() +
    relative.split(path.sep).map(portablePathComponentKey).join(path.sep)
  );
}

function assertPortableRelativePath(relativePath: string): void {
  if (path.sep !== '\\' && relativePath.includes('\\')) {
    throw new Error(
      `Generated file path is not portable to Windows because it contains an invalid filename character: ${relativePath}`
    );
  }
  for (const component of relativePath.split(/[\\/]/u).filter(Boolean)) {
    const normalized = component.normalize('NFD').replace(/[ .]+$/u, '');
    const stem = normalized.split('.', 1)[0];
    if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/iu.test(stem)) {
      throw new Error(
        `Generated file path is not portable to Windows because it uses a reserved device name: ${relativePath}`
      );
    }
    if (
      [...component].some((character) => character.charCodeAt(0) <= 31) ||
      /[<>:"|?*]/u.test(component)
    ) {
      throw new Error(
        `Generated file path is not portable to Windows because it contains an invalid filename character: ${relativePath}`
      );
    }
    if (/[ .]$/u.test(component)) {
      throw new Error(
        `Generated file path is not portable to Windows because it ends in a dot or space: ${relativePath}`
      );
    }
  }
}

function portablePathComponentKey(component: string): string {
  const normalized = component
    .normalize('NFD')
    .toLowerCase()
    .replace(/[ .]+$/u, '');
  const regularName = normalized.split(':', 1)[0];
  const stem = regularName.split('.', 1)[0];
  return /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/iu.test(stem)
    ? `\0device:${stem}`
    : regularName;
}

function assertPathHasNoSymbolicLinks(dir: string, filepath: string): void {
  const resolvedDir = path.resolve(dir);
  if (fs.lstatSync(resolvedDir).isSymbolicLink()) {
    throw new Error(
      `Generated file path contains a symbolic link: ${resolvedDir}`
    );
  }
  const relative = path.relative(resolvedDir, filepath);
  let current = resolvedDir;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(
        `Generated file path contains a symbolic link: ${current}`
      );
    }
  }
}

function isExternalScriptSource(source: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(source);
}

function localSourcePath(source: string): string | null {
  if (isExternalScriptSource(source)) return null;
  const pathname = sourcePathname(source).replace(/^\.\//, '');
  try {
    return decodeURIComponent(pathname);
  } catch (error) {
    if (error instanceof URIError) return pathname;
    throw error;
  }
}

function sourcePathname(source: string): string {
  return source.replace(/[?#].*$/, '');
}

function isP5ScriptSource(source: string): boolean {
  return /(?:^|\/)p5(\.min)?\.js$/i.test(sourcePathname(source));
}

export class ScriptSketch extends Sketch {
  private _files?: readonly string[];
  private _libraries?: readonly Library[];

  static async fromFile(scriptFile: string): Promise<ScriptSketch> {
    const dir = path.dirname(scriptFile);
    let description: string | undefined;
    if (fs.existsSync(scriptFile)) {
      const source = await readFile(scriptFile, 'utf-8');
      description = ScriptSketch.getDescriptionFromScript(source);
    }
    return new ScriptSketch(dir, path.basename(scriptFile), { description });
  }

  static async isSketchScriptFile(file: string): Promise<boolean> {
    if (
      !isScriptPathname(file) ||
      !fs.existsSync(file) ||
      fs.statSync(file).isDirectory()
    ) {
      return false;
    }

    try {
      const { defs, refs, isP5InstanceSketch } = Script.fromFile(file);
      return (
        (defs.get('setup') === 'function' && refs.has('createCanvas')) ||
        isP5InstanceSketch
      );
    } catch (e) {
      if (e instanceof SyntaxError) {
        const source = await readFile(file, 'utf-8');
        return (
          /function\s+(setup)\b/.test(source) &&
          /\bcreateCanvas\s*\(/.test(source)
        );
      }
      throw e;
    }
  }

  get structureType(): SketchStructureType {
    return 'script';
  }

  get mainFile(): string {
    return this.scriptFile;
  }

  get htmlFile(): null {
    return null;
  }

  get files(): readonly string[] {
    if (this._files) return this._files;
    const files = [
      this.scriptFile,
      ...Script.getAssociatedFiles(path.join(this.dir, this.scriptFile)),
    ];
    this._files = [...new Set(files)];
    return this._files;
  }

  get libraries(): readonly Library[] {
    if (!this._libraries) this._libraries = this.resolveLibraries().libraries;
    return this._libraries;
  }

  public async convert(options: {
    discardHtml?: boolean;
    type: SketchStructureType;
  }): Promise<void> {
    switch (options.type) {
      case 'html': {
        // javascript -> html
        const htmlName = `${this.mainFile.replace(/\.js$/, '')}.html`;
        const htmlPath = path.join(this.dir, htmlName);
        if (fs.existsSync(htmlPath)) {
          throw new Error(`${htmlPath} already exists`);
        }
        await this.writeGeneratedFile(
          Sketch.indexTemplateName,
          htmlName,
          false,
          {}
        );
      }
    }
  }

  private static getDescriptionFromScript(content: string): string | undefined {
    let text: string | undefined;
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

function nonDisposableHtmlReason(htmlRoot: HTMLElement): string | null {
  const html = htmlRoot.querySelector('html');
  const allowedHtmlAttributes = new Set(['lang']);
  if (
    html &&
    Object.keys(html.attributes).some(
      (name) => !allowedHtmlAttributes.has(name)
    )
  ) {
    return 'custom HTML attributes';
  }

  const body = htmlRoot.querySelector('body');
  if (body && (Object.keys(body.attributes).length || body.innerHTML.trim())) {
    return 'custom body content';
  }

  if (htmlRoot.querySelectorAll('link').length) return 'linked resources';

  const allowedElements = new Set([
    'HTML',
    'HEAD',
    'META',
    'TITLE',
    'STYLE',
    'BODY',
    'SCRIPT',
  ]);
  if (
    htmlRoot
      .querySelectorAll('*')
      .some((element) => !allowedElements.has(element.tagName))
  ) {
    return 'custom page elements';
  }

  const viewport = 'width=device-width, initial-scale=1';
  for (const meta of htmlRoot.querySelectorAll('meta')) {
    const attributes = meta.attributes;
    const isCharset =
      Object.keys(attributes).length === 1 && attributes.charset === 'utf-8';
    const isViewport =
      Object.keys(attributes).length === 2 &&
      attributes.name === 'viewport' &&
      attributes.content === viewport;
    if (!isCharset && !isViewport) return 'custom metadata';
  }

  const normalizeCss = (css: string) => css.replace(/\s+/g, ' ').trim();
  const generatedStyles = new Set(
    [
      'body { margin: 0; }',
      `html, body { height: 100%; }
       body { margin: 0; display: flex; justify-content: center; align-items: center; }`,
    ].map(normalizeCss)
  );
  if (
    htmlRoot
      .querySelectorAll('style')
      .some((style) => !generatedStyles.has(normalizeCss(style.text)))
  ) {
    return 'custom styles';
  }
  return null;
}
