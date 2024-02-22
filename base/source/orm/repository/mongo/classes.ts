/* eslint-disable max-classes-per-file */
import type { Injectable } from '#/container';
import { replaceClass, resolveArgumentType } from '#/container';
import type { MongoClientOptions } from 'mongodb';
import { Collection as MongoCollection, Db, MongoClient as MongoMongoClient } from 'mongodb';

export type MongoConnection = {
  url: string
} & MongoClientOptions;

export type MongoClientArgument = MongoConnection;

/** database name */
export type DatabaseArgument = string | { connection?: MongoConnection, database?: string };

export type CollectionArgument = string | (DatabaseArgument & { collection: string });

@replaceClass(MongoMongoClient)
export class MongoClient extends MongoMongoClient implements Injectable<MongoClientArgument> {
  readonly [resolveArgumentType]: MongoClientArgument;
}

@replaceClass(Db)
export class Database extends Db implements Injectable<DatabaseArgument> {
  readonly [resolveArgumentType]: DatabaseArgument;
}

@replaceClass(MongoCollection)
export class Collection extends MongoCollection implements Injectable<CollectionArgument> {
  readonly [resolveArgumentType]: CollectionArgument;
}
