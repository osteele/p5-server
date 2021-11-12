/** Modifies target by removing the items in other. */

export function removeSetElements<T>(target: Set<T>, other: Set<T>): Set<T> {
  for (const element of other) {
    target.delete(element);
  }
  return target;
}

export function setDifference<T>(target: Set<T>, other: Set<T>): Set<T> {
  return new Set([...target].filter(x => !other.has(x)));
}

export function setUnion<T>(...sets: Set<T>[]): Set<T> {
  const union = new Set<T>();
  for (const set of sets) {
    for (const element of set) {
      union.add(element);
    }
  }
  return union;
}
