import type { Observable } from 'rxjs';
import type { AsyncComparator } from '../utils';
import type { AnyIterable } from '../utils/any-iterable-iterator';
import type { AsyncIteratorFunction, AsyncPredicate, AsyncReducer, AsyncRetryPredicate, ParallelizableIteratorFunction, ParallelizablePredicate, ThrottleFunction } from '../utils/async-iterable-helpers';
import { anyAsync, assertAsync, batchAsync, bufferAsync, concatAsync, defaultIfEmptyAsync, distinctAsync, drainAsync, filterAsync, firstAsync, forEachAsync, groupAsync, groupSingleAsync, groupToMapAsync, groupToSingleMapAsync, interceptAsync, interruptEveryAsync, interruptPerSecondAsync, isAsyncIterableIterator, iterableToAsyncIterator, lastAsync, mapAsync, mapManyAsync, materializeAsync, multiplexAsync, pairwiseAsync, reduceAsync, retryAsync, singleAsync, skipAsync, sortAsync, takeAsync, takeWhileAsync, throttle, toArrayAsync, toAsyncIterableIterator, toSync, whileAsync } from '../utils/async-iterable-helpers';
import { observableAsyncIterable } from '../utils/async-iterable-helpers/observable-iterable';
import { parallelFilter, parallelForEach, parallelGroup, parallelIntercept, parallelMap } from '../utils/async-iterable-helpers/parallel';
import type { TypePredicate } from '../utils/iterable-helpers';
import { isIterable, range } from '../utils/iterable-helpers';
import { Enumerable } from './enumerable';
import type { EnumerableMethods } from './enumerable-methods';

export class AsyncEnumerable<T> implements EnumerableMethods, AsyncIterableIterator<T> {
  private readonly source: AnyIterable<T>;
  private asyncIterator?: AsyncIterator<T>;

  constructor(iterable: AnyIterable<T>) {
    this.source = iterable;
  }

  static from<T>(iterable: AnyIterable<T>): AsyncEnumerable<T> {
    return new AsyncEnumerable(iterable);
  }

  static fromObservable<T, O extends Observable<T>>(observable: O): AsyncEnumerable<T> {
    const iterable = observableAsyncIterable(observable);
    return new AsyncEnumerable(iterable);
  }

  static fromRange(fromInclusive: number, toInclusive: number): AsyncEnumerable<number> {
    const rangeIterable = range(fromInclusive, toInclusive);
    return new AsyncEnumerable(rangeIterable);
  }

  assert<TPredicate extends T>(predicate: TypePredicate<T, TPredicate> | AsyncPredicate<T>): AsyncEnumerable<TPredicate> {
    const asserted = assertAsync<T, TPredicate>(this.source, predicate);
    return new AsyncEnumerable(asserted);
  }

  async any(predicate?: AsyncPredicate<T>): Promise<boolean> {
    return anyAsync(this.source, predicate);
  }

  batch(size: number): AsyncEnumerable<T[]> {
    const result = batchAsync(this.source, size);
    return new AsyncEnumerable(result);
  }

  buffer(size: number): AsyncEnumerable<T> {
    const result = bufferAsync(this.source, size);
    return new AsyncEnumerable(result);
  }

  cast<TNew extends T>(): AsyncEnumerable<TNew> {
    return this as AsyncEnumerable<any> as AsyncEnumerable<TNew>;
  }

  concat<TOther>(iterable: Iterable<TOther>): AsyncEnumerable<T | TOther> {
    const concatted = concatAsync(this.source, iterable);
    return new AsyncEnumerable(concatted);
  }

  defaultIfEmpty<TDefault>(defaultValue: TDefault): AsyncEnumerable<T | TDefault> {
    const result = defaultIfEmptyAsync(this.source, defaultValue);
    return new AsyncEnumerable(result);
  }

  distinct(selector?: AsyncIteratorFunction<T, any>): AsyncEnumerable<T> {
    const result = distinctAsync(this.source, selector);
    return new AsyncEnumerable(result);
  }

  async drain(): Promise<void> {
    await drainAsync(this.source);
  }

  filter<TPredicate extends T = T>(predicate: TypePredicate<T, TPredicate> | AsyncPredicate<T>): AsyncEnumerable<TPredicate> {
    const filtered = filterAsync<T, TPredicate>(this.source, predicate);
    return new AsyncEnumerable(filtered);
  }

  filterUndefined(): AsyncEnumerable<NonNullable<T>> {
    return this.filter((item): item is NonNullable<T> => item != undefined);
  }

  async first<TPredicate extends T = T>(predicate?: TypePredicate<T, TPredicate> | AsyncPredicate<T>): Promise<TPredicate> {
    return firstAsync(this.source, predicate);
  }

  forceCast<TNew>(): AsyncEnumerable<TNew> {
    return this as AsyncEnumerable<any> as AsyncEnumerable<TNew>;
  }

  async forEach(func: AsyncIteratorFunction<T, any>): Promise<void> {
    await forEachAsync(this.source, func);
  }

  group<TGroup>(selector: AsyncIteratorFunction<T, TGroup>): AsyncEnumerable<[TGroup, T[]]> {
    const grouped = groupAsync(this.source, selector);
    return new AsyncEnumerable(grouped);
  }

  groupSingle<TGroup>(selector: AsyncIteratorFunction<T, TGroup>): AsyncEnumerable<[TGroup, T]> {
    const grouped = groupSingleAsync(this.source, selector);
    return new AsyncEnumerable(grouped);
  }

  async groupToMap<TGroup>(selector: AsyncIteratorFunction<T, TGroup>): Promise<Map<TGroup, T[]>> {
    return groupToMapAsync<T, TGroup>(this.source, selector);
  }

  async groupToSingleMap<TGroup>(selector: AsyncIteratorFunction<T, TGroup>): Promise<Map<TGroup, T>> {
    return groupToSingleMapAsync<T, TGroup>(this.source, selector);
  }

  intercept(func: AsyncIteratorFunction<T, void>): AsyncEnumerable<T> {
    const iterator = interceptAsync(this.source, func);
    return new AsyncEnumerable(iterator);
  }

  interruptEvery(value: number): AsyncEnumerable<T> {
    const interrupted = interruptEveryAsync(this.source, value);
    return new AsyncEnumerable(interrupted);
  }

  interruptPerSecond(value: number): AsyncEnumerable<T> {
    const interrupted = interruptPerSecondAsync(this.source, value);
    return new AsyncEnumerable(interrupted);
  }

  async last<TPredicate extends T = T>(predicate?: TypePredicate<T, TPredicate> | AsyncPredicate<T>): Promise<TPredicate> {
    return lastAsync(this.source, predicate);
  }

  map<TOut>(mapper: AsyncIteratorFunction<T, TOut>): AsyncEnumerable<TOut> {
    const result = mapAsync(this.source, mapper);
    return new AsyncEnumerable(result);
  }

  mapMany<TOut>(mapper: AsyncIteratorFunction<T, AnyIterable<TOut>>): AsyncEnumerable<TOut> {
    const result = mapManyAsync(this.source, mapper);
    return new AsyncEnumerable(result);
  }

  materialize(): AsyncEnumerable<T> {
    const materialized = materializeAsync(this.source);
    return new AsyncEnumerable(materialized);
  }

  multiplex(count: number, bufferSize: number = 0): AsyncEnumerable<T>[] {
    const iterables = multiplexAsync(this.source, count, bufferSize);
    const enumerables = iterables.map((iterable) => new AsyncEnumerable(iterable));

    return enumerables;
  }

  pairwise(): AsyncEnumerable<[T, T]> {
    const pairwised = pairwiseAsync(this.source);
    return new AsyncEnumerable(pairwised);
  }

  async reduce(reducer: AsyncReducer<T, T>): Promise<T>;
  async reduce<U>(reducer: AsyncReducer<T, U>, initialValue: U): Promise<U>;
  async reduce<U>(reducer: AsyncReducer<T, U>, initialValue?: U): Promise<U> {
    return reduceAsync(this.source, reducer, initialValue);
  }

  retry(throwOnRetryFalse: boolean, predicate: AsyncRetryPredicate<T>): AsyncEnumerable<T> {
    const result = retryAsync(this.source, throwOnRetryFalse, predicate);
    return new AsyncEnumerable(result);
  }

  async single<TPredicate extends T = T>(predicate?: TypePredicate<T, TPredicate> | AsyncPredicate<T>): Promise<TPredicate> {
    return singleAsync(this.source, predicate);
  }

  skip(count: number): AsyncEnumerable<T> {
    const skipped = skipAsync(this.source, count);
    return new AsyncEnumerable(skipped);
  }

  async sort(comparator?: AsyncComparator<T>): Promise<T[]> {
    return sortAsync(this.source, comparator);
  }

  take(count: number): AsyncEnumerable<T> {
    const taken = takeAsync(this.source, count);
    return new AsyncEnumerable(taken);
  }

  takeWhile(yieldLastOnFalse: boolean, predicate: AsyncPredicate<T>): AsyncEnumerable<T> {
    const taken = takeWhileAsync(this.source, yieldLastOnFalse, predicate);
    return new AsyncEnumerable(taken);
  }

  throttle(delayOrThrottleFunction: number | ThrottleFunction): AsyncEnumerable<T> {
    const result = throttle(this.source, delayOrThrottleFunction);
    return new AsyncEnumerable(result);
  }

  async toArray(): Promise<T[]> {
    return toArrayAsync(this.source);
  }

  toAsync(): AsyncEnumerable<T> {
    return this;
  }

  toIterator(): AsyncIterator<T> {
    const iterator = iterableToAsyncIterator(this.source);
    return iterator;
  }

  async toSync(): Promise<Enumerable<T>> {
    const syncIterable = await toSync(this.source);
    return new Enumerable(syncIterable);
  }

  while(predicate: AsyncPredicate<T>): AsyncEnumerable<T> {
    const whiled = whileAsync(this.source, predicate);
    return new AsyncEnumerable(whiled);
  }

  parallelFilter(concurrency: number, keepOrder: boolean, predicate: ParallelizablePredicate<T>): AsyncEnumerable<T> {
    const result = parallelFilter(this.source, concurrency, keepOrder, predicate);
    return new AsyncEnumerable(result);
  }

  async parallelForEach(concurrency: number, func: ParallelizableIteratorFunction<T, any>): Promise<void> {
    return parallelForEach(this.source, concurrency, func);
  }

  async parallelGroup<TGroup>(concurrency: number, selector: ParallelizableIteratorFunction<T, TGroup>): Promise<Map<TGroup, T[]>> {
    return parallelGroup(this.source, concurrency, selector);
  }

  parallelIntercept(concurrency: number, keepOrder: boolean, func: ParallelizableIteratorFunction<T, void>): AsyncEnumerable<T> {
    const result = parallelIntercept(this.source, concurrency, keepOrder, func);
    return new AsyncEnumerable(result);
  }

  parallelMap<TOut>(concurrency: number, keepOrder: boolean, func: ParallelizableIteratorFunction<T, TOut>): AsyncEnumerable<TOut> {
    const result = parallelMap(this.source, concurrency, keepOrder, func);
    return new AsyncEnumerable(result);
  }

  async next(value?: any): Promise<IteratorResult<T>> {
    if (this.asyncIterator == undefined) {
      this.asyncIterator = this.toIterator();
    }

    const result = await this.asyncIterator.next(value);
    return result;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    if (isAsyncIterableIterator(this.source)) {
      return this.source[Symbol.asyncIterator]();
    }

    if (isIterable(this.source)) {
      return toAsyncIterableIterator(this.source);
    }

    throw new Error('source is neither iterable nor async-iterable');
  }
}
