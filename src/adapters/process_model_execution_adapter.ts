import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/consumer_api_contracts';
import {
  EndEventReachedMessage,
  IExecuteProcessService,
  ProcessStartedMessage,
} from '@process-engine/process_engine_contracts';
import {IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import * as uuid from 'node-uuid';

export interface IProcessModelExecutionAdapter {
  startProcessInstance(
    identity: IIdentity,
    processModelId: string,
    startEventId: string,
    payload: DataModels.ProcessModels.ProcessStartRequestPayload,
    startCallbackType: DataModels.ProcessModels.StartCallbackType,
    endEventId?: string,
  ): Promise<DataModels.ProcessModels.ProcessStartResponsePayload>;
}

// Note: When running processes, we need to pass full process model to the ExecuteProcessService.
// Right now, this can only be achieved, if all claim checks against the ProcessModel API pass, regardless of who makes the request.
// To that end, this adapter - and this adapter ONLY! - will have to make use of the dummy token we currently have in place.
export class ProcessModelExecutionAdapter implements IProcessModelExecutionAdapter {

  private readonly _executeProcessService: IExecuteProcessService;
  private readonly _identityService: IIdentityService;
  private readonly _processModelUseCase: IProcessModelUseCases;

  private _internalIdentity: IIdentity;

  constructor(executeProcessService: IExecuteProcessService, identityService: IIdentityService, processModelUseCase: IProcessModelUseCases) {
    this._executeProcessService = executeProcessService;
    this._identityService = identityService;
    this._processModelUseCase = processModelUseCase;
  }

  public async initialize(): Promise<void> {
    const dummyToken: string = 'ZHVtbXlfdG9rZW4=';
    this._internalIdentity = await this._identityService.getIdentity(dummyToken);
  }

  public async startProcessInstance(
    identity: IIdentity,
    processModelId: string,
    startEventId: string,
    payload: DataModels.ProcessModels.ProcessStartRequestPayload,
    startCallbackType: DataModels.ProcessModels.StartCallbackType,
    endEventId?: string,
  ): Promise<DataModels.ProcessModels.ProcessStartResponsePayload> {

    const correlationId: string = payload.correlationId || uuid.v4();

    // We use the internal identity here to ensure the ProcessModel will be complete.
    const processModel: Model.Types.Process = await this._processModelUseCase.getProcessModelById(this._internalIdentity, processModelId);

    // Execution of the ProcessModel will still be done with the requesting users identity.
    const response: DataModels.ProcessModels.ProcessStartResponsePayload =
      await this._startProcessInstance(identity, correlationId, processModel, startEventId, payload, startCallbackType, endEventId);

    return response;
  }

  private async _startProcessInstance(
    identity: IIdentity,
    correlationId: string,
    processModel: Model.Types.Process,
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
        await this._executeProcessService.start(identity, processModel, startEventId, correlationId, payload.inputValues, payload.callerId);

      response.processInstanceId = startResult.processInstanceId;

      return response;
    }

    let processEndedMessage: EndEventReachedMessage;

    // Start the process instance and wait for a specific end event result
    const resolveAfterReachingSpecificEndEvent: boolean = startCallbackType === DataModels.ProcessModels.StartCallbackType.CallbackOnEndEventReached;
    if (resolveAfterReachingSpecificEndEvent) {

      processEndedMessage = await this
        ._executeProcessService
        .startAndAwaitSpecificEndEvent(identity, processModel, startEventId, correlationId, endEventId, payload.inputValues, payload.callerId);

      response.endEventId = processEndedMessage.flowNodeId;
      response.tokenPayload = processEndedMessage.currentToken;
      response.processInstanceId = processEndedMessage.processInstanceId;

      return response;
    }

    // Start the process instance and wait for the first end event result
    processEndedMessage = await this
      ._executeProcessService
      .startAndAwaitEndEvent(identity, processModel, startEventId, correlationId, payload.inputValues, payload.callerId);

    response.endEventId = processEndedMessage.flowNodeId;
    response.tokenPayload = processEndedMessage.currentToken;
    response.processInstanceId = processEndedMessage.processInstanceId;

    return response;
  }
}
