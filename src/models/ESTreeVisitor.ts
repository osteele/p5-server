import { Program } from 'esprima';
import { Expression, Pattern, Statement, SwitchCase } from 'estree';

export class ESTreeVisitor {
    program: Program;

    constructor(program: Program) {
        this.program = program;
    }

    *visit() {
        yield* this.visitProgram(this.program);
    }

    *visitProgram(program: Program): Iterable<string> {
        for (const node of program.body) {
            switch (node.type) {
                case 'FunctionDeclaration':
                case 'VariableDeclaration':
                    yield* this.visitStatement(node);
            }
        }
    }

    *visitStatement(node: Statement): Iterable<string> {
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

    *visitExpression(node: Expression): Iterable<string> {
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

    *visitPattern(node: Pattern): Iterable<string> {
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

    *visitSwitchCase(switchCase: SwitchCase) {
        if (switchCase.test) {
            yield* this.visitExpression(switchCase.test);
        }
        for (const stmt of switchCase.consequent) {
            yield* this.visitStatement(stmt);
        }
    }
}
