import * as uuid from 'node-uuid';

import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {APIs, DataModels, Messages} from '@process-engine/consumer_api_contracts';
import {
  BpmnType,
  FlowNodeInstance,
  IFlowNodeInstanceService,
  ProcessToken,
  ProcessTokenType,
} from '@process-engine/flow_node_instance.contracts';
import {
  EndEventReachedMessage,
  IExecuteProcessService,
  IProcessModelFacadeFactory,
  ProcessStartedMessage,
} from '@process-engine/process_engine_contracts';
import {IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import {NotificationAdapter} from './adapters/index';
import {ProcessModelConverter} from './converters/index';

export class ProcessModelService implements APIs.IProcessModelConsumerApi {

  private readonly executeProcessService: IExecuteProcessService;
  private readonly flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly iamService: IIAMService;
  private readonly processModelFacadeFactory: IProcessModelFacadeFactory;
  private readonly processModelUseCase: IProcessModelUseCases;

  private readonly notificationAdapter: NotificationAdapter;

  private readonly processModelConverter: ProcessModelConverter;

  private readonly canSubscribeToEventsClaim = 'can_subscribe_to_events';

  constructor(
    executeProcessService: IExecuteProcessService,
    flowNodeInstanceService: IFlowNodeInstanceService,
    iamService: IIAMService,
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processModelUseCase: IProcessModelUseCases,
    notificationAdapter: NotificationAdapter,
    processModelConverter: ProcessModelConverter,
  ) {
    this.executeProcessService = executeProcessService;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.iamService = iamService;
    this.processModelFacadeFactory = processModelFacadeFactory;
    this.processModelUseCase = processModelUseCase;

    this.notificationAdapter = notificationAdapter;

    this.processModelConverter = processModelConverter;
  }

  public async onProcessStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onProcessStarted(identity, callback, subscribeOnce);
  }

  public async onProcessWithProcessModelIdStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    processModelId: string,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onProcessWithProcessModelIdStarted(identity, callback, processModelId, subscribeOnce);
  }

  public async onProcessEnded(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessEndedCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onProcessEnded(identity, callback, subscribeOnce);
  }

  public async onProcessTerminated(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessTerminatedCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onProcessTerminated(identity, callback, subscribeOnce);
  }

  public async onProcessError(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessErrorCallback,
    subscribeOnce = false,
  ): Promise<Subscription> {
    await this.iamService.ensureHasClaim(identity, this.canSubscribeToEventsClaim);

    return this.notificationAdapter.onProcessError(identity, callback, subscribeOnce);
  }

  public async getProcessModels(identity: IIdentity): Promise<DataModels.ProcessModels.ProcessModelList> {

    const processModels = await this.processModelUseCase.getProcessModels(identity);
    const consumerApiProcessModels = processModels.map((processModel: Model.Process): DataModels.ProcessModels.ProcessModel => {
      return this.processModelConverter.convertProcessModel(processModel);
    });

    return {
      processModels: consumerApiProcessModels,
    };
  }

  public async getProcessModelById(identity: IIdentity, processModelId: string): Promise<DataModels.ProcessModels.ProcessModel> {

    const processModel = await this.processModelUseCase.getProcessModelById(identity, processModelId);
    const consumerApiProcessModel = this.processModelConverter.convertProcessModel(processModel);

    return consumerApiProcessModel;
  }

  public async getProcessModelByProcessInstanceId(identity: IIdentity, processInstanceId: string): Promise<DataModels.ProcessModels.ProcessModel> {

    const processModel = await this.processModelUseCase.getProcessModelByProcessInstanceId(identity, processInstanceId);
    const consumerApiProcessModel = this.processModelConverter.convertProcessModel(processModel);

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

    let startCallbackTypeToUse = startCallbackType;

    const useDefaultStartCallbackType: boolean = startCallbackTypeToUse === undefined;
    if (useDefaultStartCallbackType) {
      startCallbackTypeToUse = DataModels.ProcessModels.StartCallbackType.CallbackOnProcessInstanceCreated;
    }

    if (!Object.values(DataModels.ProcessModels.StartCallbackType).includes(startCallbackTypeToUse)) {
      throw new EssentialProjectErrors.BadRequestError(`${startCallbackTypeToUse} is not a valid return option!`);
    }

    const correlationId: string = payload.correlationId || uuid.v4();

    // Execution of the ProcessModel will still be done with the requesting users identity.
    const response: DataModels.ProcessModels.ProcessStartResponsePayload =
      await this.executeProcessInstance(identity, correlationId, processModelId, startEventId, payload, startCallbackTypeToUse, endEventId);

    return response;
  }

  public async getProcessResultForCorrelation(
    identity: IIdentity,
    correlationId: string,
    processModelId: string,
  ): Promise<Array<DataModels.CorrelationResult>> {

    const processModel =
      await this.processModelUseCase.getProcessModelById(identity, processModelId);

    // First retreive all EndEvents the user can access.
    const processModelFacade = this.processModelFacadeFactory.create(processModel);
    const userAccessibleEndEvents = processModelFacade.getEndEvents();

    // Get all FlowNodeInstances that were run in the Correlation.
    const flowNodeInstances = await this.flowNodeInstanceService.queryByCorrelation(correlationId);

    const noResultsFound = !flowNodeInstances || flowNodeInstances.length === 0;
    if (noResultsFound) {
      throw new EssentialProjectErrors.NotFoundError(`No process results for correlation with id '${correlationId}' found.`);
    }

    // Get all EndEvents that were run in the Correlation.
    const endEventInstances = flowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {

      const isEndEvent = flowNodeInstance.flowNodeType === BpmnType.endEvent;
      const isFromProcessModel = flowNodeInstance.processModelId === processModelId;

      // If an onExit token exists, then this FlowNodeInstance was finished.
      const flowNodeInstanceIsFinished = flowNodeInstance.getTokenByType(ProcessTokenType.onExit) !== undefined;

      // Do not include EndEvent Results from CallActivities or Subprocesses.
      const isNotFromSubprocess = !flowNodeInstance.parentProcessInstanceId;

      return isEndEvent
        && isFromProcessModel
        && flowNodeInstanceIsFinished
        && isNotFromSubprocess;
    });

    // Now filter out the EndEvents that the user has no access to.
    const availableEndEvents = endEventInstances.filter((endEventInstance: FlowNodeInstance): boolean => {
      return userAccessibleEndEvents
        .some((accessibleEndEvent: Model.Events.EndEvent): boolean => accessibleEndEvent.id === endEventInstance.flowNodeId);
    });

    // Now extract all results from the available EndEvents.
    const results = availableEndEvents.map(this.createCorrelationResultFromEndEventInstance);

    return results;
  }

  public async getProcessInstancesByIdentity(identity: IIdentity): Promise<Array<DataModels.ProcessInstance>> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.queryActive();

    const flowNodeInstancesOwnedByUser = suspendedFlowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
      return this.checkIfIdentityUserIDsMatch(identity, flowNodeInstance.owner);
    });

    const processInstances = this.getProcessInstancesfromFlowNodeInstances(flowNodeInstancesOwnedByUser);

    return processInstances;
  }

  private async executeProcessInstance(
    identity: IIdentity,
    correlationId: string,
    processModelId: string,
    startEventId: string,
    payload: DataModels.ProcessModels.ProcessStartRequestPayload,
    startCallbackType: DataModels.ProcessModels.StartCallbackType,
    endEventId?: string,
  ): Promise<DataModels.ProcessModels.ProcessStartResponsePayload> {

    const response: DataModels.ProcessModels.ProcessStartResponsePayload = {
      correlationId: correlationId,
      processInstanceId: undefined,
    };

    // Only start the process instance and return
    const resolveImmediatelyAfterStart: boolean = startCallbackType === DataModels.ProcessModels.StartCallbackType.CallbackOnProcessInstanceCreated;
    if (resolveImmediatelyAfterStart) {
      const startResult: ProcessStartedMessage =
        await this.executeProcessService.start(identity, processModelId, correlationId, startEventId, payload.inputValues, payload.callerId);

      response.processInstanceId = startResult.processInstanceId;

      return response;
    }

    let processEndedMessage: EndEventReachedMessage;

    // Start the process instance and wait for a specific end event result
    const resolveAfterReachingSpecificEndEvent: boolean = startCallbackType === DataModels.ProcessModels.StartCallbackType.CallbackOnEndEventReached;
    if (resolveAfterReachingSpecificEndEvent) {

      processEndedMessage = await this
        .executeProcessService
        .startAndAwaitSpecificEndEvent(identity, processModelId, correlationId, endEventId, startEventId, payload.inputValues, payload.callerId);

      response.endEventId = processEndedMessage.flowNodeId;
      response.tokenPayload = processEndedMessage.currentToken;
      response.processInstanceId = processEndedMessage.processInstanceId;

      return response;
    }

    // Start the process instance and wait for the first end event result
    processEndedMessage = await this
      .executeProcessService
      .startAndAwaitEndEvent(identity, processModelId, correlationId, startEventId, payload.inputValues, payload.callerId);

    response.endEventId = processEndedMessage.flowNodeId;
    response.tokenPayload = processEndedMessage.currentToken;
    response.processInstanceId = processEndedMessage.processInstanceId;

    return response;
  }

  private createCorrelationResultFromEndEventInstance(endEventInstance: FlowNodeInstance): DataModels.CorrelationResult {

    const exitToken = endEventInstance.tokens.find((token: ProcessToken): boolean => {
      return token.type === ProcessTokenType.onExit;
    });

    const correlationResult: DataModels.CorrelationResult = {
      correlationId: exitToken.correlationId,
      endEventId: endEventInstance.flowNodeId,
      tokenPayload: exitToken.payload,
    };

    return correlationResult;
  }

  private checkIfIdentityUserIDsMatch(identityA: IIdentity, identityB: IIdentity): boolean {
    return identityA.userId === identityB.userId;
  }

  private getProcessInstancesfromFlowNodeInstances(flowNodeInstances: Array<FlowNodeInstance>): Array<DataModels.ProcessInstance> {

    const activeProcessInstances: Array<DataModels.ProcessInstance> = [];

    for (const flowNodeInstance of flowNodeInstances) {

      const processInstanceListHasNoMatchingEntry =
        !activeProcessInstances.some((entry: DataModels.ProcessInstance): boolean => {
          return entry.id === flowNodeInstance.processInstanceId;
        });

      if (processInstanceListHasNoMatchingEntry) {
        const processInstance = new DataModels.ProcessInstance(
          flowNodeInstance.processInstanceId,
          flowNodeInstance.processModelId,
          flowNodeInstance.correlationId,
          flowNodeInstance.owner,
          flowNodeInstance.parentProcessInstanceId,
        );
        activeProcessInstances.push(processInstance);
      }
    }

    return activeProcessInstances;
  }

}
