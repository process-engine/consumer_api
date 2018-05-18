import {ICorrelation, ICorrelationItem, ICorrelationStore} from '@process-engine/consumer_api_contracts';

export class CorrelationStore implements ICorrelationStore {

  private _correlationStore: ICorrelation = {};

  public addProcessInstanceToCorrelation(correlationId: string, processInstanceId: string, processModelKey?: string): void {

    if (!this._correlationStore[correlationId]) {
      this._correlationStore[correlationId] = [];
    }

    const newCorrelationItem: ICorrelationItem = {
      processInstanceId: processInstanceId,
      processModelKey: processModelKey,
    };

    this._correlationStore[correlationId].push(newCorrelationItem);
  }

  public getProcessInstancesInCorrelation(correlationId: string): Array<ICorrelationItem> {

    return this._correlationStore[correlationId];
  }
}
