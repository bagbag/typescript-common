/* eslint-disable @typescript-eslint/ban-types */

import { MultiKeyMap } from '#/data-structures';
import { HttpError } from '#/http';
import { decodeJsonPath } from '#/json-path';
import { DetailsError } from '../error';
import type { BinaryData, DeepArray, DeepFlatten, DeepNonNullable, StringMap } from '../types';
import { toUint8Array } from './binary';
import { currentTimestamp } from './date-time';
import { sort } from './iterable-helpers';
import type { Comparator } from './sort';
import { assertString, assertStringPass, isArray, isArrayBuffer, isDataView, isDate, isDefined, isFunction, isMap, isNotNull, isNull, isNullOrUndefined, isObject, isPrimitive, isRegExp, isSet, isString, isTypedArray, isUndefined } from './type-guards';

export function noop(): void {
  // noop
}

export function toArray<T>(value: T | T[]): T[];
export function toArray<T>(value: T | readonly T[]): readonly T[];
export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

const supportsNotification = typeof Notification != 'undefined';

/**
 * create an structured clone of an value using Notification if available, otherwise history state (may alters history)
 *
 * may not work in every environment!
 * @param value value to clone
 * @returns clone of value
 */
export function structuredClone<T>(value: T): T {
  if (supportsNotification) {
    return new Notification('', { data: value, silent: true }).data as T;
  }

  const oldState = history.state;
  history.replaceState(value, document.title);
  const copy = history.state as T;
  history.replaceState(oldState, document.title);

  return copy;
}

/**
 * create an structured clone of an value using a MessageChannel
 *
 * should work in all environments
 * @param value value to clone
 * @returns clone of value
 */
export async function structuredCloneAsync<T>(value: T, options?: { transfer?: any[] }): Promise<T> {
  const { port1, port2 } = new MessageChannel();

  const promise = new Promise<T>((resolve) => (port2.onmessage = (event) => resolve(event.data as T)));
  port1.postMessage(value, options);

  return promise;
}

// eslint-disable-next-line max-statements
export function clone<T>(object: T, deep: boolean): T {
  if (isPrimitive(object) || isNullOrUndefined(object)) {
    return object;
  }

  if (isDate(object)) {
    return new Date(object) as unknown as T;
  }

  if (isRegExp(object)) {
    return new RegExp(object.source, object.flags) as unknown as T;
  }

  if (isSet(object)) {
    return new Set(object) as unknown as T;
  }

  if (isMap(object)) {
    return new Map(object) as unknown as T;
  }

  if (isArrayBuffer(object)) {
    return object.slice(0) as unknown as T;
  }

  if (isTypedArray(object)) {
    return object.slice() as unknown as T;
  }

  if (isDataView(object)) {
    const clonedBuffer = object.buffer.slice(0);
    return new DataView(clonedBuffer, object.byteOffset, object.byteLength) as unknown as T;
  }

  if (!deep) {
    return (isArray(object) ? [...object] : { ...object }) as T;
  }

  if (isArray(object)) {
    return object.map((value): any => clone(value, true)) as any as T;
  }

  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, clone(value, true)] as const)) as T;
}

type DidNotRun = symbol;
export const didNotRun: DidNotRun = Symbol('did-not-run');

export function throttleFunction<Args extends any[], ReturnValue>(func: (...args: Args) => ReturnValue, interval: number, queue: boolean = false): (...args: Args) => (ReturnValue | DidNotRun) {
  let lastCall = 0;
  let pending = false;
  let nextArgs: Args;

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const throttled = (...args: Args) => {
    const nextAllowedCall = lastCall + interval;
    const now = currentTimestamp(); // eslint-disable-line no-shadow

    if (now >= nextAllowedCall) {
      pending = false;
      lastCall = now;
      return func(...args);
    }
    else if (queue) {
      nextArgs = args;

      if (!pending) {
        const delay = nextAllowedCall - now;
        setTimeout(() => throttled(...nextArgs), delay);
        pending = true;
      }
    }

    return didNotRun;
  };

  return throttled;
}

export function formatDuration(milliseconds: number, precision: number): string {
  let value: number;
  let suffix: string;

  if (milliseconds >= (10 ** 3)) {
    value = milliseconds / (10 ** 3);
    suffix = 's';
  }
  else if (milliseconds >= 1) {
    value = milliseconds;
    suffix = 'ms';
  }
  else if (milliseconds >= 1 / (10 ** 3)) {
    value = milliseconds * (10 ** 3);
    suffix = 'us';
  }
  else {
    value = milliseconds * (10 ** 6);
    suffix = 'ns';
  }

  const trimmed = parseFloat(value.toFixed(precision));
  const result = `${trimmed} ${suffix}`;

  return result;
}

export function valueOfType<T>(value: T): T {
  return value;
}

export function flatten<T>(array: DeepArray<T>): T[] {
  return array.reduce<T[]>((acc, item) => (Array.isArray(item) ? [...(acc), ...flatten(item)] : [...(acc), item]), []);
}

export function toError(obj: any): Error {
  if (obj instanceof Error) {
    return obj;
  }

  let message: string;

  try {
    message = JSON.stringify(decycle(obj));
  }
  catch {
    message = 'serialization of error reason failed. Take a look at the details property of this error instance.';
  }

  const error = new DetailsError(message, obj);
  return error;
}

export type FormatErrorOptions = {
  /**
   * include all error properties beside name and message
   */
  includeRest?: boolean,

  /**
   * include stack trace
   */
  includeStack?: boolean,

  /**
   * enable special formatting for some known Errors like {@link HttpError} in certain configurations
   */
  handleBuiltInErrors?: boolean
};

// eslint-disable-next-line max-statements, complexity
export function formatError(error: any, options: FormatErrorOptions = {}): string {
  const { includeRest = true, includeStack = true, handleBuiltInErrors = true } = options;

  let name: string | undefined;
  let message: string | undefined;
  let stack: string | undefined;
  let rest: StringMap | undefined;
  let extraInfo: StringMap | undefined;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const wrappedError = error?.rejection ?? error?.reason ?? error?.error;

  if ((error instanceof Error) && !(error.message.startsWith('Uncaught') && (wrappedError instanceof Error))) {
    ({ name, message, stack, ...rest } = error);

    if (handleBuiltInErrors) {
      if ((error instanceof HttpError) && !includeRest) {
        extraInfo = {
          url: error.request.url,
          method: error.request.method
        };
      }
    }
  }
  else if (wrappedError instanceof Error) {
    return formatError(wrappedError, options);
  }

  if (isUndefined(name) && (isUndefined(message) || message.trim().length == 0)) {
    try {
      message = JSON.stringify(decycle(error), null, 2);
    }
    catch {
      throw error;
    }
  }

  const restString = (includeRest && (Object.keys(rest ?? {}).length > 0)) ? `\n${JSON.stringify(decycle(rest), null, 2)}` : '';
  const extraInfoString = isDefined(extraInfo) ? `\n${JSON.stringify(extraInfo, null, 2)}` : '';
  const stackString = (includeStack && isDefined(stack)) ? `\n${stack}` : '';

  return `${name ?? 'Error'}: ${message}${restString}${extraInfoString}${stackString}`;
}

export function select<T extends Record<any, any>, K extends keyof T>(key: K): (item: T) => T[K] {
  return (item: T) => item[key];
}

export function compareByValueSelection<T>(...selectors: ((item: T) => unknown)[]): (a: T, b: T) => number {
  return (a: T, b: T) => {
    for (const selector of selectors) {
      const selectedA = selector(a);
      const selectedB = selector(b);
      const comparison = compareByValue(selectedA, selectedB);

      if (comparison != 0) {
        return comparison;
      }
    }

    return 0;
  };
}

export function compareByValueSelectionDescending<T>(...selectors: ((item: T) => unknown)[]): (a: T, b: T) => number {
  return (a: T, b: T) => {
    for (const selector of selectors) {
      const selectedA = selector(a);
      const selectedB = selector(b);
      const comparison = compareByValueDescending(selectedA, selectedB);

      if (comparison != 0) {
        return comparison;
      }
    }

    return 0;
  };
}

export function compareByValueSelectionOrdered<T>(...selectors: (readonly [(item: T) => unknown, 1 | -1])[]): (a: T, b: T) => number {
  return (a: T, b: T) => {
    for (const [selector, order] of selectors) {
      const selectedA = selector(a);
      const selectedB = selector(b);
      const comparison = (order == 1)
        ? compareByValue(selectedA, selectedB)
        : compareByValueDescending(selectedA, selectedB);

      if (comparison != 0) {
        return comparison;
      }
    }

    return 0;
  };
}

export function compareByValueToOrder<T>(order: T[]): (a: T, b: T) => number {
  return compareByValueSelectionToOrder(order, (item) => item);
}

export function compareByValueSelectionToOrder<T, TSelect>(order: TSelect[], selector: (item: T) => TSelect): (a: T, b: T) => number {
  const indexMapEntries = order.map((orderItem, index) => [orderItem, index] as const);
  const indexMap = new Map(indexMapEntries);

  // eslint-disable-next-line @typescript-eslint/no-shadow
  return function compareByValueSelectionToOrder(a: T, b: T): number {
    const selectedA = selector(a);
    const selectedB = selector(b);
    const indexA = indexMap.get(selectedA);
    const indexB = indexMap.get(selectedB);

    if (indexA == undefined || indexB == undefined) {
      throw new Error('value not defined in order');
    }

    return compareByValue(indexA, indexB);
  };
}

export function compareByValue<T>(a: T, b: T): number {
  if (a === b) {
    return 0;
  }
  else if (a > b) {
    return 1;
  }
  else if (b > a) {
    return -1;
  }

  throw new Error('objects not comparable');
}

export function compareByValueDescending<T>(a: T, b: T): number {
  if (a === b) {
    return 0;
  }
  else if (a > b) {
    return -1;
  }
  else if (b > a) {
    return 1;
  }

  throw new Error('objects not comparable');
}

export const propertyName = Symbol('PropertyName');

export type PropertyName = { [propertyName]: string };
export type PropertyNameProxy<T extends Record<any, any>> = { [P in keyof DeepNonNullable<T>]: PropertyNameProxyChild<T[P]> };
export type PropertyNameProxyChild<T> = T extends Record<any, any> ? ({ [P in keyof DeepNonNullable<T>]: PropertyNameProxyChild<T[P]> } & PropertyName) : PropertyName;

export function isPropertyName(value: any): value is PropertyName {
  return isDefined((value as PropertyName | undefined)?.[propertyName]);
}

/**
 * get the path to a property
 *
 * @param options.deep whether to return the whole path to the property or just the last property
 * @param options.flat ignore array accesses (properties consiting only of numbers)
 * @param options.prefix name prefix
 *
 * @example
 * import { getPropertyNameProxy, propertyName } from '@tstdl/base/utils';
 *
 * const name = getPropertyNameProxy<MyType>().foo.bar[propertyName];
 *
 * name == 'foo.bar' // true
 */
export function getPropertyNameProxy<T extends Record<any, any> = Record<any, any>>(options: { deep?: boolean, flat?: boolean, prefix?: string } = {}): PropertyNameProxy<T> {
  const { deep = true, flat = false, prefix } = options;

  const proxy = new Proxy<PropertyNameProxy<T>>({} as PropertyNameProxy<T>, {
    get: (_target, property): any => {
      if (property == propertyName) {
        return prefix;
      }

      assertString(property, `property must be a string, but was ${property.toString()}`);

      const ignore = (flat && (/\d+/u).test(property));

      if (ignore) {
        return proxy;
      }

      if (deep) {
        return getPropertyNameProxy({ deep, flat, prefix: isUndefined(prefix) ? property : `${prefix}.${property}` });
      }

      return getPropertyNameProxy({ deep, flat, prefix: property });
    }
  });

  return proxy;
}

/**
 * get the path to a property
 * @param expression property selection expression
 * @param options.deep whether to return the whole path to the property or just the last property
 * @returns property name
 */
export function propertyNameOf<T extends Record<any, any> = Record<any, any>>(expression: (instance: DeepNonNullable<T>) => any, options: { deep?: boolean } = {}): string {
  const name = (expression(getPropertyNameProxy<T>({ deep: options.deep, flat: false }) as DeepNonNullable<T>) as (PropertyNameProxyChild<any> | undefined))?.[propertyName];
  return assertStringPass(name, 'invalid expression');
}

/**
 * get the flat path to a property (flat = ignore array accesses (properties only consisting of numbers))
 * @param expression property selection expression
 * @param options.deep whether to return the whole path to the property or just the last property
 * @returns property name
 */
export function flatPropertyNameOf<T extends Record<any, any> = Record<any, any>>(expression: (instance: DeepFlatten<DeepNonNullable<T>>) => any, options: { deep?: boolean } = {}): string {
  const name = (expression(getPropertyNameProxy({ deep: options.deep, flat: true }) as DeepFlatten<DeepNonNullable<T>>) as unknown as (PropertyNameProxyChild<any> | undefined))?.[propertyName];
  return assertStringPass(name, 'invalid expression');
}

/**
 * compiles a dereferencer for a specific reference
 * @param object object to dereference
 * @param reference path to property in dot notation or JSONPath ({@link decodeJsonPath})
 * @returns referenced value
 */
export function compileDereferencer(reference: string): (object: object) => unknown {
  const nodes = decodeJsonPath(reference);

  function dereferencer(object: object): unknown {
    let target = object;

    for (let i = 0; i < nodes.length; i++) { // eslint-disable-line @typescript-eslint/prefer-for-of
      target = (target as StringMap)[nodes[i]!];
    }

    return target;
  }

  return dereferencer;
}

/**
 * dereference a reference
 *
 * @description useful if you dereference a reference a few times at most
 *
 * also take a look at {@link getCachedDereference} and {@link compileDereferencer} if you need to dereference multiple times
 * @param object object to dereference
 * @param reference path to property in dot notation or JSONPath ({@link decodeJsonPath})
 * @returns referenced value
 */
export function dereference(object: object, reference: string): unknown {
  return compileDereferencer(reference)(object);
}

/**
 * cached version of {@link dereference}. It caches the internally used dereferencer, but it does *not* cache the referenced value
 *
 * @description
 * useful if you dereference multiple references, each multiple times
 *
 * also take a look at {@link dereference} and {@link compileDereferencer} for other use cases
 * @param object object to dereference
 * @param reference path to property in dot notation or JSONPath ({@link decodeJsonPath})
 * @returns referenced value
 */
export function getCachedDereference(): typeof dereference {
  const memoizedDereferencer = memoizeSingle(compileDereferencer);

  function cachedDereference(object: object, reference: string): unknown {
    return memoizedDereferencer(reference)(object);
  }

  return cachedDereference;
}

/** memoizes a function with an arbitrary number of parameters. If you only need a single parameter, {@link memoizeSingle} is faster */
export function memoize<Fn extends (...parameters: any[]) => T, T>(fn: Fn): Fn {
  const cache = new MultiKeyMap<any, T>();

  function memoized(...parameters: Parameters<Fn>): T {
    if (cache.has(parameters)) {
      return cache.get(parameters)!;
    }

    const result = fn(...parameters);
    cache.set(parameters, result);

    return result;
  }

  return memoized as Fn;
}

/** memoizes a function with a single parameter. Faster than {@link memoize} */
export function memoizeSingle<Fn extends (parameters: any) => T, T>(fn: Fn): Fn {
  const cache = new Map<any, T>();

  function memoized(parameters: Parameters<Fn>): T {
    if (cache.has(parameters)) {
      return cache.get(parameters)!;
    }

    const result = fn(parameters);
    cache.set(parameters, result);

    return result;
  }

  return memoized as Fn;
}

const defaultArrayEqualsComparator = (a: unknown, b: unknown): boolean => a === b;

type ArrayEqualsComparator<A, B> = (a: A, b: B) => boolean;

type ArrayEqualsOptions<A, B> = {
  sort?: Comparator<A | B>,
  comparator?: ArrayEqualsComparator<A, B>
};

export function arrayEquals<A, B>(a: readonly A[], b: readonly B[], options?: ArrayEqualsOptions<A, B>): boolean {
  const _sort = options?.sort ?? false;
  const comparator = options?.comparator ?? defaultArrayEqualsComparator;

  if (a.length != b.length) {
    return false;
  }

  const c = _sort != false ? toArray(sort(a, _sort)) : a;
  const d = _sort != false ? toArray(sort(b, _sort)) : b;

  for (let i = 0; i < c.length; i++) {
    const itemEquals = comparator(c[i]!, d[i]!);

    if (!itemEquals) {
      return false;
    }
  }

  return true;
}

export type EqualsOptions = {
  deep?: boolean,
  arrayDeep?: boolean,
  sortArray?: boolean,
  coerceStrings?: boolean
};

const allowedEqualsCoerceStringsTypes = ['string', 'number', 'boolean', 'bigint'];

export function equals(a: any, b: any, options?: EqualsOptions): boolean;
export function equals(a: any, b: any, options?: EqualsOptions, __internal?: any): boolean; // eslint-disable-line @typescript-eslint/unified-signatures
export function equals(a: any, b: any, options: EqualsOptions = {}, visitedNodes: Set<any> = new Set()): boolean { // eslint-disable-line max-statements, complexity, max-lines-per-function
  if (a === b) {
    return true;
  }

  const aType = typeof a;
  const bType = typeof b;

  if (aType != bType) {
    if (isDefined(options.coerceStrings) && allowedEqualsCoerceStringsTypes.includes(aType) && allowedEqualsCoerceStringsTypes.includes(bType)) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return (a as object).toString() == (b as object).toString();
    }

    return false;
  }

  switch (aType) {
    case 'function':
      return (options.deep == true)
        ? (a as Function).toString() == (b as Function).toString()
        : false; // eslint-disable-line @typescript-eslint/ban-types

    case 'object':
      if (a === null || b === null) { // hasn't passed equals check at top, so one must be a true object
        return false;
      }

      if (visitedNodes.has(a)) {
        return true;
      }

      visitedNodes.add(a);

      const aPrototype = Object.getPrototypeOf(a);
      const bPrototype = Object.getPrototypeOf(b);

      if (aPrototype !== bPrototype) {
        return false;
      }

      if (Array.isArray(a)) {
        return (options.arrayDeep != false && (options.deep == true || options.arrayDeep == true))
          ? arrayEquals(a, b as any[], { sort: (options.sortArray == true) ? compareByValue : undefined, comparator: (x, y) => equals(x, y, options, visitedNodes) })
          : a === b;
      }

      if (aPrototype != Object.prototype && aPrototype !== null) { // checking a is enough, because b must have equal prototype (checked above)
        throw new Error('equals only supports plain objects, arrays and primitives');
      }

      if (options.deep == false) {
        return false;
      }

      return objectEquals(a as Record<any, any>, b as Record<any, any>, options, visitedNodes);

    default:
      return a === b;
  }
}

// eslint-disable-next-line max-statements, max-lines-per-function
function objectEquals(a: Record<string, unknown>, b: Record<string, unknown>, options: EqualsOptions, visitedNodes: Set<any>): boolean {
  const aProperties = Object.getOwnPropertyNames(a);
  const bProperties = Object.getOwnPropertyNames(b);

  if (!arrayEquals(aProperties, bProperties, { sort: compareByValue })) {
    return false;
  }

  for (const property of aProperties) {
    const eq = equals(a[property], b[property], options, visitedNodes);

    if (!eq) {
      return false;
    }
  }

  return true;
}

/**
 * compares to binary types for equal content
 */
export function binaryEquals(bufferA: BinaryData, bufferB: BinaryData): boolean {
  const a = toUint8Array(bufferA, false);
  const b = toUint8Array(bufferB, false);

  if (a.length != b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) {
      return false;
    }
  }

  return true;
}

export function stripPropertyWhen<T extends object, S>(obj: T, predicate: (value: unknown) => value is S): { [P in keyof T]: T[P] extends S ? T[P] | undefined : T[P] } {
  const filtered = Object.entries(obj).filter(([, value]) => !predicate(value));
  return Object.fromEntries(filtered) as { [P in keyof T]: T[P] extends S ? T[P] | undefined : T[P] };
}

export function stripPropertyWhenUndefined<T extends object>(obj: T): { [P in keyof T]: T[P] extends undefined ? T[P] | undefined : T[P] } {
  return stripPropertyWhen(obj, isUndefined);
}

export function stripPropertyWhenNull<T extends object>(obj: T): { [P in keyof T]: T[P] extends null ? T[P] | undefined : T[P] } {
  return stripPropertyWhen(obj, isNull);
}

export function stripPropertyWhenNullOrUndefined<T extends object>(obj: T): { [P in keyof T]: T[P] extends undefined | null ? T[P] | undefined : T[P] } {
  return stripPropertyWhen(obj, isNullOrUndefined);
}

export function parseFirstAndFamilyName(name: string): { firstName: string | undefined, familyName: string | undefined } {
  if (name.includes(',')) {
    const [familyName, firstName] = name.split(',').map((part) => part.trim());
    return { firstName, familyName };
  }

  const parts = name.split(' ');
  const familyName = (parts.length > 1) ? (parts.pop()!).trim() : '';
  const firstName = parts.map((part) => part.trim()).join(' ');

  return {
    firstName: firstName.length > 0 ? firstName : undefined,
    familyName: familyName.length > 0 ? familyName : undefined
  };
}

export function _throw(value: any): never {
  throw value;
}

export function deferThrow(value: any): () => never {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return function deferThrow() {
    throw value;
  };
}

export type Decycled<T> = { __type: T } & StringMap;

/**
 * replaces cycles (circular references) in objects with JSONPath
 * @param value object to decycle
 * @param replacer replace values. Like JSON.stringify(value, *replacer*)
 */
export function decycle<T>(value: T, replacer?: (value: any) => any): Decycled<T>;
export function decycle<T>(_value: T, replacer?: (value: any) => any): Decycled<T> {
  const mapping = new Map<any, string>();

  const replacerFn = isDefined(replacer) ? replacer : (value: any) => value;

  function _decycle(__value: any, path: string): any {
    const value = replacerFn(__value);

    if (isPrimitive(value) || isRegExp(value) || isDate(value) || isFunction(value)) {
      return value;
    }

    const mappedPath = mapping.get(value);

    if (isDefined(mappedPath)) {
      return { $ref: mappedPath };
    }

    mapping.set(value, path);

    if (isArray(value)) {
      return value.map((item, index): any => _decycle(item, `${path}[${index}]`)) as any;
    }

    return Object.fromEntries(Object.entries(value as StringMap).map(([key, item]) => [key, _decycle(item, `${path}['${key}']`)] as const));
  }

  return _decycle(_value, '$') as Decycled<T>;
}

const recyclePathPattern = /^\$(?:\[(?:(\d+)|'(.*?)')\])*$/u;
const recyclePathPartsPattern = /\[(?:(\d+)|'(.*?)')\]/ug;

/**
 * replaces JSONPath in objects with their reference
 * @param value object to recycle
 */
export function recycle<T = any>(value: Decycled<T>, clone?: boolean): T; // eslint-disable-line @typescript-eslint/no-shadow
export function recycle<T = any>(value: any, clone?: boolean): T; // eslint-disable-line @typescript-eslint/no-shadow, @typescript-eslint/unified-signatures
export function recycle<T = any>(_value: Decycled<T>, _clone: boolean = true): T { // eslint-disable-line max-lines-per-function
  const value = _clone ? clone(_value, true) : _value;

  function deref(ref: string): any {
    const parts = ref.matchAll(recyclePathPartsPattern);

    let target = value;
    for (const [, index, property] of parts) {
      const key = index ?? property;

      if (!Object.prototype.hasOwnProperty.call(target, key!)) {
        throw new Error(`reference ${ref} not found`);
      }

      target = (target as StringMap)[key!];
    }

    return target;
  }

  function getRef(node: any): string | undefined {
    if (isObject(node) && Object.prototype.hasOwnProperty.call(node, '$ref')) {
      const ref = (node as StringMap)['$ref'];

      if (isString(ref) && recyclePathPattern.test(ref)) {
        return ref;
      }
    }

    return undefined;
  }

  function _recycle(node: any): void {
    if (isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const ref = getRef(node[i]);

        if (isDefined(ref)) {
          node[i] = deref(ref);
        }
        else {
          _recycle(node[i]);
        }
      }
    }
    else if (isObject(node) && isNotNull(node)) {
      for (const key of Object.keys(node)) {
        const ref = getRef((node as StringMap)[key]);

        if (isDefined(ref)) {
          (node as StringMap)[key] = deref(ref);
        }
        else {
          _recycle((node as StringMap)[key]);
        }
      }
    }
  }

  _recycle(value);
  return value as any as T;
}

type NormalizeTextOptions = {
  /**
   * remove leading and trailing whitespace
   */
  trim?: boolean,

  /**
   * lowercase all characters
   */
  lowercase?: boolean,

  /**
   * remove multiple consecutive whitespace characters
   */
  multipleWhitespace?: boolean,

  /**
   * remove diacritics (è -> e)
   *
   * applies unicode NFD normalization and removes diacritics
   * @see unicode option
   */
  diacritics?: boolean,

  /**
   * replace ligatures with their consecutive characters (æ -> ae)
   *
   * applies unicode NFKC normalization
   * @see unicode option
   */
  ligatures?: boolean,

  /**
   * unicode normalization
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
   */
  unicode?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD'
};

/**
 * trims, lowercases, replaces multi-character whitespace with a single space and unicode normalization
 * @param text text to normalize
 * @param options specify what to normalize. Defaults to all except unicode
 * @returns normalized text
 */
export function normalizeText(text: string, options: NormalizeTextOptions = { trim: true, lowercase: true, multipleWhitespace: true, diacritics: true, ligatures: true }): string {
  let normalized = text;

  if (options.trim == true) {
    normalized = normalized.trim();
  }

  if (options.lowercase == true) {
    normalized = normalized.toLowerCase();
  }

  if (options.multipleWhitespace == true) {
    normalized = normalized.replace(/\s+/ug, ' ');
  }

  if (options.diacritics == true) {
    normalized = normalized.normalize('NFD').replace(/\p{Diacritic}/ug, '');
  }

  if (options.ligatures == true) {
    normalized = normalized.normalize('NFKC');
  }

  if (isDefined(options.unicode)) {
    normalized = normalized.normalize(options.unicode);
  }

  return normalized;
}

export function iif<T, F>(condition: boolean, trueFn: () => T, falseFn: () => F): T | F {
  return condition ? trueFn() : falseFn();
}
