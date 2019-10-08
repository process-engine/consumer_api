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
  FinishManualTaskMessage as InternalFinishManualTaskMessage,
} from '@process-engine/process_engine_contracts';

import {NotificationAdapter} from './adapters/index';
import {applyPagination} from './paginator';
import * as ProcessModelCache from './process_model_cache';

export class ManualTaskService implements APIs.IManualTaskConsumerApi {

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
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processModelUseCase: IProcessModelUseCases,
    notificationAdapter: NotificationAdapter,
  ) {
    this.correlationService = correlationService;
    this.eventAggregator = eventAggregator;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.iamService = iamService;
    this.processModelFacadeFactory = processModelFacadeFactory;
    this.processModelUseCase = processModelUseCase;

    this.notificationAdapter = notificationAdapter;
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

    const manualTaskList = await this.convertFlowNodeInstancesToManualTasks(identity, suspendedFlowNodes);

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

    const manualTaskList = await this.convertFlowNodeInstancesToManualTasks(identity, suspendedFlowNodes);

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

    const manualTaskList = await this.convertFlowNodeInstancesToManualTasks(identity, suspendedFlowNodes);

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

    const manualTaskList = await this.convertFlowNodeInstancesToManualTasks(identity, suspendedFlowNodeInstances);

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

    const manualTaskList = await this.convertFlowNodeInstancesToManualTasks(identity, flowNodeInstancesOwnedByUser);

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

    const convertedUserTaskList = await this.convertFlowNodeInstancesToManualTasks(identity, [matchingFlowNodeInstance]);

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

  public async convertFlowNodeInstancesToManualTasks(
    identity: IIdentity,
    suspendedFlowNodes: Array<FlowNodeInstance>,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedManualTasks: Array<DataModels.ManualTasks.ManualTask> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      const taskIsNotAManualTask = suspendedFlowNode.flowNodeType !== BpmnType.manualTask;
      if (taskIsNotAManualTask) {
        continue;
      }

      const processModelFacade = await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);

      const manualTask = await this.convertSuspendedFlowNodeToManualTask(suspendedFlowNode, processModelFacade);

      suspendedManualTasks.push(manualTask);
    }

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = {
      manualTasks: suspendedManualTasks,
      totalCount: suspendedManualTasks.length,
    };

    return manualTaskList;
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

  private async convertSuspendedFlowNodeToManualTask(
    manualTaskInstance: FlowNodeInstance,
    processModelFacade: IProcessModelFacade,
  ): Promise<DataModels.ManualTasks.ManualTask> {

    const manualTaskModel = processModelFacade.getFlowNodeById(manualTaskInstance.flowNodeId);

    const onSuspendToken = manualTaskInstance.getTokenByType(ProcessTokenType.onSuspend);

    const consumerApiManualTask: DataModels.ManualTasks.ManualTask = {
      flowNodeType: BpmnType.manualTask,
      id: manualTaskInstance.flowNodeId,
      flowNodeInstanceId: manualTaskInstance.id,
      name: manualTaskModel.name,
      correlationId: manualTaskInstance.correlationId,
      processModelId: manualTaskInstance.processModelId,
      processInstanceId: manualTaskInstance.processInstanceId,
      tokenPayload: onSuspendToken.payload,
    };

    return consumerApiManualTask;

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
