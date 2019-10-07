import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {APIs, DataModels, Messages} from '@process-engine/consumer_api_contracts';
import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  IFlowNodeInstanceService,
} from '@process-engine/persistence_api.contracts';
import {FinishUserTaskMessage as InternalFinishUserTaskMessage} from '@process-engine/process_engine_contracts';

import {NotificationAdapter} from './adapters/index';
import {UserTaskConverter} from './converters/index';
import {applyPagination} from './paginator';

export class UserTaskService implements APIs.IUserTaskConsumerApi {

  private readonly eventAggregator: IEventAggregator;
  private readonly flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly iamService: IIAMService;

  private readonly notificationAdapter: NotificationAdapter;

  private readonly userTaskConverter: UserTaskConverter;

  private readonly canSubscribeToEventsClaim = 'can_subscribe_to_events';

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeInstanceService: IFlowNodeInstanceService,
    iamService: IIAMService,
    notificationAdapter: NotificationAdapter,
    userTaskConverter: UserTaskConverter,
  ) {
    this.eventAggregator = eventAggregator;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.iamService = iamService;

    this.notificationAdapter = notificationAdapter;

    this.userTaskConverter = userTaskConverter;
  }

  public async onUserTaskWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskWaitingCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onUserTaskWaiting(identity, callback, subscribeOnce);
  }

  public async onUserTaskFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskFinishedCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onUserTaskFinished(identity, callback, subscribeOnce);
  }

  public async onUserTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskWaitingCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onUserTaskForIdentityWaiting(identity, callback, subscribeOnce);
  }

  public async onUserTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskFinishedCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onUserTaskForIdentityFinished(identity, callback, subscribeOnce);
  }

  public async removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    this.notificationAdapter.removeSubscription(subscription);
  }

  public async getUserTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);

    userTaskList.userTasks = applyPagination(userTaskList.userTasks, offset, limit);

    return userTaskList;
  }

  public async getUserTasksForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByProcessInstance(processInstanceId);

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);

    userTaskList.userTasks = applyPagination(userTaskList.userTasks, offset, limit);

    return userTaskList;
  }

  public async getUserTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);

    userTaskList.userTasks = applyPagination(userTaskList.userTasks, offset, limit);

    return userTaskList;
  }

  public async getUserTasksForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.UserTasks.UserTaskList> {

    const flowNodeInstances = await this.flowNodeInstanceService.queryActiveByCorrelationAndProcessModel(correlationId, processModelId);

    const suspendedFlowNodeInstances = flowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
      return flowNodeInstance.state === FlowNodeInstanceState.suspended;
    });

    const noSuspendedFlowNodesFound = !suspendedFlowNodeInstances || suspendedFlowNodeInstances.length === 0;
    if (noSuspendedFlowNodesFound) {
      return <DataModels.UserTasks.UserTaskList> {
        userTasks: [],
      };
    }

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodeInstances);

    userTaskList.userTasks = applyPagination(userTaskList.userTasks, offset, limit);

    return userTaskList;
  }

  public async getWaitingUserTasksByIdentity(
    identity: IIdentity,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.queryByState(FlowNodeInstanceState.suspended);

    const flowNodeInstancesOwnedByUser = suspendedFlowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
      return this.checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
    });

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, flowNodeInstancesOwnedByUser);

    userTaskList.userTasks = applyPagination(userTaskList.userTasks, offset, limit);

    return userTaskList;
  }

  public async finishUserTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    userTaskInstanceId: string,
    userTaskResult?: DataModels.UserTasks.UserTaskResult,
  ): Promise<void> {

    const resultForProcessEngine = this.createUserTaskResultForProcessEngine(userTaskResult);

    const matchingFlowNodeInstance =
      await this.getFlowNodeInstanceForCorrelationInProcessInstance(correlationId, processInstanceId, userTaskInstanceId);

    const noMatchingInstanceFound = matchingFlowNodeInstance === undefined;
    if (noMatchingInstanceFound) {
      const errorMessage =
        `ProcessInstance '${processInstanceId}' in Correlation '${correlationId}' does not have a UserTask with id '${userTaskInstanceId}'`;
      throw new EssentialProjectErrors.NotFoundError(errorMessage);
    }

    const convertedUserTaskList = await this.userTaskConverter.convertUserTasks(identity, [matchingFlowNodeInstance]);

    const matchingUserTask = convertedUserTaskList.userTasks[0];

    return new Promise<void>((resolve: Function): void => {

      const userTaskFinishedEvent = Messages.EventAggregatorSettings.messagePaths.userTaskWithInstanceIdFinished
        .replace(Messages.EventAggregatorSettings.messageParams.correlationId, correlationId)
        .replace(Messages.EventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
        .replace(Messages.EventAggregatorSettings.messageParams.flowNodeInstanceId, userTaskInstanceId);

      this.eventAggregator.subscribeOnce(userTaskFinishedEvent, (): void => {
        resolve();
      });

      this.publishFinishUserTaskEvent(identity, matchingUserTask, resultForProcessEngine);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createUserTaskResultForProcessEngine(finishedTask: DataModels.UserTasks.UserTaskResult): any {

    const noResultsProvided = !finishedTask || !finishedTask.formFields;

    if (noResultsProvided) {
      return {};
    }

    const formFieldResultIsNotAnObject = typeof finishedTask !== 'object'
      || typeof finishedTask.formFields !== 'object'
      || Array.isArray(finishedTask.formFields);

    if (formFieldResultIsNotAnObject) {
      throw new EssentialProjectErrors.BadRequestError('The UserTask\'s FormFields are not an object.');
    }

    return finishedTask.formFields;
  }

  private checkIfIdentityUserIDsMatch(identityA: IIdentity, identityB: IIdentity): boolean {
    return identityA.userId === identityB.userId;
  }

  private publishFinishUserTaskEvent(
    identity: IIdentity,
    userTaskInstance: DataModels.UserTasks.UserTask,
    userTaskResult: DataModels.UserTasks.UserTaskResult,
  ): void {

    const finishUserTaskMessage = new InternalFinishUserTaskMessage(
      userTaskResult,
      userTaskInstance.correlationId,
      userTaskInstance.processModelId,
      userTaskInstance.processInstanceId,
      userTaskInstance.id,
      userTaskInstance.flowNodeInstanceId,
      identity,
      userTaskInstance.tokenPayload,
    );

    const finishUserTaskEvent = Messages.EventAggregatorSettings.messagePaths.finishUserTask
      .replace(Messages.EventAggregatorSettings.messageParams.correlationId, userTaskInstance.correlationId)
      .replace(Messages.EventAggregatorSettings.messageParams.processInstanceId, userTaskInstance.processInstanceId)
      .replace(Messages.EventAggregatorSettings.messageParams.flowNodeInstanceId, userTaskInstance.flowNodeInstanceId);

    this.eventAggregator.publish(finishUserTaskEvent, finishUserTaskMessage);
  }

}
