/* eslint-disable @typescript-eslint/naming-convention */

import type { Decorator } from '#/reflection';
import { createSchemaValueTransformerDecorator } from '../decorators';
import type { TransformResult } from '../types';
import { SchemaValueTransformer } from '../types';

export class UppercaseTransformer extends SchemaValueTransformer {
  readonly sourceType = String;
  readonly targetType = String;

  transform(value: string): TransformResult {
    return { success: true, value: value.toUpperCase() };
  }
}

export function Uppercase(): Decorator<'property' | 'accessor'> {
  return createSchemaValueTransformerDecorator(new UppercaseTransformer(), { type: String });
}
