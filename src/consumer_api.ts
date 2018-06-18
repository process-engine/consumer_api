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
import {IExecuteProcessService, IProcessModelPersistance, IFlowNodeInstancePersistance, Model, Runtime} from '@process-engine/process_engine_contracts';
import * as uuid from 'uuid';
import {MessageAction} from './process_engine_adapter/process_engine_adapter_interfaces';

export class ConsumerApiService implements IConsumerApiService {
  public config: any = undefined;

  private _processEngineAdapter: IConsumerApiService;
  private _executeProcessService: IExecuteProcessService;
  private _processModelFacadeFactory: IProcessModelFacadeFactory;
  private _processModelPersistance: IProcessModelPersistance;
  private _flowNodeInstancePersistance: IFlowNodeInstancePersistance;
  private _eventAggregator: IEventAggregator;

  constructor(processEngineAdapter: IConsumerApiService,
              executeProcessService: IExecuteProcessService,
              processModelFacadeFactory: IProcessModelFacadeFactory,
              processModelPersistance: IProcessModelPersistance,
              flowNodeInstancePersistance: IFlowNodeInstancePersistance,
              eventAggregator: IEventAggregator) {
    this._processEngineAdapter = processEngineAdapter;
    this._executeProcessService = executeProcessService;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processModelPersistance = processModelPersistance;
    this._flowNodeInstancePersistance = flowNodeInstancePersistance;
    this._eventAggregator = eventAggregator;
  }

  private get processEngineAdapter(): IConsumerApiService {
    return this._processEngineAdapter;
  }

  private get executeProcessService(): IExecuteProcessService {
    return this._executeProcessService;
  }

  private get processModelFacadeFactory(): IProcessModelFacadeFactory {
    return this._processModelFacadeFactory;
  }

  private get processModelPersistance(): IProcessModelPersistance {
    return this._processModelPersistance;
  }

  private get flowNodeInstancePersistance(): IFlowNodeInstancePersistance {
    return this._flowNodeInstancePersistance;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  // Process models
  public async getProcessModels(context: ConsumerContext): Promise<ProcessModelList> {
    return this.processEngineAdapter.getProcessModels(context);
  }

  public async getProcessModelByKey(context: ConsumerContext, processModelKey: string): Promise<ProcessModel> {
    return this.processEngineAdapter.getProcessModelByKey(context, processModelKey);
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

    const executionContext: ExecutionContext = await this.processEngineAdapter.createExecutionContextFromConsumerContext(context);
    const correlationId: string = payload.correlation_id || uuid.v4();
    
    if (startCallbackType === StartCallbackType.CallbackOnProcessInstanceCreated) {
      await this._startProcessInstance(executionContext, processModelId, correlationId, payload.inputValues);
    } else {
      // TODO: not needed in user task integration test
      // await this._startProcessInstanceAndAwaitEndEvent(executionContext, processInstanceId, startEventId, payload);
    }

    const response: ProcessStartResponsePayload = {
      correlationId: correlationId,
    };

    return response;
  }

  private async _startProcessInstance(executionContext: ExecutionContext, processModelId: string, correlationId: string, initialToken?: any): Promise<void> {

    const processDefinition: Model.Types.Process = await this.processModelPersistance.getProcessModelById(processModelId);

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
    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstancePersistance.querySuspended(correlationId);

    const suspendedUserTaskPromises: Array<Promise<UserTask>> = suspendedFlowNodes.map(async (suspendedUserTask) => {

      const processModel: Model.Types.Process =
        await this.processModelPersistance.getProcessModelById(suspendedUserTask.token.processModelId);

      const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
      const userTask: Model.Activities.UserTask = processModelFacade.getFlowNodeById(suspendedUserTask.flowNodeId);
      
      if (!userTask instanceof Model.Activities.UserTask) {
        return undefined;
      }
      
      const userTaskConfig: UserTaskConfig = {
        formFields: userTask.formFields,
      };

      return {
        key: suspendedUserTask.flowNodeId,
        id: suspendedUserTask.flowNodeId,
        processInstanceId: suspendedUserTask.token.processInstanceId,
        data: userTaskConfig,
        payload: suspendedUserTask.token.payload,
      };
    });

    const suspendedUserTasks: Array<Promise<UserTask>> = (await Promise.all(suspendedUserTaskPromises))
                                                                      .filter((suspendedUserTask) => {
                                                                        return suspendedUserTask !== undefined;
                                                                      });

    const userTaskList: UserTaskList = {
      userTasks: suspendedUserTasks,
    };

    return userTaskList;
  }


  public async getUserTasksForProcessModelInCorrelation(context: ConsumerContext,
                                                        processModelId: string,
                                                        correlationId: string): Promise<UserTaskList> {

    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstancePersistance.querySuspended(correlationId);

    const suspendedUserTaskPromises: Array<Promise<UserTask>> = suspendedFlowNodes.map(async (suspendedUserTask) => {

      if (!suspendedUserTask.token.processModelId === processModelId) {
        return undefined;
      }

      const processModel: Model.Types.Process =
        await this.processModelPersistance.getProcessModelById(suspendedUserTask.token.processModelId);

      const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
      const userTask: Model.Activities.UserTask = processModelFacade.getFlowNodeById(suspendedUserTask.flowNodeId);
      
      if (!userTask instanceof Model.Activities.UserTask) {
        return undefined;
      }
      
      const userTaskConfig: UserTaskConfig = {
        formFields: userTask.formFields,
      };

      return {
        key: suspendedUserTask.flowNodeId,
        id: suspendedUserTask.flowNodeId,
        processInstanceId: suspendedUserTask.token.processInstanceId,
        data: userTaskConfig,
        payload: suspendedUserTask.token.payload,
      };
    });

    const suspendedUserTasks: Array<Promise<UserTask>> = (await Promise.all(suspendedUserTaskPromises))
                                                                      .filter((suspendedUserTask) => {
                                                                        return suspendedUserTask !== undefined;
                                                                      });

    const userTaskList: UserTaskList = {
      userTasks: suspendedUserTasks,
    };

    return userTaskList;
  }

  public async finishUserTask(context: ConsumerContext,
                              processModelId: string,
                              correlationId: string,
                              userTaskId: string,
                              userTaskResult: UserTaskResult): Promise<void> {

    const executionContext: ExecutionContext = await this.processEngineAdapter.createExecutionContextFromConsumerContext(context);

    const userTasks: UserTaskList = await this.getUserTasksForProcessModelInCorrelation(context, processModelId, correlationId);

    const userTask: UserTask = userTasks.userTasks.find((task: UserTask) => {
      return task.key === userTaskId;
    });

    if (userTask === undefined) {
      throw new NotFoundError(`Process model '${processModelId}' in correlation '${correlationId}' does not have a user task '${userTaskId}'`);
    }

    const resultForProcessEngine: any = this._getUserTaskResultFromUserTaskConfig(userTaskResult);

    return new Promise<void>((resolve: Function, reject: Function): void => {
      const subscription: ISubscription = this.eventAggregator.subscribe(`/processengine/node/${userTask.id}`, (event: any) => {
        const eventIsNotUserTaskEndedEvent: boolean = event.data.action !== 'changeState' || event.data.data !== 'end';
        if (eventIsNotUserTaskEndedEvent) {
          return;
        }

        subscription.dispose();
        resolve();
      });

      this.eventAggregator.publish(`/processengine/node/${userTask.id}`, {
        data: {
          action: MessageAction.proceed,
          token: resultForProcessEngine,
        },
        metadata: {
          context: executionContext,
        },
      });
    });

  }

  private _getUserTaskResultFromUserTaskConfig(finishedTask: UserTaskResult): any {
    const userTaskIsNotAnObject: boolean = finishedTask === undefined
                                        || finishedTask.formFields === undefined
                                        || typeof finishedTask.formFields !== 'object'
                                        || Array.isArray(finishedTask.formFields);

    if (userTaskIsNotAnObject) {
      throw new BadRequestError('The UserTasks formFields is not an object.');
    }

    const noFormfieldsSubmitted: boolean = Object.keys(finishedTask.formFields).length === 0;
    if (noFormfieldsSubmitted) {
      throw new BadRequestError('The UserTasks formFields are empty.');
    }

    return finishedTask.formFields;
  }
}
