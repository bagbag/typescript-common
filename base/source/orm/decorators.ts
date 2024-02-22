/* eslint-disable @typescript-eslint/naming-convention */

import { NotSupportedError } from '#/error/not-supported.error.js';
import { JsonPath } from '#/json-path/json-path.js';
import type { Decorator, ReflectionMetadata } from '#/reflection/index.js';
import { createClassDecorator, createDecorator, createPropertyDecorator, reflectionRegistry } from '#/reflection/index.js';
import { EnumerationConstraint } from '#/schema/constraints/enumeration.js';
import { IntegerConstraint } from '#/schema/constraints/integer.js';
import type { SchemaTestable } from '#/schema/schema.js';
import type { ObjectSchema, ValueSchema } from '#/schema/types/index.js';
import { isDeferredValueType, isObjectSchema, isTypeSchema, isValueSchema, resolveValueType } from '#/schema/types/index.js';
import { tryGetObjectSchemaFromReflection } from '#/schema/utils/schema.js';
import type { AbstractConstructor, TypedOmit } from '#/types.js';
import { distinct, toArray } from '#/utils/array/array.js';
import { map } from '#/utils/iterable-helpers/map.js';
import { filterObject, objectKeys } from '#/utils/object/object.js';
import { assert, assertArray, assertDefinedPass, assertNotArrayPass, isArray, isDefined, isFunction, isString, isUndefined } from '#/utils/type-guards.js';
import type { EntityDefinition, FieldDefinition, FieldType, IndexOptions } from './entity-definition.model.js';

export type EntityOptions = Partial<Pick<EntityDefinition, 'name' | 'indexes'>>;
export type FieldOptions = Partial<FieldDefinition>;

function getEntityOptions(typeOrMetadata: AbstractConstructor | ReflectionMetadata): EntityOptions {
  const metadata = isFunction(typeOrMetadata) ? reflectionRegistry.getMetadata(typeOrMetadata) : typeOrMetadata;

  assert(metadata?.metadataType == 'type', 'EntityOptions is only available for decorated classes.');
  return metadata.data.tryGet<EntityOptions>('orm') ?? {};
}

function getFieldOptions(type: AbstractConstructor, property: string | symbol): FieldOptions;
function getFieldOptions(metadata: ReflectionMetadata): FieldOptions;
function getFieldOptions(typeOrMetadata: AbstractConstructor | ReflectionMetadata, property?: string | symbol): FieldOptions {
  const metadata = isFunction(typeOrMetadata) ? reflectionRegistry.getMetadata(typeOrMetadata)?.properties.get(assertDefinedPass(property, 'Missing property parameter.')) : typeOrMetadata;

  assert(metadata?.metadataType == 'property', 'FieldOptions is only available for decorated properties.');
  return metadata.data.tryGet<FieldOptions>('orm') ?? {};
}

export function createEntityDecorator(options: EntityOptions): ClassDecorator {
  return createClassDecorator({ data: { orm: options }, mergeData: true });
}

export function createFieldDecorator(options: FieldOptions): PropertyDecorator {
  return createPropertyDecorator({ data: { orm: options }, mergeData: true });
}

export function Entity(options: EntityOptions = {}): ClassDecorator {
  return createEntityDecorator(options);
}

export function Field(options: FieldOptions = {}): PropertyDecorator {
  return createFieldDecorator(options);
}

export function NullableField(options: TypedOmit<FieldOptions, 'nullable'> = {}): PropertyDecorator {
  return Field({ ...options, nullable: true });
}

export function PrimaryField(options?: TypedOmit<FieldOptions, 'primary'>): PropertyDecorator {
  return Field({ ...options, primary: true });
}

export function PrimaryGeneratedField(options?: TypedOmit<FieldOptions, 'primary' | 'generated'>): PropertyDecorator {
  return Field({ ...options, primary: true, generated: true });
}

export function CreatedField(options?: TypedOmit<FieldOptions, 'type'>): PropertyDecorator {
  return Field({ ...options, type: 'created' });
}

export function UpdatedField(options?: TypedOmit<FieldOptions, 'type'>): PropertyDecorator {
  return Field({ ...options, type: 'updated', nullable: true });
}

export function DeletedField(options?: TypedOmit<FieldOptions, 'type'>): PropertyDecorator {
  return Field({ ...options, type: 'deleted', nullable: true });
}

export function RevisionField(options?: TypedOmit<FieldOptions, 'type'>): PropertyDecorator {
  return Field({ ...options, type: 'revision' });
}

export function Index(fields: string[], options?: IndexOptions): ClassDecorator;
export function Index(options?: IndexOptions): PropertyDecorator;
export function Index(fieldsOrOptions?: string[] | IndexOptions, optionsOrNothing?: IndexOptions): Decorator<'class' | 'property'> {
  const fields = isArray(fieldsOrOptions) ? fieldsOrOptions : undefined;
  const options = (isArray(fieldsOrOptions) ? optionsOrNothing : fieldsOrOptions) ?? {};

  return createDecorator({ class: true, property: true }, (data, metadata) => {
    switch (data.type) {
      case 'class':
        const entityOptions = getEntityOptions(metadata);
        assertArray(fields, 'Fields can only be specified on class index decorator.');
        Entity({ indexes: [...(entityOptions.indexes ?? []), { fields, ...options }] })(data.constructor);
        break;

      case 'property':
        const fieldOptions = getFieldOptions(metadata);
        Field({ indexes: [...(fieldOptions.indexes ?? []), options] })(data.prototype, data.propertyKey);
        break;

      default:
        throw new NotSupportedError('Index decorator only works for classes and properties.');
    }
  });
}

type GetEntityDefinitionData = {
  entityOptions?: EntityOptions,
  objectSchema?: ObjectSchema
};

export function getEntityDefinition(typeOrData: AbstractConstructor | GetEntityDefinitionData): EntityDefinition;
export function getEntityDefinition(typeOrData: AbstractConstructor | GetEntityDefinitionData, path: JsonPath): EntityDefinition;
export function getEntityDefinition(typeOrData: AbstractConstructor | GetEntityDefinitionData, path: JsonPath = JsonPath.ROOT): EntityDefinition {
  const type = isFunction(typeOrData) ? typeOrData : undefined;
  const typeMetadata = isDefined(type) ? reflectionRegistry.getMetadata(type) : undefined;

  if (isUndefined(typeMetadata)) {
    throw new Error(`Type not found in reflection. Missing decorators? (${path.path})`);
  }

  const entityOptions = isDefined(typeMetadata) ? getEntityOptions(typeMetadata) : (typeOrData as GetEntityDefinitionData).entityOptions;
  const objectSchema = isFunction(typeOrData) ? tryGetObjectSchemaFromReflection(typeOrData) : typeOrData.objectSchema;

  const properties = distinct([...typeMetadata.properties.keys(), ...objectKeys(objectSchema?.properties ?? {})]);

  const fieldEntries = map(properties, (property): [string, FieldDefinition] => {
    const propertyName = property.toString();
    const propertyMetadata = typeMetadata.properties.get(propertyName);
    const fieldOptions = isDefined(propertyMetadata) ? getFieldOptions(propertyMetadata) : undefined;
    const propertySchema = objectSchema?.properties[propertyName];

    const fieldType = fieldOptions?.type
      ?? getFieldTypeFromSchema(
        assertNotArrayPass(
          assertDefinedPass(propertySchema, 'Could not get field type from schema.'),
          'Only a single type is allowed as field type.'
        ),
        path.add(propertyName)
      );

    return [propertyName, filterObject({
      name: fieldOptions?.name,
      type: fieldType,
      primary: fieldOptions?.primary,
      generated: fieldOptions?.generated,
      nullable: fieldOptions?.nullable ?? (isValueSchema(propertySchema) ? (((propertySchema.nullable ?? false) || (propertySchema.optional ?? false)) ? true : undefined) : undefined),
      indexes: fieldOptions?.indexes
    }, isDefined)];
  });

  return {
    name: assertDefinedPass(entityOptions?.name ?? type?.name, 'Entity name not defined.'),
    indexes: entityOptions?.indexes,
    fields: Object.fromEntries(fieldEntries)
  };
}

function getFieldTypeFromSchema(schema: SchemaTestable, path: JsonPath): FieldType {
  if (isObjectSchema(schema)) {
    return { nested: getEntityDefinition({ objectSchema: schema }) };
  }

  if (isFunction(schema)) {
    return getFieldTypeFromType(schema as AbstractConstructor, path);
  }

  if (isString(schema)) {
    throw new NotSupportedError(`Schema type "${schema}" is not supported as field type.`);
  }

  if (isDeferredValueType(schema)) {
    return getFieldTypeFromSchema(resolveValueType(schema), path);
  }

  if (isTypeSchema(schema)) {
    return getFieldTypeFromSchema(resolveValueType(schema.type), path);
  }

  return getFieldTypeFromValueSchema(schema, path);
}

function getFieldTypeFromValueSchema(schema: ValueSchema, path: JsonPath): FieldType {
  if (isDefined(schema.valueConstraints)) {
    const constraints = toArray(schema.valueConstraints);

    const enumerationConstraint = constraints.find((constraint): constraint is EnumerationConstraint => constraint instanceof EnumerationConstraint);
    const integerConstraint = constraints.find((constraint): constraint is IntegerConstraint => constraint instanceof IntegerConstraint);

    if (isDefined(enumerationConstraint)) {
      return { enumeration: enumerationConstraint.enumeration };
    }

    if (isDefined(integerConstraint)) {
      return 'integer';
    }
  }

  const innerSchemas = toArray(schema.schema);
  assert(innerSchemas.length == 1, `Could not get field type from schema type as exactly 1 schema is required, but ${innerSchemas.length} were given.`);
  const innerSchema = innerSchemas[0]!;

  return getFieldTypeFromSchema(innerSchema, path);
}

function getFieldTypeFromType(type: AbstractConstructor, path: JsonPath): FieldType {
  switch (type) {
    case String:
      return 'string';

    case Number:
      return 'float';

    case Boolean:
      return 'boolean';

    case Date:
      return 'date-time';

    default:
      return { nested: getEntityDefinition(type, path) };
  }
}
