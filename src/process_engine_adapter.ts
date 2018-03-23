// tslint:disable:max-file-line-count

import {
  IConsumerApiService,
  IConsumerContext,
  IEvent as IConsumerApiEvent,
  IEventList as IConsumerApiEventList,
  IEventTriggerPayload,
  IProcessModel,
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

import {ForbiddenError, isError, NotFoundError} from '@essential-projects/errors_ts';
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
    this._consumerApiIamService = consumerApiIamService;
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

    const executionContext: ExecutionContext = await this.executionContextFromConsumerContext(context);

    const processModels: Array<IProcessDefEntity> = await this._getProcessModels(executionContext);

    const result: Array<IProcessModel> = [];
    for (const processModel of processModels) {

      try {
        const mappedProcessModel: IProcessModel = await this.getProcessModelByKey(context, processModel.key);
        result.push(mappedProcessModel);
      } catch (error) {
        if (!isError(error, ForbiddenError)) {
          throw error;
        }
      }
    }

    return {
      page_number: 1,
      page_size: result.length,
      element_count: result.length,
      page_count: 1,
      process_models: result,
    };
  }

  public async getProcessModelByKey(context: IConsumerContext, processModelKey: string): Promise<IConsumerApiProcessModel> {

    const executionContext: ExecutionContext = await this.executionContextFromConsumerContext(context);

    const processDef: IProcessDefEntity = await this._getProcessModelByKey(executionContext, processModelKey);

    const accessibleStartEventEntities: Array<INodeDefEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    if (accessibleStartEventEntities.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    const startEventMapper: any = (startEventEntity: INodeDefEntity): IConsumerApiEvent => {
      const consumerApiStartEvent: IConsumerApiEvent = {
        key: startEventEntity.key,
        id: startEventEntity.id,
        process_instance_id: undefined,
        data: startEventEntity.startContext,
      };

      return consumerApiStartEvent;
    };

    const mappedStartEvents: Array<IConsumerApiEvent> = accessibleStartEventEntities.map(startEventMapper);

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

    // Verify that the process model exists and can be accessed
    await this._getProcessModelByKey(executionContext, processModelKey);
    await this._ensureStartEventAccessibility(executionContext, processModelKey, startEventKey);

    // TODO Add case for different returnOn Scenarios and retrieve and return the created correlationId somehow.
    await this.processEngineService.executeProcess(executionContext, undefined, processModelKey, payload.input_values);

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

    // Verify that the process model exists and can be accessed
    await this._getProcessModelByKey(executionContext, processModelKey);
    await this._ensureStartEventAccessibility(executionContext, processModelKey, startEventKey);
    await this._ensureEndEventAccessibility(executionContext, processModelKey, endEventKey);

    // TODO Add support for returning only at a specific end event and retrieve and return the created correlationId somehow.
    await this.processEngineService.executeProcess(executionContext, undefined, processModelKey, payload.input_values);

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

    const userTasks: Array<IUserTaskEntity> = await this._getAccessibleUserTasks(executionContext, processModelKey);

    const resultUserTaskPromises: Array<any> = userTasks.map(async(userTask: IUserTaskEntity) => {

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

  private async _ensureStartEventAccessibility(executionContext: ExecutionContext, processModelKey: string, startEventKey: string): Promise<void> {

    const accessibleStartEventEntities: Array<INodeDefEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    const matchingStartEvent: INodeDefEntity = accessibleStartEventEntities.find((entity: INodeDefEntity): boolean => {
      return entity.key === startEventKey;
    });

    if (!matchingStartEvent) {
      throw new NotFoundError(`Start event ${processModelKey} not found.`);
    }
  }

  private async _ensureEndEventAccessibility(executionContext: ExecutionContext, processModelKey: string, endEventKey: string): Promise<void> {

    const accessibleEndEventEntities: Array<INodeDefEntity> = await this._getAccessibleEndEvents(executionContext, processModelKey);

    const matchingEndEvent: INodeDefEntity = accessibleEndEventEntities.find((entity: INodeDefEntity): boolean => {
      return entity.key === endEventKey;
    });

    if (!matchingEndEvent) {
      throw new NotFoundError(`End event ${processModelKey} not found.`);
    }
  }

  private async _getIdsOfLanesThatCanBeAccessed(executionContext: ExecutionContext, processModelKey: string): Promise<Array<string>> {
    const processModel: IProcessDefEntity = await this._getProcessModelByKey(executionContext, processModelKey);

    const identity: IIdentity = await this.processEngineiamService.getIdentity(executionContext);
    const processDefinitions: IDefinition = await this._getDefinitionsFromProcessModel(processModel);

    let accessibleLanes: Array<IModdleElement> = [];
    for (const rootElement of processDefinitions.rootElements) {
      if (rootElement.$type !== 'bpmn:Process') {
        continue;
      }

      for (const laneSet of rootElement.laneSets) {
        accessibleLanes = accessibleLanes.concat(await this._getLanesThatCanBeAccessed(identity, laneSet));
      }
    }

    return accessibleLanes.map((lane: IModdleElement) => {
      return lane.id;
    });
  }

  private async _getLanesThatCanBeAccessed(identity: IIdentity, laneSet: IModdleElement): Promise<Array<IModdleElement>> {
    if (laneSet === undefined) {
      return Promise.resolve([]);
    }

    let result: Array<IModdleElement> = [];

    for (const lane of laneSet.lanes) {
      const claimIsInvalid: boolean = lane.name === undefined || lane.name === '';
      if (claimIsInvalid) {
        logger.warn(`lane with id ${lane.id} has no claim/title`);
        continue;
      }

      const identityHasClaim: boolean = await this.consumerApiIamService.hasClaim(identity, lane.name);
      if (!identityHasClaim) {
        continue;
      }

      result.push(lane);
      result = result.concat(await this._getLanesThatCanBeAccessed(identity, lane.childLaneSet));
    }

    return result;
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

  private _getLaneIdForElement(processDefinitions: IDefinition, elementId: string): string {
    for (const rootElement of processDefinitions.rootElements) {
      if (rootElement.$type !== 'bpmn:Process') {
        continue;
      }

      for (const laneSet of rootElement.laneSets) {
        const closestLaneId: string = this._getClosestLaneIdToElement(laneSet, elementId);
        if (closestLaneId !== undefined) {
          return closestLaneId;
        }
      }
    }
  }

  private _getClosestLaneIdToElement(laneSet: IModdleElement, elementId: string): string {
    for (const lane of laneSet.lanes) {
      if (lane.childLaneSet !== undefined) {
        return this._getClosestLaneIdToElement(lane.childLaneSet, elementId);
      }

      if (lane.flowNodeRef === undefined) {
        continue;
      }

      const elementIsInLane: boolean = lane.flowNodeRef.some((flowNode: IModdleElement) => {
        return flowNode.id === elementId;
      });

      if (elementIsInLane) {
        return lane.id;
      }
    }
  }

  private async _getProcessModels(executionContext: ExecutionContext): Promise<Array<IProcessDefEntity>> {
    const processDefEntityType: IEntityType<IProcessDefEntity> = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');
    const processDefCollection: IEntityCollection<IProcessDefEntity> = await processDefEntityType.all(executionContext);

    const processModels: Array<IProcessDefEntity> = [];
    await processDefCollection.each(executionContext, (processModel: IProcessDefEntity) => {
      processModels.push(processModel);
    });

    return processModels;
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

  private async _getAccessibleUserTasks(executionContext: ExecutionContext, processModelKey: string): Promise<Array<IUserTaskEntity>> {

    const userTasks: Array<IUserTaskEntity> = await this._getUserTasksForProcessModel(executionContext, processModelKey);
    const accessibleLaneIds: Array<string> = await this._getIdsOfLanesThatCanBeAccessed(executionContext, processModelKey);

    if (accessibleLaneIds.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    const processModel: IProcessDefEntity = await this._getProcessModelByKey(executionContext, processModelKey);
    const processDefinitions: IDefinition = await this._getDefinitionsFromProcessModel(processModel);

    const accessibleUserTaskEntities: Array<any> = userTasks.filter((userTask: IUserTaskEntity) => {
      const laneId: string = this._getLaneIdForElement(processDefinitions, userTask.key);
      const identityCanAccessUserTask: boolean = laneId !== undefined && accessibleLaneIds.includes(laneId);

      return identityCanAccessUserTask;
    });

    return accessibleUserTaskEntities;
  }

  private async _getAccessibleStartEvents(executionContext: ExecutionContext, processModelKey: string): Promise<Array<INodeDefEntity>> {

    const startEvents: Array<INodeDefEntity> = await this._getStartEventsForProcessModel(executionContext, processModelKey);
    const accessibleStartEventEntities: Array<INodeDefEntity> = await this._filterAccessibleEvents(executionContext, processModelKey, startEvents);

    return accessibleStartEventEntities;
  }

  private async _getAccessibleEndEvents(executionContext: ExecutionContext, processModelKey: string): Promise<Array<INodeDefEntity>> {

    const endEvents: Array<INodeDefEntity> = await this._getEndEventsForProcessModel(executionContext, processModelKey);
    const accessibleEndEventEntities: Array<INodeDefEntity> = await this._filterAccessibleEvents(executionContext, processModelKey, endEvents);

    return accessibleEndEventEntities;
  }

  private async _filterAccessibleEvents(executionContext: ExecutionContext,
                                        processModelKey: string,
                                        events: Array<INodeDefEntity>): Promise<Array<INodeDefEntity>> {

    const accessibleLaneIds: Array<string> = await this._getIdsOfLanesThatCanBeAccessed(executionContext, processModelKey);

    if (accessibleLaneIds.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    const processModel: IProcessDefEntity = await this._getProcessModelByKey(executionContext, processModelKey);
    const processDefinitions: IDefinition = await this._getDefinitionsFromProcessModel(processModel);

    const accessibleEventEntities: Array<any> = events.filter((event: INodeDefEntity) => {
      const laneId: string = this._getLaneIdForElement(processDefinitions, event.key);
      const identityCanAccessEvent: boolean = laneId !== undefined && accessibleLaneIds.includes(laneId);

      return identityCanAccessEvent;
    });

    if (accessibleEventEntities.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    return accessibleEventEntities;
  }

  private async _getUserTasksForProcessModel(executionContext: ExecutionContext, processModelKey: string): Promise<Array<IUserTaskEntity>> {

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

    return userTasks;
  }

  private async _getStartEventsForProcessModel(executionContext: ExecutionContext, processModelKey: string): Promise<Array<INodeDefEntity>> {
    return this._getEventsByTypeForProcessModel(executionContext, processModelKey, 'bpmn:StartEvent');
  }

  private async _getEndEventsForProcessModel(executionContext: ExecutionContext, processModelKey: string): Promise<Array<INodeDefEntity>> {
    return this._getEventsByTypeForProcessModel(executionContext, processModelKey, 'bpmn:EndEvent');
  }

  private async _getEventsByTypeForProcessModel(executionContext: ExecutionContext,
                                                processModelKey: string,
                                                eventType: string): Promise<Array<INodeDefEntity>> {

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
            value: eventType,
          },
        ],
      },
      expandCollection: [
        {
          attribute: 'processDef',
          childAttributes: [
            {attribute: 'key'},
          ],
        },
      ],
    };

    const eventEntityType: IEntityType<INodeDefEntity> = await this.datastoreService.getEntityType<INodeDefEntity>('NodeDef');
    const eventCollection: IEntityCollection<INodeDefEntity> = await eventEntityType.query(executionContext, queryOptions);

    const events: Array<INodeDefEntity> = [];
    await eventCollection.each(executionContext, (event: INodeDefEntity) => {
      events.push(event);
    });

    return events;
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
