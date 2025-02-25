
import type { TypedArray } from '#/types.js';
import { decodeBase64, encodeBase64 } from '#/utils/base64.js';
import { toArrayBuffer } from '#/utils/binary.js';

interface TypedArrayConstructor {
  readonly BYTES_PER_ELEMENT: number;

  new(buffer: ArrayBufferLike, byteOffset?: number, length?: number): TypedArray;
}

export function serializeArrayBuffer(buffer: ArrayBuffer): string {
  return encodeBase64(buffer);
}

export function deserializeArrayBuffer(data: string): ArrayBufferLike {
  const uint8Array = decodeBase64(data);
  return toArrayBuffer(uint8Array);
}

export function serializeTypedArray(array: TypedArray): string {
  return encodeBase64(array);
}

export function getTypedArrayDeserializer(constructor: TypedArrayConstructor): (data: string) => TypedArray {
  function deserializeTypedArray(data: string): TypedArray {
    const uint8Array = decodeBase64(data);
    return new constructor(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength / constructor.BYTES_PER_ELEMENT);
  }

  return deserializeTypedArray;
}

export function serializeBuffer(buffer: Buffer): string {
  return buffer.toString('base64');
}

export function deserializeBuffer(data: string): Buffer {
  return Buffer.from(data, 'base64');
}
