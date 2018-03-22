import {
  IConsumerApiService,
  IConsumerContext,
  IEvent as IConsumerApiEvent,
  IEventList as IConsumerApiEventList,
  IEventTriggerPayload,
  IProcessModel as IConsumerApiProcessModel,
  IProcessModelList as IConsumerApiProcessModelList,
  IProcessStartRequestPayload,
  IProcessStartResponsePayload,
  IUserTaskList,
  IUserTaskResult,
  ProcessStartReturnOnOptions,
} from '@process-engine/consumer_api_contracts';

import {
  CombinedQueryOperatorType,
  ExecutionContext,
  IIamService,
  IPrivateGetOptions,
  IPrivateQueryOptions,
  IQueryClause,
  TokenType,
} from '@essential-projects/core_contracts';
import {IDatastoreService, IEntityCollection, IEntityType} from '@essential-projects/data_model_contracts';
import {
  ILaneEntity,
  IProcessDefEntity,
  IProcessEngineService,
  IStartEventEntity,
  IUserTaskEntity,
  IUserTaskMessageData,
} from '@process-engine/process_engine_contracts';

import {ForbiddenError, NotFoundError} from '@essential-projects/errors_ts';
import {
  FormWidgetFieldType,
  IConfirmWidgetAction,
  IConfirmWidgetConfig,
  IFormWidgetConfig,
  IFormWidgetEnumField,
  IFormWidgetEnumValue,
  IFormWidgetField,
  INodeDefFormField,
  INodeDefFormFieldValue,
  IUserTaskConfig,
  SpecificFormWidgetField,
  UiConfigLayoutElement,
  UserTaskProceedAction,
  WidgetType,
} from './process_engine_adapter_interfaces';

export class ConsumerProcessEngineAdapter implements IConsumerApiService {
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
  public async getProcessModels(context: IConsumerContext): Promise<IConsumerApiProcessModelList> {

    const mockData: IConsumerApiProcessModelList = {
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

  public async getProcessModelByKey(context: IConsumerContext, processModelKey: string): Promise<IConsumerApiProcessModel> {

    const executionContext: ExecutionContext = await this.executionContextFromConsumerContext(context);

    const processDef: IProcessDefEntity = await this._getProcessModelByKey(executionContext, processModelKey);

    const accessibleStartEventEntities: Array<IStartEventEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    const startEventMapper: Function = (startEventEntities: Array<IStartEventEntity>): Array<IConsumerApiEvent> => {
      return startEventEntities.map((startEventEntity: IStartEventEntity): IConsumerApiEvent => {
        const consumerApiStartEvent: IConsumerApiEvent = {
          key: startEventEntity.key,
          id: startEventEntity.id,
          process_instance_id: undefined,
          data: startEventEntity.nodeDef.startContext,
        };

        return consumerApiStartEvent;
      });
    };

    const mappedStartEvents: Array<IConsumerApiEvent> = startEventMapper(accessibleStartEventEntities);

    const processModel: IConsumerApiProcessModel = {
      key: processDef.key,
      startEvents: mappedStartEvents,
    };

    return processModel;
  }

  public async startProcess(context: IConsumerContext,
                            processModelKey: string,
                            startEventKey: string,
                            payload: IProcessStartRequestPayload,
                            returnOn: ProcessStartReturnOnOptions): Promise<IProcessStartResponsePayload> {

    const executionContext: ExecutionContext = await this.executionContextFromConsumerContext(context);

    // Verify that the process model exists
    await this._getProcessModelByKey(executionContext, processModelKey);

    const accessibleStartEventEntities: Array<IStartEventEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    const matchingStartEvent: IStartEventEntity = accessibleStartEventEntities.find((entity: IStartEventEntity): boolean => {
      return entity.key === startEventKey;
    });

    if (!matchingStartEvent) {
      throw new NotFoundError(`Start event ${processModelKey} not found.`);
    }

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

    const executionContext: ExecutionContext = await this.executionContextFromConsumerContext(context);

    // Verify that the process model exists
    await this._getProcessModelByKey(executionContext, processModelKey);

    const accessibleStartEventEntities: Array<IStartEventEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    const matchingStartEvent: IStartEventEntity = accessibleStartEventEntities.find((entity: IStartEventEntity): boolean => {
      return entity.key === startEventKey;
    });

    if (!matchingStartEvent) {
      throw new NotFoundError(`Start event ${processModelKey} not found.`);
    }

    const mockResponse: IProcessStartResponsePayload = {
      correlation_id: payload.correlation_id || 'mocked-correlation-id',
    };

    return Promise.resolve(mockResponse);
  }

  // Events
  public async getEventsForProcessModel(context: IConsumerContext, processModelKey: string): Promise<IConsumerApiEventList> {

    const mockData: IConsumerApiEventList = {
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

  public async getEventsForCorrelation(context: IConsumerContext, correlationId: string): Promise<IConsumerApiEventList> {

    const mockData: IConsumerApiEventList = {
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

  public async getEventsForProcessModelInCorrelation(context: IConsumerContext,
                                                     processModelKey: string,
                                                     correlationId: string): Promise<IConsumerApiEventList> {

    const mockData: IConsumerApiEventList = {
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
    const executionContext: ExecutionContext = await this.executionContextFromConsumerContext(context);

    // this will throw a NotFoundError of it doesn't exist
    const processModel: IConsumerApiProcessModel = await this.getProcessModelByKey(context, processModelKey);

    const accessibleLanes: Array<ILaneEntity> = this.getLanesThatCanBeAccessed(executionContext, processModelKey);

    if (accessibleLanes.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    const userTaskEntityType: IEntityType<IUserTaskEntity> = await this.datastoreService.getEntityType<IUserTaskEntity>('UserTask');

    const query: IPrivateQueryOptions = {
      query: {
        operator: 'and',
        queries: [
          {
            attribute: 'process.processDef.key',
            operator: '=',
            value: processModelKey,
          },
          {
            attribute: 'state',
            operator: '=',
            value: 'wait',
          },
        ],
      },
      expandCollection: [
        {attribute: 'processToken'},
        {
          attribute: 'nodeDef',
          childAttributes: [
            {attribute: 'lane'},
            {attribute: 'extensions'},
          ],
        },
        {
          attribute: 'process',
          childAttributes: [
            {attribute: 'id'},
          ],
        },
      ],
    };

    const userTaskCollection: IEntityCollection<IUserTaskEntity> = await userTaskEntityType.query(executionContext, query);
    const userTasks: Array<IUserTaskEntity> = [];
    await userTaskCollection.each(executionContext, (userTask: IUserTaskEntity) => {
      userTasks.push(userTask);
    });

    const accessibleLaneIds: Array<string> = accessibleLanes.map((lane: ILaneEntity) => {
      return lane.id;
    });

    const resultUserTaskPromises: Array<any> = userTasks.filter(async(userTask: IUserTaskEntity) => {
      return accessibleLaneIds.includes(userTask.nodeDef.lane.id);
    }).map(async(userTask: IUserTaskEntity) => {

      const userTaskData: any = await userTask.getUserTaskData(executionContext);

      return {
        key: userTask.key,
        id: userTask.id,
        process_instance_id: userTask.process.id,
        data: this.getUserTaskConfigFromUserTaskData(userTaskData),
      };
    });

    const result: IUserTaskList = {
      page_number: 1,
      page_size: resultUserTaskPromises.length,
      element_count: resultUserTaskPromises.length,
      page_count: 1,
      user_tasks: await Promise.all(resultUserTaskPromises),
    };

    return result;
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

  private getLanesThatCanBeAccessed(context: ExecutionContext, processModelKey: string): any {
    return;
  }

  private async _getProcessModelByKey(executionContext: ExecutionContext, processModelKey: string): Promise<IProcessDefEntity> {

    const queryOptions: IPrivateQueryOptions = {
      query: {
        attribute: 'key',
        operator: '=',
        value: processModelKey,
      },
    };

    const processDefEntityType: IEntityType<IProcessDefEntity> = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');
    const processDef: IProcessDefEntity = await processDefEntityType.findOne(executionContext, queryOptions);

    if (!processDef) {
      throw new NotFoundError(`Process model with key ${processModelKey} not found.`);
    }

    return processDef;
  }

  private async _getAccessibleStartEvents(executionContext: ExecutionContext, processModelKey: string): Promise<Array<IStartEventEntity>> {

    const startEvents: Array<IStartEventEntity> = await this._getStartEventsForProcessModel(executionContext, processModelKey);
    const accessibleLanes: Array<ILaneEntity> = this.getLanesThatCanBeAccessed(executionContext, processModelKey);

    if (accessibleLanes.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    const accessibleLaneIds: Array<string> = accessibleLanes.map((lane: ILaneEntity) => {
      return lane.id;
    });

    const accessibleStartEventEntities: Array<IStartEventEntity> = startEvents.filter((startEvent: IStartEventEntity) => {
      return accessibleLaneIds.includes(startEvent.nodeDef.lane.id);
    });

    if (accessibleStartEventEntities.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    return accessibleStartEventEntities;
  }

  private async _getStartEventsForProcessModel(executionContext: ExecutionContext, processModelKey: string): Promise<Array<IStartEventEntity>> {

    const queryOptions: IPrivateQueryOptions = {
      query: {
        operator: 'and',
        queries: [
          {
            attribute: 'key',
            operator: '=',
            value: processModelKey,
          },
          {
            attribute: 'type',
            operator: '=',
            value: 'bpmn:StartEvent',
          },
        ],
      },
      expandCollection: [
        {
          attribute: 'nodeDef',
          childAttributes: [
            {attribute: 'lane'},
          ],
        },
      ],
    };

    const startEventEntityType: IEntityType<IStartEventEntity> = await this.datastoreService.getEntityType<IStartEventEntity>('NodeDef');
    const startEvents: IEntityCollection<IStartEventEntity> = await startEventEntityType.query(executionContext, queryOptions);

    return startEvents.data;
  }

  private executionContextFromConsumerContext(consumerContext: IConsumerContext): Promise<ExecutionContext> {
    return this.iamService.resolveExecutionContext(consumerContext.authorization.substr('Bearer '.length), TokenType.jwt);
  }

  private formWidgetFieldIsEnum(formWidgetField: IFormWidgetField<any>): formWidgetField is IFormWidgetEnumField {
    return formWidgetField.type === FormWidgetFieldType.enumeration;
  }

  private getUserTaskConfigFromUserTaskData(userTaskData: IUserTaskMessageData): IUserTaskConfig {
    const result: any = {
      title: userTaskData.userTaskEntity.name,
      widgetType: null,
      widgetConfig: null,
    };

    if (userTaskData.uiName === 'Form') {
      result.widgetType = WidgetType.form;
      result.widgetConfig = this.getFormWidgetConfigFromUserTaskData(userTaskData);
    }

    if (userTaskData.uiName === 'Confirm') {
      result.widgetType = WidgetType.confirm;
      result.widgetConfig = this.getConfirmWidgetConfigFromUserTaskData(userTaskData);
    }

    return result;
  }

  private getFormWidgetConfigFromUserTaskData(userTaskData: IUserTaskMessageData): IFormWidgetConfig {
    const formWidgetConfig: IFormWidgetConfig = {
      fields: null,
    };

    const nodeDefFormFields: Array<INodeDefFormField> = userTaskData.userTaskEntity.nodeDef.extensions.formFields;
    formWidgetConfig.fields = nodeDefFormFields.map((nodeDefFormField: INodeDefFormField): SpecificFormWidgetField => {
      const result: SpecificFormWidgetField = {
        id: nodeDefFormField.id,
        label: nodeDefFormField.label,
        type: nodeDefFormField.type,
        defaultValue: nodeDefFormField.defaultValue,
      };

      if (this.formWidgetFieldIsEnum(result)) {
        result.enumValues = nodeDefFormField.formValues.map((formValue: INodeDefFormFieldValue): IFormWidgetEnumValue => {
          const enumEntry: IFormWidgetEnumValue = {
            label: formValue.name,
            value: formValue.id,
          };

          return enumEntry;
        });
      }

      return result;
    });

    return formWidgetConfig;
  }

  private getConfirmWidgetConfigFromUserTaskData(userTaskData: IUserTaskMessageData): IConfirmWidgetConfig {
    const confirmWidgetConfig: IConfirmWidgetConfig = {
      message: userTaskData.uiConfig.message,
      actions: null,
    };

    confirmWidgetConfig.actions = userTaskData.uiConfig.layout.map((action: UiConfigLayoutElement): IConfirmWidgetAction => {
      const confirmAction: IConfirmWidgetAction = {
        label: action.label,
        action: null,
      };

      if (action.key === 'confirm') {
        confirmAction.action = UserTaskProceedAction.proceed;
      } else if (action.key === 'cancel' || action.isCancel === true) {
        confirmAction.action = UserTaskProceedAction.cancel;
      }

      return confirmAction;
    });

    return confirmWidgetConfig;
  }
}
