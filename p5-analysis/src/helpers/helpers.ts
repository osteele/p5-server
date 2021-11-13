export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// This is a very loose approximation, for purposes of sizing the LRU cache
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sizeof(value: unknown, seen?:WeakSet<any>): number {
  if (value === null) {
    return 0;
  }
  switch (typeof value) {
    case 'bigint':
      return 32; // just guess, instead of spending time to calculate
    case 'boolean':
      return 4;
    case 'function':
      return 40; // maybe it's a closure, so guess a size
    case 'number':
      return 8;
    case 'string':
      return 4 + value.length * 2;
    case 'symbol': {
      const s = Symbol.keyFor(value);
      return (s ? s.length : value.toString().length - 8) * 2;
    }
    case 'undefined':
      return 0;
    case 'object':
      seen ??= new WeakSet();
      if (seen?.has(value)) {
        return 0;
      }
      if (Array.isArray(value)) {
        return value.reduce((sum, v) => sum + sizeof(v, seen), 8);
      } else if (value instanceof ArrayBuffer
        || value instanceof Int8Array
        || value instanceof Uint8Array
        || value instanceof Uint8ClampedArray
        || value instanceof Int16Array
        || value instanceof Uint16Array
        || value instanceof Int32Array
        || value instanceof Uint32Array
        || value instanceof Float32Array
        || value instanceof Float64Array
        || value instanceof BigInt64Array
        || value instanceof BigUint64Array
        || value instanceof DataView) {
        return 32 + value.byteLength;
      } else if (value instanceof Map) {
        let size = 40;
        for (const [k, v] of value) {
          size += sizeof(k, seen) + sizeof(v, seen);
        }
        return size;
      } else if (value instanceof Set) {
        let size = 40;
        for (const key of value) {
          size += sizeof(key, seen);
        }
        return size;
      } else {
        let size = 60;
        const obj = value as Record<string, unknown>;
        for (const key in value) {
          if (Object.hasOwnProperty.call(obj, key)) {
            size += sizeof(key, seen);
            size += sizeof(obj[key], seen);
          }
        }
        return size;
      }
  }
}
