import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/consumer_api_contracts';
import {
  EndEventReachedMessage,
  IExecuteProcessService,
  ProcessStartedMessage,
} from '@process-engine/process_engine_contracts';

import * as uuid from 'node-uuid';

export interface IProcessModelExecutionAdapter {
  startProcessInstance(identity: IIdentity,
                       processModelId: string,
                       payload: DataModels.ProcessModels.ProcessStartRequestPayload,
                       startCallbackType: DataModels.ProcessModels.StartCallbackType,
                       startEventId?: string,
                       endEventId?: string): Promise<DataModels.ProcessModels.ProcessStartResponsePayload>;
}

export class ProcessModelExecutionAdapter implements IProcessModelExecutionAdapter {

  private readonly _executeProcessService: IExecuteProcessService;

  constructor(executeProcessService: IExecuteProcessService) {
    this._executeProcessService = executeProcessService;
  }

  public async startProcessInstance(
    identity: IIdentity,
    processModelId: string,
    payload: DataModels.ProcessModels.ProcessStartRequestPayload,
    startCallbackType: DataModels.ProcessModels.StartCallbackType,
    startEventId?: string,
    endEventId?: string,
  ): Promise<DataModels.ProcessModels.ProcessStartResponsePayload> {

    const useDefaultStartCallbackType: boolean = startCallbackType === undefined;
    if (useDefaultStartCallbackType) {
      startCallbackType = DataModels.ProcessModels.StartCallbackType.CallbackOnProcessInstanceCreated;
    }

    if (!Object.values(DataModels.ProcessModels.StartCallbackType).includes(startCallbackType)) {
      throw new EssentialProjectErrors.BadRequestError(`${startCallbackType} is not a valid return option!`);
    }

    const correlationId: string = payload.correlationId || uuid.v4();

    // Execution of the ProcessModel will still be done with the requesting users identity.
    const response: DataModels.ProcessModels.ProcessStartResponsePayload =
      await this._startProcessInstance(identity, correlationId, processModelId, startEventId, payload, startCallbackType, endEventId);

    return response;
  }

  private async _startProcessInstance(
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
        await this._executeProcessService.start(identity, processModelId, correlationId, startEventId, payload.inputValues, payload.callerId);

      response.processInstanceId = startResult.processInstanceId;

      return response;
    }

    let processEndedMessage: EndEventReachedMessage;

    // Start the process instance and wait for a specific end event result
    const resolveAfterReachingSpecificEndEvent: boolean = startCallbackType === DataModels.ProcessModels.StartCallbackType.CallbackOnEndEventReached;
    if (resolveAfterReachingSpecificEndEvent) {

      processEndedMessage = await this
        ._executeProcessService
        .startAndAwaitSpecificEndEvent(identity, processModelId, correlationId, endEventId, startEventId, payload.inputValues, payload.callerId);

      response.endEventId = processEndedMessage.flowNodeId;
      response.tokenPayload = processEndedMessage.currentToken;
      response.processInstanceId = processEndedMessage.processInstanceId;

      return response;
    }

    // Start the process instance and wait for the first end event result
    processEndedMessage = await this
      ._executeProcessService
      .startAndAwaitEndEvent(identity, processModelId, correlationId, startEventId, payload.inputValues, payload.callerId);

    response.endEventId = processEndedMessage.flowNodeId;
    response.tokenPayload = processEndedMessage.currentToken;
    response.processInstanceId = processEndedMessage.processInstanceId;

    return response;
  }
}
