import { Program } from 'esprima';
import { Expression, MethodDefinition, Pattern, PropertyDefinition, Statement, SwitchCase } from 'estree';

export class ESTreeVisitor<T> {
  program: Program;

  constructor(program: Program) {
    this.program = program;
  }

  *visit() {
    yield* this.visitProgram(this.program);
  }

  *visitProgram(program: Program): Iterable<T> {
    for (const node of program.body) {
      switch (node.type) {
        case 'ExportAllDeclaration':
        case 'ExportDefaultDeclaration':
        case 'ExportNamedDeclaration':
        case 'ImportDeclaration':
          break;
        default:
          yield* this.visitStatement(node);
      }
    }
  }

  *visitStatement(node: Statement): Iterable<T> {
    switch (node.type) {
      case 'FunctionDeclaration':
        for (const param of node.params) {
          yield* this.visitPattern(param);
        }
        for (const stmt of node.body.body) {
          yield* this.visitStatement(stmt);
        }
        break;
      case 'BlockStatement':
        for (const stmt of node.body) {
          yield* this.visitStatement(stmt);
        }
        break;
      case 'ClassDeclaration':
        if (node.superClass) {
          yield* this.visitExpression(node.superClass);
        }
        for (const defn of node.body.body) {
          yield* this.visitDefinition(defn);
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
    }
    // TODO: Declaration | WithStatement
  }

  *visitExpression(node: Expression): Iterable<T> {
    switch (node.type) {
      case 'ArrayExpression':
        for (const elt of node.elements) {
          if (elt && elt.type !== 'SpreadElement') {
            yield* this.visitExpression(elt);
          }
        }
        break;
      case 'ArrowFunctionExpression':
        if (node.params) {
          for (const param of node.params) {
            yield* this.visitPattern(param);
          }
        }
        if (node.body.type === 'BlockStatement') {
          yield* this.visitStatement(node.body);
        } else {
          yield* this.visitExpression(node.body);
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
      case 'FunctionExpression':
        for (const param of node.params) {
          yield* this.visitPattern(param);
        }
        yield* this.visitStatement(node.body);
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
      case 'Identifier':
      case 'Literal':
      case 'ThisExpression':
        break;
      default:
        console.warn('Visitor: unimplemented expression', node);
    }
    // TODO: ClassExpression
    // TODO: TemplateLiteral | TaggedTemplateExpression | MetaProperty
    // TODO: ImportExpression
  }

  *visitDefinition(node: MethodDefinition | PropertyDefinition) {
    if (node.key.type !== 'PrivateIdentifier') { yield* this.visitExpression(node.key); }
    if (node.value) { yield* this.visitExpression(node.value); }
  }

  * visitPattern(node: Pattern): Iterable<T> {
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
