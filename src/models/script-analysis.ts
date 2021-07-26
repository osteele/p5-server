import { parseScript, Program } from 'esprima';
import { Expression, FunctionDeclaration, Pattern, Statement } from 'estree';
import fs from 'fs';
import { ESTreeVisitor } from './ESTreeVisitor';

export class JavascriptSyntaxError extends Error {
  code: string;
  fileName: string | null;

  constructor(msg: string, fileName: string | null = null, code: string) {
    super(msg);
    Object.setPrototypeOf(this, JavascriptSyntaxError.prototype);
    this.fileName = fileName;
    this.code = code;
  }
}

export function checkedParseScript(filePath: string): Program {
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    return parseScript(code);
  } catch (e) {
    throw new JavascriptSyntaxError(e.message, filePath, code);
  }
}

type ScriptAnalysis = {
  globals: Set<string>;
  freeVariables?: Set<string>;
  loadCallArguments?: Set<string>;
  p5properties?: Set<string>;
};

export function analyzeScript(code: string, options: { deep: boolean, filePath?: string } = { deep: true })
  : ScriptAnalysis {
  try {
    const program = parseScript(code);
    const globals = findGlobals(program);
    if (!options.deep) {
      return { globals };
    }
    const freeVariables = findFreeVariables(program);
    const p5properties = findP5PropertyReferences(program);
    const loadCallArguments = findLoadCalls(program);
    return { globals, freeVariables, p5properties, loadCallArguments };
  } catch (e) {
    throw new JavascriptSyntaxError(e.message, options.filePath, code);
  }
}

export function analyzeScriptFile(filePath: string, options = { deep: true })
  : ScriptAnalysis {
  const code = fs.readFileSync(filePath, 'utf-8');
  return analyzeScript(code, { ...options, filePath });
}

function findGlobals(program: Program): Set<string> {
  const functionDeclarations = program.body.filter(node => node.type === 'FunctionDeclaration') as Array<FunctionDeclaration>;
  return new Set(functionDeclarations.map(node => node.id?.name).filter(Boolean)) as Set<string>;
}

function findFreeVariables(program: Program): Set<string> {
  return new Set(iterProgram(program));

  function* iterProgram(program: Program): Iterable<string> {
    yield* new FreeVariableIterator(program).visit();
  }
}

class FreeVariableIterator extends ESTreeVisitor {
  * visitProgram(node: Program) {
    // TODO: collect variable declarations too
    const globalVariables = findGlobals(this.program);
    for (const name of ESTreeVisitor.prototype.visitProgram.call(this, node)) {
      if (!globalVariables.has(name)) {
        yield name;
      }
    }
  }

  * visitStatement(node: Statement): Iterable<string> {
    switch (node.type) {
      case 'FunctionDeclaration':
        const locals = new Set<string>();
        if (node.id) {
          locals.add(node.id.name);
        }
        for (const param of node.params) {
          for (const name of this.visitPattern(param)) {
            locals.add(name);
          }
        }
        // FIXME: this doesn't account for names that are used before they are declared
        for (const block of node.body.body) {
          for (const name of this.iterDeclaredNames(block)) {
            locals.add(name);
          }
        }
        for (const child of node.body.body) {
          for (const name of this.visitStatement(child)) {
            if (!locals.has(name)) {
              yield name;
            }
          }
        }
        break;
      case 'ForStatement':
        // FIXME: build local context
        // TODO: if (node.init) { yield* iterExpression(node.init); }
        if (node.test) { yield* this.visitExpression(node.test); }
        if (node.update) { yield* this.visitExpression(node.update); }
        yield* this.visitStatement(node.body);
        break;
      case 'ForInStatement':
        // FIXME: build local context
        // TODO: yield* iterExpression(node.left);
        yield* this.visitExpression(node.right);
        yield* this.visitStatement(node.body);
        break;
      case 'ForOfStatement':
        // FIXME: build local context
        // TODO: yield* iterExpression(node.left);
        yield* this.visitExpression(node.right);
        yield* this.visitStatement(node.body);
        break;
      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          if (decl.init) {
            yield* this.visitExpression(decl.init);
          }
        }
        break;
      default:
        yield* ESTreeVisitor.prototype.visitStatement.call(this, node);
        break;
    }
    // TODO: Declaration ImportExpression
    // TODO: note binding in TryStatement
  }

  * visitExpression(node: Expression): Iterable<string> {
    switch (node.type) {
      case 'Identifier':
        yield node.name;
        break;
      default:
        yield* ESTreeVisitor.prototype.visitExpression.call(this, node);
        break;
    }
    // TODO: FunctionExpression
    // TODO: ArrowFunctionExpression
  }

  * iterDeclaredNames(node: Statement): Iterable<string> {
    switch (node.type) {
      case 'FunctionDeclaration':
        if (node.id) {
          yield node.id.name;
        }
        break;
      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          yield* this.visitPattern(decl.id);
          break;
        }
    }
  }

  * visitPattern(node: Pattern): Iterable<string> {
    switch (node.type) {
      case 'Identifier':
        yield node.name;
        break;
      default:
        yield* ESTreeVisitor.prototype.visitPattern.call(this, node);
        break;
    }
  }
}

function findP5PropertyReferences(program: Program): Set<string> {
  return new Set(iterProgram(program));

  function* iterProgram(program: Program): Iterable<string> {
    yield* new PropertyMemberIterator(program).visit();
  }
}

class PropertyMemberIterator extends ESTreeVisitor {
  * visitExpression(node: Expression): Iterable<string> {
    if (node.type === 'MemberExpression') {
      if (node.object.type === 'Identifier' && node.object.name === 'p5'
        && node.property.type === 'Identifier') {
        yield node.property.name;
      }
    }
    yield* ESTreeVisitor.prototype.visitExpression.call(this, node);
  }
}

function findLoadCalls(program: Program) {
  return new Set(iterProgram(program));

  function* iterProgram(program: Program): Iterable<string> {
    yield* new LoadCallIterator(program).visit();
  }
}


class LoadCallIterator extends ESTreeVisitor {
  * visitExpression(node: Expression): Iterable<string> {
    if (node.type === 'CallExpression') {
      if (node.callee.type === 'Identifier' && node.callee.name.startsWith('load')
        && node.arguments.length >= 1) {
        const arg = node.arguments[0];
        if (arg.type === 'Literal' && typeof arg.value === 'string') {
          yield arg.value;
        }
      }
    }
    yield* ESTreeVisitor.prototype.visitExpression.call(this, node);
  }
}
