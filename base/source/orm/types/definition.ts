import { NotSupportedError } from '#/error/not-supported.error.js';
import { reflectionRegistry } from '#/reflection/registry.js';
import type { ResolvedValueType } from '#/schema/index.js';
import { getSchemaValueTypes, getValueTypeName, isValueSchema, tryGetObjectSchemaFromReflection } from '#/schema/index.js';
import type { OneOrMany, Record, Type } from '#/types.js';
import { toArray } from '#/utils/array/array.js';
import { objectEntries } from '#/utils/object/object.js';
import { isNotNull, isUndefined } from '#/utils/type-guards.js';

export type EntityDefinition = {
  name: string,
  tableName?: string,
  properties: Record,
  indexes?: IndexDefinition[]
};

export type EntityPropertyType = 'any' | 'string' | 'number' | 'boolean';

export type PropertyDefinition = {
  type: OneOrMany<EntityPropertyType>,
  array?: boolean,
  nullable?: boolean,
  unique?: boolean
};

export type IndexDefinition = {
  properties: string[],
  unique?: boolean
};

export function getEntityDefinitionFromSchema(type: Type): EntityDefinition | null {
  const metadata = reflectionRegistry.getMetadata(type);

  if (isUndefined(metadata)) {
    return null;
  }

  const properties: Record<PropertyKey, PropertyDefinition> = {};

  const schema = tryGetObjectSchemaFromReflection(type);

  if (isNotNull(schema)) {
    for (const [key, property] of objectEntries(schema.properties)) {
      const valueTypes = getSchemaValueTypes(property);
      const valueTypesWithoutNullAndUndefined = valueTypes.filter((valueType) => (valueType != 'null') && (valueType != 'undefined'));

      const types = toArray(valueTypesWithoutNullAndUndefined).map(schemaValueTypeToEntityPropertyType);

      properties[key] = {
        type: (types.length > 1) ? types : types[0]!,
        array: (isValueSchema(property) && (property.array == true)),
        nullable: valueTypes.includes('null') || valueTypes.includes('undefined') || (isValueSchema(property) && ((property.nullable == true) || (property.optional == true)))
      };
    }
  }

  const definition: EntityDefinition = {
    name: type.name,
    properties,
    indexes: []
  };

  return definition;
}

function schemaValueTypeToEntityPropertyType(valueType: ResolvedValueType): EntityPropertyType {
  if ((valueType == 'undefined') || (valueType == 'null')) {
    throw new Error('null and undefined are not supported');
  }

  if (valueType == String) {
    return 'string';
  }

  if (valueType == Number) {
    return 'number';
  }

  if (valueType == Boolean) {
    return 'boolean';
  }

  if (valueType == 'any') {
    return 'any';
  }

  throw new NotSupportedError(`ValueType ${getValueTypeName(valueType)} not supported.`);
}
