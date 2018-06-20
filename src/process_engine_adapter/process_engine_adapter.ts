// tslint:disable:max-file-line-count
import {
  ExecutionContext,
  IIamService,
  TokenType,
} from '@essential-projects/core_contracts';
import {
  ConsumerContext,
  Event as ConsumerApiEvent,
  EventList as ConsumerApiEventList,
  EventTriggerPayload,
  IConsumerApiService,
  ProcessModel as ConsumerApiProcessModel,
  ProcessModelList as ConsumerApiProcessModelList,
} from '@process-engine/consumer_api_contracts';
import {
  IErrorDeserializer,
} from '@process-engine/process_engine_contracts';

import {
  BaseError,
} from '@essential-projects/errors_ts';
import {ConsumerApiIamService} from './consumer_api_iam_service';

import {Logger} from 'loggerhythm';

const logger: Logger = Logger.createLogger('consumer_api_core')
                             .createChildLogger('process_engine_adapter');

export class ConsumerApiProcessEngineAdapter {
  public config: any = undefined;

  private _consumerApiIamService: ConsumerApiIamService;
  private _errorDeserializer: IErrorDeserializer;

  constructor(consumerApiIamService: ConsumerApiIamService) {
    this._consumerApiIamService = consumerApiIamService;
  }

  private get consumerApiIamService(): ConsumerApiIamService {
    return this._consumerApiIamService;
  }

  private get errorDeserializer(): IErrorDeserializer {
    return this._errorDeserializer;
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
}
