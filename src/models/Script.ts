import { parseModule, parseScript, Program } from 'esprima';
import fs from 'fs';
import { findFreeVariables, findGlobals, findLoadCalls, findP5PropertyReferences, JavascriptSyntaxError } from './script-analysis';

interface ScriptAnalysis {
  globals: Map<string, string>;
  freeVariables: Set<string>;
  loadCallArguments: Set<string>;
  p5properties: Set<string>;
}

export class Script implements ScriptAnalysis {
  protected readonly program: Program;
  private readonly analysis: Partial<ScriptAnalysis> = {};

  constructor(public readonly source: string, public readonly filePath?: string) {
    try {
      this.program = parseScript(this.source);
    } catch {
      // eslint-disable-next-line no-empty
    }
    try {
      this.program = parseModule(this.source);
    } catch (e) {
      throw new JavascriptSyntaxError(e.message, this.filePath, this.source);
    }
  }

  static fromSource(source: string, filePath?: string) {
    return new Script(source, filePath);
  }

  static fromFile(filePath: string) {
    return new Script(fs.readFileSync(filePath, 'utf8'), filePath);
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
}
