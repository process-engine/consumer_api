import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {
  IConsumerApiService,
  IConsumerContext,
  IEventList,
  IEventTriggerPayload,
  IProcessModel,
  IProcessModelList,
  IProcessStartRequestPayload,
  IProcessStartResponsePayload,
  IUserTaskList,
  IUserTaskResult,
  ProcessStartReturnOnOptions,
} from '@process-engine/consumer_api_contracts';

export class ConsumerApiService implements IConsumerApiService {
  public config: any = undefined;

  private _processEngineAdapter: IConsumerApiService;

  constructor(processEngineAdapter: IConsumerApiService) {

    this._processEngineAdapter = processEngineAdapter;
  }

  private get processEngineAdapter(): IConsumerApiService {
    return this._processEngineAdapter;
  }

  // Process models
  public async getProcessModels(context: IConsumerContext): Promise<IProcessModelList> {
    return this.processEngineAdapter.getProcessModels(context);
  }

  public async getProcessModelByKey(context: IConsumerContext, processModelKey: string): Promise<IProcessModel> {
    return this.processEngineAdapter.getProcessModelByKey(context, processModelKey);
  }

  public async startProcess(context: IConsumerContext,
                            processModelKey: string,
                            startEventKey: string,
                            payload: IProcessStartRequestPayload,
                            returnOn: ProcessStartReturnOnOptions = ProcessStartReturnOnOptions.onProcessInstanceStarted,
                          ): Promise<IProcessStartResponsePayload> {

    if (!Object.values(ProcessStartReturnOnOptions).includes(returnOn)) {
      throw new EssentialProjectErrors.BadRequestError(`${returnOn} is not a valid return option!`);
    }

    return this.processEngineAdapter.startProcess(context, processModelKey, startEventKey, payload, returnOn);
  }

  public async startProcessAndAwaitEndEvent(context: IConsumerContext,
                                            processModelKey: string,
                                            startEventKey: string,
                                            endEventKey: string,
                                            payload: IProcessStartRequestPayload): Promise<IProcessStartResponsePayload> {

    return this.processEngineAdapter.startProcessAndAwaitEndEvent(context, processModelKey, startEventKey, endEventKey, payload);
  }

  // Events
  public async getEventsForProcessModel(context: IConsumerContext, processModelKey: string): Promise<IEventList> {
    return this.processEngineAdapter.getEventsForProcessModel(context, processModelKey);
  }

  public async getEventsForCorrelation(context: IConsumerContext, correlationId: string): Promise<IEventList> {
    return this.processEngineAdapter.getEventsForCorrelation(context, correlationId);
  }

  public async getEventsForProcessModelInCorrelation(context: IConsumerContext, processModelKey: string, correlationId: string): Promise<IEventList> {
    return this.processEngineAdapter.getEventsForProcessModelInCorrelation(context, processModelKey, correlationId);
  }

  public async triggerEvent(context: IConsumerContext,
                            processModelKey: string,
                            correlationId: string,
                            eventId: string,
                            eventTriggerPayload?: IEventTriggerPayload): Promise<void> {

    return this.processEngineAdapter.triggerEvent(context, processModelKey, correlationId, eventId, eventTriggerPayload);
  }

  // UserTasks
  public async getUserTasksForProcessModel(context: IConsumerContext, processModelKey: string): Promise<IUserTaskList> {
    return this.processEngineAdapter.getUserTasksForProcessModel(context, processModelKey);
  }

  public async getUserTasksForCorrelation(context: IConsumerContext, correlationId: string): Promise<IUserTaskList> {
    return this.processEngineAdapter.getUserTasksForCorrelation(context, correlationId);
  }

  public async getUserTasksForProcessModelInCorrelation(context: IConsumerContext,
                                                        processModelKey: string,
                                                        correlationId: string): Promise<IUserTaskList> {

    return this.processEngineAdapter.getUserTasksForProcessModelInCorrelation(context, processModelKey, correlationId);
  }

  public async finishUserTask(context: IConsumerContext,
                              processModelKey: string,
                              correlationId: string,
                              userTaskId: string,
                              userTaskResult: IUserTaskResult): Promise<void> {

    return this.processEngineAdapter.finishUserTask(context, processModelKey, correlationId, userTaskId, userTaskResult);
  }
}
