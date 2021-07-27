import fs from 'fs';
import { analyzeScript, ScriptAnalysis } from './script-analysis';

export class Script {
  source: string;
  filePath?: string;
  analysis?: ScriptAnalysis;

  constructor(source: string, filePath?: string) {
    this.source = source;
    this.filePath = filePath;
  }

  static fromFile(filePath: string) {
    return new Script(fs.readFileSync(filePath, 'utf8'), filePath);
  }

  get globals() {
    if (!this.analysis) {
      this.analysis = analyzeScript(this.source, this.filePath, false);
    }
    return this.analysis.globals;
  }

  get freeVariables() {
    if (!this.analysis?.freeVariables) {
      this.analysis = analyzeScript(this.source, this.filePath, true);
    }
    return this.analysis.freeVariables;
  }

  get loadCallArguments() {
    if (!this.analysis?.loadCallArguments) {
      this.analysis = analyzeScript(this.source, this.filePath, true);
    }
    return this.analysis.loadCallArguments;
  }

  get p5properties() {
    if (!this.analysis?.p5properties) {
      this.analysis = analyzeScript(this.source, this.filePath, true);
    }
    return this.analysis.p5properties;
  }
}
