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
  IIdentity,
  IPrivateGetOptions,
  IPrivateQueryOptions,
  IQueryClause,
  TokenType,
} from '@essential-projects/core_contracts';
import {IDatastoreService, IEntityCollection, IEntityType} from '@essential-projects/data_model_contracts';
import {
  ILaneEntity,
  INodeDefEntity,
  IProcessDefEntity,
  IProcessEngineService,
  IProcessEntity,
  IUserTaskEntity,
  IUserTaskMessageData,
} from '@process-engine/process_engine_contracts';

import {ForbiddenError, NotFoundError} from '@essential-projects/errors_ts';
import * as BpmnModdle from 'bpmn-moddle';
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

import {IBpmnModdle, IDefinition, IModdleElement} from './bpmnmodeler/index';

import {Logger} from 'loggerhythm';

const logger: Logger = Logger.createLogger('consumer_api_core')
                             .createChildLogger('process_engine_adapter');

export class ConsumerProcessEngineAdapter implements IConsumerApiService {
  public config: any = undefined;

  private _processEngineService: IProcessEngineService;
  private _iamService: IIamService;
  private _datastoreService: IDatastoreService;
  private _consumerApiIamService: any;

  constructor(datastoreService: IDatastoreService,
              iamService: IIamService,
              processEngineService: IProcessEngineService,
              consumerApiIamService: any) {

    this._datastoreService = datastoreService;
    this._iamService = iamService;
    this._processEngineService = processEngineService;
    this._consumerApiIamService = this.consumerApiIamService;
  }

  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }

  private get processEngineiamService(): IIamService {
    return this._iamService;
  }

  private get processEngineService(): IProcessEngineService {
    return this._processEngineService;
  }

  private get consumerApiIamService(): any {
    return this._consumerApiIamService;
  }

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

    const accessibleLanes: Array<ILaneEntity> = await this._getLanesThatCanBeAccessed(executionContext, processModelKey);

    if (accessibleLanes.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    const accessibleStartEventEntities: Array<INodeDefEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    const startEventMapper: Function = (startEventEntities: Array<INodeDefEntity>): Array<IConsumerApiEvent> => {
      return startEventEntities.map((startEventEntity: INodeDefEntity): IConsumerApiEvent => {
        const consumerApiStartEvent: IConsumerApiEvent = {
          key: startEventEntity.key,
          id: startEventEntity.id,
          process_instance_id: undefined,
          data: startEventEntity.startContext,
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

    const accessibleStartEventEntities: Array<INodeDefEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    const matchingStartEvent: INodeDefEntity = accessibleStartEventEntities.find((entity: INodeDefEntity): boolean => {
      return entity.key === startEventKey;
    });

    if (!matchingStartEvent) {
      throw new NotFoundError(`Start event ${startEventKey} not found.`);
    }

    // TODO Add case for different returnOn Scenarios and retrieve and return the created correlationId somehow.
    // await this.processEngineService.executeProcess(executionContext, undefined, processModelKey, payload);

    // const processInstance: IProcessEntity = await this.processEngineService.createProcessInstance(executionContext, undefined, processModelKey);

    const mockResponse: IProcessStartResponsePayload = {
      correlation_id: payload.correlation_id || 'mocked-correlation-id',
    };

    return mockResponse;
  }

  public async startProcessAndAwaitEndEvent(context: IConsumerContext,
                                            processModelKey: string,
                                            startEventKey: string,
                                            endEventKey: string,
                                            payload: IProcessStartRequestPayload): Promise<IProcessStartResponsePayload> {

    const executionContext: ExecutionContext = await this.executionContextFromConsumerContext(context);

    // Verify that the process model exists
    await this._getProcessModelByKey(executionContext, processModelKey);

    const accessibleStartEventEntities: Array<INodeDefEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    const matchingStartEvent: INodeDefEntity = accessibleStartEventEntities.find((entity: INodeDefEntity): boolean => {
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
    const processModel: IProcessDefEntity = await this._getProcessModelByKey(executionContext, processModelKey);

    const accessibleLanes: Array<ILaneEntity> = await this._getLanesThatCanBeAccessed(executionContext, processModelKey);
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

  private async _getLanesByProcessModelKey(executionContext: ExecutionContext, processModelKey: string): Promise<Array<ILaneEntity>> {
    const laneEntityType: IEntityType<ILaneEntity> = await this.datastoreService.getEntityType<ILaneEntity>('Lane');

    const query: IPrivateQueryOptions = {
      query: {
        attribute: 'processDef.key',
        operator: '=',
        value: processModelKey,
      },
    };

    const laneCollection: IEntityCollection<ILaneEntity> = await laneEntityType.query(executionContext, query);
    const lanes: Array<ILaneEntity> = [];
    await laneCollection.each(executionContext, (userTask: ILaneEntity) => {
      lanes.push(userTask);
    });

    return lanes;
  }

  private async _getLanesThatCanBeAccessed(executionContext: ExecutionContext, processModelKey: string): Promise<Array<ILaneEntity>> {
    const processModel: IProcessDefEntity = await this._getProcessModelByKey(executionContext, processModelKey);
    const lanes: Array<ILaneEntity> = await this._getLanesByProcessModelKey(executionContext, processModelKey);

    const identity: IIdentity = await this.processEngineiamService.getIdentity(executionContext);
    const processDefinitions: IDefinition = await this._getDefinitionsFromProcessModel(processModel);

    return lanes.filter(async(lane: ILaneEntity) => {
      const requiredClaims: Array<string> = this._getRequiredClaimsForLane(processDefinitions, lane.id);

      for (const claim of requiredClaims) {
        const claimIsInvalid: boolean = claim === undefined || claim === '';
        if (claimIsInvalid) {
          return false;
        }

        const identityHasClaim: boolean = await this.consumerApiIamService.hasClaim(identity, claim);
        if (!identityHasClaim) {
          return false;
        }
      }

      return true;
    });
  }

  private _getDefinitionsFromProcessModel(processModel: IProcessDefEntity): Promise<IDefinition> {
    return new Promise((resolve: Function, reject: Function): void => {

      const moddle: IBpmnModdle = BpmnModdle();
      moddle.fromXML(processModel.xml, (error: Error, definitions: IDefinition) => {
        if (error) {
          return reject(error);
        }

        return resolve(definitions);
      });
    });
  }

  private _getRequiredClaimsForLane(definitions: IDefinition, laneId: string): Array<string> {
    // 1. Find the process of the lane
    // 2. Find all lanes in that process
    // 3. find lane hierarchy

    const processThatHostsLane: IModdleElement = this._getProcessThatContainsLane(definitions, laneId);
    console.log('laneSets', processThatHostsLane.laneSets, 'lanes', processThatHostsLane.lanes);

    return [];
    /*
    if (claim === undefined || claim === false) {
      logger.warn(`lane with id ${lane.id} has no claim/title`);
    }
    */
  }

  private _getProcessThatContainsLane(definitions: IDefinition, laneId: string): IModdleElement {
    for (const rootElement of definitions.rootElements) {
      if (rootElement.$type !== 'bpmn:Process') {
        continue;
      }

      for (const laneSet of rootElement.laneSets) {
        if (laneSet.id === laneId) {
          return rootElement;
        }
      }
    }
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

  private async _getAccessibleStartEvents(executionContext: ExecutionContext, processModelKey: string): Promise<Array<INodeDefEntity>> {

    const startEvents: Array<INodeDefEntity> = await this._getStartEventsForProcessModel(executionContext, processModelKey);
    const accessibleLanes: Array<ILaneEntity> = await this._getLanesThatCanBeAccessed(executionContext, processModelKey);

    if (accessibleLanes.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    const accessibleLaneIds: Array<string> = accessibleLanes.map((lane: ILaneEntity) => {
      return lane.id;
    });

    const accessibleStartEventEntities: Array<INodeDefEntity> = startEvents.filter((startEvent: INodeDefEntity) => {
      return accessibleLaneIds.includes(startEvent.lane.id);
    });

    if (accessibleStartEventEntities.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    return accessibleStartEventEntities;
  }

  private async _getStartEventsForProcessModel(executionContext: ExecutionContext, processModelKey: string): Promise<Array<INodeDefEntity>> {

    const queryOptions: IPrivateQueryOptions = {
      query: {
        operator: 'and',
        queries: [
          {
            attribute: 'processDef.key',
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
          attribute: 'processDef',
          childAttributes: [
            { attribute: 'key' },
          ],
        },
      ],
    };

    const startEventEntityType: IEntityType<INodeDefEntity> = await this.datastoreService.getEntityType<INodeDefEntity>('NodeDef');
    const startEvents: IEntityCollection<INodeDefEntity> = await startEventEntityType.query(executionContext, queryOptions);

    return startEvents.data;
  }

  private executionContextFromConsumerContext(consumerContext: IConsumerContext): Promise<ExecutionContext> {
    return this.processEngineiamService.resolveExecutionContext(consumerContext.authorization.substr('Bearer '.length), TokenType.jwt);
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
