/* eslint-disable @typescript-eslint/naming-convention */

import type { Decorator } from '#/reflection';
import type { AbstractConstructor, OneOrMany, TypedOmit } from '#/types';
import { isDefined } from '#/utils/type-guards';
import { createSchemaValueTransformerDecorator } from '../decorators';
import type { TransformResult, ValueType_FOO } from '../types';
import { SchemaValueTransformer } from '../types';

export type GenericTransformFunction<T, O> = (value: T) => TypedOmit<TransformResult<O>, 'success'>;

export class GenericTransformer<T, O, TransformOutput> extends SchemaValueTransformer<T, O, TransformOutput> {
  readonly sourceType: OneOrMany<ValueType_FOO<T>>;
  readonly targetType: ValueType_FOO<TransformOutput>;
  readonly transformFunction: GenericTransformFunction<O, TransformOutput>;

  constructor(sourceType: OneOrMany<ValueType_FOO<T>>, targetType: AbstractConstructor<TransformOutput>, transformFunction: GenericTransformFunction<O, TransformOutput>) {
    super();

    this.sourceType = sourceType;
    this.targetType = targetType;
    this.transformFunction = transformFunction;
  }

  transform(value: O): TransformResult<TransformOutput> {
    const result = this.transformFunction(value);

    if (isDefined(result.error)) {
      return { success: false, error: result.error };
    }

    return { success: true, value: result.value! };
  }
}

export function Transform<T, O, TransformOutput>(sourceType: OneOrMany<AbstractConstructor<T>>, targetType: AbstractConstructor, transformFunction: GenericTransformFunction<O, TransformOutput>): Decorator<'property' | 'accessor'> {
  return createSchemaValueTransformerDecorator(new GenericTransformer(sourceType, targetType, transformFunction));
}
