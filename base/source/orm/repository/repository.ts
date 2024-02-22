/* eslint-disable @typescript-eslint/member-ordering */

import type { Injectable } from '#/container/index.js';
import { resolveArgumentType } from '#/container/index.js';
import { NotFoundError } from '#/error/not-found.error.js';
import type { AbstractConstructor, DeepPartialObject, Record } from '#/types.js';
import { currentTimestamp, now } from '#/utils/date-time.js';
import { hasOwnProperty, objectEntries } from '#/utils/object/object.js';
import { getRandomString } from '#/utils/random.js';
import { assertDefinedPass, assertFunctionPass, isArray, isDefined, isFunction, isNotFunction, isObject, isUndefined } from '#/utils/type-guards.js';
import { getEntityDefinition } from '../decorators.js';
import type { EntityDefinition, NormalizedEntityDefinition, SpecialFieldType } from '../entity-definition.model.js';
import { normalizeEntityDefinition } from '../entity-definition.model.js';
import type { Id, MaybeNewEntity } from '../models/entity.js';
import { isId } from '../models/entity.js';
import type { BaseOptions, ComparisonInQuery, DeleteManyOptions, DeleteOptions, HasOptions, InsertOptions, LoadManyOptions, LoadOptions, PatchManyOptions, PatchOptions, Query } from '../types/index.js';
import type { CollectionArgument } from './mongo/classes.js';
import { IsolationLevel, Transaction } from './transaction.js';

export type RepositoryOptions = AbstractConstructor | {
  type?: AbstractConstructor,
  definition?: EntityDefinition
};

export type RepositoryArgument = RepositoryOptions & {
  mongo?: CollectionArgument
};

export type EntityPatch<T extends Record> = DeepPartialObject<T>;

export type UseTransactionHandler<T extends Record, Result> = (transaction: Transaction, repositoryWithTransaction: Repository<T>) => Promise<Result>;

export abstract class Repository<T extends Record> implements Injectable<RepositoryArgument> {
  private transaction: Transaction | undefined;

  protected readonly options: RepositoryOptions;
  protected readonly type?: AbstractConstructor;
  protected readonly definition: EntityDefinition;
  protected readonly normalizedDefinition: NormalizedEntityDefinition;
  protected readonly notFoundErrorMessage: string;

  readonly [resolveArgumentType]: RepositoryArgument;
  constructor(options: RepositoryOptions) {
    this.options = options;

    this.type = isFunction(options) ? options : options.type;
    this.definition = (isNotFunction(options) ? options.definition : undefined) ?? getEntityDefinition(assertDefinedPass(this.type, 'Neither definition nor type provided.'));
    this.normalizedDefinition = normalizeEntityDefinition(this.definition);

    this.notFoundErrorMessage = `Entity in ${this.definition.name} not found.`;
  }

  /* transaction */

  async startTransaction(isolationLevel: IsolationLevel = IsolationLevel.RepeatableRead): Promise<Transaction> {
    return this.initializeTransaction(isolationLevel);
  }

  async withTransaction(transactionOrIsolationLevel?: Transaction | IsolationLevel): Promise<Repository<T>> {
    const instance = await this.duplicateInstance();
    instance.transaction = (transactionOrIsolationLevel instanceof Transaction) ? transactionOrIsolationLevel : await this.startTransaction(transactionOrIsolationLevel);

    return instance;
  }

  async useTransaction<R>(handler: UseTransactionHandler<T, R>, isolationLevel?: IsolationLevel): Promise<R>;
  async useTransaction<R>(transaction: Transaction, handler: UseTransactionHandler<T, R>): Promise<R>;
  async useTransaction<R>(handlerOrTransaction: UseTransactionHandler<T, R> | Transaction, handlerOrIsolationLevel?: UseTransactionHandler<T, R> | IsolationLevel): Promise<R> {
    const handler = isFunction(handlerOrTransaction) ? handlerOrTransaction : assertFunctionPass<UseTransactionHandler<T, R>>(handlerOrIsolationLevel);
    const isolationLevel = isFunction(handlerOrTransaction) ? handlerOrIsolationLevel as IsolationLevel : undefined;
    const transaction = isFunction(handlerOrTransaction) ? await this.startTransaction(isolationLevel) : handlerOrTransaction;

    return transaction.use(async () => handler(transaction, this));
  }


  /* insert */

  async insert<U extends T = T>(entities: MaybeNewEntity<U> | MaybeNewEntity<U>[], options?: InsertOptions): Promise<void> {
    const actualOptions = this.getOptions(options);

    if (!isArray(entities)) {
      const obj: Record = {};

      for (const [field, definition] of this.normalizedDefinition.fieldsEntries) {
        if (definition.type == 'created') {
          obj[definition.name] = entities[field] ?? currentTimestamp();
        }
      }
    }

    return this._insert(entities, actualOptions);
  }

  async insertAndLoad<U extends T = T>(entity: MaybeNewEntity<U>, options?: InsertOptions): Promise<U>;
  async insertAndLoad<U extends T = T>(entities: MaybeNewEntity<U>[], options?: InsertOptions): Promise<U[]>;
  async insertAndLoad<U extends T = T>(entities: MaybeNewEntity<U> | MaybeNewEntity<U>[], options?: InsertOptions): Promise<U | U[]> {
    const actualOptions = this.getOptions(options);
    return this._insertAndLoad(entities, actualOptions);
  }


  /* patch */

  async patch<U extends T = T>(idOrQuery: Id | Query<U>, patch: EntityPatch<U>, options?: PatchOptions<U>): Promise<void> {
    const patched = await this.tryPatch(idOrQuery, patch, options);

    if (!patched) {
      throw new NotFoundError(this.notFoundErrorMessage);
    }
  }

  async tryPatch<U extends T = T>(idOrQuery: Id | Query<U>, patch: EntityPatch<U>, options?: PatchOptions<U>): Promise<boolean> {
    const query = this.getQuery(idOrQuery);
    const actualOptions = this.getOptions(options);

    return this._tryPatch(query, patch, actualOptions);
  }

  async patchMany<U extends T = T>(idOrQuery: Id | Query<U>, patch: EntityPatch<U>, options?: PatchManyOptions<U>): Promise<number> {
    const query = this.getQuery(idOrQuery);
    const actualOptions = this.getOptions(options);

    return this._patchMany(query, patch, actualOptions);
  }

  async patchAndLoad<U extends T = T>(idOrQuery: Id | Query<U>, patch: EntityPatch<U>, options?: PatchOptions<U>): Promise<U> {
    const entity = await this.tryPatchAndLoad(idOrQuery, patch, options);
    return this.throwNotFoundIfUndefinedPass(entity);
  }

  async tryPatchAndLoad<U extends T = T>(idOrQuery: Id | Query<U>, patch: EntityPatch<U>, options?: PatchOptions<U>): Promise<U | undefined> {
    const query = this.getQuery(idOrQuery);
    const actualOptions = this.getOptions(options);

    return this._tryPatchAndLoad(query, patch, actualOptions);
  }

  async patchAndLoadMany<U extends T = T>(idOrQuery: Id | Query<U>, patch: EntityPatch<U>, options?: PatchManyOptions<U>): Promise<U[]> {
    const query = this.getQuery(idOrQuery);
    const actualOptions = this.getOptions(options);

    return this._patchAndLoadMany(query, patch, actualOptions);
  }

  /* has */

  async has<U extends T = T>(idOrQuery: Id | Query<U>, options?: HasOptions): Promise<boolean> {
    const query = this.getQuery(idOrQuery);
    const actualOptions = this.getOptions(options);

    return this._has(query, actualOptions);
  }

  /* count */

  async count<U extends T = T>(query?: Query<U>, options?: LoadManyOptions<U>): Promise<number> {
    const actualOptions = this.getOptions(options);

    return this._count(query ?? {}, actualOptions);
  }


  /* load */

  async load<U extends T = T>(idOrQuery: Id | Query<U>, options?: LoadOptions<U>): Promise<U> {
    const entity = await this.tryLoad(idOrQuery, options);
    return this.throwNotFoundIfUndefinedPass(entity);
  }

  async tryLoad<U extends T = T>(idOrQuery: Id | Query<U>, options?: LoadOptions<U>): Promise<U | undefined> {
    const query = this.getQuery(idOrQuery);
    const actualOptions = this.getOptions(options);

    return this._tryLoad(query, actualOptions);
  }

  async loadAll<U extends T = T>(options?: LoadManyOptions<U>): Promise<U[]> {
    return this.loadMany({}, options);
  }

  async loadMany<U extends T = T>(idsOrQuery: Id[] | Query<U>, options?: LoadManyOptions<U>): Promise<U[]> {
    const query = this.getQuery(idsOrQuery);
    const actualOptions = this.getOptions(options);

    return this._loadMany(query, actualOptions);
  }

  loadAllCursor<U extends T = T>(options?: LoadManyOptions<U>): AsyncIterable<U> {
    return this.loadManyCursor({}, options);
  }

  loadManyCursor<U extends T = T>(idsOrQuery: Id[] | Query<U>, options?: LoadManyOptions<U>): AsyncIterable<U> {
    const query = this.getQuery(idsOrQuery);
    const actualOptions = this.getOptions(options);

    return this._loadManyCursor(query, actualOptions);
  }

  /* delete */

  async delete<U extends T = T>(idOrQuery: Id | Query<U>, options?: DeleteOptions<U>): Promise<void> {
    const deleted = await this.tryDelete(idOrQuery, options);

    if (!deleted) {
      throw new NotFoundError(this.notFoundErrorMessage);
    }
  }

  async tryDelete<U extends T = T>(idOrQuery: Id | Query<U>, options?: DeleteOptions<U>): Promise<boolean> {
    const query = this.getQuery(idOrQuery);
    const actualOptions = this.getOptions(options);

    return this._tryDelete(query, actualOptions);
  }

  async deleteMany<U extends T = T>(idsOrQuery: Id[] | Query<U>, options?: DeleteManyOptions<U>): Promise<number> {
    const query = this.getQuery(idsOrQuery);
    const actualOptions = this.getOptions(options);

    return this._deleteMany(query, actualOptions);
  }

  async deleteAndLoad<U extends T = T>(idOrQuery: Id | Query<U>, options?: DeleteOptions<U>): Promise<U> {
    const entity = await this.tryDeleteAndLoad(idOrQuery, options);
    return this.throwNotFoundIfUndefinedPass(entity);
  }

  async tryDeleteAndLoad<U extends T = T>(idOrQuery: Id | Query<U>, options?: DeleteOptions<U>): Promise<U | undefined> {
    const query = this.getQuery(idOrQuery);
    const actualOptions = this.getOptions(options);

    return this._tryDeleteAndLoad(query, actualOptions);
  }

  async deleteAndLoadMany<U extends T = T>(idsOrQuery: Id[] | Query<U>, options?: DeleteManyOptions<U>): Promise<U[]> {
    const query = this.getQuery(idsOrQuery);
    const actualOptions = this.getOptions(options);

    return this._deleteAndLoadMany(query, actualOptions);
  }

  /* misc */

  protected getQuery<U>(idOrQuery: Id | Id[] | Query<U>): Query<U> {
    const query = isId(idOrQuery) ? { id: idOrQuery } satisfies Query
      : isArray(idOrQuery) ? { id: { $in: idOrQuery } satisfies ComparisonInQuery } satisfies Query
        : idOrQuery;

    return query as Query<U>;
  }

  protected getOptions<O extends BaseOptions>(options?: O): O {
    if (isDefined(this.transaction)) {
      return {
        ...options,
        transaction: options?.transaction ?? this.transaction
      } as O;
    }

    return options ?? {} as O;
  }

  private throwNotFoundIfUndefinedPass<U>(entity: U | undefined): U {
    if (isUndefined(entity)) {
      throw new NotFoundError(this.notFoundErrorMessage);
    }

    return entity;
  }

  /* implementation specific */

  protected abstract duplicateInstance(): Repository<T> | Promise<Repository<T>>;

  protected abstract initializeTransaction(isolationLevel: IsolationLevel): Transaction | Promise<Transaction>;

  protected abstract _insert<U extends T = T>(entities: MaybeNewEntity<U> | MaybeNewEntity<U>[], options: InsertOptions): Promise<void>;
  protected abstract _insertAndLoad<U extends T = T>(entity: MaybeNewEntity<U>, options: InsertOptions): Promise<U>;
  protected abstract _insertAndLoad<U extends T = T>(entities: MaybeNewEntity<U>[], options: InsertOptions): Promise<U[]>;
  protected abstract _insertAndLoad<U extends T = T>(entities: MaybeNewEntity<U> | MaybeNewEntity<U>[], options: InsertOptions): Promise<U | U[]>;

  protected abstract _has<U extends T = T>(query: Query<U>, options: HasOptions): Promise<boolean>;
  protected abstract _count<U extends T = T>(query: Query<U>, options: LoadManyOptions<U>): Promise<number>;

  protected abstract _tryLoad<U extends T = T>(query: Query<U>, options: LoadOptions<U>): Promise<U | undefined>;
  protected abstract _loadMany<U extends T = T>(query: Query<U>, options: LoadManyOptions<U>): Promise<U[]>;
  protected abstract _loadManyCursor<U extends T = T>(query: Query<U>, options: LoadManyOptions<U>): AsyncIterable<U>;

  protected abstract _tryPatch<U extends T = T>(query: Query<U>, patch: EntityPatch<U>, options: PatchOptions<U>): Promise<boolean>;
  protected abstract _patchMany<U extends T = T>(query: Query<U>, patch: EntityPatch<U>, options: PatchManyOptions<U>): Promise<number>;
  protected abstract _tryPatchAndLoad<U extends T = T>(query: Query<U>, patch: EntityPatch<U>, options: PatchOptions<U>): Promise<U | undefined>;
  protected abstract _patchAndLoadMany<U extends T = T>(query: Query<U>, patch: EntityPatch<U>, options: PatchManyOptions<U>): Promise<U[]>;

  protected abstract _tryDelete<U extends T = T>(query: Query<U>, options: DeleteOptions<U>): Promise<boolean>;
  protected abstract _deleteMany<U extends T = T>(query: Query<U>, options: DeleteManyOptions<U>): Promise<number>;
  protected abstract _tryDeleteAndLoad<U extends T = T>(query: Query<U>, options: DeleteOptions<U>): Promise<U | undefined>;
  protected abstract _deleteAndLoadMany<U extends T = T>(query: Query<U>, options: DeleteManyOptions<U>): Promise<U[]>;
}

function prepareEntityForInsert(entity: Record, entityDefinition: NormalizedEntityDefinition): Record {
  const databaseEntity: Record = {};

  const entries = objectEntries(entity);

  for (const [key, value] of entries) {
    const definition = entityDefinition.fields[key as string];

    if (isUndefined(definition)) {
      databaseEntity[key] = value;
      continue;
    }

    if (isObject(definition.type) && isDefined(definition.type.nested)) {
      databaseEntity[definition.name] = prepareEntityForInsert(value as Record, definition.type.nested.definition);
    }
    else {
      databaseEntity[definition.name] = definition.transformer?.toDatabase(value) ?? value;
    }
  }

  for (const [key, definition] of entityDefinition.generatedFieldsEntries) {
    if (hasOwnProperty(databaseEntity, definition.name)) {
      continue;
    }

    switch (definition.type) {
      case 'string':
        databaseEntity[definition.name] = getRandomString(24);
        break;

      case 'uuid':
        databaseEntity[definition.name] = globalThis.crypto.randomUUID();
        break;

      case 'date-time':
      case 'date':
      case 'time':
        databaseEntity[definition.name] = now();
        break;

      default:
        throw new Error(`Unsupported field type for auto-generation at ${key}.`);
    }
  }

  for (const [, definition] of entityDefinition.specialFieldsEntries) {
    if (definition.type == 'created') {
      databaseEntity[definition.name] = now();
    }
  }

  return databaseEntity;
}

function prepareEntity(prepareType: 'insert' | 'patch', entity: Record, entityDefinition: NormalizedEntityDefinition): Record {
  const databaseEntity: Record = {};

  const entries = objectEntries(entity);

  for (const [key, value] of entries) {
    const definition = entityDefinition.fields[key as string];

    if (isUndefined(definition)) {
      databaseEntity[key] = value;
      continue;
    }

    if (isObject(definition.type) && isDefined(definition.type.nested)) {
      databaseEntity[definition.name] = prepareEntity(prepareType, value as Record, definition.type.nested.definition);
    }
    else {
      databaseEntity[definition.name] = definition.transformer?.toDatabase(value) ?? value;
    }
  }

  if (prepareType == 'insert') {
    for (const [key, definition] of entityDefinition.generatedFieldsEntries) {
      if (hasOwnProperty(databaseEntity, definition.name)) {
        continue;
      }

      switch (definition.type) {
        case 'string':
          databaseEntity[definition.name] = getRandomString(24);
          break;

        case 'uuid':
          databaseEntity[definition.name] = globalThis.crypto.randomUUID();
          break;

        case 'date-time':
        case 'date':
        case 'time':
          databaseEntity[definition.name] = now();
          break;

        default:
          throw new Error(`Unsupported field type for auto-generation at ${key}.`);
      }
    }
  }

  for (const [, definition] of entityDefinition.specialFieldsEntries) {
    if ((prepareType == 'insert') && ((definition.type as SpecialFieldType) == 'created')) {
      databaseEntity[definition.name] = now();
    }

    if ((prepareType == 'patch') && ((definition.type as SpecialFieldType) == 'updated')) {
      databaseEntity[definition.name] = now();
    }
  }

  return databaseEntity;
}
