import { AsyncEnumerable } from '@tstdl/base/enumerable';
import { NotFoundError } from '@tstdl/base/error';
import { Entity, EntityWithPartialId } from '@tstdl/database';
import { FindAndModifyWriteOpResultObject } from 'mongodb';
import { MongoDocument, toEntity, toMongoDocument, toMongoDocumentWithNewId } from './model';
import { Collection, FilterQuery, TypedIndexSpecification, UpdateQuery } from './types';

export type UpdateResult = {
  matchedCount: number,
  modifiedCount: number,
  upsertedCount: number
};

export type LoadOptions<T extends Entity> = {
  sort?: [keyof MongoDocument<T>, 1 | -1][],
  upsert?: boolean
};

export type LoadManyOptions<T extends Entity> = LoadOptions<T> & {
  limit: number
};

export type LoadAndUpdateOptions<T extends Entity> = LoadOptions<T> & {
  returnOriginal?: boolean
};

export class MongoBaseRepository<T extends Entity> {
  readonly collection: Collection<MongoDocument<T>>;

  constructor(collection: Collection<MongoDocument<T>>) {
    this.collection = collection;
  }

  async createIndexes(indexes: TypedIndexSpecification<T>[]): Promise<void> {
    return this.collection.createIndexes(indexes);
  }

  async insert<U extends T>(entity: EntityWithPartialId<U>): Promise<U> {
    const document = toMongoDocumentWithNewId(entity);
    const result = await this.collection.insertOne(document as any);

    return toEntity(document);
  }

  async replace<U extends T>(entity: EntityWithPartialId<U>, upsert: boolean): Promise<U> {
    const document = toMongoDocumentWithNewId(entity);
    const { replaceOne: { filter, replacement } } = toReplaceOneOperation(document, upsert);
    await this.collection.replaceOne(filter, replacement, { upsert });

    return toEntity(document);
  }

  async replaceByFilter<U extends T>(filter: FilterQuery<U>, entity: EntityWithPartialId<U>, upsert: boolean): Promise<U> {
    const document = toMongoDocumentWithNewId(entity);
    await this.collection.replaceOne(filter, document, { upsert });

    return toEntity(document);
  }

  async insertMany<U extends T>(entities: EntityWithPartialId<U>[]): Promise<U[]> {
    if (entities.length == 0) {
      return [];
    }

    const documents = entities.map(toMongoDocumentWithNewId);
    const operations = documents.map(toInsertOneOperation);
    const bulkWriteResult = await this.collection.bulkWrite(operations);

    const savedEntities = documents.map(toEntity);
    return savedEntities;
  }

  async replaceMany<U extends T>(entities: EntityWithPartialId<U>[], upsert: boolean): Promise<U[]> {
    if (entities.length == 0) {
      return [];
    }

    const documents = entities.map(toMongoDocumentWithNewId);
    const operations = documents.map((document) => toReplaceOneOperation(document, upsert));
    await this.collection.bulkWrite(operations);

    const savedEntities = documents.map(toEntity);
    return savedEntities;
  }

  async insertOrReplace<U extends T>(entities: EntityWithPartialId<U>[], upsert: boolean): Promise<U[]> {
    if (entities.length == 0) {
      return [];
    }

    const documents: MongoDocument<U>[] = [];
    const operations: object[] = [];

    for (const entity of entities) {
      let operation: object;

      if (entity.id == undefined) {
        const document = toMongoDocumentWithNewId(entity);
        operation = toInsertOneOperation(document);

        documents.push(document);
      }
      else {
        const document = toMongoDocument(entity as U);
        operation = toReplaceOneOperation(document, upsert);

        documents.push(document);
      }

      operations.push(operation);
    }

    await this.collection.bulkWrite(operations);

    const savedEntities = documents.map(toEntity);
    return savedEntities;
  }

  async update<U extends T>(filter: FilterQuery<U>, update: Partial<MongoDocument<U>> | UpdateQuery<U>, upsert: boolean = false): Promise<UpdateResult> {
    const { matchedCount, modifiedCount, upsertedCount } = await this.collection.updateOne(filter, update, { upsert });

    const updateResult: UpdateResult = {
      matchedCount,
      modifiedCount,
      upsertedCount
    };

    return updateResult;
  }

  async updateMany<U extends T>(filter: FilterQuery<U>, update: Partial<MongoDocument<U>> | UpdateQuery<U>, upsert: boolean = false): Promise<UpdateResult> {
    const { matchedCount, modifiedCount, upsertedCount } = await this.collection.updateMany(filter, update, { upsert });

    const updateResult: UpdateResult = {
      matchedCount,
      modifiedCount,
      upsertedCount
    };

    return updateResult;
  }

  async load<U extends T = T>(id: string, throwIfNotFound?: true): Promise<U>;
  async load<U extends T = T>(id: string, throwIfNotFound: boolean): Promise<U | undefined>;
  async load<U extends T = T>(id: string, throwIfNotFound: boolean = true): Promise<U | undefined> {
    const filter: FilterQuery<U> = {
      _id: id
    } as FilterQuery<U>;

    return this.loadByFilter(filter, throwIfNotFound);
  }

  async tryLoadAndUpdate<U extends T = T>(id: string, update: UpdateQuery<U>): Promise<U | undefined> {
    const filter: FilterQuery<U> = {
      _id: id
    } as FilterQuery<U>;

    return this.tryLoadByFilterAndUpdate(filter, update);
  }

  async loadAndUpdate<U extends T = T>(id: string, update: UpdateQuery<U>): Promise<U> {
    const entity = await this.tryLoadAndUpdate(id, update);

    if (entity == undefined) {
      throw new NotFoundError('document not found');
    }

    return entity;
  }

  async loadByFilter<U extends T = T>(filter: FilterQuery<U>, throwIfNotFound?: true): Promise<U>;
  async loadByFilter<U extends T = T>(filter: FilterQuery<U>, throwIfNotFound: boolean): Promise<U | undefined>;
  async loadByFilter<U extends T = T>(filter: FilterQuery<U>, throwIfNotFound: boolean = true): Promise<U | undefined> {
    const document = await this.collection.findOne<MongoDocument<U>>(filter);

    if (document == undefined) {
      if (throwIfNotFound) {
        throw new Error('document not found');
      }

      return undefined;
    }

    const entity = toEntity(document);
    return entity;
  }

  async tryLoadByFilterAndUpdate<U extends T = T>(filter: FilterQuery<U>, update: UpdateQuery<U>, options?: LoadAndUpdateOptions<U>): Promise<U | undefined> {
    const { value: document } = await this.collection.findOneAndUpdate(filter, update, options) as FindAndModifyWriteOpResultObject<MongoDocument<U>>;

    if (document == undefined) {
      return undefined;
    }

    return toEntity(document);
  }

  async loadByFilterAndUpdate<U extends T = T>(filter: FilterQuery<U>, update: UpdateQuery<U>, options?: LoadAndUpdateOptions<U>): Promise<U> {
    const entity = await this.tryLoadByFilterAndUpdate(filter, update, options);

    if (entity == undefined) {
      throw new NotFoundError('document not found');
    }

    return entity;
  }

  async loadManyById<U extends T = T>(ids: string[]): Promise<U[]> {
    const iterator = this.loadManyByIdWithCursor<U>(ids);
    return AsyncEnumerable.from(iterator).toArray();
  }

  async loadManyByFilter<U extends T = T>(filter: FilterQuery<U>, options?: LoadManyOptions<U>): Promise<U[]> {
    const iterator = this.loadManyByFilterWithCursor<U>(filter, options);
    return AsyncEnumerable.from(iterator).toArray();
  }

  async *loadManyByIdWithCursor<U extends T = T>(ids: string[]): AsyncIterableIterator<U> {
    const filter: FilterQuery<U> = {
      _id: { $in: ids }
    } as FilterQuery<U>;

    yield* this.loadManyByFilterWithCursor(filter);
  }

  async *loadManyByFilterWithCursor<U extends T = T>(filter: FilterQuery<U>, options?: LoadManyOptions<U>): AsyncIterableIterator<U> {
    const cursor = this.collection.find<MongoDocument<U>>(filter, options);

    for await (const document of (cursor as AsyncIterable<MongoDocument<U>>)) {
      const entity = toEntity(document);
      yield entity;
    }
  }

  async delete<U extends T = T>(entity: U): Promise<boolean> {
    return this.deleteById(entity.id);
  }

  async deleteById(id: string): Promise<boolean> {
    const filter: FilterQuery<T> = {
      _id: id
    } as FilterQuery<T>;

    return this.deleteByFilter(filter);
  }

  async deleteMany<U extends T = T>(entities: U[]): Promise<number> {
    const ids = entities.map((entity) => entity.id);
    return this.deleteManyById(ids);
  }

  deleteManyById(ids: string[]): Promise<number> {
    const filter: FilterQuery<T> = {
      _id: { $in: ids }
    } as FilterQuery<T>;

    return this.deleteManyByFilter(filter);
  }

  async deleteByFilter<U extends T = T>(filter: FilterQuery<U>): Promise<boolean> {
    const { deletedCount } = await this.collection.deleteOne(filter);
    return deletedCount == 1;
  }

  async deleteManyByFilter<U extends T = T>(filter: FilterQuery<U>): Promise<number> {
    const { deletedCount } = await this.collection.deleteMany(filter);
    return deletedCount as number;
  }

  async countByFilter<U extends T = T>(filter: FilterQuery<U>): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  async hasByFilter<U extends T = T>(filter: FilterQuery<U>): Promise<boolean> {
    const count = await this.countByFilter(filter);
    return count > 0;
  }

  async has(id: string): Promise<boolean> {
    const filter: FilterQuery<T> = { _id: id } as FilterQuery<T>;
    return this.hasByFilter(filter);
  }

  async hasMany(ids: string[]): Promise<string[]> {
    const filter: FilterQuery<T> = {
      _id: { $in: ids }
    } as FilterQuery<T>;

    const result = await this.collection.distinct('_id', filter) as string[];
    return result;
  }

  async drop(): Promise<void> {
    await this.collection.drop();
  }
}

// tslint:disable-next-line: typedef
function toInsertOneOperation<T extends Entity>(document: MongoDocument<T>) {
  const operation = {
    insertOne: {
      document
    }
  };

  return operation;
}

// tslint:disable-next-line: typedef
function toReplaceOneOperation<T extends Entity>(document: MongoDocument<T>, upsert: boolean) {
  const filter: FilterQuery<T> = {
    _id: document._id
  } as FilterQuery<T>;

  const operation = {
    replaceOne: {
      filter,
      replacement: document,
      upsert
    }
  };

  return operation;
}
