import { singleton } from '#/container';
import type { KeyValueStore, KeyValueStoreProvider } from '#/key-value-store';
import type { StringMap } from '#/types';
import { MongoKeyValueRepository } from './mongo-key-value.repository';
import { MongoKeyValueStore } from './mongo-key-value.store';

@singleton()
export class MongoKeyValueStoreProvider implements KeyValueStoreProvider {
  private readonly keyValueRepository: MongoKeyValueRepository;

  constructor(keyValueRepository: MongoKeyValueRepository) {
    this.keyValueRepository = keyValueRepository;
  }

  get<KV extends StringMap>(module: string): KeyValueStore<KV> {
    return new MongoKeyValueStore(this.keyValueRepository, module);
  }
}
