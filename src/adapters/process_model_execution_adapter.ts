import {
  EndEventReachedMessage,
  IExecuteProcessService,
  IExecutionContextFacade,
  IProcessModelPersistenceRepository,
  IProcessModelPersistenceService,
  Model,
} from '@process-engine/process_engine_contracts';

import {ProcessStartRequestPayload, ProcessStartResponsePayload, StartCallbackType} from '@process-engine/consumer_api_contracts';

import * as uuid from 'uuid';

import {IFactoryAsync, InvocationContainer} from 'addict-ioc';

import {IamServiceMock} from './iam_service_mock';

export interface IProcessModelExecutionAdapter {
  startProcessInstance(executionContextFacade: IExecutionContextFacade,
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

  private _container: InvocationContainer;
  private _executeProcessService: IExecuteProcessService;
  private _processModelPersistenceService: IProcessModelPersistenceService;
  private _processModelPersistenceServiceFactory: IFactoryAsync<IProcessModelPersistenceService>;

  constructor(container: InvocationContainer,
              executeProcessService: IExecuteProcessService,
              processModelPersistenceServiceFactory: IFactoryAsync<IProcessModelPersistenceService>) {

    this._container = container;
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

    const processModelPeristanceRepository: IProcessModelPersistenceRepository =
      await this._container.resolveAsync<IProcessModelPersistenceRepository>('ProcessModelPersistenceRepository');

    const iamServiceMock: IamServiceMock = new IamServiceMock();

    this._processModelPersistenceService = await this._processModelPersistenceServiceFactory([processModelPeristanceRepository, iamServiceMock]);
  }

  public async startProcessInstance(executionContextFacade: IExecutionContextFacade,
                                    processModelId: string,
                                    startEventId: string,
                                    payload: ProcessStartRequestPayload,
                                    startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceCreated,
                                    endEventId?: string): Promise<ProcessStartResponsePayload> {

    const correlationId: string = payload.correlationId || uuid.v4();

    // Uses the mock IAM facade with the processModelPersistenceService => The process model will always be complete.
    const processModel: Model.Types.Process = await this.processModelPersistenceService.getProcessModelById(executionContextFacade, processModelId);

    const response: ProcessStartResponsePayload = await this._startProcessInstance(executionContextFacade,
                                                                                   correlationId,
                                                                                   processModel,
                                                                                   startEventId,
                                                                                   payload,
                                                                                   startCallbackType,
                                                                                   endEventId);

    return response;
  }

  private async _startProcessInstance(executionContextFacade: IExecutionContextFacade,
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
      this.executeProcessService.start(executionContextFacade, processModel, startEventId, correlationId, payload.inputValues);

      return response;
    }

    let endEventReachedMessage: EndEventReachedMessage;

    // Start the process instance and wait for a specific end event result
    const resolveAfterReachingSpecificEndEvent: boolean = startCallbackType === StartCallbackType.CallbackOnEndEventReached;
    if (resolveAfterReachingSpecificEndEvent) {
      endEventReachedMessage = await this.executeProcessService.startAndAwaitSpecificEndEvent(executionContextFacade,
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
    endEventReachedMessage = await this.executeProcessService.startAndAwaitEndEvent(executionContextFacade,
                                                                                    processModel,
                                                                                    startEventId,
                                                                                    correlationId,
                                                                                    payload.inputValues);

    response.endEventId = endEventReachedMessage.endEventId;
    response.tokenPayload = endEventReachedMessage.tokenPayload;

    return response;
  }
}
