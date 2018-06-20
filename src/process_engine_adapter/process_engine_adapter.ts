// tslint:disable:max-file-line-count
import {
  ConsumerContext,
  Event as ConsumerApiEvent,
  EventList as ConsumerApiEventList,
  EventTriggerPayload,
  IConsumerApiService,
  ICorrelationResult,
  ProcessModel as ConsumerApiProcessModel,
  ProcessModelList as ConsumerApiProcessModelList,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
  UserTask,
  UserTaskConfig,
  UserTaskFormField,
  UserTaskList,
  UserTaskResult,
} from '@process-engine/consumer_api_contracts';

import {
  ExecutionContext,
  IIamService,
  IIdentity,
  IPrivateQueryOptions,
  IPublicGetOptions,
  IQueryClause,
  TokenType,
} from '@essential-projects/core_contracts';
import {IDatastoreService, IEntityCollection, IEntityType} from '@essential-projects/data_model_contracts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IDataMessage, IMessageBusService, IMessageSubscription} from '@essential-projects/messagebus_contracts';
import {
  BpmnType,
  IEndEventEntity,
  IErrorDeserializer,
  INodeDefEntity,
  INodeInstanceEntity,
  INodeInstanceEntityTypeService,
  IProcessDefEntity,
  IProcessEngineService,
  IProcessEntity,
  IProcessTokenEntity,
  IStartEventEntity,
  IUserTaskEntity,
  IUserTaskMessageData,
  IFlowNodeInstancePersistance,
  IProcessModelPersistance,
  Model,
} from '@process-engine/process_engine_contracts';

import {
  BadRequestError,
  BaseError,
  ForbiddenError,
  InternalServerError,
  isError,
  NotFoundError,
  UnprocessableEntityError,
} from '@essential-projects/errors_ts';
import * as BpmnModdle from 'bpmn-moddle';
import {MessageAction, NodeDefFormField} from './process_engine_adapter_interfaces';

import {IBpmnModdle, IDefinition, IModdleElement} from './bpmnmodeler/index';
import {ConsumerApiIamService} from './consumer_api_iam_service';

import {Logger} from 'loggerhythm';

import * as uuid from 'uuid';

const logger: Logger = Logger.createLogger('consumer_api_core')
                             .createChildLogger('process_engine_adapter');

export class ConsumerApiProcessEngineAdapter implements IConsumerApiService {
  public config: any = undefined;

  private _consumerApiIamService: ConsumerApiIamService;
  private _processEngineService: IProcessEngineService;
  private _iamService: IIamService;
  private _datastoreService: IDatastoreService;
  private _nodeInstanceEntityTypeService: INodeInstanceEntityTypeService;
  private _messageBusService: IMessageBusService;
  private _errorDeserializer: IErrorDeserializer;
  private _eventAggregator: IEventAggregator;
  private _processModelPersistance: IProcessModelPersistance;
  private _flowNodeInstancePersistance: IFlowNodeInstancePersistance;

  constructor(consumerApiIamService: ConsumerApiIamService,
              datastoreService: IDatastoreService,
              eventAggregator: IEventAggregator,
              iamService: IIamService,
              messageBusService: IMessageBusService,
              nodeInstanceEntityTypeService: INodeInstanceEntityTypeService,
              processEngineService: IProcessEngineService,
              processModelPersistance: IProcessModelPersistance,
              flowNodeInstancePersistance: IFlowNodeInstancePersistance) {

    this._consumerApiIamService = consumerApiIamService;
    this._datastoreService = datastoreService;
    this._eventAggregator = eventAggregator;
    this._iamService = iamService;
    this._messageBusService = messageBusService;
    this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
    this._processEngineService = processEngineService;
    this._processModelPersistance = processModelPersistance;
    this._flowNodeInstancePersistance = flowNodeInstancePersistance;
  }

  private get consumerApiIamService(): ConsumerApiIamService {
    return this._consumerApiIamService;
  }

  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }

  private get errorDeserializer(): IErrorDeserializer {
    return this._errorDeserializer;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  }

  private get nodeInstanceEntityTypeService(): INodeInstanceEntityTypeService {
    return this._nodeInstanceEntityTypeService;
  }

  private get processEngineIamService(): IIamService {
    return this._iamService;
  }

  private get processEngineService(): IProcessEngineService {
    return this._processEngineService;
  }

  private get processModelPersistance(): IProcessModelPersistance {
    return this._processModelPersistance;
  }

  private get flowNodeInstancePersistance(): IFlowNodeInstancePersistance {
    return this._flowNodeInstancePersistance;
  }

  public async initialize(): Promise<void> {
    this._initializeDefaultErrorDeserializer();

    return Promise.resolve();
  }

  private _initializeDefaultErrorDeserializer(): void {
    const defaultDeserializer: IErrorDeserializer = (serializedError: string): Error => {

      if (typeof serializedError !== 'string') {
        return serializedError;
      }

      try {
        return BaseError.deserialize(serializedError);
      } catch (error) {
        logger.error('an error occured deserializing this error: ', serializedError);
        throw new Error('an error occured during error deserialization');
      }

    };
    this._errorDeserializer = defaultDeserializer;
  }

  // Events
  public async getEventsForProcessModel(context: ConsumerContext, processModelKey: string): Promise<ConsumerApiEventList> {

    const mockData: ConsumerApiEventList = {
      events: [{
        key: 'startEvent_1',
        id: '',
        processInstanceId: '',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async getEventsForCorrelation(context: ConsumerContext, correlationId: string): Promise<ConsumerApiEventList> {

    const mockData: ConsumerApiEventList = {
      events: [{
        key: 'startEvent_1',
        id: '',
        processInstanceId: '',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async getEventsForProcessModelInCorrelation(context: ConsumerContext,
                                                     processModelKey: string,
                                                     correlationId: string): Promise<ConsumerApiEventList> {

    const mockData: ConsumerApiEventList = {
      events: [{
        key: 'startEvent_1',
        id: '',
        processInstanceId: '',
        data: {},
      }],
    };

    return Promise.resolve(mockData);
  }

  public async triggerEvent(context: ConsumerContext,
                            processModelKey: string,
                            correlationId: string,
                            eventId: string,
                            eventTriggerPayload?: EventTriggerPayload): Promise<void> {
    return Promise.resolve();
  }

  // -------------
  // Process Engine Accessor Functions. Here be dragons. With lasers.
  // -------------

  public createExecutionContextFromConsumerContext(consumerContext: ConsumerContext): Promise<ExecutionContext> {
    return this.processEngineIamService.resolveExecutionContext(consumerContext.identity, TokenType.jwt);
  }

}
