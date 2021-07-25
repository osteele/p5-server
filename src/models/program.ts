import { parseScript, Program } from 'esprima';
import { Expression, FunctionDeclaration, Pattern, Statement, SwitchCase } from 'estree';
import fs from 'fs';

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

class Visitor {
  program: Program;

  constructor(program: Program) {
    this.program = program;
  }

  * visit() {
    yield* this.visitProgram(this.program);
  }

  * visitProgram(program: Program): Iterable<string> {
    for (const node of program.body) {
      switch (node.type) {
        case 'FunctionDeclaration':
        case 'VariableDeclaration':
          yield* this.visitStatement(node);
      }
    }
  }

  * visitStatement(node: Statement): Iterable<string> {
    switch (node.type) {
      case 'FunctionDeclaration':
        for (const child of node.params) {
          yield* this.visitPattern(child);
        }
        for (const child of node.body.body) {
          yield* this.visitStatement(child);
        }
        break;
      case 'BlockStatement':
        for (const child of node.body) {
          yield* this.visitStatement(child);
        }
        break;
      case 'DoWhileStatement':
        yield* this.visitStatement(node.body);
        yield* this.visitExpression(node.test);
        break;
      case 'ExpressionStatement':
        yield* this.visitExpression(node.expression);
        break;
      case 'ForStatement':
        // TODO: if (node.init) { yield* this.iterExpression(node.init); }
        if (node.test) { yield* this.visitExpression(node.test); }
        if (node.update) { yield* this.visitExpression(node.update); }
        yield* this.visitStatement(node.body);
        break;
      case 'ForInStatement':
        // TODO: yield* this.iterExpression(node.left);
        yield* this.visitExpression(node.right);
        yield* this.visitStatement(node.body);
        break;
      case 'ForOfStatement':
        // TODO: yield* this.iterExpression(node.left);
        yield* this.visitExpression(node.right);
        yield* this.visitStatement(node.body);
        break;
      case 'IfStatement':
        yield* this.visitExpression(node.test);
        yield* this.visitStatement(node.consequent);
        if (node.alternate) {
          yield* this.visitStatement(node.alternate);
        }
        break;
      case 'LabeledStatement':
        yield* this.visitStatement(node.body);
        break;
      case 'ReturnStatement':
        if (node.argument) {
          yield* this.visitExpression(node.argument);
        }
        break;
      case 'SwitchStatement':
        yield* this.visitExpression(node.discriminant);
        for (const switchCase of node.cases) {
          yield* this.visitSwitchCase(switchCase);
        }
        break;
      case 'ThrowStatement':
        yield* this.visitExpression(node.argument);
        break;
      case 'TryStatement':
        yield* this.visitStatement(node.block);
        if (node.handler) {
          yield* this.visitStatement(node.handler.body);
        }
        if (node.finalizer) {
          for (const stmt of node.finalizer.body) {
            yield* this.visitStatement(stmt);
          }
        }
        break;
      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          if (decl.init) {
            yield* this.visitExpression(decl.init);
          }
        }
        break;
      case 'WhileStatement':
        yield* this.visitExpression(node.test);
        yield* this.visitStatement(node.body);
        break;
      case 'DebuggerStatement':
      case 'EmptyStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
        break;
      default:
        console.warn('Visitor: unimplemented statement', node);
        break;
    }
    // TODO: Declaration | WithStatement
  }

  * visitExpression(node: Expression): Iterable<string> {
    switch (node.type) {
      case 'ArrayExpression':
        for (const child of node.elements) {
          if (child && child.type !== 'SpreadElement') {
            yield* this.visitExpression(child);
          }
        }
        break;
      case 'AssignmentExpression':
        yield* this.visitExpression(node.right);
        break;
      case 'BinaryExpression':
      case 'LogicalExpression':
        yield* this.visitExpression(node.left);
        yield* this.visitExpression(node.right);
        break;
      case 'CallExpression':
        if (node.callee.type !== 'Super') {
          yield* this.visitExpression(node.callee);
        }
        for (const arg of node.arguments) {
          if (arg.type === 'SpreadElement') {
            yield* this.visitExpression(arg.argument);
          } else {
            yield* this.visitExpression(arg);
          }
        }
        break;
      case 'ChainExpression':
        yield* this.visitExpression(node.expression);
        break;
      case 'ConditionalExpression':
        yield* this.visitExpression(node.test);
        yield* this.visitExpression(node.consequent);
        yield* this.visitExpression(node.alternate);
        break;
      case 'MemberExpression':
        if (node.object.type !== 'Super') {
          yield* this.visitExpression(node.object);
        }
        break;
      case 'NewExpression':
        if (node.callee.type !== 'Super') {
          yield* this.visitExpression(node.callee);
        }
        break;
      case 'ObjectExpression':
        for (const prop of node.properties) {
          if (prop.type === 'SpreadElement') {
            yield* this.visitExpression(prop.argument);
          } else {
            // TODO
            // yield* iterExpression(prop.key);
            // yield* iterExpression(prop.value);
          }
        }
        break;
      case 'SequenceExpression':
        for (const expr of node.expressions) {
          yield* this.visitExpression(expr);
        }
        break;
      case 'AwaitExpression':
      case 'UnaryExpression':
      case 'UpdateExpression':
      case 'YieldExpression':
        if (node.argument) {
          yield* this.visitExpression(node.argument);
        }
        break;
      case 'ArrowFunctionExpression':
      case 'Identifier':
      case 'Literal':
      case 'ThisExpression':
        break;
      default:
        console.warn('Visitor: unimplemented expression', node);
        break;
    }
    // TODO: FunctionExpression | ArrowFunctionExpression
    // TODO: ClassExpression
    // TODO: TemplateLiteral | TaggedTemplateExpression | MetaProperty
    // TODO: ImportExpression
  }

  * visitPattern(node: Pattern): Iterable<string> {
    switch (node.type) {
      case 'ObjectPattern':
        for (const prop of node.properties) {
          if (prop.type === 'Property') {
            yield* this.visitPattern(prop.value);
          } else {
            yield* this.visitPattern(prop.argument);
          }
        }
        break;
      case 'ArrayPattern':
        for (const elem of node.elements) {
          if (elem) {
            yield* this.visitPattern(elem);
          }
        }
        break;
      case 'RestElement':
        yield* this.visitPattern(node.argument);
        break;
      case 'AssignmentPattern':
        yield* this.visitPattern(node.left);
        break;
      case 'Identifier':
        break;
      default:
        // TODO: MemberExpression ?
        console.warn('Visitor: unimplemented pattern', node);
        break;
    }
  }

  * visitSwitchCase(switchCase: SwitchCase) {
    if (switchCase.test) {
      yield* this.visitExpression(switchCase.test);
    }
    for (const stmt of switchCase.consequent) {
      yield* this.visitStatement(stmt);
    }
  }
}

class FreeVariableIterator extends Visitor {
  * visitProgram(node: Program) {
    // TODO: collect variable declarations too
    const globalVariables = findGlobals(this.program);
    for (const name of Visitor.prototype.visitProgram.call(this, node)) {
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
        yield* Visitor.prototype.visitStatement.call(this, node);
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
        yield* Visitor.prototype.visitExpression.call(this, node);
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
        yield* Visitor.prototype.visitPattern.call(this, node);
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

class PropertyMemberIterator extends Visitor {
  * visitExpression(node: Expression): Iterable<string> {
    if (node.type === 'MemberExpression') {
      if (node.object.type === 'Identifier' && node.object.name === 'p5'
        && node.property.type === 'Identifier') {
        yield node.property.name;
      }
    }
    yield* Visitor.prototype.visitExpression.call(this, node);
  }
}

function findLoadCalls(program: Program) {
  return new Set(iterProgram(program));

  function* iterProgram(program: Program): Iterable<string> {
    yield* new LoadCallIterator(program).visit();
  }
}


class LoadCallIterator extends Visitor {
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
    yield* Visitor.prototype.visitExpression.call(this, node);
  }
}
