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
  private _ast?: ReturnType<typeof parse>;
  private readonly analysis: Partial<ScriptAnalysis> = {};

  constructor(public readonly source: string, public readonly filename?: string) {}

  static fromSource(source: string, filePath?: string) {
    return new Script(source, filePath);
  }

  static fromFile(filePath: string) {
    return new Script(fs.readFileSync(filePath, 'utf-8'), filePath);
  }

  private get ast() {
    if (!this._ast) {
      this._ast = parse(this.source, { sourceFilename: this.filename });
    }
    return this._ast;
  }

  get globals() {
    if (!this.analysis.globals) {
      this.analysis.globals = findGlobals(this.ast);
    }
    return this.analysis.globals;
  }

  get freeVariables() {
    if (!this.analysis.freeVariables)
      this.analysis.freeVariables = findFreeVariables(this.ast);
    return this.analysis.freeVariables;
  }

  get loadCallArguments() {
    if (!this.analysis.loadCallArguments)
      this.analysis.loadCallArguments = findLoadCalls(this.ast);
    return this.analysis.loadCallArguments;
  }

  get p5properties() {
    if (!this.analysis.p5properties)
      this.analysis.p5properties = findPropertyReferences(this.ast, 'p5');
    return this.analysis.p5properties;
  }

  getErrors(): SyntaxError[] {
    try {
      this.ast;
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
