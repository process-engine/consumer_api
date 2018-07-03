import {ExecutionContext, IIamService, TokenType} from '@essential-projects/core_contracts';
import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {
  ConsumerContext,
  Event,
  EventList,
  EventTriggerPayload,
  IConsumerApiService,
  ICorrelationResult,
  ProcessModel,
  ProcessModelList,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
  UserTask,
  UserTaskConfig,
  UserTaskFormField,
  UserTaskFormFieldType,
  UserTaskList,
  UserTaskResult,
} from '@process-engine/consumer_api_contracts';
import {
  EndEventReachedMessage,
  IExecuteProcessService,
  IExecutionContextFacade,
  IExecutionContextFacadeFactory,
  IFlowNodeInstancePersistenceService,
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessModelPersistenceService,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import * as uuid from 'uuid';

const mockEventList: EventList = {
  events: [{
    key: 'startEvent_1',
    id: '',
    processInstanceId: '',
    data: {},
  }],
};

export class ConsumerApiService implements IConsumerApiService {
  public config: any = undefined;

  private _eventAggregator: IEventAggregator;
  private _executeProcessService: IExecuteProcessService;
  private _executionContextFacadeFactory: IExecutionContextFacadeFactory;
  private _processModelFacadeFactory: IProcessModelFacadeFactory;
  private _processModelPersistenceService: IProcessModelPersistenceService;
  private _flowNodeInstancePersistenceService: IFlowNodeInstancePersistenceService;
  private _iamService: IIamService;

  constructor(eventAggregator: IEventAggregator,
              executeProcessService: IExecuteProcessService,
              executionContextFacadeFactory: IExecutionContextFacadeFactory,
              flowNodeInstancePersistenceService: IFlowNodeInstancePersistenceService,
              iamService: IIamService,
              processModelFacadeFactory: IProcessModelFacadeFactory,
              processModelPersistenceService: IProcessModelPersistenceService) {

    this._eventAggregator = eventAggregator;
    this._executeProcessService = executeProcessService;
    this._executionContextFacadeFactory = executionContextFacadeFactory;
    this._flowNodeInstancePersistenceService = flowNodeInstancePersistenceService;
    this._iamService = iamService;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processModelPersistenceService = processModelPersistenceService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get executeProcessService(): IExecuteProcessService {
    return this._executeProcessService;
  }

  private get executionContextFacadeFactory(): IExecutionContextFacadeFactory {
    return this._executionContextFacadeFactory;
  }

  private get flowNodeInstancePersistenceService(): IFlowNodeInstancePersistenceService {
    return this._flowNodeInstancePersistenceService;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }

  private get processModelFacadeFactory(): IProcessModelFacadeFactory {
    return this._processModelFacadeFactory;
  }

  private get processModelPersistenceService(): IProcessModelPersistenceService {
    return this._processModelPersistenceService;
  }

  // Process models
  public async getProcessModels(context: ConsumerContext): Promise<ProcessModelList> {

    const executionContextFacade: IExecutionContextFacade = await this._createExecutionContextFacadeFromConsumerContext(context);
    const processModels: Array<Model.Types.Process> = await this.processModelPersistenceService.getProcessModels(executionContextFacade);
    const consumerApiProcessModels: Array<ProcessModel> = processModels.map(this._convertToConsumerApiProcessModel);

    return <ProcessModelList> {
      processModels: consumerApiProcessModels,
    };
  }

  public async getProcessModelByKey(context: ConsumerContext, processModelKey: string): Promise<ProcessModel> {

    const executionContextFacade: IExecutionContextFacade = await this._createExecutionContextFacadeFromConsumerContext(context);
    const processModel: Model.Types.Process = await this.processModelPersistenceService.getProcessModelById(executionContextFacade, processModelKey);
    const consumerApiProcessModel: ProcessModel = this._convertToConsumerApiProcessModel(processModel);

    return consumerApiProcessModel;
  }

  public async startProcessInstance(context: ConsumerContext,
                                    processModelId: string,
                                    startEventId: string,
                                    payload: ProcessStartRequestPayload,
                                    startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated,
                                    endEventId?: string,
                                  ): Promise<ProcessStartResponsePayload> {

    const executionContextFacade: IExecutionContextFacade = await this._createExecutionContextFacadeFromConsumerContext(context);
    const correlationId: string = payload.correlationId || uuid.v4();
    const processModel: Model.Types.Process = await this.processModelPersistenceService.getProcessModelById(executionContextFacade, processModelId);

    this._validateStartRequest(processModel, startEventId, endEventId, startCallbackType);

    const response: ProcessStartResponsePayload = await this._startProcessInstance(executionContextFacade,
                                                                                   correlationId,
                                                                                   processModel,
                                                                                   startEventId,
                                                                                   payload,
                                                                                   startCallbackType,
                                                                                   endEventId);

    return response;
  }

  public async getProcessResultForCorrelation(context: ConsumerContext,
                                              correlationId: string,
                                              processModelId: string): Promise<ICorrelationResult> {

    const executionContextFacade: IExecutionContextFacade = await this._createExecutionContextFacadeFromConsumerContext(context);

    const processModel: Model.Types.Process =
      await this.processModelPersistenceService.getProcessModelById(executionContextFacade, processModelId);

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();

    const flowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstancePersistenceService.queryByCorrelation(executionContextFacade, correlationId);

    const endEventInstances: Array<Runtime.Types.FlowNodeInstance>
      = flowNodeInstances.filter((flowNodeInstance: Runtime.Types.FlowNodeInstance) => {

        const isEndEvent: boolean = endEvents.some((endEvent: Model.Events.EndEvent) => {
          return endEvent.id === flowNodeInstance.flowNodeId;
        });

        return isEndEvent
          && flowNodeInstance.token.caller === undefined // only from the process who started the correlation
          && flowNodeInstance.token.processModelId === processModelId;
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
    return Promise.resolve(mockEventList);
  }

  public async getEventsForCorrelation(context: ConsumerContext, correlationId: string): Promise<EventList> {
    return Promise.resolve(mockEventList);
  }

  public async getEventsForProcessModelInCorrelation(context: ConsumerContext, processModelKey: string, correlationId: string): Promise<EventList> {
    return Promise.resolve(mockEventList);
  }

  public async triggerEvent(context: ConsumerContext,
                            processModelKey: string,
                            correlationId: string,
                            eventId: string,
                            eventTriggerPayload?: EventTriggerPayload): Promise<void> {
    return Promise.resolve();
  }

  // UserTasks
  public async getUserTasksForProcessModel(context: ConsumerContext, processModelId: string): Promise<UserTaskList> {

    const executionContextFacade: IExecutionContextFacade = await this._createExecutionContextFacadeFromConsumerContext(context);

    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstancePersistenceService.querySuspendedByProcessModel(executionContextFacade, processModelId);

    const userTaskList: UserTaskList = await this._convertSuspendedFlowNodesToUserTaskList(executionContextFacade, suspendedFlowNodes);

    return userTaskList;
  }

  public async getUserTasksForCorrelation(context: ConsumerContext, correlationId: string): Promise<UserTaskList> {

    const executionContextFacade: IExecutionContextFacade = await this._createExecutionContextFacadeFromConsumerContext(context);

    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstancePersistenceService.querySuspendedByCorrelation(executionContextFacade, correlationId);

    const userTaskList: UserTaskList = await this._convertSuspendedFlowNodesToUserTaskList(executionContextFacade, suspendedFlowNodes);

    return userTaskList;
  }

  public async getUserTasksForProcessModelInCorrelation(context: ConsumerContext,
                                                        processModelId: string,
                                                        correlationId: string): Promise<UserTaskList> {

    const executionContextFacade: IExecutionContextFacade = await this._createExecutionContextFacadeFromConsumerContext(context);

    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstancePersistenceService.querySuspendedByCorrelation(executionContextFacade, correlationId);

    const userTaskList: UserTaskList =
      await this._convertSuspendedFlowNodesToUserTaskList(executionContextFacade, suspendedFlowNodes, processModelId);

    return userTaskList;
  }

  public async finishUserTask(context: ConsumerContext,
                              processModelId: string,
                              correlationId: string,
                              userTaskId: string,
                              userTaskResult: UserTaskResult): Promise<void> {

    const userTasks: UserTaskList = await this.getUserTasksForProcessModelInCorrelation(context, processModelId, correlationId);

    const userTask: UserTask = userTasks.userTasks.find((task: UserTask) => {
      return task.key === userTaskId;
    });

    if (userTask === undefined) {
      const errorMessage: string = `Process model '${processModelId}' in correlation '${correlationId}' does not have a user task '${userTaskId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    const resultForProcessEngine: any = this._getUserTaskResultFromUserTaskConfig(userTaskResult);

    return new Promise<void>((resolve: Function, reject: Function): void => {
      this.eventAggregator.subscribeOnce(`/processengine/node/${userTask.id}/finished`, (event: any) => {
        resolve();
      });

      this.eventAggregator.publish(`/processengine/node/${userTask.id}/finish`, {
        data: {
          token: resultForProcessEngine,
        },
      });
    });
  }

  private async _createExecutionContextFacadeFromConsumerContext(consumerContext: ConsumerContext): Promise<IExecutionContextFacade> {
    const executionContext: ExecutionContext = await this.iamService.resolveExecutionContext(consumerContext.identity, TokenType.jwt);

    return this.executionContextFacadeFactory.create(executionContext);
  }

  private _convertToConsumerApiEvent(event: Model.Events.Event): Event {

    const consumerApiEvent: Event = new Event();
    consumerApiEvent.key = event.id;
    consumerApiEvent.id = event.id;

    return consumerApiEvent;
  }

  private _convertToConsumerApiProcessModel(processModel: Model.Types.Process): ProcessModel {

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);

    const startEvents: Array<Model.Events.StartEvent> = processModelFacade.getStartEvents();
    const consumerApiStartEvents: Array<Event> = startEvents.map(this._convertToConsumerApiEvent);

    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
    const consumerApiEndEvents: Array<Event> = endEvents.map(this._convertToConsumerApiEvent);

    const processModelResponse: ProcessModel = {
      key: processModel.id,
      startEvents: consumerApiStartEvents,
      endEvents: consumerApiEndEvents,
    };

    return processModelResponse;
  }

  private _validateStartRequest(processModel: Model.Types.Process,
                                startEventId: string,
                                endEventId: string,
                                startCallbackType: StartCallbackType,
                               ): void {

    if (!Object.values(StartCallbackType).includes(startCallbackType)) {
      throw new EssentialProjectErrors.BadRequestError(`${startCallbackType} is not a valid return option!`);
    }

    const hasMatchingStartEvent: boolean = processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
      return flowNode.id === startEventId;
    });

    if (!hasMatchingStartEvent) {
      throw new EssentialProjectErrors.NotFoundError(`StartEvent with ID '${startEventId}' not found!`);
    }

    if (startCallbackType === StartCallbackType.CallbackOnEndEventReached) {

      if (!endEventId) {
        throw new EssentialProjectErrors.BadRequestError(`Must provide an EndEventId, when using callback type 'CallbackOnEndEventReached'!`);
      }

      const hasMatchingEndEvent: boolean = processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.id === endEventId;
      });

      if (!hasMatchingEndEvent) {
        throw new EssentialProjectErrors.NotFoundError(`EndEvent with ID '${startEventId}' not found!`);
      }
    }
  }

  private async _startProcessInstance(executionContextFacade: IExecutionContextFacade,
                                      correlationId: string,
                                      processModel: Model.Types.Process,
                                      startEventId: string,
                                      payload: ProcessStartRequestPayload,
                                      startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated,
                                      endEventId?: string,
                                    ): Promise<ProcessStartResponsePayload> {

    const executionContext: ExecutionContext = executionContextFacade.getExecutionContext();

    const response: ProcessStartResponsePayload = {
      correlationId: correlationId,
    };

    // Only start the process instance and return
    if (startCallbackType === StartCallbackType.CallbackOnProcessInstanceCreated) {
      this.executeProcessService.start(executionContext, processModel, startEventId, correlationId, payload.inputValues);

      return response;
    }

    let endEventReachedMessage: EndEventReachedMessage;

    // Start the process instance and wait for a specific end event result
    if (startCallbackType === StartCallbackType.CallbackOnEndEventReached && endEventId) {
      endEventReachedMessage = await this.executeProcessService.startAndAwaitSpecificEndEvent(executionContext,
                                                                                              processModel,
                                                                                              startEventId,
                                                                                              correlationId,
                                                                                              endEventId,
                                                                                              payload.inputValues);

      response.endEventId = endEventReachedMessage.endEventId;
      response.tokenPayload = endEventReachedMessage.tokenPayload;

      return response;
    }

    // Start the process instance and wait for the first end event result
    endEventReachedMessage
      = await this.executeProcessService.startAndAwaitEndEvent(executionContext, processModel, startEventId, correlationId, payload.inputValues);

    response.endEventId = endEventReachedMessage.endEventId;
    response.tokenPayload = endEventReachedMessage.tokenPayload;

    return response;
  }

  private async _convertSuspendedFlowNodesToUserTaskList(executionContextFacade: IExecutionContextFacade,
                                                         suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance>,
                                                         processModelId?: string,
                                                        ): Promise<UserTaskList> {

    const suspendedUserTasks: Array<UserTask> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      if (processModelId && suspendedFlowNode.token.processModelId !== processModelId) {
        continue;
      }

      const userTask: UserTask = await this._convertSuspendedFlowNodeToUserTask(executionContextFacade, suspendedFlowNode);

      if (userTask === undefined) {
        continue;
      }

      suspendedUserTasks.push(userTask);
    }

    const userTaskList: UserTaskList = {
      userTasks: suspendedUserTasks,
    };

    return userTaskList;
  }

  private async _convertSuspendedFlowNodeToUserTask(executionContextFacade: IExecutionContextFacade,
                                                    flowNodeInstance: Runtime.Types.FlowNodeInstance): Promise<UserTask> {

    const processModel: Model.Types.Process =
      await this.processModelPersistenceService.getProcessModelById(executionContextFacade, flowNodeInstance.token.processModelId);

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
    const userTask: Model.Activities.UserTask = processModelFacade.getFlowNodeById(flowNodeInstance.flowNodeId) as Model.Activities.UserTask;

    return this._convertToConsumerApiUserTask(userTask, flowNodeInstance);
  }

  private _convertToConsumerApiFormFieldType(type: string): UserTaskFormFieldType {
    return UserTaskFormFieldType[type];
  }

  private _convertToConsumerApiUserTask(userTask: Model.Activities.UserTask, flowNodeInstance: Runtime.Types.FlowNodeInstance): UserTask {

    const consumerApiFormFields: Array<UserTaskFormField> = userTask.formFields.map((formField: Model.Types.FormField) => {
      return this._convertToConsumerApiFormField(formField);
    });

    const userTaskConfig: UserTaskConfig = {
      formFields: consumerApiFormFields,
    };

    const consumerApiUserTask: UserTask = {
      key: flowNodeInstance.flowNodeId,
      id: flowNodeInstance.flowNodeId,
      processInstanceId: flowNodeInstance.token.processInstanceId,
      data: userTaskConfig,
      tokenPayload: flowNodeInstance.token.payload,
    };

    return consumerApiUserTask;
  }

  private _convertToConsumerApiFormField(formField: Model.Types.FormField): UserTaskFormField {

    const userTaskFormField: UserTaskFormField = new UserTaskFormField();
    userTaskFormField.id = formField.id;
    userTaskFormField.label = formField.label;
    userTaskFormField.type = this._convertToConsumerApiFormFieldType(formField.type);
    userTaskFormField.defaultValue = formField.defaultValue;
    userTaskFormField.preferredControl = formField.preferredControl;

    return userTaskFormField;
  }

  private _getUserTaskResultFromUserTaskConfig(finishedTask: UserTaskResult): any {
    const userTaskIsNotAnObject: boolean = finishedTask === undefined
                                        || finishedTask.formFields === undefined
                                        || typeof finishedTask.formFields !== 'object'
                                        || Array.isArray(finishedTask.formFields);

    if (userTaskIsNotAnObject) {
      throw new EssentialProjectErrors.BadRequestError('The UserTasks formFields is not an object.');
    }

    const noFormfieldsSubmitted: boolean = Object.keys(finishedTask.formFields).length === 0;
    if (noFormfieldsSubmitted) {
      throw new EssentialProjectErrors.BadRequestError('The UserTasks formFields are empty.');
    }

    return finishedTask.formFields;
  }
}
