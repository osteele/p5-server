import { parse } from '@babel/parser';
import crypto from 'crypto';
import fs from 'fs';
import lruCache from 'lru-cache';
import path from 'path';
import {
  findFreeVariables,
  findGlobals,
  findLoadCalls,
  findPropertyReferences,
} from './script-analysis';

interface ScriptAnalysis {
  globals: Map<string, string>;
  freeVariables: Set<string>;
  loadCallArguments: Set<string>;
  p5properties: Set<string>;
}

export class Script implements ScriptAnalysis {
  static cache: lruCache<string, [string, ScriptAnalysis]>;
  private _analysis?: ScriptAnalysis;
  private _syntaxError?: SyntaxError;

  constructor(public readonly source: string, public readonly filename?: string) {
    if (this.cacheKey) {
      const [hash, data] = Script.cache.get(this.cacheKey) || [];
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
          globals: findGlobals(ast),
          freeVariables: findFreeVariables(ast),
          loadCallArguments: findLoadCalls(ast),
          p5properties: findPropertyReferences(ast, 'p5'),
        };
        if (this.cacheKey)
          Script.cache.set(this.cacheKey, [this.cacheDigest!, this._analysis]);
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
        this._syntaxError = e;
      }
    }
    if (this._syntaxError) throw this._syntaxError;
    return this._analysis!;
  }

  get globals() {
    return this.analysis.globals;
  }

  get freeVariables() {
    return this.analysis.freeVariables;
  }

  get loadCallArguments() {
    return this.analysis.loadCallArguments;
  }

  get p5properties() {
    return this.analysis.p5properties;
  }

  getErrors(): SyntaxError[] {
    try {
      this.analysis; // for effect
    } catch (e) {
      if (e instanceof SyntaxError) return [e];
      throw e;
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

// TODO: move to static block when esbuild-jest supports classic static blocks
Script.cache = new lruCache({
  max: 1000,
  length: ([_hash, data]) =>
    5 +
    data.globals.size +
    data.freeVariables.size +
    data.loadCallArguments.size +
    data.p5properties.size,
});
