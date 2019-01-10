// tslint:disable:max-file-line-count
import * as jsonwebtoken from 'jsonwebtoken';

import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity, TokenBody} from '@essential-projects/iam_contracts';
import {
  CorrelationResult,
  EventList,
  EventTriggerPayload,
  IConsumerApi,
  ManualTask,
  ManualTaskList,
  Messages,
  ProcessInstance,
  ProcessModel,
  ProcessModelList,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
  UserTask,
  UserTaskList,
  UserTaskResult,
} from '@process-engine/consumer_api_contracts';
import {
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessModelService,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IProcessModelExecutionAdapter, NotificationAdapter} from './adapters/index';
import {
  EventConverter,
  ManualTaskConverter,
  ProcessInstanceConverter,
  ProcessModelConverter,
  UserTaskConverter,
} from './converters/index';

export class ConsumerApiService implements IConsumerApi {
  public config: any = undefined;

  private readonly _eventAggregator: IEventAggregator;
  private readonly _eventConverter: EventConverter;
  private readonly _flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly _iamService: IIAMService;
  private readonly _processModelExecutionAdapter: IProcessModelExecutionAdapter;
  private readonly _processModelFacadeFactory: IProcessModelFacadeFactory;
  private readonly _processModelService: IProcessModelService;

  private readonly _notificationAdapter: NotificationAdapter;

  private readonly _userTaskConverter: UserTaskConverter;
  private readonly _manualTaskConverter: ManualTaskConverter;
  private readonly _processInstanceConverter: ProcessInstanceConverter;
  private readonly _processModelConverter: ProcessModelConverter;

  private readonly _canTriggerMessagesClaim: string = 'can_trigger_messages';
  private readonly _canTriggerSignalsClaim: string = 'can_trigger_signals';
  private readonly _canSubscribeToEventsClaim: string = 'can_subscribe_to_events';

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              iamService: IIAMService,
              processModelExecutionAdapter: IProcessModelExecutionAdapter,
              processModelFacadeFactory: IProcessModelFacadeFactory,
              processModelService: IProcessModelService,
              notificationAdapter: NotificationAdapter,
              eventConverter: EventConverter,
              userTaskConverter: UserTaskConverter,
              manualTaskConverter: ManualTaskConverter,
              processInstanceConverter: ProcessInstanceConverter,
              processModelConverter: ProcessModelConverter) {

    this._eventAggregator = eventAggregator;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._iamService = iamService;
    this._processModelExecutionAdapter = processModelExecutionAdapter;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processModelService = processModelService;

    this._notificationAdapter = notificationAdapter;

    this._eventConverter = eventConverter;
    this._userTaskConverter = userTaskConverter;
    this._manualTaskConverter = manualTaskConverter;
    this._processInstanceConverter = processInstanceConverter;
    this._processModelConverter = processModelConverter;
  }

  // Notifications
  public async onUserTaskWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskWaitingCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onUserTaskWaiting(identity, callback);
  }

  public async onUserTaskFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskFinishedCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onUserTaskFinished(identity, callback);
  }

  public async onUserTaskForIdentityWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskWaitingCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onUserTaskForIdentityWaiting(identity, callback);
  }

  public async onUserTaskForIdentityFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskFinishedCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onUserTaskForIdentityFinished(identity, callback);
  }

  public async onManualTaskWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnManualTaskWaitingCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onManualTaskWaiting(identity, callback);
  }

  public async onManualTaskFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnManualTaskFinishedCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onManualTaskFinished(identity, callback);
  }

  public async onManualTaskForIdentityWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnManualTaskWaitingCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onManualTaskForIdentityWaiting(identity, callback);
  }

  public async onManualTaskForIdentityFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnManualTaskFinishedCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onManualTaskForIdentityFinished(identity, callback);
  }

  public async onProcessStarted(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessStartedCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onProcessStarted(identity, callback);
  }

  public async onProcessWithProcessModelIdStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    processModelId: string,
  ): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onProcessWithProcessModelIdStarted(identity, callback, processModelId);
  }

  public async onProcessEnded(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessEndedCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onProcessEnded(identity, callback);
  }

  public async onProcessTerminated(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessTerminatedCallback): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);
    this._notificationAdapter.onProcessTerminated(identity, callback);
  }

  // Process models and instances
  public async getProcessModels(identity: IIdentity): Promise<ProcessModelList> {

    const processModels: Array<Model.Types.Process> = await this._processModelService.getProcessModels(identity);
    const consumerApiProcessModels: Array<ProcessModel> = processModels.map((processModel: Model.Types.Process) => {
      return this._processModelConverter.convertProcessModel(processModel);
    });

    return <ProcessModelList> {
      processModels: consumerApiProcessModels,
    };
  }

  public async getProcessModelById(identity: IIdentity, processModelId: string): Promise<ProcessModel> {

    const processModel: Model.Types.Process = await this._processModelService.getProcessModelById(identity, processModelId);
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

  public async getProcessInstancesByIdentity(identity: IIdentity): Promise<Array<ProcessInstance>> {

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.queryActive();

    const flowNodeInstancesOwnedByUser: Array<Runtime.Types.FlowNodeInstance> =
      suspendedFlowNodeInstances.filter((flowNodeInstance: Runtime.Types.FlowNodeInstance): boolean => {
        return this._checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
      });

    const processInstances: Array<ProcessInstance> = this._processInstanceConverter.convertFlowNodeInstances(flowNodeInstancesOwnedByUser);

    return processInstances;
  }

  // Events
  public async getEventsForProcessModel(identity: IIdentity, processModelId: string): Promise<EventList> {

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const suspendedEvents: Array<Runtime.Types.FlowNodeInstance> = suspendedFlowNodeInstances.filter(this._isFlowNodeAnEvent);

    const eventList: EventList = await this._eventConverter.convertEvents(identity, suspendedEvents);

    return eventList;
  }

  public async getEventsForCorrelation(identity: IIdentity, correlationId: string): Promise<EventList> {

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedEvents: Array<Runtime.Types.FlowNodeInstance> = suspendedFlowNodeInstances.filter(this._isFlowNodeAnEvent);

    const accessibleEvents: Array<Runtime.Types.FlowNodeInstance> =
      await Promise.filter(suspendedEvents, async(flowNode: Runtime.Types.FlowNodeInstance) => {
        try {
          await this._processModelService.getProcessModelById(identity, flowNode.processModelId);

          return true;
        } catch (error) {

          return false;
        }
      });

    const eventList: EventList = await this._eventConverter.convertEvents(identity, accessibleEvents);

    return eventList;
  }

  public async getEventsForProcessModelInCorrelation(identity: IIdentity, processModelId: string, correlationId: string): Promise<EventList> {

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedEvents: Array<Runtime.Types.FlowNodeInstance> =
      suspendedFlowNodeInstances.filter((flowNode: Runtime.Types.FlowNodeInstance) => {

        const flowNodeIsEvent: boolean = this._isFlowNodeAnEvent(flowNode);
        const flowNodeBelongstoCorrelation: boolean = flowNode.processModelId === processModelId;

        return flowNodeIsEvent && flowNodeBelongstoCorrelation;
      });

    const triggerableEvents: EventList = await this._eventConverter.convertEvents(identity, suspendedEvents);

    return triggerableEvents;
  }

  public async triggerMessageEvent(identity: IIdentity, messageName: string, payload?: EventTriggerPayload): Promise<void> {

    await this._iamService.ensureHasClaim(identity, this._canTriggerMessagesClaim);

    const messageEventName: string = Messages.EventAggregatorSettings.messagePaths.messageEventReached
      .replace(Messages.EventAggregatorSettings.messageParams.messageReference, messageName);

    this._eventAggregator.publish(messageEventName, payload);
  }

  public async triggerSignalEvent(identity: IIdentity, signalName: string, payload?: EventTriggerPayload): Promise<void> {

    await this._iamService.ensureHasClaim(identity, this._canTriggerSignalsClaim);

    const signalEventName: string = Messages.EventAggregatorSettings.messagePaths.signalEventReached
      .replace(Messages.EventAggregatorSettings.messageParams.signalReference, signalName);

    this._eventAggregator.publish(signalEventName, payload);
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

  public async getWaitingUserTasksByIdentity(identity: IIdentity): Promise<UserTaskList> {

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByState(Runtime.Types.FlowNodeInstanceState.suspended);

    const flowNodeInstancesOwnedByUser: Array<Runtime.Types.FlowNodeInstance> =
      suspendedFlowNodeInstances.filter((flowNodeInstance: Runtime.Types.FlowNodeInstance): boolean => {
        return this._checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
      });

    const userTaskList: UserTaskList =
      await this._userTaskConverter.convertUserTasks(identity, flowNodeInstancesOwnedByUser);

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

      const userTaskFinishedEvent: string = Messages.EventAggregatorSettings.messagePaths.userTaskWithInstanceIdFinished
        .replace(Messages.EventAggregatorSettings.messageParams.correlationId, correlationId)
        .replace(Messages.EventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
        .replace(Messages.EventAggregatorSettings.messageParams.flowNodeInstanceId, userTaskInstanceId);

      this._eventAggregator.subscribeOnce(userTaskFinishedEvent, (message: Messages.Internal.SystemEvents.UserTaskFinishedMessage) => {
        resolve();
      });

      await this._sendUserTaskResultToProcessEngine(identity, matchingFlowNodeInstance, resultForProcessEngine);
    });
  }

  // ManualTasks
  public async getManualTasksForProcessModel(identity: IIdentity, processModelId: string): Promise<ManualTaskList> {
    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const manualTaskList: ManualTaskList = await this._manualTaskConverter.convert(identity, suspendedFlowNodes);

    return manualTaskList;
  }

  public async getManualTasksForCorrelation(identity: IIdentity, correlationId: string): Promise<ManualTaskList> {
    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const manualTaskList: ManualTaskList = await this._manualTaskConverter.convert(identity, suspendedFlowNodes);

    return manualTaskList;
  }

  public async getManualTasksForProcessModelInCorrelation(identity: IIdentity,
                                                          processModelId: string,
                                                          correlationId: string): Promise<ManualTaskList> {

    const suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedProcessModelFlowNodes: Array<Runtime.Types.FlowNodeInstance> =
      suspendedFlowNodes.filter((flowNodeInstance: Runtime.Types.FlowNodeInstance) => {
        return flowNodeInstance.tokens[0].processModelId === processModelId;
      });

    const manualTaskList: ManualTaskList =
      await this._manualTaskConverter.convert(identity, suspendedProcessModelFlowNodes);

    return manualTaskList;
  }

  public async getWaitingManualTasksByIdentity(identity: IIdentity): Promise<ManualTaskList> {

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByState(Runtime.Types.FlowNodeInstanceState.suspended);

    const flowNodeInstancesOwnedByUser: Array<Runtime.Types.FlowNodeInstance> =
      suspendedFlowNodeInstances.filter((flowNodeInstance: Runtime.Types.FlowNodeInstance): boolean => {
        return this._checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
      });

    const manualTaskList: ManualTaskList =
      await this._manualTaskConverter.convert(identity, flowNodeInstancesOwnedByUser);

    return manualTaskList;
  }

  public async finishManualTask(identity: IIdentity,
                                processInstanceId: string,
                                correlationId: string,
                                manualTaskInstanceId: string): Promise<void> {

    const matchingFlowNodeInstance: ManualTask =
      await this._getSuspendedManualTask(identity, correlationId, processInstanceId, manualTaskInstanceId);

    return new Promise<void>((resolve: Function, reject: Function): void => {
      const routePrameter: {[name: string]: string} = Messages.EventAggregatorSettings.messageParams;

      const manualTaskFinishedEvent: string = Messages.EventAggregatorSettings
          .messagePaths.manualTaskWithInstanceIdFinished
          .replace(routePrameter.correlationId, correlationId)
          .replace(routePrameter.processInstanceId, processInstanceId)
          .replace(routePrameter.flowNodeInstanceId, manualTaskInstanceId);

      this._eventAggregator.subscribeOnce(manualTaskFinishedEvent, (message: Messages.Internal.SystemEvents.ManualTaskFinishedMessage) => {
        resolve();
      });

      const finishManualTaskMessage: Messages.Internal.SystemEvents.FinishManualTaskMessage =
        new Messages.Internal.SystemEvents.FinishManualTaskMessage(
          matchingFlowNodeInstance.correlationId,
          matchingFlowNodeInstance.processModelId,
          matchingFlowNodeInstance.processInstanceId,
          matchingFlowNodeInstance.id,
          matchingFlowNodeInstance.flowNodeInstanceId,
          identity,
          matchingFlowNodeInstance.tokenPayload,
        );

      const finishManualTaskEvent: string = Messages.EventAggregatorSettings
          .messagePaths.finishManualTask
          .replace(routePrameter.correlationId, correlationId)
          .replace(routePrameter.processInstanceId, processInstanceId)
          .replace(routePrameter.flowNodeInstanceId, manualTaskInstanceId);

      this._eventAggregator.publish(finishManualTaskEvent, finishManualTaskMessage);
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

  private _isFlowNodeAnEvent(flowNodeInstance: Runtime.Types.FlowNodeInstance): boolean {
    const flowNodeIsEvent: boolean = flowNodeInstance.eventType !== undefined &&
                                     flowNodeInstance.eventType !== null;

    return flowNodeIsEvent;
  }

  private async _getSuspendedUserTask(
    identity: IIdentity,
    correlationId: string,
    processInstanceId: string,
    userTaskInstanceId: string,
  ): Promise<UserTask> {

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const userTaskList: UserTaskList =
      await this._userTaskConverter.convertUserTasks(identity, suspendedFlowNodeInstances);

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

  private async _getSuspendedManualTask(
    identity: IIdentity,
    correlationId: string,
    processInstanceId: string,
    manualTaskInstanceId: string,
  ): Promise<ManualTask> {

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const manualTaskList: ManualTaskList =
      await this._manualTaskConverter.convert(identity, suspendedFlowNodeInstances);

    const matchingManualTask: ManualTask =
    manualTaskList.manualTasks.find((manualTask: ManualTask): boolean => {
        return manualTask.flowNodeInstanceId === manualTaskInstanceId
          && manualTask.processInstanceId === processInstanceId;
      });

    const noMatchingManualTaskFound: boolean = matchingManualTask === undefined;
    if (noMatchingManualTaskFound) {
      const errorMessage: string =
        `ProcessInstance '${processInstanceId}' in Correlation '${correlationId}' does not have a ManualTask with id '${manualTaskInstanceId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    return matchingManualTask;
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

  private async _sendUserTaskResultToProcessEngine(identity: IIdentity, userTaskInstance: UserTask, userTaskResult: any): Promise<void> {

    const finishUserTaskMessage: Messages.Internal.SystemEvents.FinishUserTaskMessage =
      new Messages.Internal.SystemEvents.FinishUserTaskMessage(
        userTaskResult,
        userTaskInstance.correlationId,
        userTaskInstance.processModelId,
        userTaskInstance.processInstanceId,
        userTaskInstance.id,
        userTaskInstance.flowNodeInstanceId,
        identity,
        userTaskInstance.tokenPayload,
      );

    const finishUserTaskEvent: string = Messages.EventAggregatorSettings.messagePaths.finishUserTask
      .replace(Messages.EventAggregatorSettings.messageParams.correlationId, userTaskInstance.correlationId)
      .replace(Messages.EventAggregatorSettings.messageParams.processInstanceId, userTaskInstance.processInstanceId)
      .replace(Messages.EventAggregatorSettings.messageParams.flowNodeInstanceId, userTaskInstance.flowNodeInstanceId);

    this._eventAggregator.publish(finishUserTaskEvent, finishUserTaskMessage);
  }

  private _checkIfIdentityUserIDsMatch(identityA: IIdentity, identityB: IIdentity): boolean {

    const decodedRequestingIdentity: TokenBody = <TokenBody> jsonwebtoken.decode(identityA.token);
    const decodedUserTaskIdentity: TokenBody = <TokenBody> jsonwebtoken.decode(identityB.token);

    return decodedRequestingIdentity.sub === decodedUserTaskIdentity.sub;
  }
}
