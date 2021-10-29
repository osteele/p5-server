import { parse } from '@babel/parser';
import fs from 'fs';
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
  private _analysis?: ScriptAnalysis;
  private _syntaxError?: SyntaxError;

  constructor(public readonly source: string, public readonly filename?: string) {}

  static fromSource(source: string, filePath?: string) {
    return new Script(source, filePath);
  }

  static fromFile(filePath: string) {
    return new Script(fs.readFileSync(filePath, 'utf-8'), filePath);
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
