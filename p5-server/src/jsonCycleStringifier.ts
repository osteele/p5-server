export function jsonCycleStringifier(prefix = '$__jsonCycleStringifer:'): {
  stringify: (value: unknown) => string;
  parse: (json: string) => any;
} {
  const scopeKey = `${prefix}circular`;
  const defKey = `${prefix}def`;
  const refKey = `${prefix}ref`;
  const bigintKey = `${prefix}bigint`;
  const objectHasOwnProperty = Object.prototype.hasOwnProperty;

  function stringify(value: unknown) {
    try {
      return JSON.stringify(value);
    } catch (e) {
      if (e instanceof TypeError) {
        return stringifyCycle(value);
      } else {
        throw e;
      }
    }
  }

  function stringifyCycle(
    value: unknown,
    replacer?: (this: unknown, key: string, value: unknown) => unknown
  ) {
    const seen = new Set<object>();
    const repeated = new Set<object>();
    let hasBigInt = false;

    JSON.stringify(value, collector);
    seen.clear();
    const definitionIds = new Map<object, number>();
    return repeated.size === 0 && !hasBigInt
      ? JSON.stringify(value, replacer)
      : JSON.stringify({ [scopeKey]: value }, cycleReplacer);

    function collector(_key: unknown, value: unknown) {
      if (typeof value === 'bigint') {
        hasBigInt = true;
        return { [bigintKey]: value.toString() };
      }
      if (value && typeof value === 'object') {
        if (seen.has(value)) {
          repeated.add(value);
          return undefined;
        }
        seen.add(value);
      }
      return value;
    }

    function cycleReplacer(key: string, value: unknown) {
      if (typeof value === 'bigint') {
        return { [bigintKey]: value.toString() };
      }
      if (value && typeof value === 'object') {
        if (key === defKey) {
          return value;
        }
        const definitionId = definitionIds.get(value);
        if (definitionId !== undefined) {
          return { [refKey]: definitionId };
        }
        if (repeated.has(value)) {
          definitionIds.set(value, definitionIds.size);
          return { [defKey]: value };
        }
      }
      return replacer ? replacer(key, value) : value;
    }
  }

  function parse(json: string) {
    const value = JSON.parse(json);
    if (
      !(typeof value === 'object' && objectHasOwnProperty.call(value, scopeKey))
    )
      return value;

    const defs: any[] = [];
    let root: any;
    const stack: { key: string | null; parent: any; value: any }[] = [
      { key: null, parent: null, value: value[scopeKey] },
    ];
    while (stack.length) {
      const frame = stack.pop()!;
      let resolved = frame.value;
      let traverse = true;
      if (resolved && typeof resolved === 'object') {
        if (objectHasOwnProperty.call(resolved, defKey)) {
          resolved = resolved[defKey];
          defs.push(resolved);
        } else if (objectHasOwnProperty.call(resolved, refKey)) {
          resolved = defs[resolved[refKey]];
          traverse = false;
        } else if (objectHasOwnProperty.call(resolved, bigintKey)) {
          resolved = BigInt(resolved[bigintKey]);
          traverse = false;
        }
      }
      if (frame.parent === null) {
        root = resolved;
      } else {
        frame.parent[frame.key!] = resolved;
      }
      if (traverse && resolved && typeof resolved === 'object') {
        const keys = Object.keys(resolved);
        for (let index = keys.length - 1; index >= 0; index--) {
          const key = keys[index];
          stack.push({ key, parent: resolved, value: resolved[key] });
        }
      }
    }
    return root;
  }

  return { stringify, parse };
}
