export const indentSymbol = Symbol('indent');
export const dedentSymbol = Symbol('dedent');

export type IndentationSymbol = typeof indentSymbol | typeof dedentSymbol;
export type AsyncTreeInputIterable<T> = AsyncIterable<T | IndentationSymbol>;

export async function printTree(iter: AsyncTreeInputIterable<string>) {
  const prefixStack = [];
  let prefix = '';
  for await (const { item, isFirst, isLast } of addTreeProperties(iter)) {
    if (isFirst) {
      prefixStack.push(prefix);
      prefix = prefix.replace(/├/g, '|').replace(/─/g, ' ') + '├── ';
    }
    if (isLast) {
      prefix = prefix.replace('├', '└');
    }
    console.log(prefix + item);
    if (isLast) {
      prefix = prefixStack.pop()!;
    }
  }
}

/** Remove indent and unindent symbols; annotate items with isFirst and isLast properties.
 *
 * Input: *[1, indentSymbol, 2, 3, unindentSymbol, 4, indentSymbol, 5, 6, unindentSymbol, 7, 8]
 * Output: *[
 *   {item: 1, isFirst: false, isLast: false},
 *   {item: 2, isFirst: true, isLast: false},
 *   {item: 3, isFirst: false, isLast: true},
 *   {item: 4, isFirst: false, isLast: false},
 *   {item: 5, isFirst: true, isLast: false},
 *   {item: 6, isFirst: false, isLast: true},
 *   {item: 7, isFirst: false, isLast: false},
 *   {item: 8, isFirst: false, isLast: true}]
 */
async function* addTreeProperties<T>(
  iter: AsyncTreeInputIterable<T>
): AsyncIterable<{ item: T; isFirst: boolean; isLast: boolean }> {
  for await (const [prev, item, next] of asyncIterateWindows(dropEmptyGroups(iter), 3)) {
    switch (item) {
      case indentSymbol:
      case dedentSymbol:
        break;
      default:
        if (item) {
          const isFirst = prev === indentSymbol; // the first item is not isFirst
          const isLast = !next || next === dedentSymbol; // the last item is isLast
          yield { item, isFirst, isLast };
        }
    }
  }
}

/** Remove *[indentSymbol, unindentSymbol] pairs from the iterable, and pairs
 * that they reveal.
 *
 * Input: *[1, indentSymbol, unindentSymbol, 2, 3, indentSymbol, 4, 5, 6, unindentSymbol, 7, 8]
 * Output: *[1, 2, 3, indentSymbol, 4, 5, 6, unindentSymbol, 7, 8]
 */
async function* dropEmptyGroups<T>(iter: AsyncTreeInputIterable<T>): AsyncTreeInputIterable<T> {
  let indentation = 0;
  for await (const item of iter) {
    switch (item) {
      case indentSymbol:
        indentation++;
        break;
      case dedentSymbol:
        if (indentation > 0) {
          indentation--;
        } else {
          yield item;
        }
        break;
      default:
        while (indentation > 0) {
          indentation--;
          yield indentSymbol;
        }
        yield item;
    }
  }
}

/** Input: *[1, 2, 3]
 * Output: *[[,,1], [,1,2], [1,2,3], [2,3,], [3,,]]
 * (modulo technicalities about missing vs. undefined Array elements)
 */
async function* asyncIterateWindows<T>(iter: AsyncIterable<T>, width: number): AsyncIterable<(T | undefined)[]> {
  const window = new Array<T | undefined>(width);
  for await (const x of iter) {
    window.shift();
    window.push(x);
    yield window;
  }
  for (let i = 0; i < width - 1; i++) {
    window.shift();
    window.push(undefined);
    yield window;
  }
}
