export async function asyncFilter<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => Promise<boolean>
): Promise<T[]> {
  const keys = await Promise.all(array.map(predicate));
  return array.filter((value, index) => keys[index]);
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
