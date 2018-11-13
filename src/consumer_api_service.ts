import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import { BadRequestError, NotFoundError } from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  CorrelationResult,
  EventList,
  EventTriggerPayload,
  IConsumerApi,
  Messages,
  ProcessModel,
  ProcessModelList,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
  UserTaskList,
  UserTaskResult,
  UserTask,
} from '@process-engine/consumer_api_contracts';
import {
  eventAggregatorSettings,
  EventType,
  ICorrelationService,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessModelService,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';
import {IProcessModelExecutionAdapter} from './adapters/index';
import {
  ProcessModelConverter,
  UserTaskConverter,
} from './converters/index';

export class ConsumerApiService implements IConsumerApi {
  public config: any = undefined;

  private _correlationService: ICorrelationService;
  private _eventAggregator: IEventAggregator;
  private _flowNodeInstanceService: IFlowNodeInstanceService;
  private _processModelExecutionAdapter: IProcessModelExecutionAdapter;
  private _processModelFacadeFactory: IProcessModelFacadeFactory;
  private _processModelService: IProcessModelService;
  private _processModelConverter: ProcessModelConverter;
  private _userTaskConverter: UserTaskConverter;

  constructor(correlationService: ICorrelationService,
              eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              processModelExecutionAdapter: IProcessModelExecutionAdapter,
              processModelFacadeFactory: IProcessModelFacadeFactory,
              processModelService: IProcessModelService,
              userTaskConverter: UserTaskConverter,
              processModelConverter: ProcessModelConverter) {

    this._correlationService = correlationService;
    this._eventAggregator = eventAggregator;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._processModelExecutionAdapter = processModelExecutionAdapter;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processModelService = processModelService;
    this._userTaskConverter = userTaskConverter;
    this._processModelConverter = processModelConverter;
  }

  // Process models
  public async getProcessModels(identity: IIdentity): Promise<ProcessModelList> {

    const processModels: Array<Model.Types.Process> = await this._processModelService.getProcessModels(identity);
    const consumerApiProcessModels: Array<ProcessModel> = processModels.map((processModel: Model.Types.Process) => {
      return this._processModelConverter.convertProcessModel(processModel);
    });

    return <ProcessModelList> {
      processModels: consumerApiProcessModels,
    };
  }

  public async getProcessModelById(identity: IIdentity, processModelKey: string): Promise<ProcessModel> {

    const processModel: Model.Types.Process = await this._processModelService.getProcessModelById(identity, processModelKey);
    const consumerApiProcessModel: ProcessModel = this._processModelConverter.convertProcessModel(processModel);

    return consumerApiProcessModel;
  }

  public async startProcessInstance(identity: IIdentity,
                                    processModelId: string,
                                    startEventId: string,
                                    payload: ProcessStartRequestPayload,
                                    startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated,
                                    endEventId?: string,
                                  ): Promise<ProcessStartResponsePayload> {

    // Uses the standard IAM facade with the processModelService => The process model gets filtered.
    const processModel: Model.Types.Process = await this._processModelService.getProcessModelById(identity, processModelId);

    this._validateStartRequest(processModel, startEventId, endEventId, startCallbackType);

    return this
      ._processModelExecutionAdapter
      .startProcessInstance(identity, processModelId, startEventId, payload, startCallbackType, endEventId);
  }

  public async getProcessResultForCorrelation(identity: IIdentity,
                                              correlationId: string,
                                              processModelId: string): Promise<Array<CorrelationResult>> {

    const processModel: Model.Types.Process =
      await this._processModelService.getProcessModelById(identity, processModelId);

    const processModelFacade: IProcessModelFacade = this._processModelFacadeFactory.create(processModel);
    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();

    const flowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByCorrelation(correlationId);

    const noResultsFound: boolean = !flowNodeInstances || flowNodeInstances.length === 0;
    if (noResultsFound) {
      throw new EssentialProjectErrors.NotFoundError(`No process results for correlation with id '${correlationId}' found.`);
    }

    const endEventInstances: Array<Runtime.Types.FlowNodeInstance>
      = flowNodeInstances.filter((flowNodeInstance: Runtime.Types.FlowNodeInstance) => {

        const isEndEvent: boolean = endEvents.some((endEvent: Model.Events.EndEvent) => {
          return endEvent.id === flowNodeInstance.flowNodeId;
        });

        const exitToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
          return token.type === Runtime.Types.ProcessTokenType.onExit;
        });

        return isEndEvent
          && !exitToken.caller // only from the process who started the correlation
          && exitToken.processModelId === processModelId;
    });

    const results: Array<CorrelationResult> = endEventInstances.map(this._createCorrelationResultFromEndEventInstance);

    return results;
  }

  // Events
  public async getEventsForProcessModel(identity: IIdentity, processModelKey: string): Promise<EventList> {
    return Promise.resolve(mockEventList);
  }

  public async getEventsForCorrelation(identity: IIdentity, correlationId: string): Promise<EventList> {
    return Promise.resolve(mockEventList);
  }

  public async getEventsForProcessModelInCorrelation(identity: IIdentity, processModelKey: string, correlationId: string): Promise<EventList> {
    return Promise.resolve(mockEventList);
  }

  public async triggerMessageEvent(identity: IIdentity,
                                   processModelId: string,
                                   correlationId: string,
                                   eventId: string,
                                   eventTriggerPayload?: EventTriggerPayload): Promise<void> {

    const processModel: Model.Types.Process = await this._processModelService.getProcessModelById(identity, processModelId);

    const eventFlowNode: Model.Events.Event = processModel.flowNodes.find((flowNode: Model.Base.FlowNode): boolean => {
      return flowNode.id === eventId;
    });

    if (eventFlowNode === undefined) {
      throw new NotFoundError(`FlowNode with id: ${eventId} was not found!`);
    }

    // TODO: Rework Event Typings.
    const eventIsNoMessageEvent: boolean = (eventFlowNode as any).eventType !== EventType.messageEvent;

    if (eventIsNoMessageEvent) {
      throw new BadRequestError(`Event with id: ${eventId} is no MessageEvent!`);
    }

    const messageEventName: string = eventAggregatorSettings.routePaths.messageEventReached
      .replace(eventAggregatorSettings.routeParams.messageReference, (eventFlowNode as any).messageEventDefinition.name);

    this._eventAggregator.publish(messageEventName);
  }

  public async triggerSignalEvent(identity: IIdentity,
                                  processModelId: string,
                                  correlationId: string,
                                  eventId: string,
                                  eventTriggerPayload?: EventTriggerPayload): Promise<void> {

      const processModel: Model.Types.Process = await this._processModelService.getProcessModelById(identity, processModelId);

      const eventFlowNode: Model.Events.Event = processModel.flowNodes.find((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.id === eventId;
      });

      if (eventFlowNode === undefined) {
        throw new NotFoundError(`FlowNode with id: ${eventId} was not found!`);
      }

      // TODO: Rework Event Typings.
      const eventIsNoMessageEvent: boolean = (eventFlowNode as any).eventType !== EventType.signalEvent;

      if (eventIsNoMessageEvent) {
        throw new BadRequestError(`Event with id: ${eventId} is no SignalEvent!`);
      }

      const messageEventName: string = eventAggregatorSettings.routePaths.messageEventReached
        .replace(eventAggregatorSettings.routeParams.messageReference, (eventFlowNode as any).signalEventDefinition.name);

      this._eventAggregator.publish(messageEventName);
  }

  // UserTasks
  public async getUserTasksForProcessModel(identity: IIdentity, processModelId: string): Promise<UserTaskList> {

    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const userTaskList: UserTaskList = await this._userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);

    return userTaskList;
  }

  public async getUserTasksForCorrelation(identity: IIdentity, correlationId: string): Promise<UserTaskList> {

    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const userTaskList: UserTaskList = await this._userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);

    return userTaskList;
  }

  public async getUserTasksForProcessModelInCorrelation(identity: IIdentity,
                                                        processModelId: string,
                                                        correlationId: string): Promise<UserTaskList> {

    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedProcessModelFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      suspendedFlowNodes.filter((flowNodeInstance: Runtime.Types.FlowNodeInstance) => {
        return flowNodeInstance.processModelId === processModelId;
      });

    const noSuspendedFlowNodesFound: boolean = !suspendedFlowNodes || suspendedFlowNodes.length === 0;
    if (noSuspendedFlowNodesFound) {
      return <UserTaskList> {
        userTasks: [],
      };
    }

    const userTaskList: UserTaskList =
      await this._userTaskConverter.convertUserTasks(identity, suspendedProcessModelFlowNodes);

    return userTaskList;
  }

  public async finishUserTask(identity: IIdentity,
                              processInstanceId: string,
                              correlationId: string,
                              userTaskInstanceId: string,
                              userTaskResult?: UserTaskResult): Promise<void> {

    // Do this first in order to avoid unnecessary database requests, in case the provided result is invalid.
    const resultForProcessEngine: any = this._createUserTaskResultForProcessEngine(userTaskResult);

    const matchingFlowNodeInstance: UserTask =
      await this._getSuspendedUserTask(identity, correlationId, processInstanceId, userTaskInstanceId);

    return new Promise<void>(async(resolve: Function, reject: Function): Promise<void> => {

      const userTaskFinishedEvent: string = Messages.EventAggregatorSettings.routePaths.userTaskFinished
        .replace(Messages.EventAggregatorSettings.routeParams.correlationId, correlationId)
        .replace(Messages.EventAggregatorSettings.routeParams.processInstanceId, processInstanceId)
        .replace(Messages.EventAggregatorSettings.routeParams.flowNodeInstanceId, userTaskInstanceId);

      const subscription: ISubscription =
        this._eventAggregator.subscribeOnce(userTaskFinishedEvent, (message: Messages.SystemEvents.UserTaskFinishedMessage) => {
          if (subscription) {
            subscription.dispose();
          }
          resolve();
        });

      const finishUserTaskMessage: Messages.SystemEvents.FinishUserTaskMessage = new Messages.SystemEvents.FinishUserTaskMessage(
        resultForProcessEngine,
        correlationId,
        processModelId,
        userTask.processInstanceId,
        userTaskId,
        '', // TODO: Add FlowNodeInstanceId to UserTask type
        userTask.tokenPayload,
      );

      const finishUserTaskEvent: string = Messages.EventAggregatorSettings.routePaths.finishUserTask
        .replace(Messages.EventAggregatorSettings.routeParams.correlationId, correlationId)
        .replace(Messages.EventAggregatorSettings.routeParams.processModelId, userTask.processModelId)
        .replace(Messages.EventAggregatorSettings.routeParams.userTaskId, userTask.id);

      this._eventAggregator.publish(finishUserTaskEvent, finishUserTaskMessage);
    });
  }

  private _validateStartRequest(processModel: Model.Types.Process,
                                startEventId: string,
                                endEventId: string,
                                startCallbackType: StartCallbackType,
                               ): void {

    if (!Object.values(StartCallbackType).includes(startCallbackType)) {
      throw new EssentialProjectErrors.BadRequestError(`${startCallbackType} is not a valid return option!`);
    }

    if (!processModel.isExecutable) {
      throw new EssentialProjectErrors.BadRequestError('The process model is not executable!');
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

  private async _checkIfCorrelationExists(correlationId: string): Promise<void> {
    const flowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByCorrelation(correlationId);

    if (!flowNodeInstances || flowNodeInstances.length === 0) {
      throw new EssentialProjectErrors.NotFoundError(`No Correlation with id '${correlationId}' found.`);
    }
  }

  private async _checkIfProcessModelInstanceExists(processInstanceId: string): Promise<void> {
    const flowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByProcessModel(processInstanceId);

    if (!flowNodeInstances || flowNodeInstances.length === 0) {
      throw new EssentialProjectErrors.NotFoundError(`No process instance with id '${processInstanceId}' found.`);
    }
  }

  private _createCorrelationResultFromEndEventInstance(endEventInstance: Runtime.Types.FlowNodeInstance): CorrelationResult {

    const exitToken: Runtime.Types.ProcessToken = endEventInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
      return token.type === Runtime.Types.ProcessTokenType.onExit;
    });

    const correlationResult: CorrelationResult = {
      correlationId: exitToken.correlationId,
      endEventId: endEventInstance.flowNodeId,
      tokenPayload: exitToken.payload,
    };

    return correlationResult;
  }

  private async _getSuspendedUserTask(
    identity: IIdentity,
    correlationId: string,
    processInstanceId: string,
    userTaskInstanceId: string,
  ): Promise<UserTask> {

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const userTaskList: UserTaskList =
      await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodeInstances);

    const matchingUserTask: UserTask =
      userTaskList.userTasks.find((userTask: UserTask): boolean => {
        return userTask.flowNodeInstanceId === userTaskInstanceId
          && userTask.processInstanceId === processInstanceId;
      });

    const noMatchingUserTaskFound: boolean = matchingUserTask === undefined;
    if (noMatchingUserTaskFound) {
      const errorMessage: string =
        `ProcessInstance '${processInstanceId}' in Correlation '${correlationId}' does not have a UserTask with id '${userTaskInstanceId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    return matchingUserTask;
  }

  private _createUserTaskResultForProcessEngine(finishedTask: UserTaskResult): any {

    const noResultsProvided: boolean = !finishedTask || !finishedTask.formFields;

    if (noResultsProvided) {
      return {};
    }

    const formFieldResultIsNotAnObject: boolean = typeof finishedTask !== 'object'
      || typeof finishedTask.formFields !== 'object'
      || Array.isArray(finishedTask.formFields);

    if (formFieldResultIsNotAnObject) {
      throw new EssentialProjectErrors.BadRequestError(`The UserTask's FormFields are not an object.`);
    }

    return finishedTask.formFields;
  }

  public onUserTaskWaiting(callback: Messages.CallbackTypes.OnUserTaskWaitingCallback): void {
    this._eventAggregator.subscribe(Messages.EventAggregatorSettings.messagePaths.userTaskReached, callback);
  }

  public onUserTaskFinished(callback: Messages.CallbackTypes.OnUserTaskFinishedCallback): void {
    this._eventAggregator.subscribe(Messages.EventAggregatorSettings.messagePaths.userTaskFinished, callback);
  }

  public onProcessTerminated(callback: Messages.CallbackTypes.OnProcessTerminatedCallback): void {
    this._eventAggregator.subscribe(Messages.EventAggregatorSettings.messagePaths.processTerminated, callback);
  }

  public onProcessEnded(callback: Messages.CallbackTypes.OnProcessEndedCallback): void {
    this._eventAggregator.subscribe(Messages.EventAggregatorSettings.messagePaths.processEnded, callback);
  }
}
