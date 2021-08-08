import { parseModule, parseScript, Program } from 'esprima';
import fs from 'fs';
import { findFreeVariables, findGlobals, findLoadCalls, findP5PropertyReferences } from './script-analysis';

export class JavaScriptSyntaxError extends Error {
  constructor(msg: string, public readonly fileName: string | null = null) {
    super(msg);
    Object.setPrototypeOf(this, JavaScriptSyntaxError.prototype);
    this.fileName = fileName;
  }
}

interface ScriptAnalysis {
  globals: Map<string, string>;
  freeVariables: Set<string>;
  loadCallArguments: Set<string>;
  p5properties: Set<string>;
}

export class Script implements ScriptAnalysis {
  private _program?: Program;
  private readonly analysis: Partial<ScriptAnalysis> = {};

  constructor(public readonly source: string, public readonly filePath?: string) {}

  static fromSource(source: string, filePath?: string) {
    return new Script(source, filePath);
  }

  static fromFile(filePath: string) {
    return new Script(fs.readFileSync(filePath, 'utf8'), filePath);
  }

  private get program() {
    if (this._program) {
      return this._program;
    }
    try {
      this._program = parseScript(this.source);
    } catch {
      // eslint-disable-next-line no-empty
    }
    try {
      this._program = parseModule(this.source);
    } catch (e) {
      throw new JavaScriptSyntaxError(e.message, this.filePath);
    }
    return this._program;
  }

  get globals() {
    if (!this.analysis.globals) {
      this.analysis.globals = findGlobals(this.program);
    }
    return this.analysis.globals;
  }

  get freeVariables() {
    if (!this.analysis.freeVariables) {
      this.analysis.freeVariables = findFreeVariables(this.program);
    }
    return this.analysis.freeVariables;
  }

  get loadCallArguments() {
    if (!this.analysis.loadCallArguments) {
      this.analysis.loadCallArguments = findLoadCalls(this.program);
    }
    return this.analysis.loadCallArguments;
  }

  get p5properties() {
    if (!this.analysis.p5properties) {
      this.analysis.p5properties = findP5PropertyReferences(this.program);
    }
    return this.analysis.p5properties;
  }

  getErrors() {
    try {
      this.program;
    } catch (e) {
      if (e instanceof JavaScriptSyntaxError) {
        return [e];
      }
      throw e;
    }
    return [];
  }
}
