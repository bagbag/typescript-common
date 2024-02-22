import { getNewId } from '#/database/id.js';
import { assign, Class, Optional, partial, Property } from '#/schema/index.js';
import type { ObjectLiteral, PartialProperty, Type } from '#/types.js';
import { isNumber, isString } from '#/utils/type-guards.js';
import { CreatedField, DeletedField, RevisionField, UpdatedField } from '../decorators.js';

export type Id = string | number;

export abstract class EntityMetadata {
  @RevisionField()
  revision: number;

  @CreatedField()
  created: Date;

  @UpdatedField()
  updated?: Date;

  @DeletedField()
  deleted?: Date;
}

export abstract class Entity {
  @Property()
  id: string;
}

export abstract class EntityWithMetadata extends Entity {
  @Property()
  metadata: EntityMetadata;
}

export abstract class NewEntityBase {
  @Optional(String)
  id?: string;
}

export type NewEntity<T> = T extends Entity ? PartialProperty<T, 'id'> : T;
export type MaybeNewEntity<T> = T | NewEntity<T>;

export function newEntity<T extends ObjectLiteral>(type: Type<T>): Type<NewEntity<T>> {
  const newName = `New${type.name}Base`;

  const newClass = {
    [newName]: class extends NewEntityBase { }
  }[newName]!;

  Reflect.decorate([Class({ schema: assign(NewEntityBase, partial<any, any>(type, 'id')) })], newClass);

  return newClass as Type<NewEntity<T>>;
}

export function toEntity<T extends Entity>(entity: T | NewEntity<T>): T {
  const { id, ...entityRest } = entity;

  const entityWithId = {
    id: id ?? getNewId(),
    ...entityRest
  } as T;

  return entityWithId;
}

export function isId(value: any): value is Id {
  return isString(value) || isNumber(value);
}
