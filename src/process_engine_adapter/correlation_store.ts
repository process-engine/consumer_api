import {ICorrelation, ICorrelationStore} from '@process-engine/consumer_api_contracts';

export class CorrelationStore implements ICorrelationStore {

  private _correlationStore: Array<ICorrelation> = [];

  public addProcessInstanceToCorrelation(correlationId: string, processInstanceId: string, processModelKey?: string): void {

    const newCorrelationItem: ICorrelation = {
      id: correlationId,
      processInstanceId: processInstanceId,
      processModelKey: processModelKey,
    };

    this._correlationStore.push(newCorrelationItem);
  }

  public getProcessInstancesInCorrelation(correlationId: string): Array<ICorrelation> {

    const matchingCorrelations: Array<ICorrelation> = this._correlationStore.filter((correlation: ICorrelation) => {
      return correlation.id === correlationId;
    });

    return matchingCorrelations;
  }
}
