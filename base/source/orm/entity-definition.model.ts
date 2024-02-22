import type { RequireExactlyOne } from 'type-fest';

import { NotSupportedError } from '#/error/not-supported.error.js';
import { JsonPath } from '#/json-path/json-path.js';
import type { AbstractConstructor, Enumeration, Paths, Record } from '#/types.js';
import { memoize } from '#/utils/function/memoize.js';
import { objectEntries } from '#/utils/object/object.js';
import { isDefined, isObject } from '#/utils/type-guards.js';

export type FieldType = 'string' | 'integer' | 'float' | 'boolean' | 'uuid' | 'date-time' | 'date' | 'time' | 'json' | 'serialized' | ComplexFieldType | SpecialFieldType;
export type NormalizedFieldType = 'string' | 'integer' | 'float' | 'boolean' | 'uuid' | 'date-time' | 'date' | 'time' | 'json' | 'serialized' | NormalizedComplexFieldType | SpecialFieldType;

export type NestedFieldType = { nested: EntityDefinition };
export type EnumerationFieldType = { enumeration: Enumeration };

export type ComplexFieldType = RequireExactlyOne<NestedFieldType & EnumerationFieldType>;
export type NormalizedComplexFieldType = RequireExactlyOne<EnumerationFieldType>;

export type SpecialFieldType = 'created' | 'updated' | 'deleted' | 'revision';

export type FieldPropertyType = AbstractConstructor | 'numeric-date' | 'numeric-time';

export type GeneratedField = boolean | 'now' | ((insertedEntity: object) => any);

export type IndexOptions = {
  name?: string,
  unique?: boolean
};

export type IndexDirection = 1 | -1 | 'asc' | 'desc';

export type EntityIndexDefinition<T extends Record = any> = IndexOptions & {
  fields: (Paths<T> | [Paths<T>, IndexDirection])[] | { [P in Paths<T>]?: IndexDirection }
};

export type NormalizedEntityIndexDefinition = Required<IndexOptions> & { fields: [string, 'asc' | 'desc'][] };

export type FieldIndexDefinition = IndexOptions & { direction?: 'asc' | 'desc' };

export type NormalizedFieldIndexDefinition = Required<FieldIndexDefinition>;

export interface ValueTransformer<T = unknown, TDb = unknown> {
  toDatabase(value: T): TDb;
  fromDatabase(value: TDb): T;
}

export type FieldDefinition = {
  /** Type of field in database */
  type: FieldType,

  /** Field name in database */
  name?: string,

  /** Type of property in object (used for conversion) */
  propertyType?: FieldPropertyType,

  /** Whether it is the primary field (identifier). If it is, an unique index/constraint is automatically created */
  primary?: boolean,

  /** Whether the fields value should be generated on insert. `true` only works for some data types like uuid, in which case an random uuid is generated */
  generated?: GeneratedField,

  /** Whether the field is an array. Does not work for every database type */
  array?: boolean,

  /** Whether the field is nullable */
  nullable?: boolean,

  /** Indexes of the field. If compound index (over multiple fields) is required, specify index on entity instead. */
  indexes?: FieldIndexDefinition[],

  /** Manual conversion from JavaScript value to database value */
  transformer?: ValueTransformer
};

export type EntityDefinition = {
  /** Name of entity. Used to infer various things like table/collection/etc name and for logging */
  name: string,

  /** Fields of the entity */
  fields: Record<string, FieldDefinition>,

  /** Indexes of the entity */
  indexes?: EntityIndexDefinition[]
};

export type NormalizedEntityDefinition = {
  name: string,
  fields: Record<string, NormalizedFieldDefinition>,
  fieldsEntries: (readonly [string, NormalizedFieldDefinition])[],
  generatedFields: Record<string, NormalizedFieldDefinition>,
  generatedFieldsEntries: (readonly [string, NormalizedFieldDefinition])[],
  specialFields: Record<string, NormalizedFieldDefinition>,
  specialFieldsEntries: (readonly [string, NormalizedFieldDefinition])[],
  indexes: NormalizedEntityIndexDefinition[]
};

export type NormalizedFieldDefinition = {
  type: NormalizedFieldType,
  name: string | undefined,
  property: string[],
  propertyType?: FieldPropertyType,
  primary: boolean,
  generated: GeneratedField,
  array: boolean,
  nullable: boolean,
  indexes: FieldIndexDefinition[],
  transformer: ValueTransformer | undefined
};

export const normalizeEntityDefinition = memoize(_normalizeEntityDefinition);
export const normalizeFieldDefinition = memoize(_normalizeFieldDefinition);

function norm(definition: EntityDefinition, path: string[] = [], result: NormalizedEntityDefinition | undefined = undefined): NormalizedEntityDefinition {
  const normalized: NormalizedEntityDefinition = result ?? {
    name: definition.name,
    fields: {},
    fieldsEntries: [],
    generatedFields: {},
    generatedFieldsEntries: [],
    specialFields: {},
    specialFieldsEntries: [],
    indexes: []
  };

  for (const [field, fieldDefinition] of objectEntries(definition.fields)) {
    const fieldPath = [...path, field];

    if (isNestedField(fieldDefinition.type)) {
      norm(fieldDefinition.type.nested, fieldPath, normalized);
    }

    normalized.fieldsEntries.push([fieldPath.join('.'), normalizeFieldDefinition([...path, field], fieldDefinition)]);
  }

  return normalized;
}

function _normalizeEntityDefinition(definition: EntityDefinition, path: JsonPath = new JsonPath({ dollar: false })): NormalizedEntityDefinition {
  const indexes = isDefined(definition.indexes) ? [...definition.indexes] : [];

  const fieldsEntries = objectEntries(definition.fields).map(([field, fieldDefinition]) => [field, normalizeFieldDefinition(field, fieldDefinition)] as const);
  const generatedFieldsEntries = fieldsEntries.filter((entry) => isDefined(entry[1].generated));
  const specialFieldsEntries = fieldsEntries.filter((entry) => isSpecialFieldType(entry[1].type));

  return {
    name: definition.name,
    fields: Object.fromEntries(fieldsEntries),
    fieldsEntries,
    generatedFields: Object.fromEntries(generatedFieldsEntries),
    generatedFieldsEntries,
    specialFields: Object.fromEntries(specialFieldsEntries),
    specialFieldsEntries,
    indexes: definition.indexes ?? []
  };
}

function _normalizeFieldDefinition(property: string[], definition: FieldDefinition): NormalizedFieldDefinition {
  if (isNestedField(definition.type)) {
    throw new NotSupportedError('Nested field type is not supported. Must be flattened.');
  }

  return {
    type: definition.type,
    name: definition.name,
    property,
    propertyType: definition.propertyType,
    primary: definition.primary ?? false,
    generated: definition.generated ?? false,
    array: definition.array ?? false,
    nullable: definition.nullable ?? false,
    indexes: definition.indexes ?? [],
    transformer: definition.transformer
  };
}

function normalizeEntityIndexDefinition(def: EntityIndexDefinition): EntityIndexDefinition {

}

function normalizeFieldIndexDefinition(definition: FieldIndexDefinition): NormalizedFieldIndexDefinition {
  return {
    name: definition.name ?? ,
    unique: definition.unique ?? false,
    direction: definition.direction ?? 'asc'
  };
}

export function isSpecialFieldType(fieldType: FieldType | NormalizedFieldType): fieldType is SpecialFieldType {
  return (fieldType == 'created') || (fieldType == 'updated') || (fieldType == 'deleted') || (fieldType == 'revision');
}

export function isNestedField(fieldType: FieldType): fieldType is NestedFieldType {
  return isObject(fieldType) && isDefined(fieldType.nested);
}

function generateCrc32Table(): Uint32Array {
  const crcTable = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let c = i;

    for (var k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    }

    crcTable[i] = c;
  }

  return crcTable;
}

function crc32(bytes: Uint8Array): Uint8Array {
  const crcTable = generateCrc32Table();

  let crc = 0 ^ (-1);

  for (var i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[crc ^ bytes[i]! & 0xff]!;
  }

  crc = (crc ^ (-1)) >>> 0;

  return new Uint8Array(new Uint32Array([crc]).buffer);
};
