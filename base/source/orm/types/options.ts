import type { Paths, Record, TypedOmit } from '#/types.js';
import type { Transaction } from '../repository/transaction.js';
import type { Query } from './query.js';

export type Order = 'asc' | 'desc';
export const allOrders: Order[] = ['asc', 'desc'];

export type Sort<T = unknown> = {
  field: Extract<keyof T, string> | '$score',
  order?: Order
};

export type SortOptions<T = unknown> = {
  sort?: Sort<T>[]
};

export type SkipOptions = {
  skip?: number
};

export type LimitOptions = {
  limit?: number
};

export type BaseOptions = {
  transaction?: Transaction
};

export type HasOptions = BaseOptions;

export type LoadOptions<T> = BaseOptions & SkipOptions & SortOptions<T> & {
  /** include deleted */
  deleted?: boolean
};

export type LoadManyOptions<T> = LoadOptions<T> & LimitOptions;

export type SaveOptions<T extends Record> = BaseOptions & {
  /** update existing  */
  upsert?: Paths<T> | Query<T>
};

export type InsertOptions = BaseOptions;

export type PatchOptions<T> = BaseOptions & SkipOptions & SortOptions<T>;

export type PatchManyOptions<T> = PatchOptions<T> & LimitOptions;

export type DeleteOptions<T> = TypedOmit<LoadOptions<T>, 'deleted'>;

export type DeleteManyOptions<T> = TypedOmit<LoadManyOptions<T>, 'deleted'>;
