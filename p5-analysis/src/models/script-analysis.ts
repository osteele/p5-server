import traverse, { type Node } from '@babel/traverse';

import * as t from '@babel/types';

export type DefinitionType = 'function' | 'class' | 'variable';

const bindingValueTypes: Partial<Record<Node['type'], DefinitionType>> = {
  ClassDeclaration: 'class',
  FunctionDeclaration: 'function',
  VariableDeclarator: 'variable',
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
    },
  });
  return defs;
}

export function findGlobalReferences(ast: Node): Set<string> {
  const refs = new Set<string>();
  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) return;
      const { name } = path.node;
      const binding = path.scope.getBinding(name);
      const declaration = binding?.path.parentPath;
      const isForwardLexicalReference =
        binding?.path.isVariableDeclarator() &&
        declaration?.isVariableDeclaration() &&
        declaration.node.kind !== 'var' &&
        path.node.start !== null &&
        path.node.start !== undefined &&
        binding.identifier.start !== null &&
        binding.identifier.start !== undefined &&
        path.node.start < binding.identifier.start;
      if (!binding || isForwardLexicalReference) {
        refs.add(name);
      }
    },
  });
  return refs;
}

export function isP5InstanceSketch(ast: Node): boolean {
  let isSketch = false;
  traverse(ast, {
    NewExpression(path) {
      if (!t.isIdentifier(path.node.callee, { name: 'p5' })) return;
      const [argument] = path.node.arguments;
      let callback: t.ArrowFunctionExpression | t.FunctionExpression | null =
        null;
      if (
        t.isArrowFunctionExpression(argument) ||
        t.isFunctionExpression(argument)
      ) {
        callback = argument;
      } else if (t.isIdentifier(argument)) {
        const binding = path.scope.getBinding(argument.name);
        const init = binding?.path.isVariableDeclarator()
          ? binding.path.node.init
          : null;
        if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
          callback = init;
        }
      }
      const [parameter] = callback?.params ?? [];
      if (!callback || !t.isIdentifier(parameter)) return;

      let assignsSetup = false;
      let callsCreateCanvas = false;
      t.traverseFast(callback.body, (node) => {
        if (
          t.isAssignmentExpression(node) &&
          t.isMemberExpression(node.left) &&
          t.isIdentifier(node.left.object, { name: parameter.name }) &&
          t.isIdentifier(node.left.property, { name: 'setup' })
        ) {
          assignsSetup = true;
        }
        if (
          t.isCallExpression(node) &&
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.object, { name: parameter.name }) &&
          t.isIdentifier(node.callee.property, { name: 'createCanvas' })
        ) {
          callsCreateCanvas = true;
        }
      });
      if (assignsSetup && callsCreateCanvas) {
        isSketch = true;
        path.stop();
      }
    },
  });
  return isSketch;
}

export function findPropertyReferences(
  ast: Node,
  objectName: string
): Set<string> {
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
    },
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
    },
  });
  return calls;
}
