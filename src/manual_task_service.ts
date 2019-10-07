import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {APIs, DataModels, Messages} from '@process-engine/consumer_api_contracts';
import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  IFlowNodeInstanceService,
} from '@process-engine/persistence_api.contracts';
import {FinishManualTaskMessage as InternalFinishManualTaskMessage} from '@process-engine/process_engine_contracts';

import {NotificationAdapter} from './adapters/index';
import {ManualTaskConverter} from './converters/index';
import {applyPagination} from './paginator';

export class ManualTaskService implements APIs.IManualTaskConsumerApi {

  private readonly eventAggregator: IEventAggregator;
  private readonly flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly iamService: IIAMService;

  private readonly notificationAdapter: NotificationAdapter;

  private readonly manualTaskConverter: ManualTaskConverter;

  private readonly canSubscribeToEventsClaim = 'can_subscribe_to_events';

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeInstanceService: IFlowNodeInstanceService,
    iamService: IIAMService,
    notificationAdapter: NotificationAdapter,
    manualTaskConverter: ManualTaskConverter,
  ) {
    this.eventAggregator = eventAggregator;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.iamService = iamService;

    this.notificationAdapter = notificationAdapter;

    this.manualTaskConverter = manualTaskConverter;
  }

  public async onManualTaskWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onManualTaskWaiting(identity, callback, subscribeOnce);
  }

  public async onManualTaskFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onManualTaskFinished(identity, callback, subscribeOnce);
  }

  public async onManualTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onManualTaskForIdentityWaiting(identity, callback, subscribeOnce);
  }

  public async onManualTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onManualTaskForIdentityFinished(identity, callback, subscribeOnce);
  }

  public async getManualTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const manualTaskList = await this.manualTaskConverter.convert(identity, suspendedFlowNodes);

    // TODO: Remove that useless `ManualTaskList` datatype and just return an Array of ManualTasks.
    // Goes for the other UseCases as well.
    manualTaskList.manualTasks = applyPagination(manualTaskList.manualTasks, offset, limit);

    return manualTaskList;
  }

  public async getManualTasksForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByProcessInstance(processInstanceId);

    const manualTaskList = await this.manualTaskConverter.convert(identity, suspendedFlowNodes);

    manualTaskList.manualTasks = applyPagination(manualTaskList.manualTasks, offset, limit);

    return manualTaskList;
  }

  public async getManualTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const manualTaskList = await this.manualTaskConverter.convert(identity, suspendedFlowNodes);

    manualTaskList.manualTasks = applyPagination(manualTaskList.manualTasks, offset, limit);

    return manualTaskList;
  }

  public async getManualTasksForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {

    const flowNodeInstances = await this.flowNodeInstanceService.queryActiveByCorrelationAndProcessModel(correlationId, processModelId);

    const suspendedFlowNodeInstances = flowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
      return flowNodeInstance.state === FlowNodeInstanceState.suspended;
    });

    const manualTaskList = await this.manualTaskConverter.convert(identity, suspendedFlowNodeInstances);

    manualTaskList.manualTasks = applyPagination(manualTaskList.manualTasks, offset, limit);

    return manualTaskList;
  }

  public async getWaitingManualTasksByIdentity(
    identity: IIdentity,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.queryByState(FlowNodeInstanceState.suspended);

    const flowNodeInstancesOwnedByUser = suspendedFlowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
      return this.checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
    });

    const manualTaskList = await this.manualTaskConverter.convert(identity, flowNodeInstancesOwnedByUser);

    manualTaskList.manualTasks = applyPagination(manualTaskList.manualTasks, offset, limit);

    return manualTaskList;
  }

  public async finishManualTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    manualTaskInstanceId: string,
  ): Promise<void> {

    const matchingFlowNodeInstance =
      await this.getFlowNodeInstanceForCorrelationInProcessInstance(correlationId, processInstanceId, manualTaskInstanceId);

    const noMatchingInstanceFound = matchingFlowNodeInstance === undefined;
    if (noMatchingInstanceFound) {
      const errorMessage =
        `ProcessInstance '${processInstanceId}' in Correlation '${correlationId}' does not have a ManualTask with id '${manualTaskInstanceId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    const convertedUserTaskList = await this.manualTaskConverter.convert(identity, [matchingFlowNodeInstance]);

    const matchingManualTask = convertedUserTaskList.manualTasks[0];

    return new Promise<void>((resolve: Function): void => {
      const routePrameter: {[name: string]: string} = Messages.EventAggregatorSettings.messageParams;

      const manualTaskFinishedEvent = Messages.EventAggregatorSettings
        .messagePaths.manualTaskWithInstanceIdFinished
        .replace(routePrameter.correlationId, correlationId)
        .replace(routePrameter.processInstanceId, processInstanceId)
        .replace(routePrameter.flowNodeInstanceId, manualTaskInstanceId);

      this.eventAggregator.subscribeOnce(manualTaskFinishedEvent, (): void => {
        resolve();
      });

      this.publishFinishManualTaskEvent(identity, matchingManualTask);
    });
  }

  private async getFlowNodeInstanceForCorrelationInProcessInstance(
    correlationId: string,
    processInstanceId: string,
    instanceId: string,
  ): Promise<FlowNodeInstance> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.querySuspendedByProcessInstance(processInstanceId);

    const matchingInstance = suspendedFlowNodeInstances.find((instance: FlowNodeInstance): boolean => {
      return instance.id === instanceId &&
             instance.correlationId === correlationId;
    });

    return matchingInstance;
  }

  private checkIfIdentityUserIDsMatch(identityA: IIdentity, identityB: IIdentity): boolean {
    return identityA.userId === identityB.userId;
  }

  private publishFinishManualTaskEvent(
    identity: IIdentity,
    manualTaskInstance: DataModels.ManualTasks.ManualTask,
  ): void {

    // ManualTasks do not produce results.
    const emptyPayload = {};
    const finishManualTaskMessage = new InternalFinishManualTaskMessage(
      manualTaskInstance.correlationId,
      manualTaskInstance.processModelId,
      manualTaskInstance.processInstanceId,
      manualTaskInstance.id,
      manualTaskInstance.flowNodeInstanceId,
      identity,
      emptyPayload,
    );

    const finishManualTaskEvent = Messages.EventAggregatorSettings.messagePaths.finishManualTask
      .replace(Messages.EventAggregatorSettings.messageParams.correlationId, manualTaskInstance.correlationId)
      .replace(Messages.EventAggregatorSettings.messageParams.processInstanceId, manualTaskInstance.processInstanceId)
      .replace(Messages.EventAggregatorSettings.messageParams.flowNodeInstanceId, manualTaskInstance.flowNodeInstanceId);

    this.eventAggregator.publish(finishManualTaskEvent, finishManualTaskMessage);
  }

}
