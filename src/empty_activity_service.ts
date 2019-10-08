import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {APIs, DataModels, Messages} from '@process-engine/consumer_api_contracts';
import {
  BpmnType,
  FlowNodeInstance,
  FlowNodeInstanceState,
  ICorrelationService,
  IFlowNodeInstanceService,
  IProcessModelUseCases,
  Model,
  ProcessTokenType,
} from '@process-engine/persistence_api.contracts';
import {
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  FinishEmptyActivityMessage as InternalFinishEmptyActivityMessage,
} from '@process-engine/process_engine_contracts';

import {NotificationAdapter} from './adapters/index';
import {applyPagination} from './paginator';

import * as ProcessModelCache from './converters/process_model_cache';

export class EmptyActivityService implements APIs.IEmptyActivityConsumerApi {

  private readonly correlationService: ICorrelationService;
  private readonly eventAggregator: IEventAggregator;
  private readonly flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly iamService: IIAMService;
  private readonly processModelUseCase: IProcessModelUseCases;
  private readonly processModelFacadeFactory: IProcessModelFacadeFactory;

  private readonly notificationAdapter: NotificationAdapter;

  private readonly canSubscribeToEventsClaim = 'can_subscribe_to_events';

  constructor(
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    flowNodeInstanceService: IFlowNodeInstanceService,
    iamService: IIAMService,
    notificationAdapter: NotificationAdapter,
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processModelUseCase: IProcessModelUseCases,
  ) {
    this.correlationService = correlationService;
    this.eventAggregator = eventAggregator;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.iamService = iamService;
    this.notificationAdapter = notificationAdapter;
    this.processModelFacadeFactory = processModelFacadeFactory;
    this.processModelUseCase = processModelUseCase;
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

    const emptyActivities = suspendedFlowNodes.filter(this.checkIfIsFlowNodeIsEmptyActivity);

    const emptyActivityList = await this.convertToEmptyActivity(identity, emptyActivities);

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

    const emptyActivities = suspendedFlowNodes.filter(this.checkIfIsFlowNodeIsEmptyActivity);

    const emptyActivityList = await this.convertToEmptyActivity(identity, emptyActivities);

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

    const emptyActivities = suspendedFlowNodes.filter(this.checkIfIsFlowNodeIsEmptyActivity);

    const emptyActivityList = await this.convertToEmptyActivity(identity, emptyActivities);

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
      const isEmptyActivity = this.checkIfIsFlowNodeIsEmptyActivity(flowNodeInstance);
      const belongsToProcessModel = flowNodeInstance.tokens[0].processModelId === processModelId;
      return isEmptyActivity && belongsToProcessModel;
    });

    const emptyActivityList = await this.convertToEmptyActivity(identity, suspendedProcessModelFlowNodes);

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
      const isEmptyActivity = this.checkIfIsFlowNodeIsEmptyActivity(flowNodeInstance);
      const userIdsMatch = this.checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
      return isEmptyActivity && userIdsMatch;
    });

    const emptyActivityList = await this.convertToEmptyActivity(identity, flowNodeInstancesOwnedByUser);

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

    if (matchingFlowNodeInstance === undefined) {
      const errorMessage =
        // eslint-disable-next-line max-len
        `ProcessInstance '${processInstanceId}' in Correlation '${correlationId}' does not have an EmptyActivity with id '${emptyActivityInstanceId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    const convertedEmptyActivityList = await this.convertToEmptyActivity(identity, [matchingFlowNodeInstance]);

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

  private checkIfIsFlowNodeIsEmptyActivity(flowNodeInstance: FlowNodeInstance): boolean {
    return flowNodeInstance.flowNodeType !== BpmnType.emptyActivity;
  }

  private checkIfIdentityUserIDsMatch(identityA: IIdentity, identityB: IIdentity): boolean {
    return identityA.userId === identityB.userId;
  }

  private async convertToEmptyActivity(
    identity: IIdentity,
    suspendedFlowNodes: Array<FlowNodeInstance>,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedEmptyActivities: Array<DataModels.EmptyActivities.EmptyActivity> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {
      const processModelFacade = await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);

      const emptyActivity = await this.convertSuspendedFlowNodeToEmptyActivity(suspendedFlowNode, processModelFacade);

      suspendedEmptyActivities.push(emptyActivity);
    }

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = {
      emptyActivities: suspendedEmptyActivities,
      totalCount: suspendedEmptyActivities.length,
    };

    return emptyActivityList;
  }

  private async getProcessModelForFlowNodeInstance(
    identity: IIdentity,
    flowNodeInstance: FlowNodeInstance,
  ): Promise<IProcessModelFacade> {

    let processModel: Model.Process;

    // We must store the ProcessModel for each user, to account for lane-restrictions.
    // Some users may not be able to see some lanes that are visible to others.
    const cacheKeyToUse = `${flowNodeInstance.processInstanceId}-${identity.userId}`;

    const cacheHasMatchingEntry = ProcessModelCache.hasEntry(cacheKeyToUse);
    if (cacheHasMatchingEntry) {
      processModel = ProcessModelCache.get(cacheKeyToUse);
    } else {
      const processModelHash = await this.getProcessModelHashForProcessInstance(identity, flowNodeInstance.processInstanceId);
      processModel = await this.processModelUseCase.getByHash(identity, flowNodeInstance.processModelId, processModelHash);
      ProcessModelCache.add(cacheKeyToUse, processModel);
    }

    const processModelFacade = this.processModelFacadeFactory.create(processModel);

    return processModelFacade;
  }

  private async getProcessModelHashForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<string> {
    const processInstance = await this.correlationService.getByProcessInstanceId(identity, processInstanceId);

    return processInstance.hash;
  }

  private async convertSuspendedFlowNodeToEmptyActivity(
    emptyActivityInstance: FlowNodeInstance,
    processModelFacade: IProcessModelFacade,
  ): Promise<DataModels.EmptyActivities.EmptyActivity> {

    const emptyActivityModel = processModelFacade.getFlowNodeById(emptyActivityInstance.flowNodeId);

    const onSuspendToken = emptyActivityInstance.getTokenByType(ProcessTokenType.onSuspend);

    const consumerApiEmptyActivity: DataModels.EmptyActivities.EmptyActivity = {
      flowNodeType: BpmnType.emptyActivity,
      id: emptyActivityInstance.flowNodeId,
      flowNodeInstanceId: emptyActivityInstance.id,
      name: emptyActivityModel.name,
      correlationId: emptyActivityInstance.correlationId,
      processModelId: emptyActivityInstance.processModelId,
      processInstanceId: emptyActivityInstance.processInstanceId,
      tokenPayload: onSuspendToken.payload,
    };

    return consumerApiEmptyActivity;

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
