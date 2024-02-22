import { container } from '#/container/container.js';
import { connect, disposer } from '#/core.js';
import { Logger } from '#/logger/logger.js';
import { filterObject } from '#/utils/object/object.js';
import { assertDefined, isDefined, isObject, isString, isUndefined } from '#/utils/type-guards.js';
import type { CollectionArgument, DatabaseArgument, MongoClientArgument, MongoConnection } from './classes.js';
import { Collection, Database, MongoClient } from './classes.js';

export type MongoOrmModuleConfig = {
  defaultConnection: MongoConnection,
  defaultDatabase: string | undefined,
  logPrefix: string
};

export const mongoOrmModuleConfig: MongoOrmModuleConfig = {
  defaultConnection: { url: 'mongodb://localhost:27017/test-db' },
  defaultDatabase: undefined,
  logPrefix: 'MONGO'
};

export function configureMongoOrm(config: Partial<MongoOrmModuleConfig>): void {
  mongoOrmModuleConfig.defaultDatabase = config.defaultDatabase ?? mongoOrmModuleConfig.defaultDatabase;
  mongoOrmModuleConfig.defaultConnection = config.defaultConnection ?? mongoOrmModuleConfig.defaultConnection;
  mongoOrmModuleConfig.logPrefix = config.logPrefix ?? mongoOrmModuleConfig.logPrefix;
}

container.registerSingleton(MongoClient, {
  useFactory: async (argument, context) => {
    assertDefined(argument, 'mongo connection resolve argument missing');

    const { url, ...options } = argument;

    const logger = context.resolve(Logger, mongoOrmModuleConfig.logPrefix);
    const client = new MongoClient(url, options);

    client
      .on('fullsetup', () => logger.verbose('connection setup'))
      .on('reconnect', () => logger.warn('reconnected'))
      .on('timeout', () => logger.warn('connection timed out'))
      .on('close', () => logger.verbose('connection closed'));

    disposer.add(async () => client.close(), 10000);

    await connect(`mongo at ${url}`, async () => client.connect(), logger);

    return client;
  }
}, {
  defaultArgumentProvider: (): MongoClientArgument => mongoOrmModuleConfig.defaultConnection,
  argumentIdentityProvider: (argument) => {
    if (isUndefined(argument)) {
      return undefined;
    }

    const configObject: MongoClientArgument = isString(argument) ? { url: argument } : argument;
    return JSON.stringify(filterObject(configObject, isDefined));
  }
});

container.registerSingleton(Database, {
  useFactory: async (argument, context) => {
    const connection = isObject(argument) ? argument.connection : mongoOrmModuleConfig.defaultConnection;
    const name = (isString(argument) ? argument : isObject(argument) ? argument.database : undefined) ?? mongoOrmModuleConfig.defaultDatabase;

    const client = await context.resolveAsync(MongoClient, connection);
    return client.db(name) as Database;
  }
}, {
  defaultArgumentProvider: (): DatabaseArgument => ({ database: mongoOrmModuleConfig.defaultDatabase, connection: mongoOrmModuleConfig.defaultConnection }),
  argumentIdentityProvider: (argument) => {
    if (isUndefined(argument)) {
      return undefined;
    }

    const configObject: DatabaseArgument = isString(argument) ? { database: argument } : argument;
    return JSON.stringify(filterObject(configObject, isDefined));
  }
});

container.registerSingleton(Collection, {
  useFactory: async (config, context) => {
    assertDefined(config, 'Mongo repository config resolve argument missing.');
    const configCollectionName = isString(config) ? config : config.collection;

    const database = await context.resolveAsync(Database, isString(config) ? undefined : config);
    const existingCollections = await database.collections();

    for (const collection of existingCollections) {
      if (collection.collectionName == configCollectionName) {
        return collection as unknown as typeof Collection;
      }
    }

    return database.createCollection(configCollectionName) as Promise<any>;
  }
}, {
  argumentIdentityProvider: (argument) => {
    if (isUndefined(argument)) {
      return undefined;
    }

    const configObject: CollectionArgument = isString(argument) ? { collection: argument } : argument;
    return JSON.stringify(filterObject(configObject, isDefined));
  }
});
