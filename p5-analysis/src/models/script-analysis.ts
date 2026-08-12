import traverseModule, { type Node, type NodePath } from '@babel/traverse';

import * as t from '@babel/types';

const traverse = (traverseModule.default ??
  traverseModule) as typeof traverseModule.default;

export type DefinitionType = 'function' | 'class' | 'variable';

const bindingValueTypes: Partial<Record<Node['type'], DefinitionType>> = {
  ClassDeclaration: 'class',
  FunctionDeclaration: 'function',
  VariableDeclarator: 'variable',
};

export function analyzeScript(ast: Node): {
  defs: Map<string, DefinitionType>;
  refs: Set<string>;
  loadCallArguments: Set<string>;
  p5propRefs: Set<string>;
  isP5InstanceSketch: boolean;
} {
  const defs = new Map<string, DefinitionType>();
  const refs = new Set<string>();
  const loadCallArguments = new Set<string>();
  const p5propRefs = new Set<string>();
  let isP5InstanceSketch = false;

  traverse(ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        const type = bindingValueTypes[binding.path.node.type];
        if (type) defs.set(name, type);
      }
    },
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
      if (!binding || isForwardLexicalReference) refs.add(name);
    },
    CallExpression(path) {
      const { callee } = path.node;
      if (!t.isIdentifier(callee) || !callee.name.startsWith('load')) return;
      const [argument] = path.node.arguments;
      if (t.isStringLiteral(argument)) loadCallArguments.add(argument.value);
    },
    MemberExpression(path) {
      const { object, property } = path.node;
      if (t.isIdentifier(object, { name: 'p5' }) && t.isIdentifier(property)) {
        p5propRefs.add(property.name);
      }
    },
    NewExpression(path) {
      if (isP5InstanceExpression(path)) isP5InstanceSketch = true;
    },
  });

  return {
    defs,
    refs,
    loadCallArguments,
    p5propRefs,
    isP5InstanceSketch,
  };
}

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
      if (isP5InstanceExpression(path)) {
        isSketch = true;
        path.stop();
      }
    },
  });
  return isSketch;
}

function isP5InstanceExpression(path: NodePath<t.NewExpression>): boolean {
  if (!t.isIdentifier(path.node.callee, { name: 'p5' })) return false;
  const [argument] = path.node.arguments;
  let callback: t.ArrowFunctionExpression | t.FunctionExpression | null = null;
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
  if (!callback || !t.isIdentifier(parameter)) return false;

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
  return assignsSetup && callsCreateCanvas;
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
