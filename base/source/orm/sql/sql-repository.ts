import { NotImplementedError } from '#/error/not-implemented.error.js';
import type { EntityDefinition } from '../types/index.js';

export class SqlRepository {
  private readonly definition: EntityDefinition;

  constructor(definition: EntityDefinition) {
    this.definition = definition;
  }

  async initialize(): Promise<void> {
    throw new NotImplementedError();
  }
}
