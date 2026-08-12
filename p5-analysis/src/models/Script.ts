import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { LRUCache } from 'lru-cache';
import { sizeof } from '../helpers/index.js';
import { analyzeScript } from './script-analysis.js';

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
  isP5InstanceSketch: boolean;
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
  private readonly cacheKey?: string;
  private readonly cacheDigest?: string;
  private isFileBacked = false;

  constructor(
    public readonly source: string,
    public readonly filename?: string
  ) {
    this.cacheKey = filename ? path.resolve(filename) : undefined;
    this.cacheDigest = filename ? createFileDigest(filename) : undefined;
    if (this.cacheKey && this.cacheDigest) {
      const cached = scriptAnalysisCache.get(this.cacheKey);
      if (
        cached?.digest === this.cacheDigest &&
        cached.source === this.source &&
        cached.data
      ) {
        if (cached.data.type === 'analysis') {
          this._analysis = cached.data.analysis;
        } else {
          this._syntaxError = cached.data.syntaxError;
        }
      }
    }
  }

  static set options({ cacheSize }: { cacheSize?: number }) {
    if (cacheSize) {
      scriptAnalysisCache = createScriptAnalysisCache(cacheSize);
      commentDirectiveCache = createCommentDirectiveCache(cacheSize);
    }
  }

  static fromSource(source: string, filePath?: string): Script {
    return new Script(source, filePath);
  }

  static fromFile(filePath: string): Script {
    const cacheKey = path.resolve(filePath);
    const digest = createFileDigest(filePath);
    const cached = scriptAnalysisCache.get(cacheKey);
    const source =
      digest && cached?.digest === digest && cached.fileBacked
        ? cached.source
        : fs.readFileSync(filePath, 'utf-8');
    if (digest && (cached?.digest !== digest || !cached.fileBacked)) {
      scriptAnalysisCache.set(cacheKey, {
        digest,
        fileBacked: true,
        source,
      });
    }
    const script = new Script(source, filePath);
    script.isFileBacked = true;
    return script;
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
    const analysis = analyzeScript(this.ast);
    this._analysis = analysis;
    if (this.cacheKey && this.cacheDigest) {
      scriptAnalysisCache.set(this.cacheKey, {
        data: { type: 'analysis', analysis },
        digest: this.cacheDigest,
        fileBacked: this.isFileBacked,
        source: this.source,
      });
    }
    return analysis;
  }

  private get ast(): ReturnType<typeof parse> {
    if (!this._ast && !this._syntaxError) {
      try {
        this._ast = parse(this.source, {
          sourceFilename: this.filename,
          sourceType: 'unambiguous',
        });
      } catch (err) {
        if (!(err instanceof SyntaxError)) throw err;
        this._syntaxError = err;
        if (this.cacheKey && this.cacheDigest) {
          scriptAnalysisCache.set(this.cacheKey, {
            data: { type: 'syntaxError', syntaxError: err },
            digest: this.cacheDigest,
            fileBacked: this.isFileBacked,
            source: this.source,
          });
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

  get isP5InstanceSketch(): boolean {
    return this.analysis.isP5InstanceSketch;
  }

  findMatchingComments(pattern: RegExp): readonly string[] {
    const cacheKey =
      this.cacheKey &&
      this.cacheDigest &&
      `${this.cacheKey}-${pattern.toString()}`;
    if (cacheKey) {
      if (P5_ANALYSIS_PRINT_CACHE_STATS)
        console.log(`Script comment cache miss: ${this.filename} / ${pattern}`);
      const [digest, source, data] = commentDirectiveCache.get(cacheKey) || [];
      if (digest === this.cacheDigest && source === this.source) {
        return data!;
      }
    }

    const comments =
      this.ast.comments
        ?.map((c) => c.value.trim())
        .filter((s) => pattern.test(s)) || [];
    if (cacheKey)
      commentDirectiveCache.set(cacheKey, [
        this.cacheDigest!,
        this.source,
        comments,
      ]);
    return comments;
  }

  getErrors(): SyntaxError[] {
    try {
      void this.analysis;
    } catch (err) {
      if (err instanceof SyntaxError) return [err];
      throw err;
    }
    return [];
  }

  getAssociatedFiles(): string[] {
    return [...this.loadCallArguments].map((s) => s.replace(/^\.\//, ''));
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
type ScriptAnalysisCacheValue = {
  digest: string;
  source: string;
  fileBacked: boolean;
  data?: Readonly<
    | { type: 'analysis'; analysis: ScriptAnalysis }
    | { type: 'syntaxError'; syntaxError: Error }
  >;
};

type CommentDirectiveCacheValue = readonly [string, string, readonly string[]];

const defaultCacheSize = 20 * 1024 * 1024;

let scriptAnalysisCache = createScriptAnalysisCache(defaultCacheSize);
let commentDirectiveCache = createCommentDirectiveCache(defaultCacheSize);

function createScriptAnalysisCache(maxSize: number) {
  return new LRUCache<string, ScriptAnalysisCacheValue>({
    maxSize,
    sizeCalculation: (value, key) => sizeof(value) + sizeof(key),
  });
}

function createCommentDirectiveCache(maxSize: number) {
  return new LRUCache<string, CommentDirectiveCacheValue>({
    maxSize,
    sizeCalculation: (value, key) => sizeof(value) + sizeof(key),
  });
}

function createFileDigest(filename: string): string | undefined {
  if (!fs.existsSync(filename)) return undefined;
  const { mtimeNs, size } = fs.statSync(filename, { bigint: true });
  return `${size}:${mtimeNs}`;
}
