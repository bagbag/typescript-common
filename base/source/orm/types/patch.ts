import type { ConditionalPickDeep } from 'type-fest';

import { NotImplementedError } from '#/error/not-implemented.error.js';
import type { DeepPartial, DeepPartialObject, Record } from '#/types.js';

export type Patch<T extends Record = Record> = CombinedOperation<T> | { [P in keyof T]?: FieldOperation<T[P]> };
export type NormalizedPatch<T extends Record = Record> = CombinedOperation<T>;

export type FieldOperation<T> =
  & Partial<SetOnInsertFieldOperation<T>>
  & Partial<(
    | SetFieldOperation<T>
    | IncrementFieldOperation<T>
    | DecrementFieldOperation<T>
    | MultiplyFieldOperation<T>
    | MinimumFieldOperation<T>
    | MaximumFieldOperation<T>
  )>;


export type CombinedOperation<T extends Record> =
  & CombinedSetOperation<T>
  & CombinedSetOnInsertOperation<T>
  & CombinedIncrementOperation<T>
  & CombinedDecrementOperation<T>
  & CombinedMultiplyOperation<T>
  & CombinedMinimumOperation<T>
  & CombinedMaximumOperation<T>;

export type SetFieldOperation<T> = DeepPartial<T> | { $set: DeepPartial<T> };
export type SetOnInsertFieldOperation<T> = { $setOnInsert: DeepPartial<T> };
export type IncrementFieldOperation<T> = T extends number ? { $inc: number } : never;
export type DecrementFieldOperation<T> = T extends number ? { $dec: number } : never;
export type MultiplyFieldOperation<T> = T extends number ? { $mul: number } : never;
export type MinimumFieldOperation<T> = T extends number ? { $min: number } : never;
export type MaximumFieldOperation<T> = T extends number ? { $max: number } : never;

export type CombinedSetOperation<T extends Record> = DeepPartialObject<T> | { $set: DeepPartialObject<T> };
export type CombinedSetOnInsertOperation<T extends Record> = { $setOnInsert: DeepPartialObject<T> };
export type CombinedIncrementOperation<T extends Record> = { $inc: DeepPartialObject<ConditionalPickDeep<T, number, { condition: 'extends' }>> };
export type CombinedDecrementOperation<T extends Record> = { $dec: DeepPartialObject<ConditionalPickDeep<T, number, { condition: 'extends' }>> };
export type CombinedMultiplyOperation<T extends Record> = { $mul: DeepPartialObject<ConditionalPickDeep<T, number, { condition: 'extends' }>> };
export type CombinedMinimumOperation<T extends Record> = { $min: DeepPartialObject<ConditionalPickDeep<T, number, { condition: 'extends' }>> };
export type CombinedMaximumOperation<T extends Record> = { $max: DeepPartialObject<ConditionalPickDeep<T, number, { condition: 'extends' }>> };

export function normalizePatch(_patch: Patch): NormalizedPatch {
  throw new NotImplementedError();
}
