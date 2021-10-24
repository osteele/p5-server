import traverse, { Node } from '@babel/traverse';

import * as t from '@babel/types';

const bindingValueTypes: Partial<
  Record<Node['type'], 'function' | 'class' | 'variable'>
> = {
  ClassDeclaration: 'class',
  FunctionDeclaration: 'function',
  VariableDeclarator: 'variable',
};

export function findGlobals(ast: Node) {
  const globals = new Map<string, string>();
  traverse(ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        const type = bindingValueTypes[binding.path.node.type];
        if (type) {
          globals.set(name, type);
        }
      }
      path.skip();
    },
  });
  return globals;
}

export function findFreeVariables(ast: Node, _globals: Set<string>): Set<string> {
  const variables = new Set<string>();
  traverse(ast, {
    Identifier(path) {
      if (t.isMemberExpression(path.parent) && path.parent.property === path.node)
        return;
      if (t.isClassMethod(path.parent) && path.parent.key === path.node) return;
      const { name } = path.node;
      if (!path.scope.hasBinding(name)) {
        variables.add(name);
      }
    },
  });
  return variables;
}

export function findP5PropertyReferences(ast: Node): Set<string> {
  const refs = new Set<string>();
  traverse(ast, {
    MemberExpression(path) {
      const { object, property } = path.node;
      if (t.isIdentifier(object, { name: 'p5' }) && property.type === 'Identifier') {
        refs.add(property.name);
      }
    },
  });
  return refs;
}

export function findLoadCalls(ast: Node): Set<string> {
  const calls = new Set<string>();
  traverse(ast, {
    CallExpression(path) {
      const { callee } = path.node;
      if (callee.type === 'Identifier' && callee.name.startsWith('load')) {
        const [arg] = path.node.arguments;
        if (arg.type === 'StringLiteral') {
          calls.add(arg.value);
        }
      }
    },
  });
  return calls;
}
