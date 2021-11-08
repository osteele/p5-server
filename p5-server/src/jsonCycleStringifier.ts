export function jsonCycleStringifier(prefix = '$__jsonCycleStringifer:') {
  const scopeKey = prefix + 'circular';
  const defKey = prefix + 'def';
  const refKey = prefix + 'ref';
  const hasOwnProperty = Object.prototype.hasOwnProperty;

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
    const seen = new Set();
    const defs = new Map();

    JSON.stringify(value, collector);
    seen.clear();
    return defs.size === 0
      ? JSON.stringify(value, replacer)
      : JSON.stringify({ [scopeKey]: value }, cycleReplacer);

    function collector(_key: unknown, value: unknown) {
      if (value && (typeof value === 'object' || Array.isArray(value))) {
        if (defs.has(value)) {
          return undefined;
        } else if (seen.has(value)) {
          defs.set(value, defs.size);
          return undefined;
        } else {
          seen.add(value);
        }
      }
      return value;
    }

    function cycleReplacer(key: string, value: unknown) {
      if (value && (typeof value === 'object' || Array.isArray(value))) {
        if (key === defKey) {
          return value;
        } else if (seen.has(value)) {
          return { [refKey]: defs.get(value) };
        } else if (defs.has(value)) {
          seen.add(value);
          return { [defKey]: value };
        }
      }
      return replacer ? replacer(key, value) : value;
    }
  }

  function parse(json: string) {
    const value = JSON.parse(json);
    if (!(typeof value === 'object' && hasOwnProperty.call(value, scopeKey)))
      return value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defs: any[] = [];
    return resolve(value[scopeKey]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function resolve(value: any) {
      if (value && typeof value === 'object') {
        if (hasOwnProperty.call(value, defKey)) {
          value = value[defKey];
          defs.push(value);
        } else if (hasOwnProperty.call(value, refKey)) {
          return defs[value[refKey]];
        }
        for (const key in value) {
          value[key] = resolve(value[key]);
        }
      } else if (Array.isArray(value)) {
        for (const i in value) {
          value[i] = resolve(value[i]);
        }
      }
      return value;
    }
  }

  return { stringify, parse };
}
