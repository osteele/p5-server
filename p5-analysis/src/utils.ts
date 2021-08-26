export async function asyncFilter<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => Promise<unknown>,
  thisArg?: unknown
): Promise<T[]> {
  const indications = await Promise.all(array.map(predicate, thisArg));
  return array.filter((_value, index) => indications[index]);
}

export async function asyncFind<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => Promise<unknown>,
  thisArg?: unknown
): Promise<T | undefined> {
  for (let i = 0; i < array.length; i++) {
    const element = array[i];
    if (await predicate.call(thisArg, element, i, array)) {
      return element;
    }
  }
  return undefined;
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
