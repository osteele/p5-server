import { parse } from '@babel/parser';
import crypto from 'crypto';
import fs from 'fs';
import lruCache from 'lru-cache';
import path from 'path';
import { sizeof } from '../helpers';
import {
  findCallArguments, findGlobalDefinitions, findGlobalReferences, findPropertyReferences
} from './script-analysis';

const { P5_ANALYSIS_PRINT_CACHE_STATS } = process.env;

// This type definition is repeated here, instead of imported from
// script-analysis.ts, in order to prevent a cascade of import dependencies that
// would add a dependency on babel to this package's clients.
type DefinitionType = 'function' | 'class' | 'variable';

interface ScriptAnalysis {
  /** Names that are defined in the script. This is a map of symbols to
   * definitions types. */
  defs: ReadonlyMap<string, DefinitionType>;
  /** Free variables that the script references. */
  refs: ReadonlySet<string>;
  /** String arguments that occur in the first position to calls `loadImage()`,
   * etc. */
  loadCallArguments: ReadonlySet<string>;
  p5propRefs: ReadonlySet<string>;
}

/** Analyzes a script (string or file) for automatic library inclusion. An
 * instance of this class is used to analyze a single script. It is immutable:
 * instantiate a new instance if the file changes.
 *
 * Analysis is cached in an lru-cache. */
export class Script implements ScriptAnalysis {
  // caches:
  private _analysis?: Readonly<ScriptAnalysis>;
  private _syntaxError?: SyntaxError;
  private _ast?: Readonly<ReturnType<typeof parse>>;

  constructor(public readonly source: string, public readonly filename?: string) {
    if (this.cacheKey) {
      const [hash, data] = scriptAnalysisCache.get(this.cacheKey) || [];
      if (hash === this.cacheDigest && data) {
        if (data.type === 'analysis') {
          this._analysis = data.analysis;
        } else {
          this._syntaxError = data.syntaxError;
        }
      }
    }
  }

  static set options({ cacheSize }: { cacheSize?: number }) {
    if (cacheSize) {
      scriptAnalysisCache.max = cacheSize;
      commentDirectiveCache.max = cacheSize;
    }
  }

  static fromSource(source: string, filePath?: string): Script {
    return new Script(source, filePath);
  }

  static fromFile(filePath: string): Script {
    return new Script(fs.readFileSync(filePath, 'utf-8'), filePath);
  }

  private get cacheKey() {
    return this.filename ? path.resolve(this.filename) : undefined;
  }
  private get cacheDigest() {
    const { filename } = this;
    if (!filename || !fs.existsSync(filename)) return undefined;
    const info = fs.statSync(filename);
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ filename, size: info.size, mtime: info.mtime }))
      .digest('hex');
  }

  private get analysis(): Readonly<ScriptAnalysis> {
    if (this._analysis) {
      return this._analysis;
    }
    if (this._syntaxError) {
      throw this._syntaxError;
    }
    if (P5_ANALYSIS_PRINT_CACHE_STATS) {
      console.log(`Script analysis cache miss: ${this.filename}`);
    }
    const { ast } = this;
    const analysis = {
      defs: findGlobalDefinitions(ast),
      refs: findGlobalReferences(ast),
      loadCallArguments: findCallArguments(ast, /^load.*/),
      p5propRefs: findPropertyReferences(ast, 'p5')
    };
    this._analysis = analysis;
    if (this.cacheKey) {
      scriptAnalysisCache.set(this.cacheKey, [
        this.cacheDigest!,
        { type: 'analysis', analysis }
      ]);
    }
    return analysis;
  }

  private get ast(): ReturnType<typeof parse> {
    if (!this._ast && !this._syntaxError) {
      try {
        this._ast = parse(this.source, { sourceFilename: this.filename });
      } catch (err) {
        if (!(err instanceof SyntaxError)) throw err;
        this._syntaxError = err;
        if (this.cacheKey) {
          scriptAnalysisCache.set(this.cacheKey, [
            this.cacheDigest!,
            { type: 'syntaxError', syntaxError: err }
          ]);
        }
      }
    }
    if (this._syntaxError) throw this._syntaxError;
    return this._ast!;
  }

  get defs(): ReadonlyMap<string, DefinitionType> {
    return this.analysis.defs;
  }

  get refs(): ReadonlySet<string> {
    return this.analysis.refs;
  }

  get loadCallArguments(): ReadonlySet<string> {
    return this.analysis.loadCallArguments;
  }

  get p5propRefs(): ReadonlySet<string> {
    return this.analysis.p5propRefs;
  }

  findMatchingComments(pattern: RegExp): readonly string[] {
    const cacheKey = this.cacheKey && `${this.cacheKey}-${pattern.toString()}`;
    if (cacheKey) {
      if (P5_ANALYSIS_PRINT_CACHE_STATS)
        console.log(`Script comment cache miss: ${this.filename} / ${pattern}`);
      const [hash, data] = commentDirectiveCache.get(cacheKey) || [];
      if (hash === this.cacheDigest) {
        return data!;
      }
    }

    const comments =
      this.ast.comments?.map(c => c.value.trim()).filter(s => pattern.test(s)) || [];
    if (cacheKey) commentDirectiveCache.set(cacheKey, [this.cacheDigest!, comments]);
    return comments;
  }

  getErrors(): SyntaxError[] {
    try {
      this.analysis; // for effect
    } catch (err) {
      if (err instanceof SyntaxError) return [err];
      throw err;
    }
    return [];
  }

  getAssociatedFiles(): string[] {
    return [...this.loadCallArguments].map(s => s.replace(/^\.\//, ''));
  }

  static getAssociatedFiles(file: string): string[] {
    if (fs.existsSync(file)) {
      try {
        return Script.fromFile(file).getAssociatedFiles();
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
    }
    return [];
  }
}

// This is a global variable rather than a class property, so that it doesn't
// appear in the typescript exports. If it did appear in exports, this would
// require that clients of this package use esModuleIterop to use it or a
// package that re-exports its types.
const scriptAnalysisCache: lruCache<
  string,
  readonly [
    string,
    Readonly<
      | { type: 'analysis'; analysis: ScriptAnalysis }
      | { type: 'syntaxError'; syntaxError: Error }
    >
  ]
> = new lruCache({
  max: 20000,
  length: (value, key) => sizeof(value) + sizeof(key)
});

const commentDirectiveCache: lruCache<
  string,
  readonly [string, readonly string[]]
> = new lruCache({
  max: 20000,
  length: (value, key) => sizeof(value) + sizeof(key)
});
