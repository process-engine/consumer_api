// tslint:disable:max-file-line-count
import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IConsumerApi, Messages} from '@process-engine/consumer_api_contracts';
import {
  BpmnType,
  FlowNodeInstance,
  FlowNodeInstanceState,
  IFlowNodeInstanceService,
  ProcessToken,
  ProcessTokenType,
} from '@process-engine/flow_node_instance.contracts';
import {
  EmptyActivityFinishedMessage as InternalEmptyActivityFinishedMessage,
  FinishEmptyActivityMessage as InternalFinishEmptyActivityMessage,
  FinishManualTaskMessage as InternalFinishManualTaskMessage,
  FinishUserTaskMessage as InternalFinishUserTaskMessage,
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  ManualTaskFinishedMessage as InternalManualTaskFinishedMessage,
  UserTaskFinishedMessage as InternalUserTaskFinishedMessage,
} from '@process-engine/process_engine_contracts';
import {IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import {IProcessModelExecutionAdapter, NotificationAdapter} from './adapters/index';
import {
  EmptyActivityConverter,
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
  private readonly _processModelUseCase: IProcessModelUseCases;

  private readonly _notificationAdapter: NotificationAdapter;

  private readonly _emptyActivityConverter: EmptyActivityConverter;
  private readonly _userTaskConverter: UserTaskConverter;
  private readonly _manualTaskConverter: ManualTaskConverter;
  private readonly _processInstanceConverter: ProcessInstanceConverter;
  private readonly _processModelConverter: ProcessModelConverter;

  private readonly _canTriggerMessagesClaim: string = 'can_trigger_messages';
  private readonly _canTriggerSignalsClaim: string = 'can_trigger_signals';
  private readonly _canSubscribeToEventsClaim: string = 'can_subscribe_to_events';

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeInstanceService: IFlowNodeInstanceService,
    iamService: IIAMService,
    processModelExecutionAdapter: IProcessModelExecutionAdapter,
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processModelUseCase: IProcessModelUseCases,
    notificationAdapter: NotificationAdapter,
    emptyActivityConverter: EmptyActivityConverter,
    eventConverter: EventConverter,
    userTaskConverter: UserTaskConverter,
    manualTaskConverter: ManualTaskConverter,
    processInstanceConverter: ProcessInstanceConverter,
    processModelConverter: ProcessModelConverter,
  ) {
    this._eventAggregator = eventAggregator;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._iamService = iamService;
    this._processModelExecutionAdapter = processModelExecutionAdapter;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processModelUseCase = processModelUseCase;

    this._notificationAdapter = notificationAdapter;

    this._emptyActivityConverter = emptyActivityConverter;
    this._eventConverter = eventConverter;
    this._userTaskConverter = userTaskConverter;
    this._manualTaskConverter = manualTaskConverter;
    this._processInstanceConverter = processInstanceConverter;
    this._processModelConverter = processModelConverter;
  }

  // Notifications
  public async onEmptyActivityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityWaitingCallback,
    subscribeOnce?: boolean,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onEmptyActivityWaiting(identity, callback, subscribeOnce);
  }
  public async onEmptyActivityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityFinishedCallback,
    subscribeOnce?: boolean,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onEmptyActivityFinished(identity, callback, subscribeOnce);
  }
  public async onEmptyActivityForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityWaitingCallback,
    subscribeOnce?: boolean,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onEmptyActivityForIdentityWaiting(identity, callback, subscribeOnce);
  }
  public async onEmptyActivityForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityFinishedCallback,
    subscribeOnce?: boolean,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onEmptyActivityForIdentityFinished(identity, callback, subscribeOnce);
  }

  public async onUserTaskWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskWaitingCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onUserTaskWaiting(identity, callback, subscribeOnce);
  }

  public async onUserTaskFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskFinishedCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onUserTaskFinished(identity, callback, subscribeOnce);
  }

  public async onUserTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskWaitingCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onUserTaskForIdentityWaiting(identity, callback, subscribeOnce);
  }

  public async onUserTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskFinishedCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onUserTaskForIdentityFinished(identity, callback, subscribeOnce);
  }

  public async onManualTaskWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onManualTaskWaiting(identity, callback, subscribeOnce);
  }

  public async onManualTaskFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onManualTaskFinished(identity, callback, subscribeOnce);
  }

  public async onManualTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onManualTaskForIdentityWaiting(identity, callback, subscribeOnce);
  }

  public async onManualTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onManualTaskForIdentityFinished(identity, callback, subscribeOnce);
  }

  public async onProcessStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onProcessStarted(identity, callback, subscribeOnce);
  }

  public async onProcessWithProcessModelIdStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    processModelId: string,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onProcessWithProcessModelIdStarted(identity, callback, processModelId, subscribeOnce);
  }

  public async onProcessEnded(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessEndedCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onProcessEnded(identity, callback, subscribeOnce);
  }

  public async onProcessTerminated(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessTerminatedCallback,
    subscribeOnce: boolean = false,
  ): Promise<Subscription> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    return this._notificationAdapter.onProcessTerminated(identity, callback, subscribeOnce);
  }

  public async removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canSubscribeToEventsClaim);

    this._notificationAdapter.removeSubscription(subscription);
  }

  // Process models and instances
  public async getProcessModels(identity: IIdentity): Promise<DataModels.ProcessModels.ProcessModelList> {

    const processModels: Array<Model.Process> = await this._processModelUseCase.getProcessModels(identity);
    const consumerApiProcessModels: Array<DataModels.ProcessModels.ProcessModel> = processModels.map((processModel: Model.Process) => {
      return this._processModelConverter.convertProcessModel(processModel);
    });

    return <DataModels.ProcessModels.ProcessModelList> {
      processModels: consumerApiProcessModels,
    };
  }

  public async getProcessModelById(identity: IIdentity, processModelId: string): Promise<DataModels.ProcessModels.ProcessModel> {

    const processModel: Model.Process = await this._processModelUseCase.getProcessModelById(identity, processModelId);
    const consumerApiProcessModel: DataModels.ProcessModels.ProcessModel = this._processModelConverter.convertProcessModel(processModel);

    return consumerApiProcessModel;
  }

  public async getProcessModelByProcessInstanceId(identity: IIdentity, processInstanceId: string): Promise<DataModels.ProcessModels.ProcessModel> {

    const processModel: Model.Process = await this._processModelUseCase.getProcessModelByProcessInstanceId(identity, processInstanceId);
    const consumerApiProcessModel: DataModels.ProcessModels.ProcessModel = this._processModelConverter.convertProcessModel(processModel);

    return consumerApiProcessModel;
  }

  public async startProcessInstance(
    identity: IIdentity,
    processModelId: string,
    payload: DataModels.ProcessModels.ProcessStartRequestPayload,
    startCallbackType?: DataModels.ProcessModels.StartCallbackType,
    startEventId?: string,
    endEventId?: string,
  ): Promise<DataModels.ProcessModels.ProcessStartResponsePayload> {

    return this
      ._processModelExecutionAdapter
      .startProcessInstance(identity, processModelId, payload, startCallbackType, startEventId, endEventId);
  }

  public async getProcessResultForCorrelation(
    identity: IIdentity,
    correlationId: string,
    processModelId: string,
  ): Promise<Array<DataModels.CorrelationResult>> {

    const processModel: Model.Process =
      await this._processModelUseCase.getProcessModelById(identity, processModelId);

    // First retreive all EndEvents the user can access.
    const processModelFacade: IProcessModelFacade = this._processModelFacadeFactory.create(processModel);
    const userAccessibleEndEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();

    // Get all FlowNodeInstances that were run in the Correlation.
    const flowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByCorrelation(correlationId);

    const noResultsFound: boolean = !flowNodeInstances || flowNodeInstances.length === 0;
    if (noResultsFound) {
      throw new EssentialProjectErrors.NotFoundError(`No process results for correlation with id '${correlationId}' found.`);
    }

    // Get all EndEvents that were run in the Correlation.
    const endEventInstances: Array<FlowNodeInstance>
      = flowNodeInstances.filter((flowNodeInstance: FlowNodeInstance) => {

        const isEndEvent: boolean = flowNodeInstance.flowNodeType === BpmnType.endEvent;
        const isFromProcessModel: boolean = flowNodeInstance.processModelId === processModelId;

        // If an onExit token exists, then this FlowNodeInstance was finished.
        const flowNodeInstanceIsFinished: boolean = flowNodeInstance.getTokenByType(ProcessTokenType.onExit) !== undefined;

        // Do not include EndEvent Results from CallActivities or Subprocesses.
        const isNotFromSubprocess: boolean = !flowNodeInstance.parentProcessInstanceId;

        return isEndEvent
          && isFromProcessModel
          && flowNodeInstanceIsFinished
          && isNotFromSubprocess;
    });

    // Now filter out the EndEvents that the user has no access to.
    const availableEndEvents: Array<FlowNodeInstance> = endEventInstances.filter((endEventInstance: FlowNodeInstance) => {
      return userAccessibleEndEvents.some((accessibleEndEvent: Model.Events.EndEvent) => accessibleEndEvent.id === endEventInstance.flowNodeId);
    });

    // Now extract all results from the available EndEvents.
    const results: Array<DataModels.CorrelationResult> = availableEndEvents.map(this._createCorrelationResultFromEndEventInstance);

    return results;
  }

  public async getProcessInstancesByIdentity(identity: IIdentity): Promise<Array<DataModels.ProcessInstance>> {

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryActive();

    const flowNodeInstancesOwnedByUser: Array<FlowNodeInstance> =
      suspendedFlowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
        return this._checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
      });

    const processInstances: Array<DataModels.ProcessInstance> = this._processInstanceConverter.convertFlowNodeInstances(flowNodeInstancesOwnedByUser);

    return processInstances;
  }

  // Events
  public async getEventsForProcessModel(identity: IIdentity, processModelId: string): Promise<DataModels.Events.EventList> {

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const suspendedEvents: Array<FlowNodeInstance> = suspendedFlowNodeInstances.filter(this._isFlowNodeAnEvent);

    const eventList: DataModels.Events.EventList = await this._eventConverter.convertEvents(identity, suspendedEvents);

    return eventList;
  }

  public async getEventsForCorrelation(identity: IIdentity, correlationId: string): Promise<DataModels.Events.EventList> {

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedEvents: Array<FlowNodeInstance> = suspendedFlowNodeInstances.filter(this._isFlowNodeAnEvent);

    const accessibleEvents: Array<FlowNodeInstance> =
      await Promise.filter(suspendedEvents, async(flowNode: FlowNodeInstance) => {
        try {
          await this._processModelUseCase.getProcessModelById(identity, flowNode.processModelId);

          return true;
        } catch (error) {

          return false;
        }
      });

    const eventList: DataModels.Events.EventList = await this._eventConverter.convertEvents(identity, accessibleEvents);

    return eventList;
  }

  public async getEventsForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
  ): Promise<DataModels.Events.EventList> {

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedEvents: Array<FlowNodeInstance> =
      suspendedFlowNodeInstances.filter((flowNode: FlowNodeInstance) => {

        const flowNodeIsEvent: boolean = this._isFlowNodeAnEvent(flowNode);
        const flowNodeBelongstoCorrelation: boolean = flowNode.processModelId === processModelId;

        return flowNodeIsEvent && flowNodeBelongstoCorrelation;
      });

    const triggerableEvents: DataModels.Events.EventList = await this._eventConverter.convertEvents(identity, suspendedEvents);

    return triggerableEvents;
  }

  public async triggerMessageEvent(identity: IIdentity, messageName: string, payload?: DataModels.Events.EventTriggerPayload): Promise<void> {

    await this._iamService.ensureHasClaim(identity, this._canTriggerMessagesClaim);

    const messageEventName: string = Messages.EventAggregatorSettings.messagePaths.messageEventReached
      .replace(Messages.EventAggregatorSettings.messageParams.messageReference, messageName);

    this._eventAggregator.publish(messageEventName, payload);
  }

  public async triggerSignalEvent(identity: IIdentity, signalName: string, payload?: DataModels.Events.EventTriggerPayload): Promise<void> {

    await this._iamService.ensureHasClaim(identity, this._canTriggerSignalsClaim);

    const signalEventName: string = Messages.EventAggregatorSettings.messagePaths.signalEventReached
      .replace(Messages.EventAggregatorSettings.messageParams.signalReference, signalName);

    this._eventAggregator.publish(signalEventName, payload);
  }

  // EmptyActivities
  public async getEmptyActivitiesForProcessModel(identity: IIdentity, processModelId: string): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this._emptyActivityConverter.convert(identity, suspendedFlowNodes);

    return emptyActivityList;
  }

  public async getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessInstance(processInstanceId);

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this._emptyActivityConverter.convert(identity, suspendedFlowNodes);

    return emptyActivityList;
  }

  public async getEmptyActivitiesForCorrelation(identity: IIdentity, correlationId: string): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this._emptyActivityConverter.convert(identity, suspendedFlowNodes);

    return emptyActivityList;
  }

  public async getEmptyActivitiesForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedProcessModelFlowNodes: Array<FlowNodeInstance> =
      suspendedFlowNodes.filter((flowNodeInstance: FlowNodeInstance) => {
        return flowNodeInstance.tokens[0].processModelId === processModelId;
      });

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList =
      await this._emptyActivityConverter.convert(identity, suspendedProcessModelFlowNodes);

    return emptyActivityList;
  }

  public async getWaitingEmptyActivitiesByIdentity(identity: IIdentity): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByState(FlowNodeInstanceState.suspended);

    const flowNodeInstancesOwnedByUser: Array<FlowNodeInstance> =
      suspendedFlowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
        return this._checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
      });

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList =
      await this._emptyActivityConverter.convert(identity, flowNodeInstancesOwnedByUser);

    return emptyActivityList;
  }

  public async finishEmptyActivity(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    emptyActivityInstanceId: string,
  ): Promise<void> {

    const matchingFlowNodeInstance: FlowNodeInstance =
      await this._getFlowNodeInstanceForCorrelationInProcessInstance(correlationId, processInstanceId, emptyActivityInstanceId);

    const noMatchingInstanceFound: boolean = matchingFlowNodeInstance === undefined;
    if (noMatchingInstanceFound) {
      const errorMessage: string =
        // tslint:disable-next-line:max-line-length
        `ProcessInstance '${processInstanceId}' in Correlation '${correlationId}' does not have an EmptyActivity with id '${emptyActivityInstanceId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    const convertedEmptyActivityList: DataModels.EmptyActivities.EmptyActivityList =
      await this._emptyActivityConverter.convert(identity, [matchingFlowNodeInstance]);

    const matchingEmptyActivity: DataModels.EmptyActivities.EmptyActivity = convertedEmptyActivityList.emptyActivities[0];

    return new Promise<void>((resolve: Function, reject: Function): void => {
      const routePrameter: {[name: string]: string} = Messages.EventAggregatorSettings.messageParams;

      const emptyActivityFinishedEvent: string = Messages.EventAggregatorSettings
          .messagePaths.emptyActivityWithInstanceIdFinished
          .replace(routePrameter.correlationId, correlationId)
          .replace(routePrameter.processInstanceId, processInstanceId)
          .replace(routePrameter.flowNodeInstanceId, emptyActivityInstanceId);

      this._eventAggregator.subscribeOnce(emptyActivityFinishedEvent, (message: InternalEmptyActivityFinishedMessage) => {
        resolve();
      });

      this._publishFinishEmptyActivityEvent(identity, matchingEmptyActivity);
    });
  }

  // ManualTasks
  public async getManualTasksForProcessModel(identity: IIdentity, processModelId: string): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this._manualTaskConverter.convert(identity, suspendedFlowNodes);

    return manualTaskList;
  }

  public async getManualTasksForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessInstance(processInstanceId);

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this._manualTaskConverter.convert(identity, suspendedFlowNodes);

    return manualTaskList;
  }

  public async getManualTasksForCorrelation(identity: IIdentity, correlationId: string): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this._manualTaskConverter.convert(identity, suspendedFlowNodes);

    return manualTaskList;
  }

  public async getManualTasksForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {

    const flowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryActiveByCorrelationAndProcessModel(correlationId, processModelId);

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      flowNodeInstances.filter((flowNodeInstance: FlowNodeInstance) => {
        return flowNodeInstance.state === FlowNodeInstanceState.suspended;
      });

    const manualTaskList: DataModels.ManualTasks.ManualTaskList =
      await this._manualTaskConverter.convert(identity, suspendedFlowNodeInstances);

    return manualTaskList;
  }

  public async getWaitingManualTasksByIdentity(identity: IIdentity): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByState(FlowNodeInstanceState.suspended);

    const flowNodeInstancesOwnedByUser: Array<FlowNodeInstance> =
      suspendedFlowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
        return this._checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
      });

    const manualTaskList: DataModels.ManualTasks.ManualTaskList =
      await this._manualTaskConverter.convert(identity, flowNodeInstancesOwnedByUser);

    return manualTaskList;
  }

  public async finishManualTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    manualTaskInstanceId: string,
  ): Promise<void> {

    const matchingFlowNodeInstance: FlowNodeInstance =
      await this._getFlowNodeInstanceForCorrelationInProcessInstance(correlationId, processInstanceId, manualTaskInstanceId);

    const noMatchingInstanceFound: boolean = matchingFlowNodeInstance === undefined;
    if (noMatchingInstanceFound) {
      const errorMessage: string =
        `ProcessInstance '${processInstanceId}' in Correlation '${correlationId}' does not have a ManualTask with id '${manualTaskInstanceId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    const convertedUserTaskList: DataModels.ManualTasks.ManualTaskList =
      await this._manualTaskConverter.convert(identity, [matchingFlowNodeInstance]);

    const matchingManualTask: DataModels.ManualTasks.ManualTask = convertedUserTaskList.manualTasks[0];

    return new Promise<void>((resolve: Function, reject: Function): void => {
      const routePrameter: {[name: string]: string} = Messages.EventAggregatorSettings.messageParams;

      const manualTaskFinishedEvent: string = Messages.EventAggregatorSettings
          .messagePaths.manualTaskWithInstanceIdFinished
          .replace(routePrameter.correlationId, correlationId)
          .replace(routePrameter.processInstanceId, processInstanceId)
          .replace(routePrameter.flowNodeInstanceId, manualTaskInstanceId);

      this._eventAggregator.subscribeOnce(manualTaskFinishedEvent, (message: InternalManualTaskFinishedMessage) => {
        resolve();
      });

      this._publishFinishManualTaskEvent(identity, matchingManualTask);
    });
  }

  // UserTasks
  public async getUserTasksForProcessModel(identity: IIdentity, processModelId: string): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const userTaskList: DataModels.UserTasks.UserTaskList = await this._userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);

    return userTaskList;
  }

  public async getUserTasksForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessInstance(processInstanceId);

    const userTaskList: DataModels.UserTasks.UserTaskList = await this._userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);

    return userTaskList;
  }

  public async getUserTasksForCorrelation(identity: IIdentity, correlationId: string): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedFlowNodes: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const userTaskList: DataModels.UserTasks.UserTaskList = await this._userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);

    return userTaskList;
  }

  public async getUserTasksForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {

    const flowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryActiveByCorrelationAndProcessModel(correlationId, processModelId);

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      flowNodeInstances.filter((flowNodeInstance: FlowNodeInstance) => {
        return flowNodeInstance.state === FlowNodeInstanceState.suspended;
      });

    const noSuspendedFlowNodesFound: boolean = !suspendedFlowNodeInstances || suspendedFlowNodeInstances.length === 0;
    if (noSuspendedFlowNodesFound) {
      return <DataModels.UserTasks.UserTaskList> {
        userTasks: [],
      };
    }

    const userTaskList: DataModels.UserTasks.UserTaskList =
      await this._userTaskConverter.convertUserTasks(identity, suspendedFlowNodeInstances);

    return userTaskList;
  }

  public async getWaitingUserTasksByIdentity(identity: IIdentity): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByState(FlowNodeInstanceState.suspended);

    const flowNodeInstancesOwnedByUser: Array<FlowNodeInstance> =
      suspendedFlowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
        return this._checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
      });

    const userTaskList: DataModels.UserTasks.UserTaskList =
      await this._userTaskConverter.convertUserTasks(identity, flowNodeInstancesOwnedByUser);

    return userTaskList;
  }

  public async finishUserTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    userTaskInstanceId: string,
    userTaskResult?: DataModels.UserTasks.UserTaskResult,
  ): Promise<void> {

    const resultForProcessEngine: any = this._createUserTaskResultForProcessEngine(userTaskResult);

    const matchingFlowNodeInstance: FlowNodeInstance =
      await this._getFlowNodeInstanceForCorrelationInProcessInstance(correlationId, processInstanceId, userTaskInstanceId);

    const noMatchingInstanceFound: boolean = matchingFlowNodeInstance === undefined;
    if (noMatchingInstanceFound) {
      const errorMessage: string =
        `ProcessInstance '${processInstanceId}' in Correlation '${correlationId}' does not have a UserTask with id '${userTaskInstanceId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    const convertedUserTaskList: DataModels.UserTasks.UserTaskList =
      await this._userTaskConverter.convertUserTasks(identity, [matchingFlowNodeInstance]);

    const matchingUserTask: DataModels.UserTasks.UserTask = convertedUserTaskList.userTasks[0];

    return new Promise<void>((resolve: Function, reject: Function): void => {

      const userTaskFinishedEvent: string = Messages.EventAggregatorSettings.messagePaths.userTaskWithInstanceIdFinished
        .replace(Messages.EventAggregatorSettings.messageParams.correlationId, correlationId)
        .replace(Messages.EventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
        .replace(Messages.EventAggregatorSettings.messageParams.flowNodeInstanceId, userTaskInstanceId);

      this._eventAggregator.subscribeOnce(userTaskFinishedEvent, (message: InternalUserTaskFinishedMessage) => {
        resolve();
      });

      this._publishFinishUserTaskEvent(identity, matchingUserTask, resultForProcessEngine);
    });
  }

  private async _getFlowNodeInstanceForCorrelationInProcessInstance(
    correlationId: string,
    processInstanceId: string,
    instanceId: string,
  ): Promise<FlowNodeInstance> {

    const suspendedFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.querySuspendedByProcessInstance(processInstanceId);

    const matchingInstance: FlowNodeInstance = suspendedFlowNodeInstances.find((instance: FlowNodeInstance) => {
      return instance.id === instanceId &&
             instance.correlationId === correlationId;
    });

    return matchingInstance;
  }

  private _createCorrelationResultFromEndEventInstance(endEventInstance: FlowNodeInstance): DataModels.CorrelationResult {

    const exitToken: ProcessToken = endEventInstance.tokens.find((token: ProcessToken): boolean => {
      return token.type === ProcessTokenType.onExit;
    });

    const correlationResult: DataModels.CorrelationResult = {
      correlationId: exitToken.correlationId,
      endEventId: endEventInstance.flowNodeId,
      tokenPayload: exitToken.payload,
    };

    return correlationResult;
  }

  private _isFlowNodeAnEvent(flowNodeInstance: FlowNodeInstance): boolean {
    const flowNodeIsEvent: boolean = flowNodeInstance.eventType !== undefined &&
                                     flowNodeInstance.eventType !== null;

    return flowNodeIsEvent;
  }

  private _createUserTaskResultForProcessEngine(finishedTask: DataModels.UserTasks.UserTaskResult): any {

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

  private _checkIfIdentityUserIDsMatch(identityA: IIdentity, identityB: IIdentity): boolean {
    return identityA.userId === identityB.userId;
  }

  private _publishFinishEmptyActivityEvent(
    identity: IIdentity,
    emptyActivityInstance: DataModels.EmptyActivities.EmptyActivity,
  ): void {

    const finishEmptyActivityMessage: InternalFinishEmptyActivityMessage =
      new InternalFinishEmptyActivityMessage(
        emptyActivityInstance.correlationId,
        emptyActivityInstance.processModelId,
        emptyActivityInstance.processInstanceId,
        emptyActivityInstance.id,
        emptyActivityInstance.flowNodeInstanceId,
        identity,
        emptyActivityInstance.tokenPayload,
      );

    const finishEmptyActivityEvent: string = Messages.EventAggregatorSettings.messagePaths.finishEmptyActivity
      .replace(Messages.EventAggregatorSettings.messageParams.correlationId, emptyActivityInstance.correlationId)
      .replace(Messages.EventAggregatorSettings.messageParams.processInstanceId, emptyActivityInstance.processInstanceId)
      .replace(Messages.EventAggregatorSettings.messageParams.flowNodeInstanceId, emptyActivityInstance.flowNodeInstanceId);

    this._eventAggregator.publish(finishEmptyActivityEvent, finishEmptyActivityMessage);
  }

  private _publishFinishManualTaskEvent(
    identity: IIdentity,
    manualTaskInstance: DataModels.ManualTasks.ManualTask,
  ): void {

    // ManualTasks do not produce results.
    const emptyPayload: any = {};
    const finishManualTaskMessage: InternalFinishManualTaskMessage =
      new InternalFinishManualTaskMessage(
        manualTaskInstance.correlationId,
        manualTaskInstance.processModelId,
        manualTaskInstance.processInstanceId,
        manualTaskInstance.id,
        manualTaskInstance.flowNodeInstanceId,
        identity,
        emptyPayload,
      );

    const finishManualTaskEvent: string = Messages.EventAggregatorSettings.messagePaths.finishManualTask
      .replace(Messages.EventAggregatorSettings.messageParams.correlationId, manualTaskInstance.correlationId)
      .replace(Messages.EventAggregatorSettings.messageParams.processInstanceId, manualTaskInstance.processInstanceId)
      .replace(Messages.EventAggregatorSettings.messageParams.flowNodeInstanceId, manualTaskInstance.flowNodeInstanceId);

    this._eventAggregator.publish(finishManualTaskEvent, finishManualTaskMessage);
  }

  private _publishFinishUserTaskEvent(
    identity: IIdentity,
    userTaskInstance: DataModels.UserTasks.UserTask,
    userTaskResult: any,
  ): void {

    const finishUserTaskMessage: InternalFinishUserTaskMessage =
      new InternalFinishUserTaskMessage(
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
}
