import { forwardArg, injectArg } from '#/container/decorators.js';
import type { MaybeNewEntity } from '#/orm/models/entity.js';
import type { BaseOptions, DeleteManyOptions, DeleteOptions, LoadManyOptions, LoadOptions, PatchManyOptions, PatchOptions, Query } from '#/orm/types/index.js';
import type { DeepPartialObject, Record } from '#/types.js';
import { assertDefinedPass, isArray, isFunction, isString } from '#/utils/type-guards.js';
import type { RepositoryArgument, RepositoryOptions } from '../repository.js';
import { Repository } from '../repository.js';
import type { IsolationLevel, Transaction } from '../transaction.js';
import type { CollectionArgument, MongoClientArgument } from './classes.js';
import { Collection, MongoClient } from './classes.js';
import { MongoTransaction } from './mongo-transaction.js';

export class MongoRepository<T extends Record> extends Repository<T> {
  private readonly client: MongoClient;
  private readonly collection: Collection;

  constructor(
    @forwardArg<RepositoryArgument, MongoClientArgument | undefined>(repositoryArgumentToMongoClientArgumentMapper) client: MongoClient,
    @forwardArg<RepositoryArgument, CollectionArgument>(repositoryArgumentToCollectionArgumentMapper) collection: Collection,
    @injectArg() options: RepositoryOptions
  ) {
    super(options);

    this.client = client;
    this.collection = collection;
  }

  protected duplicateInstance(): Repository<T> {
    return new MongoRepository<T>(this.client, this.collection, this.options);
  }

  protected initializeTransaction(isolationLevel: IsolationLevel): Transaction {
    const session = this.client.startSession({ causalConsistency: true });
    return new MongoTransaction(session, isolationLevel);
  }

  protected async _insert<U extends T = T>(entities: MaybeNewEntity<U> | MaybeNewEntity<U>[], options: BaseOptions): Promise<void> {
    if (isArray(entities)) {
      await this.collection.insertMany(entities, { session: (options.transaction as MongoTransaction | undefined)?.session });
    }

    await this.collection.insertOne(entities, { session: (options.transaction as MongoTransaction | undefined)?.session });
  }

  protected async _insertAndLoad<U extends T = T>(entity: MaybeNewEntity<U>, options: BaseOptions): Promise<U>;
  protected async _insertAndLoad<U extends T = T>(entities: MaybeNewEntity<U>[], options: BaseOptions): Promise<U[]>;
  protected async _insertAndLoad<U extends T = T>(_entities: MaybeNewEntity<U> | MaybeNewEntity<U>[], _options: BaseOptions): Promise<U | U[]> {
    throw new Error('Method not implemented.');
  }

  protected _has<U extends T = T>(_query: Query<U>, _options: BaseOptions): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  protected _count<U extends T = T>(_query: Query<U>, _options: LoadManyOptions<U>): Promise<number> {
    throw new Error('Method not implemented.');
  }

  protected _tryLoad<U extends T = T>(_query: Query<U>, _options: LoadOptions<U>): Promise<U | undefined> {
    throw new Error('Method not implemented.');
  }

  protected _loadMany<U extends T = T>(_query: Query<U>, _options: LoadManyOptions<U>): Promise<U[]> {
    throw new Error('Method not implemented.');
  }

  protected _loadManyCursor<U extends T = T>(_query: Query<U>, _options: LoadManyOptions<U>): AsyncIterable<U> {
    throw new Error('Method not implemented.');
  }

  protected _tryPatch<U extends T = T>(_query: Query<U>, _patch: DeepPartialObject<U>, _options: PatchOptions<U>): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  protected _patchMany<U extends T = T>(_query: Query<U>, _patch: DeepPartialObject<U>, _options: PatchManyOptions<U>): Promise<number> {
    throw new Error('Method not implemented.');
  }

  protected _tryPatchAndLoad<U extends T = T>(_query: Query<U>, _patch: DeepPartialObject<U>, _options: PatchOptions<U>): Promise<U | undefined> {
    throw new Error('Method not implemented.');
  }

  protected _patchAndLoadMany<U extends T = T>(_query: Query<U>, _patch: DeepPartialObject<U>, _options: PatchManyOptions<U>): Promise<U[]> {
    throw new Error('Method not implemented.');
  }

  protected _tryDelete<U extends T = T>(_query: Query<U>, _options: DeleteOptions<U>): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  protected _deleteMany<U extends T = T>(_query: Query<U>, _options: DeleteManyOptions<U>): Promise<number> {
    throw new Error('Method not implemented.');
  }

  protected _tryDeleteAndLoad<U extends T = T>(_query: Query<U>, _options: DeleteOptions<U>): Promise<U | undefined> {
    throw new Error('Method not implemented.');
  }

  protected _deleteAndLoadMany<U extends T = T>(_query: Query<U>, _options: DeleteManyOptions<U>): Promise<U[]> {
    throw new Error('Method not implemented.');
  }
}

function repositoryArgumentToMongoClientArgumentMapper(config: RepositoryArgument): MongoClientArgument | undefined {
  if (isFunction(config) || isString(config.mongo)) {
    return undefined;
  }

  return config.mongo?.connection;
}

function repositoryArgumentToCollectionArgumentMapper(config: RepositoryArgument): CollectionArgument {
  const collection = isFunction(config) ? config.name : config.definition?.name ?? config.type?.name;
  return { collection: assertDefinedPass(collection, 'Could not get collection name.') };
}
