import {IIdentity} from '@essential-projects/iam_contracts';

import {
  EndEventReachedMessage,
  IExecuteProcessResult,
  IExecuteProcessService,
  IProcessModelService,
  Model,
} from '@process-engine/process_engine_contracts';

import {ProcessStartRequestPayload, ProcessStartResponsePayload, StartCallbackType} from '@process-engine/consumer_api_contracts';

import * as uuid from 'uuid';

import {IamServiceMock} from './iam_service_mock';

export interface IProcessModelExecutionAdapter {
  startProcessInstance(identity: IIdentity,
                       processModelId: string,
                       startEventId: string,
                       payload: ProcessStartRequestPayload,
                       startCallbackType: StartCallbackType,
                       endEventId?: string): Promise<ProcessStartResponsePayload>;
}

// TODO: When running processes, we need to pass full process model to the ExecuteProcessService.
// Right now, this can only be achieved, if all claim checks against the persistence service pass, regardless of who makes the request.
// To that end, this adapter - and this adapter ONLY! - will have to use a mock for the IAM facade,
// until the consumer api is able to authenticate itself against the external authority.
export class ProcessModelExecutionAdapter implements IProcessModelExecutionAdapter {

  private _executeProcessService: IExecuteProcessService;
  private _processModelService: IProcessModelService;

  constructor(executeProcessService: IExecuteProcessService,
              processModelService: IProcessModelService) {

    this._executeProcessService = executeProcessService;
    this._processModelService = processModelService;
  }

  private get executeProcessService(): IExecuteProcessService {
    return this._executeProcessService;
  }

  private get processModelService(): IProcessModelService {
    return this._processModelService;
  }

  public async initialize(): Promise<void> {

    const iamServiceMock: IamServiceMock = new IamServiceMock();
    (this._processModelService as any)._iamService = iamServiceMock;
  }

  public async startProcessInstance(identity: IIdentity,
                                    processModelId: string,
                                    startEventId: string,
                                    payload: ProcessStartRequestPayload,
                                    startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated,
                                    endEventId?: string): Promise<ProcessStartResponsePayload> {

    const correlationId: string = payload.correlationId || uuid.v4();

    // Uses the mock IAM facade with the processModelService => The process model will always be complete.
    const processModel: Model.Types.Process = await this.processModelService.getProcessModelById(identity, processModelId);

    const response: ProcessStartResponsePayload = await this._startProcessInstance(identity,
                                                                                   correlationId,
                                                                                   processModel,
                                                                                   startEventId,
                                                                                   payload,
                                                                                   startCallbackType,
                                                                                   endEventId);

    return response;
  }

  private async _startProcessInstance(identity: IIdentity,
                                      correlationId: string,
                                      processModel: Model.Types.Process,
                                      startEventId: string,
                                      payload: ProcessStartRequestPayload,
                                      startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated,
                                      endEventId?: string,
                                    ): Promise<ProcessStartResponsePayload> {

    const response: ProcessStartResponsePayload = {
      correlationId: correlationId,
    };

    // Only start the process instance and return
    const resolveImmediatelyAfterStart: boolean = startCallbackType === StartCallbackType.CallbackOnProcessInstanceCreated;
    if (resolveImmediatelyAfterStart) {
      const startResult: IExecuteProcessResult = await this.executeProcessService.start(identity,
                                                                                        processModel,
                                                                                        startEventId,
                                                                                        correlationId,
                                                                                        payload.inputValues,
                                                                                        payload.callerId);

      response.processInstanceId = startResult.processInstanceId;

      return response;
    }

    let processEndedMessage: EndEventReachedMessage;

    // Start the process instance and wait for a specific end event result
    const resolveAfterReachingSpecificEndEvent: boolean = startCallbackType === StartCallbackType.CallbackOnEndEventReached;
    if (resolveAfterReachingSpecificEndEvent) {

      processEndedMessage = await this
        .executeProcessService
        .startAndAwaitSpecificEndEvent(identity, processModel, startEventId, correlationId, endEventId, payload.inputValues, payload.callerId);

      response.endEventId = processEndedMessage.flowNodeId;
      response.tokenPayload = processEndedMessage.currentToken;

      return response;
    }

    // Start the process instance and wait for the first end event result
    processEndedMessage = await this
      .executeProcessService
      .startAndAwaitEndEvent(identity, processModel, startEventId, correlationId, payload.inputValues, payload.callerId);

    response.endEventId = processEndedMessage.flowNodeId;
    response.tokenPayload = processEndedMessage.currentToken;

    return response;
  }
}
