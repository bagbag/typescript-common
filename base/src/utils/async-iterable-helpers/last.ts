import { AnyIterable } from '../any-iterable-iterator';
import { filterAsync } from './filter';
import { AsyncPredicate } from './types';

export async function lastAsync<T>(iterable: AnyIterable<T>, predicate?: AsyncPredicate<T>): Promise<T> {
  const source = (predicate == undefined) ? iterable : filterAsync(iterable, predicate);

  let hasLastItem: boolean = false;
  let lastItem: T;

  for await (const item of source) {
    hasLastItem = true;
    lastItem = item;
  }

  if (hasLastItem) {
    // tslint:disable-next-line: no-non-null-assertion
    return lastItem!;
  }

  throw new Error('iterable was either empty or no element matched predicate');
}
