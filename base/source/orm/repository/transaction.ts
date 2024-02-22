import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';

export enum IsolationLevel {
  ReadUncommitted = 0,
  ReadCommitted = 1,
  RepeatableRead = 2,
  Serializable = 3
}

export abstract class Transaction {
  private readonly afterCommitSubject: Subject<void>;

  protected useCounter: number;
  protected done: boolean;

  readonly isolationLevel: IsolationLevel;

  manualCommit: boolean;

  readonly afterCommit$: Observable<void>;

  constructor(isolationLevel: IsolationLevel) {
    this.isolationLevel = isolationLevel;
    this.useCounter = 0;
    this.done = false;
    this.manualCommit = false;

    this.afterCommitSubject = new Subject();
    this.afterCommit$ = this.afterCommitSubject.asObservable();
  }

  withManualCommit(): void {
    this.manualCommit = true;
  }

  /**
   * Enters automatic transaction handling. Transaction will be commited when all use-calls are done or rolled back when one throws.
   */
  async use<T>(handler: () => Promise<T>): Promise<T> {
    this.useCounter++;

    try {
      const result = await handler();
      return result;
    }
    catch (error) {
      if (!this.done) {
        await this.rollback();
      }

      throw error;
    }
    finally {
      this.useCounter--;

      if ((this.useCounter == 0) && !this.done && !this.manualCommit) {
        await this.commit();
      }
    }
  }

  async commit(): Promise<void> {
    this.done = true;

    await this._commit();
    await this._release();

    this.afterCommitSubject.next();
  }

  async rollback(): Promise<void> {
    this.done = true;

    await this._rollback();
    await this._release();
  }

  protected abstract _commit(): void | Promise<void>;
  protected abstract _rollback(): void | Promise<void>;
  protected abstract _release(): void | Promise<void>;
}
