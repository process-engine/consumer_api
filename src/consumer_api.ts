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
import {IExecuteProcessService} from '@process-engine/process_engine_contracts';

export class ConsumerApiService implements IConsumerApiService {
  public config: any = undefined;

  private _executeProcessService: IExecuteProcessService;
  private _processModelFacadeFactory: IProcessModelFacadeFactory;

  constructor(executeProcessService: IExecuteProcessService, processModelFacadeFactory: IProcessModelFacadeFactory) {

    this._executeProcessService = executeProcessService;
  }

  private get executeProcessService(): IExecuteProcessService {
    return this._executeProcessService;
  }

  private get processModelFacadeFactory(): IProcessModelFacadeFactory {
    return this._processModelFacadeFactory;
  }

  // Process models
  public async getProcessModels(context: ConsumerContext): Promise<ProcessModelList> {
    return this.processEngineAdapter.getProcessModels(context);
  }

  public async getProcessModelByKey(context: ConsumerContext, processModelKey: string): Promise<ProcessModel> {
    return this.processEngineAdapter.getProcessModelByKey(context, processModelKey);
  }

  private _createExecutionContextFromConsumerContext(consumerContext: ConsumerContext): Promise<ExecutionContext> {
    return this.processEngineIamService.resolveExecutionContext(consumerContext.identity, TokenType.jwt);
  }

  public async startProcessInstance(context: ConsumerContext,
                                    processModelId: string,
                                    startEventId: string,
                                    payload: ProcessStartRequestPayload,
                                    startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated
                                  ): Promise<ProcessStartResponsePayload> {

    if (!Object.values(StartCallbackType).includes(startCallbackType)) {
      throw new EssentialProjectErrors.BadRequestError(`${startCallbackType} is not a valid return option!`);
    }

    const executionContext: ExecutionContext = await this._createExecutionContextFromConsumerContext(context);
    const correlationId: string = payload.correlation_id || uuid.v4();
    
    if (startCallbackType === StartCallbackType.CallbackOnProcessInstanceCreated) {
      await this._startProcessInstance(executionContext, processModelId, payload);
    } else {
      // TODO: not needed in user task integration test
      // await this._startProcessInstanceAndAwaitEndEvent(executionContext, processInstanceId, startEventId, payload);
    }

    const response: ProcessStartResponsePayload = {
      correlation_id: correlationId,
    };

    return response;
  }

  private async _startProcessInstance(executionContext: ExecutionContext, processModelId: string, correlationId: string, initialToken?: any): Promise<void> {

    const processDefinition: Model.Types.Process = this.processModelPersistance.getProcessModelById(processModelId);

    this.executeProcessService.start(executionContext, processDefinition, correlationId, initialToken);
  }

  public async startProcessInstanceAndAwaitEndEvent(context: ConsumerContext,
                                                    processModelKey: string,
                                                    startEventKey: string,
                                                    endEventKey: string,
                                                    payload: ProcessStartRequestPayload,
                                                  ): Promise<ProcessStartResponsePayload> {

    return this.processEngineAdapter.startProcessInstanceAndAwaitEndEvent(context, processModelKey, startEventKey, endEventKey, payload);
  }

  public async getProcessResultForCorrelation(context: ConsumerContext,
                                              correlationId: string,
                                              processModelKey: string): Promise<ICorrelationResult> {
    return this.processEngineAdapter.getProcessResultForCorrelation(context, correlationId, processModelKey);
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
