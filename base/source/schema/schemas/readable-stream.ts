/* eslint-disable @typescript-eslint/naming-convention */

import type { Decorator } from '#/reflection';
import { createSchemaPropertyDecoratorFromValueType } from '../decorators';
import type { TypeSchema } from '../types';
import { typeSchema } from '../types';

export function readableStream(): TypeSchema<globalThis.ReadableStream> {
  return typeSchema(globalThis.ReadableStream);
}

export function ReadableStream(): Decorator<'property' | 'accessor'> {
  return createSchemaPropertyDecoratorFromValueType(readableStream());
}
