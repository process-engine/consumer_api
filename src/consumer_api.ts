import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {
  ConsumerContext,
  EventList,
  EventTriggerPayload,
  IConsumerApiService,
  ICorrelationResult,
  ProcessModel,
  ProcessModelList,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
  UserTaskList,
  UserTaskResult,
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
  public async getProcessModels(context: ConsumerContext): Promise<ProcessModelList> {
    return this.processEngineAdapter.getProcessModels(context);
  }

  public async getProcessModelByKey(context: ConsumerContext, processModelKey: string): Promise<ProcessModel> {
    return this.processEngineAdapter.getProcessModelByKey(context, processModelKey);
  }

  public async startProcessInstance(context: ConsumerContext,
                                    processModelKey: string,
                                    startEventKey: string,
                                    payload: ProcessStartRequestPayload,
                                    startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated,
                                  ): Promise<ProcessStartResponsePayload> {

    if (!Object.values(StartCallbackType).includes(startCallbackType)) {
      throw new EssentialProjectErrors.BadRequestError(`${startCallbackType} is not a valid return option!`);
    }

    return this.processEngineAdapter.startProcessInstance(context, processModelKey, startEventKey, payload, startCallbackType);
  }

  public async startProcessInstanceAndAwaitEndEvent(context: ConsumerContext,
                                                    processModelKey: string,
                                                    startEventKey: string,
                                                    endEventKey: string,
                                                    payload: ProcessStartRequestPayload,
                                                  ): Promise<ProcessStartResponsePayload> {

    return this.processEngineAdapter.startProcessInstanceAndAwaitEndEvent(context, processModelKey, startEventKey, endEventKey, payload);
  }

  public async getCorrelationResults(context: ConsumerContext, correlationId: string): Promise<ICorrelationResult> {
    return this.processEngineAdapter.getCorrelationResults(context, correlationId);
  }

  // Events
  public async getEventsForProcessModel(context: ConsumerContext, processModelKey: string): Promise<EventList> {
    return this.processEngineAdapter.getEventsForProcessModel(context, processModelKey);
  }

  public async getEventsForCorrelation(context: ConsumerContext, correlationId: string): Promise<EventList> {
    return this.processEngineAdapter.getEventsForCorrelation(context, correlationId);
  }

  public async getEventsForProcessModelInCorrelation(context: ConsumerContext, processModelKey: string, correlationId: string): Promise<EventList> {
    return this.processEngineAdapter.getEventsForProcessModelInCorrelation(context, processModelKey, correlationId);
  }

  public async triggerEvent(context: ConsumerContext,
                            processModelKey: string,
                            correlationId: string,
                            eventId: string,
                            eventTriggerPayload?: EventTriggerPayload): Promise<void> {

    return this.processEngineAdapter.triggerEvent(context, processModelKey, correlationId, eventId, eventTriggerPayload);
  }

  // UserTasks
  public async getUserTasksForProcessModel(context: ConsumerContext, processModelKey: string): Promise<UserTaskList> {
    return this.processEngineAdapter.getUserTasksForProcessModel(context, processModelKey);
  }

  public async getUserTasksForCorrelation(context: ConsumerContext, correlationId: string): Promise<UserTaskList> {
    return this.processEngineAdapter.getUserTasksForCorrelation(context, correlationId);
  }

  public async getUserTasksForProcessModelInCorrelation(context: ConsumerContext,
                                                        processModelKey: string,
                                                        correlationId: string): Promise<UserTaskList> {

    return this.processEngineAdapter.getUserTasksForProcessModelInCorrelation(context, processModelKey, correlationId);
  }

  public async finishUserTask(context: ConsumerContext,
                              processModelKey: string,
                              correlationId: string,
                              userTaskId: string,
                              userTaskResult: UserTaskResult): Promise<void> {

    return this.processEngineAdapter.finishUserTask(context, processModelKey, correlationId, userTaskId, userTaskResult);
  }
}
