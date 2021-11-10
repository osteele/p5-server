import { parse } from '@babel/parser';
import crypto from 'crypto';
import fs from 'fs';
import lruCache from 'lru-cache';
import path from 'path';
import {
  DefinitionType,
  findFreeVariables,
  findGlobals,
  findLoadCalls,
  findPropertyReferences
} from './script-analysis';

interface ScriptAnalysis {
  /** Names that are defined in the script. This is a map of symbols to definitions types. */
  defs: Map<string, DefinitionType>;
  /** Free variables that the script references. */
  refs: Set<string>;
  loadCallArguments: Set<string>;
  p5propRefs: Set<string>;
}

export class Script implements ScriptAnalysis {
  private _analysis?: ScriptAnalysis;
  private _syntaxError?: SyntaxError;

  constructor(public readonly source: string, public readonly filename?: string) {
    if (this.cacheKey) {
      const [hash, data] = scriptAnalysisCache.get(this.cacheKey) || [];
      if (hash === this.cacheDigest) {
        this._analysis = data;
      }
    }
  }

  static fromSource(source: string, filePath?: string) {
    return new Script(source, filePath);
  }

  static fromFile(filePath: string) {
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

  private get analysis() {
    if (!this._analysis && !this._syntaxError) {
      try {
        const ast = parse(this.source, { sourceFilename: this.filename });
        this._analysis = {
          defs: findGlobals(ast),
          refs: findFreeVariables(ast),
          loadCallArguments: findLoadCalls(ast),
          p5propRefs: findPropertyReferences(ast, 'p5')
        };
        if (this.cacheKey)
          scriptAnalysisCache.set(this.cacheKey, [this.cacheDigest!, this._analysis]);
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
        this._syntaxError = e;
      }
    }
    if (this._syntaxError) throw this._syntaxError;
    return this._analysis!;
  }

  get defs() {
    return this.analysis.defs;
  }

  get refs() {
    return this.analysis.refs;
  }

  get loadCallArguments() {
    return this.analysis.loadCallArguments;
  }

  get p5propRefs() {
    return this.analysis.p5propRefs;
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

// This is a global rather than a class property so that it doesn't appear in
// the typescript exports, where it would require that clients use
// esModuleIterop to use this package or a package that re-exports its types.
const scriptAnalysisCache: lruCache<string, [string, ScriptAnalysis]> = new lruCache({
  max: 1000,
  length: ([_hash, data]) =>
    5 +
    data.defs.size +
    data.refs.size +
    data.loadCallArguments.size +
    data.p5propRefs.size
});
