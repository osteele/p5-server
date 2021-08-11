import { parseModule, parseScript, Program } from 'esprima';
import fs from 'fs';
import { findFreeVariables, findGlobals, findLoadCalls, findP5PropertyReferences } from './script-analysis';
import babel = require('@babel/core');

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

  constructor(public readonly source: string, public readonly filename?: string) {}

  static fromSource(source: string, filePath?: string) {
    return new Script(source, filePath);
  }

  static fromFile(filePath: string) {
    return new Script(fs.readFileSync(filePath, 'utf8'), filePath);
  }

  private get program() {
    // TODO: use the babel AST, instead of re-parsing with esprima
    const result = babel.transform(this.source, {
      ast: false,
      babelrc: false,
      configFile: false,
      compact: true,
      filename: this.filename,
      highlightCode: false,
      plugins: ['@babel/plugin-proposal-object-rest-spread']
    });
    const source = result!.code!;
    if (this._program) {
      return this._program;
    }
    try {
      this._program = parseScript(source);
    } catch {
      // eslint-disable-next-line no-empty
    }
    try {
      this._program = parseModule(source);
    } catch (e) {
      throw new JavaScriptSyntaxError(e.message, this.filename);
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
      if (e instanceof JavaScriptSyntaxError || e instanceof SyntaxError) {
        return [e];
      }
      throw e;
    }
    return [];
  }
}
