import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {APIs, DataModels, Messages} from '@process-engine/consumer_api_contracts';
import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  IFlowNodeInstanceService,
} from '@process-engine/persistence_api.contracts';
import {FinishEmptyActivityMessage as InternalFinishEmptyActivityMessage} from '@process-engine/process_engine_contracts';

import {NotificationAdapter} from './adapters/index';
import {EmptyActivityConverter} from './converters/index';
import {applyPagination} from './paginator';

export class EmptyActivityService implements APIs.IEmptyActivityConsumerApi {

  private readonly eventAggregator: IEventAggregator;
  private readonly flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly iamService: IIAMService;

  private readonly notificationAdapter: NotificationAdapter;

  private readonly emptyActivityConverter: EmptyActivityConverter;

  private readonly canSubscribeToEventsClaim = 'can_subscribe_to_events';

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeInstanceService: IFlowNodeInstanceService,
    iamService: IIAMService,
    notificationAdapter: NotificationAdapter,
    emptyActivityConverter: EmptyActivityConverter,
  ) {
    this.eventAggregator = eventAggregator;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.iamService = iamService;

    this.notificationAdapter = notificationAdapter;

    this.emptyActivityConverter = emptyActivityConverter;
  }

  public async onEmptyActivityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityWaitingCallback,
    subscribeOnce?: boolean,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onEmptyActivityWaiting(identity, callback, subscribeOnce);
  }

  public async onEmptyActivityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityFinishedCallback,
    subscribeOnce?: boolean,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onEmptyActivityFinished(identity, callback, subscribeOnce);
  }

  public async onEmptyActivityForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityWaitingCallback,
    subscribeOnce?: boolean,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onEmptyActivityForIdentityWaiting(identity, callback, subscribeOnce);
  }

  public async onEmptyActivityForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityFinishedCallback,
    subscribeOnce?: boolean,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onEmptyActivityForIdentityFinished(identity, callback, subscribeOnce);
  }

  public async getEmptyActivitiesForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const emptyActivityList = await this.emptyActivityConverter.convert(identity, suspendedFlowNodes);

    // TODO: Remove that useless `EmptyActivityList` datatype and just return an Array of EmptyActivities.
    // Goes for the other UseCases as well.
    emptyActivityList.emptyActivities = applyPagination(emptyActivityList.emptyActivities, offset, limit);

    return emptyActivityList;
  }

  public async getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByProcessInstance(processInstanceId);

    const emptyActivityList = await this.emptyActivityConverter.convert(identity, suspendedFlowNodes);

    emptyActivityList.emptyActivities = applyPagination(emptyActivityList.emptyActivities, offset, limit);

    return emptyActivityList;
  }

  public async getEmptyActivitiesForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const emptyActivityList = await this.emptyActivityConverter.convert(identity, suspendedFlowNodes);

    emptyActivityList.emptyActivities = applyPagination(emptyActivityList.emptyActivities, offset, limit);

    return emptyActivityList;
  }

  public async getEmptyActivitiesForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedProcessModelFlowNodes = suspendedFlowNodes.filter((flowNodeInstance: FlowNodeInstance): boolean => {
      return flowNodeInstance.tokens[0].processModelId === processModelId;
    });

    const emptyActivityList = await this.emptyActivityConverter.convert(identity, suspendedProcessModelFlowNodes);

    emptyActivityList.emptyActivities = applyPagination(emptyActivityList.emptyActivities, offset, limit);

    return emptyActivityList;
  }

  public async getWaitingEmptyActivitiesByIdentity(
    identity: IIdentity,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.queryByState(FlowNodeInstanceState.suspended);

    const flowNodeInstancesOwnedByUser = suspendedFlowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
      return this.checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
    });

    const emptyActivityList = await this.emptyActivityConverter.convert(identity, flowNodeInstancesOwnedByUser);

    emptyActivityList.emptyActivities = applyPagination(emptyActivityList.emptyActivities, offset, limit);

    return emptyActivityList;
  }

  public async finishEmptyActivity(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    emptyActivityInstanceId: string,
  ): Promise<void> {

    const matchingFlowNodeInstance =
      await this.getFlowNodeInstanceForCorrelationInProcessInstance(correlationId, processInstanceId, emptyActivityInstanceId);

    const noMatchingInstanceFound = matchingFlowNodeInstance === undefined;
    if (noMatchingInstanceFound) {
      const errorMessage =
        // eslint-disable-next-line max-len
        `ProcessInstance '${processInstanceId}' in Correlation '${correlationId}' does not have an EmptyActivity with id '${emptyActivityInstanceId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    const convertedEmptyActivityList = await this.emptyActivityConverter.convert(identity, [matchingFlowNodeInstance]);

    const matchingEmptyActivity = convertedEmptyActivityList.emptyActivities[0];

    return new Promise<void>((resolve: Function): void => {
      const routePrameter: {[name: string]: string} = Messages.EventAggregatorSettings.messageParams;

      const emptyActivityFinishedEvent = Messages.EventAggregatorSettings
        .messagePaths.emptyActivityWithInstanceIdFinished
        .replace(routePrameter.correlationId, correlationId)
        .replace(routePrameter.processInstanceId, processInstanceId)
        .replace(routePrameter.flowNodeInstanceId, emptyActivityInstanceId);

      this.eventAggregator.subscribeOnce(emptyActivityFinishedEvent, (): void => {
        resolve();
      });

      this.publishFinishEmptyActivityEvent(identity, matchingEmptyActivity);
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

  private publishFinishEmptyActivityEvent(
    identity: IIdentity,
    emptyActivityInstance: DataModels.EmptyActivities.EmptyActivity,
  ): void {

    const finishEmptyActivityMessage = new InternalFinishEmptyActivityMessage(
      emptyActivityInstance.correlationId,
      emptyActivityInstance.processModelId,
      emptyActivityInstance.processInstanceId,
      emptyActivityInstance.id,
      emptyActivityInstance.flowNodeInstanceId,
      identity,
      emptyActivityInstance.tokenPayload,
    );

    const finishEmptyActivityEvent = Messages.EventAggregatorSettings.messagePaths.finishEmptyActivity
      .replace(Messages.EventAggregatorSettings.messageParams.correlationId, emptyActivityInstance.correlationId)
      .replace(Messages.EventAggregatorSettings.messageParams.processInstanceId, emptyActivityInstance.processInstanceId)
      .replace(Messages.EventAggregatorSettings.messageParams.flowNodeInstanceId, emptyActivityInstance.flowNodeInstanceId);

    this.eventAggregator.publish(finishEmptyActivityEvent, finishEmptyActivityMessage);
  }

}
