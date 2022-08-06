/* eslint-disable @typescript-eslint/naming-convention */

import { isDefined } from '#/utils/type-guards';
import { ArrayMaximumLengthConstraint } from '../array-constraints';
import type { Coercible, MaybeDeferredValueTypes, SchemaArrayConstraint, ValueSchema } from '../types';
import { valueSchema } from '../types';

export type ArrayOptions = Coercible & {
  /** minimum length */
  minimumLength?: number,

  /** maximum length */
  maximumLength?: number
};

export function array<T>(innerValues: MaybeDeferredValueTypes<T>, options: ArrayOptions = {}): ValueSchema<T[]> {
  const arrayConstraints: SchemaArrayConstraint[] = [];

  if (isDefined(options.minimumLength)) {
    arrayConstraints.push(new ArrayMaximumLengthConstraint(options.minimumLength));
  }

  if (isDefined(options.maximumLength)) {
    arrayConstraints.push(new ArrayMaximumLengthConstraint(options.maximumLength));
  }

  return valueSchema({
    type: innerValues,
    array: true,
    coerce: options.coerce,
    arrayConstraints
  });
}
