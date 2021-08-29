export const indentSymbol = Symbol('indent');
export const dedentSymbol = Symbol('dedent');

export type IndentationSymbol = typeof indentSymbol | typeof dedentSymbol;
export type AsyncTreeInputIterable<T> = AsyncIterable<T | IndentationSymbol>;

export async function printTree(iter: AsyncTreeInputIterable<string>) {
  const prefixStack = [];
  let prefix = '';
  for await (const { item, index, isFirst, isLast } of addTreeProperties(iter)) {
    if (isFirst && index > 0) {
      prefixStack.push(prefix);
      prefix = prefix.replace(/├/g, '|').replace(/─/g, ' ') + '├── ';
    }
    if (isLast) {
      prefix = prefix!.replace('├', '└');
    }
    console.log(prefix + item);
    if (isLast) {
      prefix = prefixStack.pop()!;
    }
  }
}

/** Remove indent and unindent symbols; yield record that annotate the input items with
 * additional properties:
 *
 * -  index: the item's position in the sequence
 *  - isFirst: the item is the first in a group, or the entire sequence
 * -  isLast: the item is the last in a group, or the entire sequence
 *
 * Input: *[1, indentSymbol, 2, 3, unindentSymbol, 4, indentSymbol, 5, 6, unindentSymbol, 7, 8]
 * Output: *[
 *   {item: 1, index: 0, isFirst: true, isLast: false},
 *   {item: 2, index: 1, isFirst: true, isLast: false},
 *   {item: 3, index: 2, isFirst: false, isLast: true},
 *   {item: 4, index: 3, isFirst: false, isLast: false},
 *   {item: 5, index: 4, isFirst: true, isLast: false},
 *   {item: 6, index: 5, isFirst: false, isLast: true},
 *   {item: 7, index: 6, isFirst: false, isLast: false},
 *   {item: 8, index: 7, isFirst: false, isLast: true}]
 */
async function* addTreeProperties<T>(
  iter: AsyncTreeInputIterable<T>
): AsyncIterable<{ item: T; index: number; isFirst: boolean; isLast: boolean }> {
  let index = 0;
  for await (const [prev, item, next] of asyncIterateWindows(
    dropEmptyGroups(iter),
    3
  )) {
    switch (item) {
      case indentSymbol:
      case dedentSymbol:
        break;
      default:
        if (item !== undefined) {
          const isFirst = !prev || prev === indentSymbol; // the first item is not isFirst
          const isLast = !next || next === dedentSymbol; // the last item is isLast
          yield { item, isFirst, isLast, index: index++ };
        }
    }
  }
}

/** Recursively remove *[indentSymbol, unindentSymbol] pairs from the iterable.
 *
 * Input: *[1, indentSymbol, unindentSymbol, 2, 3, indentSymbol, 4, 5, 6, unindentSymbol, 7, 8]
 * Output: *[1, 2, 3, indentSymbol, 4, 5, 6, unindentSymbol, 7, 8]
 */
async function* dropEmptyGroups<T>(
  iter: AsyncTreeInputIterable<T>
): AsyncTreeInputIterable<T> {
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
async function* asyncIterateWindows<T>(
  iter: AsyncIterable<T>,
  width: number
): AsyncIterable<(T | undefined)[]> {
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
