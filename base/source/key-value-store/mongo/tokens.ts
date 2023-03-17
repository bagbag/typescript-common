import { injectionToken } from '#/container/token.js';
import type { MongoRepositoryConfig } from '#/database/mongo/types.js';
import type { MongoKeyValue } from './mongo-key-value.model.js';

export const DEFAULT_KEY_VALUE_REPOSITORY_CONFIG = injectionToken<MongoRepositoryConfig<MongoKeyValue>>('DEFAULT_KEY_VALUE_REPOSITORY_CONFIG');
