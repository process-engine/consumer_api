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
    // TODO: implement accessibility check
    return this.processModelPersistance.getProcessModels();
  }

  public async getProcessModelByKey(context: ConsumerContext, processModelKey: string): Promise<ProcessModel> {
    // TODO: implement accessibility check
    const processModelDefinition: Model.Types.Process = await this.processModelPersistance.getProcessModelById(processModelKey);

    const startEvents = processModelDefinition.flowNodes.filter((flowNode) => {
      return flowNode instanceof Model.Events.StartEvent;
    });

    const endEvents = processModelDefinition.flowNodes.filter((flowNode) => {
      return flowNode instanceof Model.Events.StartEvent;
    });

    const processModelResponse: ProcessModel = {
      key: processModelDefinition.id,
      startEvents: startEvents,
      endEvents: endEvents,
    }

    return processModelResponse;
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
    const processModel: Model.Types.Process = await this.processModelPersistance.getProcessModelById(processModelId);
    
    if (startCallbackType === StartCallbackType.CallbackOnProcessInstanceCreated) {
      this.executeProcessService.start(executionContext, processModel, correlationId, payload.inputValues);
    } else {
      this.executeProcessService.startAndAwaitEndEvent(executionContext, processModel, correlationId, payload.inputValues);
    }

    const response: ProcessStartResponsePayload = {
      correlationId: correlationId,
    };

    return response;
  }

  public async startProcessInstanceAndAwaitEndEvent(context: ConsumerContext,
                                                    processModelKey: string,
                                                    startEventKey: string,
                                                    endEventKey: string,
                                                    payload: ProcessStartRequestPayload,
                                                  ): Promise<ProcessStartResponsePayload> {

    const executionContext: ExecutionContext = await this.processEngineAdapter.createExecutionContextFromConsumerContext(context);
    const correlationId: string = payload.correlation_id || uuid.v4();
    const processModel: Model.Types.Process = await this.processModelPersistance.getProcessModelById(processModelId);

    await this.executeProcessService.startAndAwaitSpecificEndEvent(executionContext, processModel, correlationId, endEventKey, payload.inputValues);

    const response: ProcessStartResponsePayload = {
      correlationId: correlationId,
    };

    return response;
  }

  public async getAllProcessResultsForCorrelation(context: ConsumerContext,
                                                  correlationId: string,
                                                  processModelId: string): Promise<Array<ICorrelationResult>> {

    const processModel: Model.Types.Process =
      await this.processModelPersistance.getProcessModelById(processModelId);

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
    
    const flowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = 
      await this.flowNodeInstancePersistance.queryBy(correlationId);

    const endEventFlowNodeInstances = flowNodeInstances.filter((flowNodeInstance) => {

      const isEndEvent: boolean = endEvents.some((endEvent) => {
        return endEvent.id === flowNodeInstance.flowNodeId;
      });

      return isEndEvent
        && flowNodeInstance.token.caller === undefined // only from the process who started the correlation
        && flowNodeInstance.token.processModelId === processModelId;
    });
    
    const correlationResults: Array<ICorrelationResult> = endEventFlowNodeInstances.map((endEventFlowNodeInstance) => {
      return endEventFlowNodeInstance.token.payload;
    });

    return correlationResults;
  }

  public async getProcessResultForCorrelation(context: ConsumerContext,
                                              correlationId: string,
                                              processModelId: string): Promise<ICorrelationResult> {
    // TODO: implement accessibility check
    
    const processModel: Model.Types.Process =
      await this.processModelPersistance.getProcessModelById(processModelId);

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
    
    const flowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = 
      await this.flowNodeInstancePersistance.queryBy(correlationId);

    const endEventInstances: Array<Runtime.Types.FlowNodeInstance> = flowNodeInstances.filter((flowNodeInstance) => {
      const isEndEvent: boolean = endEvents.some((endEvent) => {
        return flowNodeInstance.flowNodeId === endEvent.id;
      });

      return isEndEvent;
    });

    const correlationResult: ICorrelationResult = {};

    // merge results
    for (const endEventInstance of endEventInstances) {
      Object.assign(correlationResult, endEventInstance.token.payload);
    }

    return correlationResult;
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
  public async getUserTasksForProcessModel(context: ConsumerContext, processModelId: string): Promise<UserTaskList> {

    const processModel: Model.Types.Process =
      await this.processModelPersistance.getProcessModelById(processModelId);

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);

    const userTasks: Array<Model.Activities.UserTask> = processModelFacade.getUserTasks();

    return {
      userTasks: userTasks,
    };
  }

  public async getUserTasksForCorrelation(context: ConsumerContext, correlationId: string): Promise<UserTaskList> {

    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstancePersistance.querySuspended(correlationId);

    const suspendedUserTasks: Array<UserTask> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      const processModel: Model.Types.Process =
        await this.processModelPersistance.getProcessModelById(suspendedFlowNode.token.processModelId);

      const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
      const userTask: Model.Activities.UserTask = processModelFacade.getFlowNodeById(suspendedFlowNode.flowNodeId);
      
      if (!(userTask instanceof Model.Activities.UserTask)) {
        continue;
      }
      
      const userTaskConfig: UserTaskConfig = {
        formFields: userTask.formFields,
      };

      const externalUserTask: UserTask = {
        key: suspendedFlowNode.flowNodeId,
        id: suspendedFlowNode.flowNodeId,
        processInstanceId: suspendedFlowNode.token.processInstanceId,
        data: userTaskConfig,
        payload: suspendedFlowNode.token.payload,
      };

      suspendedUserTasks.push(externalUserTask);
    }

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

    const suspendedUserTasks: Array<UserTask> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      if (suspendedFlowNode.token.processModelId !== processModelId) {
        continue;
      }

      const processModel: Model.Types.Process =
        await this.processModelPersistance.getProcessModelById(suspendedFlowNode.token.processModelId);

      const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
      const userTask: Model.Activities.UserTask = processModelFacade.getFlowNodeById(suspendedFlowNode.flowNodeId);
      
      if (!(userTask instanceof Model.Activities.UserTask)) {
        continue;
      }
      
      const userTaskConfig: UserTaskConfig = {
        formFields: userTask.formFields,
      };

      const externalUserTask: UserTask = {
        key: suspendedFlowNode.flowNodeId,
        id: suspendedFlowNode.flowNodeId,
        processInstanceId: suspendedFlowNode.token.processInstanceId,
        data: userTaskConfig,
        payload: suspendedFlowNode.token.payload,
      };

      suspendedUserTasks.push(externalUserTask);
    }

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
