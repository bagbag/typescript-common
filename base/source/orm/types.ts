/* eslint-disable @typescript-eslint/no-redeclare, @typescript-eslint/naming-convention */

import type { HasDefault as DrizzleHasDefault, IsPrimaryKey as DrizzleIsPrimaryKey } from 'drizzle-orm';
import type { boolean, doublePrecision, integer, PgColumnBuilder, PgColumnBuilderBase, pgEnum, text, uuid } from 'drizzle-orm/pg-core';
import type { Exact, GetTagMetadata, Tagged, UnwrapTagged } from 'type-fest';

import { Array, Integer } from '#/schema/index.js';
import type { Enumeration, EnumerationValue, ObjectLiteral, Record, UnionToTuple } from '#/types.js';
import { Uuid } from './schemas/index.js';

export type IsPrimaryKey<T> =
  T extends Tagged<unknown, 'column', PgColumnBuilderBase> ? Tagged<UnwrapTagged<T>, 'column', DrizzleIsPrimaryKey<GetTagMetadata<T, 'column'>>>
  : Tagged<T, 'column', ColumnBuilder<T>>;

export type HasDefault<T> =
  T extends Tagged<unknown, 'column', PgColumnBuilderBase> ? Tagged<UnwrapTagged<T>, 'column', DrizzleHasDefault<GetTagMetadata<T, 'column'>>>
  : Tagged<T, 'column', ColumnBuilder<T>>;

export type Nested<T extends Record> = Tagged<T, 'column', { nested: T }>;

export type ColumnBuilder<T, ColumnName extends string = never> =
  T extends Tagged<T, 'column', any> ? GetTagMetadata<T, 'column'> :
  T extends string ? string extends ColumnName ? ReturnType<typeof text<ColumnName, string, [string, ...string[]]>> : ReturnType<typeof text<string, [string, ...string[]]>> :
  T extends number ? string extends ColumnName ? ReturnType<typeof doublePrecision<ColumnName>> : ReturnType<typeof doublePrecision> :
  T extends boolean ? string extends ColumnName ? ReturnType<typeof boolean<ColumnName>> : ReturnType<typeof boolean> :
  T extends Enumeration ? string extends ColumnName ? ReturnType<ColumnBuilder<U, ColumnName>['array']> : ReturnType<ColumnBuilder<U>['array']> :
  T extends (infer U)[] ? string extends ColumnName ? ReturnType<ColumnBuilder<U, ColumnName>['array']> : ReturnType<ColumnBuilder<U>['array']> :
  never;

export type TypeBuilder<T, ColumnName extends string = never> =
  [ColumnName] extends [never] ?
  T extends Tagged<any, 'column', PgColumnBuilderBase> ? T :
  T extends infer U ? Tagged<U, 'column', ColumnBuilder<U>> :
  never : never;

export type Array<T extends Tagged<ObjectLiteral, 'column', PgColumnBuilder<any>>> = Tagged<UnwrapTagged<T>[], 'column', ReturnType<GetTagMetadata<T, 'column'>['array']>>;
export type Enum<T extends Enumeration> = Tagged<EnumerationValue<T>, 'column', ReturnType<ReturnType<typeof pgEnum<string, UnionToTuple<`${EnumerationValue<T>}`> extends [string, ...string[]] ? UnionToTuple<`${EnumerationValue<T>}`> : ['NO_VALUES_PROVIDED']>>>>;
export type Text = Tagged<string, 'column', ReturnType<typeof text<string, [string, ...string[]]>>>;
export type Uuid = Tagged<string, 'column', ReturnType<typeof uuid>>;
export type Integer = Tagged<number, 'column', ReturnType<typeof integer>>;
export type DoublePrecision = Tagged<number, 'column', ReturnType<typeof doublePrecision>>;
export type Boolean = Tagged<number, 'column', ReturnType<typeof boolean>>;

export { Array, Integer, Uuid };

enum Foo {
  Bar = 0,
  Ouh = 1,
  Baz = 'World'
}

type Z = `${EnumerationValue<typeof Foo>}`;
type Y = UnionToTuple<1 | 2 | 3 | 'foo' | 'bar'>;
type X = Enum<typeof Foo>;

const foo: X = Foo.Bar;
