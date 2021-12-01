/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/ban-types, max-lines-per-function, max-statements, complexity */

import { CircularBuffer } from '#/data-structures/circular-buffer';
import type { Constructor, StringMap } from '#/types';
import { isDefined, isUndefined } from '#/utils';
import { ForwardRef, getRef, setRef } from '#/utils/object/forward-ref';
import type { BigintNonPrimitive, CustomNonPrimitive, FunctionNonPrimitive, GlobalSymbolNonPrimitive, RefNonPrimitive, SerializationOptions, Serialized, SerializedData, TypeField, UndefinedNonPrimitive } from './types';
import { bigintNonPrimitiveType, functionNonPrimitiveType, globalSymbolNonPrimitiveType, refNonPrimitiveType, undefinedNonPrimitiveType } from './types';
import type { DereferenceCallback } from './_internal';
import { getSerializerByTypeName, getTypeNameByConstructor } from './_internal';
export { registerSerializable, registerSerializer, Serializable, serializable } from './_internal';
export type { DereferenceCallback, TryDereference } from './_internal';

type QueueItem = () => void;

/**
 * serializes a value using decycling and deserialization of registered types
 * @param value value to serialize
 * @param options serialization options
 * @returns serialized representation of `value` which is safe to {@link JSON.stringify}
 */
export function serialize<T>(value: T, options?: SerializationOptions): Serialized<T>;
/**
 * for internal use only
 * @deprecated
 */
export function serialize<T>(value: T, options: SerializationOptions, references: Map<any, string>, queue: CircularBuffer<QueueItem>, path: string): Serialized<T>;
export function serialize(value: any, options: SerializationOptions = {}, references: Map<any, string> = new Map(), queue: CircularBuffer<QueueItem> = new CircularBuffer(), path: string = '$'): SerializedData {
  const type = typeof value;

  if (type == 'boolean' || type == 'number' || value === null) {
    return value;
  }

  if (type == 'undefined') {
    return { '<undefined>': null } as UndefinedNonPrimitive;
  }

  if ((path == '$') && isDefined(options.context)) {
    for (const entry of Object.entries(options.context)) {
      references.set(entry[1], `$['__context__']['${entry[0]}']`);
    }
  }

  const reference = references.get(value);
  if (reference !== undefined) {
    return { '<ref>': reference } as RefNonPrimitive;
  }

  if (type == 'string') {
    if ((value as string).length > (path.length + 50)) {
      references.set(value, path);
    }

    return value;
  }

  if (type == 'bigint') {
    const stringValue = (value as bigint).toString(10);

    if (stringValue.length > (path.length + 50)) {
      references.set(value, path);
    }

    return { '<bigint>': stringValue } as BigintNonPrimitive;
  }

  if (type == 'symbol') {
    const key = Symbol.keyFor(value as symbol);

    if (key === undefined) {
      throw new Error('only global symbols from Symbol.for(<key>) are supported');
    }

    return { '<global-symbol>': key } as GlobalSymbolNonPrimitive;
  }

  if (type == 'function') {
    if (options.allowUnsafe !== true) {
      throw new Error('functions are only allowed if allowUnsafe option is true');
    }

    references.set(value, path);

    const source = (value as Function).toString();
    return { '<function>': source } as FunctionNonPrimitive;
  }

  if (type == 'object') { // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    let result: SerializedData;

    references.set(value, path);

    const constructor = (value as object).constructor as Constructor;

    if (constructor == Array) {
      const target: SerializedData[] = [];
      target.length = (value as any[]).length;

      const queueItems = (value as any[]).map((innerValue, index): QueueItem => () => (target[index] = serialize(innerValue, options, references, queue, `${path}[${index}]`)));
      queue.addMany(queueItems);

      result = target as SerializedData;
    }
    else if (constructor == Object) {
      const target: StringMap = {};
      const entries = Object.entries(value as object);

      const queueItems = entries.map(([key, innerValue]): QueueItem => () => (target[key] = serialize(innerValue, options, references, queue, `${path}['${key}']`)));
      queue.addMany(queueItems);

      result = target;
    }
    else {
      const serializableType = getTypeNameByConstructor(constructor);

      if (isUndefined(serializableType)) {
        throw new Error(`constructor ${constructor.name} has no serializer registered`);
      }

      const registration = getSerializerByTypeName(serializableType);

      const typeString = getTypeString(serializableType);
      const nonPrimitive: CustomNonPrimitive<string> = { [typeString]: null };

      queue.add(() => {
        const data = registration!.serializer.call(value, value);
        return (nonPrimitive[typeString] = serialize(data, options, references, queue, `${path}['${typeString}']`));
      });

      result = nonPrimitive;
    }

    if (path == '$') {
      for (const fn of queue.consume()) {
        fn();
      }
    }

    return result;
  }

  throw new Error(`unsupported type '${type as string}'`);
}

export function deserialize<T>(serialized: Serialized<T>, options?: SerializationOptions): T;
export function deserialize(serialized: unknown, options?: SerializationOptions): unknown;
/**
 * for internal use only
 * @deprecated
 */
export function deserialize(serialized: unknown, options: SerializationOptions, serializedRoot: unknown, references: Map<string, any>, deserializeQueue: CircularBuffer<QueueItem>, derefQueue: CircularBuffer<QueueItem>, path: string, isFirst: boolean): unknown;
export function deserialize(serialized: unknown, options: SerializationOptions = {}, serializedRoot: unknown = serialized, references: Map<string, any> = new Map(), deserializeQueue: CircularBuffer<QueueItem> = new CircularBuffer(), derefQueue: CircularBuffer<QueueItem> = new CircularBuffer(), path = '$', isFirst: boolean = true): unknown {
  const type = typeof serialized;

  if ((type == 'number') || (type == 'boolean') || (serialized === null)) {
    return serialized;
  }

  if (type == 'string') {
    references.set(path, serialized);
    return serialized;
  }

  if (type == 'undefined') {
    return { '<undefined>': null } as UndefinedNonPrimitive;
  }

  if (type == 'object') {
    if (isFirst && isDefined(options.context)) {
      for (const entry of Object.entries(options.context)) {
        references.set(`$['__context__']['${entry[0]}']`, entry[1]);
      }
    }

    const entries = Object.entries(serialized as object);
    const isNonPrimitive = (entries.length == 1) && entries[0]![0].startsWith('<') && entries[0]![0].endsWith('>');

    if (isNonPrimitive) {
      const nonPrimitiveData = entries[0]![1];
      const nonPrimitiveType = entries[0]![0].slice(1, -1);

      switch (nonPrimitiveType) {
        case undefinedNonPrimitiveType: {
          return undefined;
        }

        case bigintNonPrimitiveType: {
          const bigint = BigInt(nonPrimitiveData as BigintNonPrimitive['<bigint>']);
          references.set(path, bigint);

          return bigint;
        }

        case globalSymbolNonPrimitiveType: {
          const symbol = Symbol.for(nonPrimitiveData as GlobalSymbolNonPrimitive['<global-symbol>']);
          references.set(path, symbol);

          return symbol;
        }

        case functionNonPrimitiveType: {
          if (options.allowUnsafe !== true) {
            throw new Error('functions are only allowed if allowUnsafe option is true');
          }

          const fn = eval(nonPrimitiveData as FunctionNonPrimitive['<function>']); // eslint-disable-line no-eval
          references.set(path, fn);

          return fn;
        }

        case refNonPrimitiveType: {
          const dereferenced = references.get(nonPrimitiveData as RefNonPrimitive['<ref>']);

          if (dereferenced == undefined) {
            throw new Error(`reference ${nonPrimitiveData as RefNonPrimitive['<ref>']} not found`);
          }

          return dereferenced;
        }

        default: {
          const registration = getSerializerByTypeName(nonPrimitiveType);

          if (registration == undefined) {
            throw new Error(`non-primitive type ${nonPrimitiveType} not registered`);
          }

          const forwardRef = new ForwardRef();
          references.set(path, forwardRef);

          deserializeQueue.add(() => {
            const deserializedData = deserialize(nonPrimitiveData, options, serializedRoot, references, deserializeQueue, derefQueue, `${path}['<${nonPrimitiveType}>']`, false);

            deserializeQueue.add(() => {
              const deserialized = registration.deserializer(deserializedData, tryAddToDerefQueue);
              forwardRef[setRef](deserialized as object);
            });
          });

          if (isFirst) {
            drainQueues(deserializeQueue, derefQueue);
            return forwardRef[getRef]();
          }

          return forwardRef;
        }
      }
    }

    let result: unknown;
    const constructor = (serialized as object).constructor as Constructor;

    if (constructor == Array) {
      const deserializedArray: unknown[] = [];
      deserializedArray.length = (serialized as any[]).length;
      references.set(path, deserializedArray);

      const queueItems = (serialized as any[]).map((innerValue, index): QueueItem => () => {
        const deserialized = deserialize(innerValue, options, serializedRoot, references, deserializeQueue, derefQueue, `${path}[${index}]`, false);
        deserializedArray[index] = deserialized;

        tryAddToDerefQueue(deserialized, (dereferenced) => (deserializedArray[index] = dereferenced));

        return deserialized;
      });
      deserializeQueue.addMany(queueItems);

      result = deserializedArray;
    }
    else if (constructor == Object) {
      const deserializedObject: StringMap = {};
      references.set(path, deserializedObject);

      const queueItems = entries.map(([key, innerValue]): QueueItem => () => {
        const deserialized = deserialize(innerValue, options, serializedRoot, references, deserializeQueue, derefQueue, `${path}['${key}']`, false);
        deserializedObject[key] = deserialized;

        tryAddToDerefQueue(deserialized, (dereferenced) => (deserializedObject[key] = dereferenced));

        return deserialized;
      });
      deserializeQueue.addMany(queueItems);

      result = deserializedObject;
    }
    else {
      throw new Error(`unsupported constructor ${constructor.name}`);
    }

    if (isFirst) {
      drainQueues(deserializeQueue, derefQueue);
    }

    return result;
  }

  throw new Error(`unsupported type '${type}'`);

  function tryAddToDerefQueue(value: unknown, callback: DereferenceCallback): boolean {
    if (!ForwardRef.isForwardRef(value) || (options.doNotDereferenceForwardRefs == true)) {
      return false;
    }

    derefQueue.add(() => {
      const dereferenced = value[getRef]();
      callback(dereferenced);
    });

    return true;
  }
}

function drainQueues(deserializeQueue: CircularBuffer<QueueItem>, derefQueue: CircularBuffer<QueueItem>): void {
  for (const fn of deserializeQueue.consume()) {
    fn();
  }

  for (const fn of derefQueue.consume()) {
    fn();
  }
}

function getTypeString<T extends string>(type: T): TypeField<T> {
  return `<${type}>`;
}
