import traverse, { Node } from '@babel/traverse';

import * as t from '@babel/types';

export type DefinitionType = 'function' | 'class' | 'variable';

const bindingValueTypes: Partial<Record<Node['type'], DefinitionType>> = {
  ClassDeclaration: 'class',
  FunctionDeclaration: 'function',
  VariableDeclarator: 'variable'
};

export function findGlobalDefinitions(ast: Node): Map<string, DefinitionType> {
  const defs = new Map<string, DefinitionType>();
  traverse(ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        const type = bindingValueTypes[binding.path.node.type];
        if (type) {
          defs.set(name, type);
        }
      }
      path.skip();
    }
  });
  return defs;
}

export function findGlobalReferences(ast: Node): Set<string> {
  const refs = new Set<string>();
  traverse(ast, {
    Identifier(path) {
      if (t.isMemberExpression(path.parent) && path.parent.property === path.node)
        return;
      if (t.isClassMethod(path.parent) && path.parent.key === path.node) return;
      const { name } = path.node;
      if (!path.scope.hasBinding(name)) {
        refs.add(name);
      }
    }
  });
  return refs;
}

export function findPropertyReferences(ast: Node, objectName: string): Set<string> {
  const refs = new Set<string>();
  traverse(ast, {
    MemberExpression(path) {
      const { object, property } = path.node;
      if (
        t.isIdentifier(object, { name: objectName }) &&
        property.type === 'Identifier'
      ) {
        refs.add(property.name);
      }
    }
  });
  return refs;
}

export function findCallArguments(ast: Node, namePattern: RegExp): Set<string> {
  const calls = new Set<string>();
  traverse(ast, {
    CallExpression(path) {
      const { callee } = path.node;
      if (callee.type === 'Identifier' && namePattern.test(callee.name)) {
        const [arg] = path.node.arguments;
        if (arg?.type === 'StringLiteral') {
          calls.add(arg.value);
        }
      }
    }
  });
  return calls;
}
