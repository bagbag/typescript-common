import { millisecondsPerSecond } from '#/utils/units.js';
import type { ClientSession } from 'mongodb';
import type { IsolationLevel } from '../transaction.js';
import { Transaction } from '../transaction.js';

export class MongoTransaction extends Transaction {
  readonly session: ClientSession;

  constructor(session: ClientSession, isolationLevel: IsolationLevel) {
    super(isolationLevel);

    this.session = session;
  }

  protected _commit(): void {
    this.session.startTransaction({
      readConcern: 'snapshot',
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
      maxCommitTimeMS: 30 * millisecondsPerSecond
    });
  }

  protected async _rollback(): Promise<void> {
    await this.session.abortTransaction();
  }

  protected async _release(): Promise<void> {
    await this.session.endSession();
  }
}
