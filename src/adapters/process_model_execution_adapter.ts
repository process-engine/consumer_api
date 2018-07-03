import {ExecutionContext} from '@essential-projects/core_contracts';
import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {
  EndEventReachedMessage,
  IExecuteProcessService,
  IExecutionContextFacade,
  IProcessModelPersistenceService,
  Model,
} from '@process-engine/process_engine_contracts';

import {ProcessStartRequestPayload, ProcessStartResponsePayload, StartCallbackType} from '@process-engine/consumer_api_contracts';

import * as uuid from 'uuid';

import {IFactoryAsync} from 'addict-ioc';

import {IamFacadeMock} from './iam_facade_mock';

export interface IProcessModelExecutionAdapter {
  startProcessInstance(executionContextFacade: IExecutionContextFacade,
                       processModelId: string,
                       startEventId: string,
                       payload: ProcessStartRequestPayload,
                       startCallbackType: StartCallbackType,
                       endEventId?: string): Promise<ProcessStartResponsePayload>;
}

// NOTE: When running processes, we need to pass full process model to the ExecuteProcessService. This can only be done,
// if all claim checks against the persistence service pass. To that end, this adapter - and this adapter ONLY! -
// will have to use a mock for the IAM facade, until the consumer api is able to authenticate itself against the external authority.
export class ProcessModelExecutionAdapter implements IProcessModelExecutionAdapter {

  private _executeProcessService: IExecuteProcessService;
  private _processModelPersistenceService: IProcessModelPersistenceService;
  private _processModelPersistenceServiceFactory: IFactoryAsync<IProcessModelPersistenceService>;

  constructor(executeProcessService: IExecuteProcessService,
              processModelPersistenceServiceFactory: IFactoryAsync<IProcessModelPersistenceService>) {

    this._executeProcessService = executeProcessService;
    this._processModelPersistenceServiceFactory = processModelPersistenceServiceFactory;
  }

  private get executeProcessService(): IExecuteProcessService {
    return this._executeProcessService;
  }

  private get processModelPersistenceService(): IProcessModelPersistenceService {
    return this._processModelPersistenceService;
  }

  public async initialize(): Promise<void> {
    const iamFacadeMock: IamFacadeMock = new IamFacadeMock();
    this._processModelPersistenceService = await this._processModelPersistenceServiceFactory([iamFacadeMock]);
  }

  public async startProcessInstance(executionContextFacade: IExecutionContextFacade,
                                    processModelId: string,
                                    startEventId: string,
                                    payload: ProcessStartRequestPayload,
                                    startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated,
                                    endEventId?: string): Promise<ProcessStartResponsePayload> {

    const correlationId: string = payload.correlationId || uuid.v4();
    const processModel: Model.Types.Process = await this.processModelPersistenceService.getProcessModelById(executionContextFacade, processModelId);

    this._validateStartRequest(processModel, startEventId, endEventId, startCallbackType);

    const response: ProcessStartResponsePayload = await this._startProcessInstance(executionContextFacade,
                                                                                   correlationId,
                                                                                   processModel,
                                                                                   startEventId,
                                                                                   payload,
                                                                                   startCallbackType,
                                                                                   endEventId);

    return response;
  }

  private _validateStartRequest(processModel: Model.Types.Process,
                                startEventId: string,
                                endEventId: string,
                                startCallbackType: StartCallbackType,
                               ): void {

    if (!Object.values(StartCallbackType).includes(startCallbackType)) {
      throw new EssentialProjectErrors.BadRequestError(`${startCallbackType} is not a valid return option!`);
    }

    const hasMatchingStartEvent: boolean = processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
      return flowNode.id === startEventId;
    });

    if (!hasMatchingStartEvent) {
      throw new EssentialProjectErrors.NotFoundError(`StartEvent with ID '${startEventId}' not found!`);
    }

    if (startCallbackType === StartCallbackType.CallbackOnEndEventReached) {

      if (!endEventId) {
        throw new EssentialProjectErrors.BadRequestError(`Must provide an EndEventId, when using callback type 'CallbackOnEndEventReached'!`);
      }

      const hasMatchingEndEvent: boolean = processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.id === endEventId;
      });

      if (!hasMatchingEndEvent) {
        throw new EssentialProjectErrors.NotFoundError(`EndEvent with ID '${startEventId}' not found!`);
      }
    }
  }

  private async _startProcessInstance(executionContextFacade: IExecutionContextFacade,
                                      correlationId: string,
                                      processModel: Model.Types.Process,
                                      startEventId: string,
                                      payload: ProcessStartRequestPayload,
                                      startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated,
                                      endEventId?: string,
                                    ): Promise<ProcessStartResponsePayload> {

    const executionContext: ExecutionContext = executionContextFacade.getExecutionContext();

    const response: ProcessStartResponsePayload = {
      correlationId: correlationId,
    };

    // Only start the process instance and return
    if (startCallbackType === StartCallbackType.CallbackOnProcessInstanceCreated) {
      this.executeProcessService.start(executionContext, processModel, startEventId, correlationId, payload.inputValues);

      return response;
    }

    let endEventReachedMessage: EndEventReachedMessage;

    // Start the process instance and wait for a specific end event result
    if (startCallbackType === StartCallbackType.CallbackOnEndEventReached && endEventId) {
      endEventReachedMessage = await this.executeProcessService.startAndAwaitSpecificEndEvent(executionContext,
                                                                                              processModel,
                                                                                              startEventId,
                                                                                              correlationId,
                                                                                              endEventId,
                                                                                              payload.inputValues);

      response.endEventId = endEventReachedMessage.endEventId;
      response.tokenPayload = endEventReachedMessage.tokenPayload;

      return response;
    }

    // Start the process instance and wait for the first end event result
    endEventReachedMessage
      = await this.executeProcessService.startAndAwaitEndEvent(executionContext, processModel, startEventId, correlationId, payload.inputValues);

    response.endEventId = endEventReachedMessage.endEventId;
    response.tokenPayload = endEventReachedMessage.tokenPayload;

    return response;
  }
}
