import { HttpApi } from './api/http-api';
import type { InjectionToken } from './container';
import { container } from './container';
import { AsyncDisposer, disposeAsync } from './disposable';
import { DistributedLoopProvider } from './distributed-loop';
import { HttpClient } from './http';
import { ImageService } from './image-service';
import type { KeyValueStore, KeyValueStoreProvider } from './key-value';
import type { LockProvider } from './lock';
import type { LoggerArgument } from './logger';
import { Logger, LogLevel } from './logger';
import { ConsoleLogger } from './logger/console';
import { MessageBusProvider } from './message-bus';
import { LocalMessageBusProvider } from './message-bus/local';
import type { MigrationStateRepository } from './migration';
import { Migrator } from './migration';
import { WebServerModule } from './module/modules';
import { ObjectStorage, ObjectStorageProvider } from './object-storage';
import type { OidcStateRepository } from './openid-connect';
import { CachedOidcConfigurationService, OidcService } from './openid-connect';
import type { StringMap, Type } from './types';
import { deferThrow } from './utils/helpers';
import { singleton } from './utils/singleton';
import { timeout } from './utils/timing';
import { millisecondsPerMinute } from './utils/units';

const singletonScope = Symbol('singletons');
const coreLoggerToken = Symbol('core-logger');
const lockProviderToken = Symbol('lock-provider');
const keyValueStoreProviderToken = Symbol('key-value-store-provider');
const keyValueStoreSingletonScopeToken = Symbol('key-value-stores');

let coreLogPrefix = 'CORE';
let logLevel = LogLevel.Debug;
let loggerToken: InjectionToken<Logger, LoggerArgument> = ConsoleLogger;

let lockProviderProvider: () => LockProvider | Promise<LockProvider> = deferThrow(new Error('LockProvider not configured'));
let keyValueStoreProviderProvider: () => KeyValueStoreProvider | Promise<KeyValueStoreProvider> = deferThrow(new Error('KeyValueStoreProvider not configured'));
let imageServiceProvider: () => ImageService | Promise<ImageService> = deferThrow(new Error('ImageService not configured'));
let messageBusProvider: () => MessageBusProvider | Promise<MessageBusProvider> = deferThrow(new Error('MessageBusProvider not configured'));

let migrationLogPrefix = 'MIGRATION';
let supressErrorLog: Type<Error>[] = [];
let migrationStateRepositoryProvider: () => MigrationStateRepository | Promise<MigrationStateRepository> = deferThrow(new Error('MigrationStateRepository not configured'));
let oidcStateRepositoryProvider: () => OidcStateRepository | Promise<OidcStateRepository> = deferThrow(new Error('OidcStateRepository not configured'));

let httpApiUrlPrefix = '';
let httpApiBehindProxy = true;
let httpApiLogPrefix = 'HTTP';

let webServerPort = 8080;
let webServerLogPrefix = 'WEBSERVER';

export const disposer: AsyncDisposer = new AsyncDisposer();

export function configureBaseInstanceProvider(
  options: {
    coreLoggerPrefix?: string,
    logLevel?: LogLevel,
    loggerToken?: typeof loggerToken,
    lockProviderProvider?: () => LockProvider | Promise<LockProvider>,
    keyValueStoreProviderProvider?: () => KeyValueStoreProvider | Promise<KeyValueStoreProvider>,
    objectStorageProviderProvider?: () => ObjectStorageProvider | Promise<ObjectStorageProvider>,
    imageServiceProvider?: () => ImageService | Promise<ImageService>,
    messageBusProvider?: () => MessageBusProvider | Promise<MessageBusProvider>,
    webServerPort?: number,
    httpApiUrlPrefix?: string,
    httpApiBehindProxy?: boolean,
    httpApiLogPrefix?: string,
    webServerLogPrefix?: string,
    migrationLogPrefix?: string,
    supressErrorLog?: Type<Error>[],
    migrationStateRepositoryProvider?: () => MigrationStateRepository | Promise<MigrationStateRepository>,
    oidcStateRepositoryProvider?: () => OidcStateRepository | Promise<OidcStateRepository>
  }
): void {
  coreLogPrefix = options.coreLoggerPrefix ?? coreLogPrefix;
  logLevel = options.logLevel ?? logLevel;
  loggerToken = options.loggerToken ?? loggerToken;
  lockProviderProvider = options.lockProviderProvider ?? lockProviderProvider;
  keyValueStoreProviderProvider = options.keyValueStoreProviderProvider ?? keyValueStoreProviderProvider;
  imageServiceProvider = options.imageServiceProvider ?? imageServiceProvider;
  messageBusProvider = options.messageBusProvider ?? messageBusProvider;
  webServerPort = options.webServerPort ?? webServerPort;
  httpApiUrlPrefix = options.httpApiUrlPrefix ?? httpApiUrlPrefix;
  httpApiBehindProxy = options.httpApiBehindProxy ?? httpApiBehindProxy;
  httpApiLogPrefix = options.httpApiLogPrefix ?? httpApiLogPrefix;
  webServerLogPrefix = options.webServerLogPrefix ?? webServerLogPrefix;
  migrationLogPrefix = options.migrationLogPrefix ?? migrationLogPrefix;
  supressErrorLog = options.supressErrorLog ?? supressErrorLog;
  migrationStateRepositoryProvider = options.migrationStateRepositoryProvider ?? migrationStateRepositoryProvider;
  oidcStateRepositoryProvider = options.oidcStateRepositoryProvider ?? oidcStateRepositoryProvider;
}

export async function disposeInstances(): Promise<void> {
  getCoreLogger().debug('dispose instances');
  await disposer[disposeAsync]();
}

function getLoggerInstance(): Logger {
  return container.resolve(Logger);
}

export function getLogger(module: string): Logger {
  const logger = getLoggerInstance().fork(module);
  return logger;
}

export function getCoreLogger(): Logger {
  return singleton(singletonScope, coreLoggerToken, () => {
    const logger = getLogger(coreLogPrefix);
    return logger;
  });
}

export function getLocalMessageBusProvider(): LocalMessageBusProvider {
  const logger = getLogger('MESSAGE-BUS');
  return new LocalMessageBusProvider(logger);
}

export async function getLockProvider(): Promise<LockProvider> {
  return singleton(singletonScope, lockProviderToken, lockProviderProvider);
}

export async function getKeyValueStoreProvider(): Promise<KeyValueStoreProvider> {
  return singleton(singletonScope, keyValueStoreProviderToken, keyValueStoreProviderProvider);
}

export async function getKeyValueStore<KV extends StringMap>(scope: string): Promise<KeyValueStore<KV>> {
  return singleton(keyValueStoreSingletonScopeToken, scope, async () => {
    const provider = await getKeyValueStoreProvider();
    return provider.get(scope);
  });
}

export async function getMigrator(): Promise<Migrator> {
  return singleton(singletonScope, Migrator, async () => {
    const migrationStateRepository = await migrationStateRepositoryProvider();
    const lockProvider = await getLockProvider();
    const logger = getLogger(migrationLogPrefix);

    return new Migrator(migrationStateRepository, lockProvider, logger);
  });
}

export async function getObjectStorageProvider(): Promise<ObjectStorageProvider> {
  return container.resolveAsync(ObjectStorageProvider);
}

export async function getObjectStorage(module: string): Promise<ObjectStorage> {
  return container.resolveAsync(ObjectStorage, module);
}

export async function getImageService(): Promise<ImageService> {
  return singleton(singletonScope, ImageService, imageServiceProvider);
}

export async function getMessageBusProvider(): Promise<MessageBusProvider> {
  return singleton(singletonScope, MessageBusProvider, messageBusProvider);
}

export async function getDistributedLoopProvider(): Promise<DistributedLoopProvider> {
  return singleton(singletonScope, DistributedLoopProvider, async () => {
    const lockProvider = await getLockProvider();
    return new DistributedLoopProvider(lockProvider);
  });
}

export function getHttpApi(): HttpApi {
  return singleton(singletonScope, HttpApi, () => {
    const logger = getLogger(httpApiLogPrefix);
    const httpApi = new HttpApi({ logger, behindProxy: httpApiBehindProxy });

    httpApi.supressErrorLog(...supressErrorLog);

    return httpApi;
  });
}

export async function getOidcService(): Promise<OidcService> {
  return singleton(singletonScope, OidcService, async () => {
    const oidcStateRepository = await oidcStateRepositoryProvider();
    const cachedOidcConfigurationService = new CachedOidcConfigurationService(HttpClient.instance, 5 * millisecondsPerMinute);

    return new OidcService(cachedOidcConfigurationService, oidcStateRepository);
  });
}

export function getWebServerModule(): WebServerModule {
  return singleton(singletonScope, WebServerModule, () => {
    const httpApi = getHttpApi();
    const logger = getLogger(webServerLogPrefix);

    return new WebServerModule(httpApi, webServerPort, logger);
  });
}

export async function connect(name: string, connectFunction: (() => Promise<any>), logger: Logger, maxTries: number = 3): Promise<void> {
  let triesLeft = maxTries;
  let success = false;

  while (!success && !disposer.disposing && triesLeft-- > 0) {
    try {
      logger.verbose(`connecting to ${name}...`);

      await connectFunction();
      success = true;

      logger.info(`connected to ${name}`);
    }
    catch (error: unknown) {
      logger.verbose(`error connecting to ${name} (${(error as Error).message})${triesLeft > 0 ? ', trying again...' : ''}`);

      if (triesLeft == 0) {
        throw new Error(`failed to connect to ${name} - no tries left`);
      }

      await timeout(2000);
    }
  }
}

container.register<LogLevel, LogLevel>(
  LogLevel,
  { useFactory: (level) => level ?? LogLevel.Trace },
  { defaultArgumentProvider: () => logLevel }
);

container.register(Logger, { useTokenProvider: () => loggerToken });
