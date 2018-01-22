import {
  IConsumerApiService,
  IEventList,
  IEventTriggerPayload,
  IProcessModel,
  IProcessModelList,
  IUserTaskList,
  IUserTaskResult,
} from '@process-engine/consumer_api_contracts';

export class ConsumerApiService implements IConsumerApiService {
  public config: any = undefined;

  public getProcessModels(): Promise<IProcessModelList> {
     // TODO: Implement this mock
    return Promise.resolve({
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      process_models: [],
    });
  }

  public getProcessModelByKey(processModelKey: string): Promise<IProcessModel> {
    return Promise.resolve(); // TODO: Implement this mock
  }

  public startProcess(processModelKey: string, startEventKey: string): Promise<void> {
    return Promise.resolve(); // TODO: Implement this mock
  }

  public getEventsByProcessModel(processModelKey: string): Promise<IEventList> {
     // TODO: Implement this mock
     return Promise.resolve({
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      events: [],
    });
  }

  public getEventsByCorrelation(correlationId: string): Promise<IEventList> {
     // TODO: Implement this mock
     return Promise.resolve({
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      events: [],
    });
  }

  public getEventsByProcessModelAndCorrelation(processModelKey: string, correlationId: string): Promise<IEventList> {
     // TODO: Implement this mock
     return Promise.resolve({
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      events: [],
    });
  }

  public triggerEvent(processModelKey: string, correlationId: string, eventId: string, eventTriggerPayload?: IEventTriggerPayload): Promise<void> {
    return Promise.resolve(); // TODO: Implement this mock
  }

  public getUserTasksByProcessModel(processModelKey: string): Promise<IUserTaskList> {
     // TODO: Implement this mock
     return Promise.resolve({
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      user_tasks: [],
    });
  }

  public getUserTasksByCorrelation(correlationId: string): Promise<IUserTaskList> {
     // TODO: Implement this mock
     return Promise.resolve({
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      user_tasks: [],
    });
  }

  public getUserTasksByProcessModelAndCorrelation(processModelKey: string, correlationId: string): Promise<IUserTaskList> {
     // TODO: Implement this mock
     return Promise.resolve({
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      user_tasks: [],
    });
  }

  public finishUserTask(processModelKey: string, correlationId: string, userTaskId: string, userTaskResult: IUserTaskResult): Promise<void> {
    return Promise.resolve(); // TODO: Implement this mock
  }
}
