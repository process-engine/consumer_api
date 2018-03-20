import {
  IConsumerApiService,
  IConsumerContext,
  IEventList,
  IEventTriggerPayload,
  IProcessModel,
  IProcessModelList,
  IProcessStartRequestPayload,
  IProcessStartResponsePayload,
  IUserTaskList,
  IUserTaskResult,
  ProcessStartReturnOnOptions,
} from '@process-engine/consumer_api_contracts';

import {ExecutionContext, IIamService, IPrivateQueryOptions} from '@essential-projects/core_contracts';
import {IDatastoreService, IEntityCollection, IEntityType} from '@essential-projects/data_model_contracts';
import {IProcessEngineService} from '@process-engine/process_engine_contracts';

export class ConsumerApiService implements IConsumerApiService {
  public config: any = undefined;

  private _processEngineService: IProcessEngineService;
  private _iamService: IIamService;
  private _datastoreService: IDatastoreService;

  constructor(datastoreService: IDatastoreService,
              iamService: IIamService,
              processEngineService: IProcessEngineService) {

    this._datastoreService = datastoreService;
    this._iamService = iamService;
    this._processEngineService = processEngineService;
  }

  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }

  private get processEngineService(): IProcessEngineService {
    return this._processEngineService;
  }

  // TODO: Replace mocks

  // Process models
  public async getProcessModels(context: IConsumerContext): Promise<IProcessModelList> {

    const mockData: IProcessModelList = {
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      process_models: [{
        key: 'mock_process_model',
        startEvents: [{
          key: 'startEvent_1',
          id: '',
          process_instance_id: '',
          data: {},
        }],
      }],
    };

    return Promise.resolve(mockData);
  }

  public async getProcessModelByKey(context: IConsumerContext, processModelKey: string): Promise<IProcessModel> {

    const mockData: IProcessModel = {
      key: 'mock_process_model',
      startEvents: [{
        key: 'startEvent_1',
        id: '',
        process_instance_id: '',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async startProcess(context: IConsumerContext,
                            processModelKey: string,
                            startEventKey: string,
                            payload: IProcessStartRequestPayload,
                            returnOn: ProcessStartReturnOnOptions): Promise<IProcessStartResponsePayload> {

    const mockResponse: IProcessStartResponsePayload = {
      correlation_id: payload.correlation_id || 'mocked-correlation-id',
    };

    return Promise.resolve(mockResponse);
  }

  public async startProcessAndAwaitEndEvent(context: IConsumerContext,
                                            processModelKey: string,
                                            startEventKey: string,
                                            endEventKey: string,
                                            payload: IProcessStartRequestPayload): Promise<IProcessStartResponsePayload> {

    const mockResponse: IProcessStartResponsePayload = {
      correlation_id: payload.correlation_id || 'mocked-correlation-id',
    };

    return Promise.resolve(mockResponse);
  }

  // Events
  public async getEventsForProcessModel(context: IConsumerContext, processModelKey: string): Promise<IEventList> {

    const mockData: IEventList = {
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      events: [{
        key: 'startEvent_1',
        id: '',
        process_instance_id: '',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async getEventsForCorrelation(context: IConsumerContext, correlationId: string): Promise<IEventList> {

    const mockData: IEventList = {
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      events: [{
        key: 'startEvent_1',
        id: '',
        process_instance_id: '',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async getEventsForProcessModelInCorrelation(context: IConsumerContext, processModelKey: string, correlationId: string): Promise<IEventList> {

    const mockData: IEventList = {
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      events: [{
        key: 'startEvent_1',
        id: '',
        process_instance_id: '',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async triggerEvent(context: IConsumerContext,
                            processModelKey: string,
                            correlationId: string,
                            eventId: string,
                            eventTriggerPayload?: IEventTriggerPayload): Promise<void> {
    return Promise.resolve();
  }

  // UserTasks
  public async getUserTasksForProcessModel(context: IConsumerContext, processModelKey: string): Promise<IUserTaskList> {

    const mockData: IUserTaskList = {
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      user_tasks: [{
        key: 'mock_user_task',
        id: '123',
        process_instance_id: '123412534124535',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async getUserTasksForCorrelation(context: IConsumerContext, correlationId: string): Promise<IUserTaskList> {

    const mockData: IUserTaskList = {
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      user_tasks: [{
        key: 'mock_user_task',
        id: '123',
        process_instance_id: '123412534124535',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async getUserTasksForProcessModelInCorrelation(context: IConsumerContext,
                                                        processModelKey: string,
                                                        correlationId: string): Promise<IUserTaskList> {

    const mockData: IUserTaskList = {
      page_number: 0,
      page_size: 30,
      element_count: 0,
      page_count: 0,
      user_tasks: [{
        key: 'mock_user_task',
        id: '123',
        process_instance_id: '123412534124535',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async finishUserTask(context: IConsumerContext,
                              processModelKey: string,
                              correlationId: string,
                              userTaskId: string,
                              userTaskResult: IUserTaskResult): Promise<void> {
    return Promise.resolve();
  }
}
