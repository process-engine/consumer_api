import {ICorrelation, ICorrelationStore} from '@process-engine/consumer_api_contracts';

export class CorrelationStore implements ICorrelationStore {

  private _correlationStore: Array<ICorrelation>;

  public addProcessInstanceToCorrelation(correlationId: string, processInstanceId: string): void {
    return;
  }

  public getProcessInstancesInCorrelation(correlationId: string): Array<string> {
    return [];
  }
}
