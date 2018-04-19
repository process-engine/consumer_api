// tslint:disable:max-file-line-count
import {
  ConsumerContext,
  Event as ConsumerApiEvent,
  EventList as ConsumerApiEventList,
  EventTriggerPayload,
  IConsumerApiService,
  ProcessModel,
  ProcessModel as ConsumerApiProcessModel,
  ProcessModelList as ConsumerApiProcessModelList,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  ProcessStartReturnOnOptions,
  UserTask,
  UserTaskConfig,
  UserTaskFormField,
  UserTaskList,
  UserTaskResult,
} from '@process-engine/consumer_api_contracts';

import {
  CombinedQueryOperatorType,
  ExecutionContext,
  IIamService,
  IIdentity,
  IPrivateGetOptions,
  IPrivateQueryOptions,
  IPublicGetOptions,
  IQueryClause,
  IQueryObject,
  IUserEntity,
  TokenType,
} from '@essential-projects/core_contracts';
import {IDatastoreService, IEntityCollection, IEntityType} from '@essential-projects/data_model_contracts';
import {IEvent, IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IDataMessage, IMessageBusService, IMessageSubscription} from '@essential-projects/messagebus_contracts';
import {
  BpmnType,
  IErrorDeserializer,
  ILaneEntity,
  INodeDefEntity,
  INodeInstanceEntity,
  INodeInstanceEntityTypeService,
  IParamStart,
  IProcessDefEntity,
  IProcessEngineService,
  IProcessEntity,
  IProcessTokenEntity,
  IStartEventEntity,
  IUserTaskEntity,
  IUserTaskMessageData,
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
import {CorrelationCache, MessageAction, NodeDefFormField} from './process_engine_adapter_interfaces';

import {IBpmnModdle, IDefinition, IModdleElement} from './bpmnmodeler/index';

import {Logger} from 'loggerhythm';

import * as util from 'util';
import * as uuid from 'uuid';

const logger: Logger = Logger.createLogger('consumer_api_core')
                             .createChildLogger('process_engine_adapter');

export class ConsumerProcessEngineAdapter implements IConsumerApiService {
  public config: any = undefined;

  private _correlations: CorrelationCache = {};

  private _processEngineService: IProcessEngineService;
  private _iamService: IIamService;
  private _datastoreService: IDatastoreService;
  private _nodeInstanceEntityTypeService: INodeInstanceEntityTypeService;
  private _messageBusService: IMessageBusService;
  private _consumerApiIamService: any;
  private _errorDeserializer: IErrorDeserializer;
  private _eventAggregator: IEventAggregator;

  constructor(datastoreService: IDatastoreService,
              iamService: IIamService,
              processEngineService: IProcessEngineService,
              nodeInstanceEntityTypeService: INodeInstanceEntityTypeService,
              messageBusService: IMessageBusService,
              consumerApiIamService: any,
              eventAggregator: IEventAggregator) {

    this._datastoreService = datastoreService;
    this._iamService = iamService;
    this._processEngineService = processEngineService;
    this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
    this._messageBusService = messageBusService;
    this._consumerApiIamService = consumerApiIamService;
    this._eventAggregator = eventAggregator;
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

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  }

  private get nodeInstanceEntityTypeService(): INodeInstanceEntityTypeService {
    return this._nodeInstanceEntityTypeService;
  }

  private get consumerApiIamService(): any {
    return this._consumerApiIamService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
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

  // Process models
  public async getProcessModels(context: ConsumerContext): Promise<ConsumerApiProcessModelList> {

    const executionContext: ExecutionContext = await this._executionContextFromConsumerContext(context);

    const processModels: Array<IProcessDefEntity> = await this._getProcessModels(executionContext);

    const result: Array<ProcessModel> = [];
    for (const processModel of processModels) {

      try {
        const mappedProcessModel: ProcessModel = await this.getProcessModelByKey(context, processModel.key);
        result.push(mappedProcessModel);
      } catch (error) {
        // if we're not allowed to access that process model, then thats fine. In that case, every startevent is invisible to us,
        // but this sould not make fetching startevents from other instances fail
        if (!isError(error, ForbiddenError)) {
          throw error;
        }
      }
    }

    return {
      process_models: result,
    };
  }

  public async getProcessModelByKey(context: ConsumerContext, processModelKey: string): Promise<ConsumerApiProcessModel> {

    const executionContext: ExecutionContext = await this._executionContextFromConsumerContext(context);

    const processDef: IProcessDefEntity = await this._getProcessModelByKey(executionContext, processModelKey);

    const accessibleStartEventEntities: Array<INodeDefEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    if (accessibleStartEventEntities.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    const startEventMapper: any = (startEventEntity: INodeDefEntity): ConsumerApiEvent => {
      const consumerApiStartEvent: ConsumerApiEvent = {
        key: startEventEntity.key,
        id: startEventEntity.id,
        process_instance_id: undefined,
        data: startEventEntity.startContext,
      };

      return consumerApiStartEvent;
    };

    const mappedStartEvents: Array<ConsumerApiEvent> = accessibleStartEventEntities.map(startEventMapper);

    const processModel: ConsumerApiProcessModel = {
      key: processDef.key,
      startEvents: mappedStartEvents,
    };

    return processModel;
  }

  public async startProcess(context: ConsumerContext,
                            processModelKey: string,
                            startEventKey: string,
                            payload: ProcessStartRequestPayload,
                            returnOn: ProcessStartReturnOnOptions): Promise<ProcessStartResponsePayload> {

    const executionContext: ExecutionContext = await this._executionContextFromConsumerContext(context);

    // Verify that the process model exists and can be accessed
    await this._getProcessModelByKey(executionContext, processModelKey);

    const startEventEntity: INodeDefEntity = await this._getStartEventEntity(executionContext, processModelKey, startEventKey);

    let correlationId: string;

    const processInstanceId: string = await this.processEngineService.createProcessInstance(executionContext, undefined, processModelKey);

    if (returnOn === ProcessStartReturnOnOptions.onProcessInstanceStarted) {
      correlationId = await this.startProcessInstance(executionContext, processInstanceId, startEventEntity, payload);
    } else {
      correlationId = payload.correlation_id || uuid.v4();
      this._correlations[correlationId] = processInstanceId;
      // TODO: This does not take the startEventKey into consideration when starting the process. This needs to be changed, so that it does!
      await this.processEngineService.executeProcessInstance(executionContext, processInstanceId, undefined, payload.input_values);
    }

    const response: ProcessStartResponsePayload = {
      correlation_id: correlationId,
    };

    return response;
  }

  public async startProcessAndAwaitEndEvent(context: ConsumerContext,
                                            processModelKey: string,
                                            startEventKey: string,
                                            endEventKey: string,
                                            payload: ProcessStartRequestPayload): Promise<ProcessStartResponsePayload> {

    const executionContext: ExecutionContext = await this._executionContextFromConsumerContext(context);

    // Verify that the process model exists and can be accessed
    await this._getProcessModelByKey(executionContext, processModelKey);

    const startEventEntity: INodeDefEntity = await this._getStartEventEntity(executionContext, processModelKey, startEventKey);
    const endEventEntity: INodeDefEntity = await this._getEndEventEntity(executionContext, processModelKey, endEventKey);

    const processInstanceId: string = await this.processEngineService.createProcessInstance(executionContext, undefined, processModelKey);

    const correlationId: string =
      await this._executeProcessInstanceLocally(executionContext, processInstanceId, startEventEntity, endEventEntity, payload);

    const response: ProcessStartResponsePayload = {
      correlation_id: correlationId,
    };

    return response;
  }

  // Events
  public async getEventsForProcessModel(context: ConsumerContext, processModelKey: string): Promise<ConsumerApiEventList> {

    const mockData: ConsumerApiEventList = {
      events: [{
        key: 'startEvent_1',
        id: '',
        process_instance_id: '',
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
        process_instance_id: '',
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
        process_instance_id: '',
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

  // UserTasks
  public async getUserTasksForProcessModel(context: ConsumerContext, processModelKey: string): Promise<UserTaskList> {
    const executionContext: ExecutionContext = await this._executionContextFromConsumerContext(context);

    const userTasks: Array<IUserTaskEntity> = await this._getAccessibleUserTasksForProcessModel(executionContext, processModelKey);

    return this._userTaskEntitiesToUserTaskList(executionContext, userTasks);
  }

  public async getUserTasksForCorrelation(context: ConsumerContext, correlationId: string): Promise<UserTaskList> {
    const executionContext: ExecutionContext = await this._executionContextFromConsumerContext(context);

    const processModelsInCorrelation: Array<string> = await this._getProcessModelKeysForCorrelation(executionContext, correlationId);
    let accessibleLaneIds: Array<string> = [];
    for (const processModelKey of processModelsInCorrelation) {
      // tslint:disable-next-line:max-line-length
      const accessibleLanesInThisProcess: Array<string> = await this._getIdsOfLanesThatCanBeAccessed(executionContext, processModelKey);
      accessibleLaneIds = accessibleLaneIds.concat(accessibleLanesInThisProcess);
    }

    if (accessibleLaneIds.length === 0) {
      throw new ForbiddenError(`Access to correlation '${correlationId}' not allowed`);
    }

    const userTasks: Array<IUserTaskEntity> = await this._getUserTasksForCorrelation(executionContext, correlationId);

    return this._userTaskEntitiesToUserTaskList(executionContext, userTasks);

  }

  public async getUserTasksForProcessModelInCorrelation(context: ConsumerContext,
                                                        processModelKey: string,
                                                        correlationId: string): Promise<UserTaskList> {
    const executionContext: ExecutionContext = await this._executionContextFromConsumerContext(context);

    if (!await this._processModelBelongsToCorrelation(executionContext, correlationId, processModelKey)) {
      throw new NotFoundError(`ProcessModel with key '${processModelKey}' is not part of the correlation mit der id '${correlationId}'`);
    }

    const accessibleLaneIds: Array<string> = await this._getIdsOfLanesThatCanBeAccessed(executionContext, processModelKey);

    if (accessibleLaneIds.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processModelKey}' not allowed`);
    }

    const userTasks: Array<IUserTaskEntity> = await this._getUserTasksForCorrelation(executionContext, correlationId);

    const userTasksForProcessModel: Array<IUserTaskEntity> = userTasks.filter((userTask: IUserTaskEntity) => {
      return userTask.process.processDef.key === processModelKey;
    });

    return this._userTaskEntitiesToUserTaskList(executionContext, userTasksForProcessModel);
  }

  public async finishUserTask(context: ConsumerContext,
                              processModelKey: string,
                              correlationId: string,
                              userTaskId: string,
                              userTaskResult: UserTaskResult): Promise<void> {

    const executionContext: ExecutionContext = await this._executionContextFromConsumerContext(context);

    const userTasks: UserTaskList = (await this.getUserTasksForProcessModelInCorrelation(context, processModelKey, correlationId));

    const userTask: UserTask = userTasks.user_tasks.find((task: UserTask) => {
      return task.key === userTaskId;
    });

    if (userTask === undefined) {
      // tslint:disable-next-line:max-line-length
      throw new NotFoundError(`UserTask with id '${userTaskId}' not found in Process Model with key '${processModelKey}' in correlation with id '${correlationId}'`);
    }

    const resultForProcessEngine: any = this._getUserTaskResultFromUserTaskConfig(userTaskResult);

    const messageData: any = {
      action: MessageAction.proceed,
      token: userTaskResult,
    };

    return new Promise<void>((resolve: Function, reject: Function): void => {
      const subscription: ISubscription = this.eventAggregator.subscribe(`/processengine/node/${userTask.id}`, (event: any) => {
        const eventIsNotUserTaskEndedEvent: boolean = event.data.action !== 'changeState' || event.data.data !== 'end';
        if (eventIsNotUserTaskEndedEvent) {
          return;
        }

        subscription.dispose();
        resolve();
      });

      this.eventAggregator.publish(`/processengine/node/${userTask.id}`, {
        data: {
          action: MessageAction.proceed,
          token: userTaskResult,
        },
        metadata: {
          context: executionContext,
        },
      });
    });
  }

  private async _userTaskEntitiesToUserTaskList(executionContext: ExecutionContext, userTasks: Array<IUserTaskEntity>): Promise<UserTaskList> {
    const resultUserTaskPromises: Array<any> = userTasks.map(async(userTask: IUserTaskEntity) => {

      const userTaskData: any = await userTask.getUserTaskData(executionContext);

      return {
        key: userTask.key,
        id: userTask.id,
        process_instance_id: userTask.process.id,
        // TODO: 'data' currently contains the response body equals that of the old consumer client.
        // The consumer api concept has no response body defined yet, however, so there MAY be discrepancies.
        data: this._getUserTaskConfigFromUserTaskData(userTaskData, userTask.key),
      };
    });

    const result: UserTaskList = {
      user_tasks: await Promise.all(resultUserTaskPromises),
    };

    return result;
  }

  private async _getUserTasksForCorrelation(executionContext: ExecutionContext, correlationId: string): Promise<Array<IUserTaskEntity>> {
    const processInstances: Array<IProcessEntity> = await this._getProcessInstancesForCorrelation(executionContext, correlationId);

    let userTasks: Array<IUserTaskEntity> = [];
    for (const processInstance of processInstances) {
      try {
        // tslint:disable-next-line:max-line-length
        const userTasksForProcessInstance: Array<IUserTaskEntity> = await this._getAccessibleUserTasksForProcessInstance(executionContext, processInstance);
        userTasks = userTasks.concat(userTasksForProcessInstance);
      } catch (error) {
        // if we're not allowed to access that process instance, then thats fine. In that case, every usertask is invisible to us,
        // but this sould not make fetching usertasks from other instances fail
        if (!isError(error, ForbiddenError)) {
          throw error;
        }
      }
    }

    return userTasks;
  }

  private async _getProcessInstancesForCorrelation(executionContext: ExecutionContext, correlationId: string): Promise<Array<IProcessEntity>> {
    const mainProcessInstaceId: string = this._correlations[correlationId];

    if (mainProcessInstaceId === undefined) {
      throw new NotFoundError(`correlation with id '${correlationId}' not found`);
    }

    const mainProcessInstance: IProcessEntity = await this._getProcessInstanceById(executionContext, mainProcessInstaceId);
    const subProcessInstances: Array<IProcessEntity> = await this._getSubProcessInstances(executionContext, mainProcessInstaceId);

    return [mainProcessInstance].concat(subProcessInstances);
  }

  private async _getSubProcessInstances(executionContext: ExecutionContext, parentProcessInstanceId: string): Promise<Array<IProcessEntity>> {

    const nodes: Array<INodeInstanceEntity> = await this._getCallActivitiesForProcessInstance(executionContext, parentProcessInstanceId);
    const nodeIds: Array<string> = nodes.map((node: INodeInstanceEntity) => {
      return node.id;
    });

    const processes: Array<IProcessEntity> = await this._getCalledProcessesViaCallerIds(executionContext, nodeIds);

    let result: Array<IProcessEntity> = processes.slice(0);
    for (const process of processes) {
      const subProcesses: Array<IProcessEntity> = await this._getSubProcessInstances(executionContext, process.id);
      result = result.concat(subProcesses);
    }

    return result;
  }

  private async _getCallActivitiesForProcessInstance(executionContext: ExecutionContext,
                                                     processInstanceId: string): Promise<Array<INodeInstanceEntity>> {
    const queryOptions: IPrivateQueryOptions = {
      query: {
        operator: 'and',
        queries: [
          {
            attribute: 'process',
            operator: '=',
            value: processInstanceId,
          },
          {
            attribute: 'type',
            operator: '=',
            value: BpmnType.callActivity,
          },
        ],
      },
    };

    const nodeDefEntityType: IEntityType<INodeInstanceEntity> = await this.datastoreService.getEntityType<INodeInstanceEntity>('NodeInstance');
    const nodeInstanceCollection: IEntityCollection<INodeInstanceEntity> = await nodeDefEntityType.query(executionContext, queryOptions);

    const nodes: Array<INodeInstanceEntity> = [];
    await nodeInstanceCollection.each(executionContext, (nodeInstance: INodeInstanceEntity) => {
      nodes.push(nodeInstance);
    });

    return nodes;
  }

  private async _getCalledProcessesViaCallerIds(executionContext: ExecutionContext, callerIds: Array<string>): Promise<Array<IProcessEntity>> {
    if (callerIds.length === 0) {
      return Promise.resolve([]);
    }

    const processInstanceQueryParts: Array<IQueryClause> = callerIds.map((callerId: string): IQueryClause => {
      return {
        attribute: 'callerId',
        operator: '=',
        value: callerId,
      };
    });

    const processInstanceQueryOptions: IPrivateQueryOptions = {
      query: {
        operator: 'or',
        queries: processInstanceQueryParts,
      },
      expandCollection: [{attribute: 'processDef'}],
    };

    const processEntityType: IEntityType<IProcessEntity> = await this.datastoreService.getEntityType<IProcessEntity>('Process');
    const processCollection: IEntityCollection<IProcessEntity> = await processEntityType.query(executionContext, processInstanceQueryOptions);

    const processes: Array<IProcessEntity> = [];
    await processCollection.each(executionContext, (process: IProcessEntity) => {
      processes.push(process);
    });

    return processes;
  }

  private async _processModelBelongsToCorrelation(executionContext: ExecutionContext,
                                                  correlationId: string,
                                                  processModelKey: string): Promise<boolean> {

    const processModelKeys: Array<string> = await this._getProcessModelKeysForCorrelation(executionContext, correlationId);

    return processModelKeys.includes(processModelKey);
  }

  private async _getProcessModelKeysForCorrelation(executionContext: ExecutionContext, correlationId: string): Promise<Array<string>> {

    const mainProcessInstaceId: string = this._correlations[correlationId];
    if (mainProcessInstaceId === undefined) {
      throw new NotFoundError(`correlation with id '${correlationId}' not found`);
    }

    const mainProcessInstance: IProcessEntity = await this._getProcessInstanceById(executionContext, mainProcessInstaceId);
    const result: Array<string> = [mainProcessInstance.processDef.key];

    const subProcessModelKeys: Array<string> = await this._getSubProcessModelKeys(executionContext, mainProcessInstance.key);

    return result.concat(subProcessModelKeys);
  }

  private async _getSubProcessModelKeys(executionContext: ExecutionContext, processModelKey: string): Promise<Array<string>> {
    const callActivities: Array<INodeDefEntity> = await this._getNodesByTypeForProcessModel(executionContext, processModelKey, BpmnType.callActivity);

    let result: Array<string> = callActivities.map((callActivity: INodeDefEntity) => {
      return callActivity.subProcessKey;
    });

    for (const callActivity of callActivities) {
      result = result.concat(await this._getSubProcessModelKeys(executionContext, callActivity.subProcessKey));
    }

    return result;
  }

  private async _getProcessInstanceById(executionContext: ExecutionContext, processInstanceId: string): Promise<IProcessEntity> {
    const processInstanceQueryOptions: IPublicGetOptions = {
      expandEntity: [{attribute: 'processDef'}],
    };

    const processEntityType: IEntityType<IProcessEntity> = await this.datastoreService.getEntityType<IProcessEntity>('Process');
    const process: IProcessEntity = await processEntityType.getById(processInstanceId, executionContext, processInstanceQueryOptions);

    if (!process) {
      throw new NotFoundError(`Process instance with id ${processInstanceId} not found.`);
    }

    return process;
  }

  private async _getStartEventEntity(executionContext: ExecutionContext, processModelKey: string, startEventKey: string): Promise<INodeDefEntity> {

    const accessibleStartEventEntities: Array<INodeDefEntity> = await this._getAccessibleStartEvents(executionContext, processModelKey);

    const matchingStartEvent: INodeDefEntity = accessibleStartEventEntities.find((entity: INodeDefEntity): boolean => {
      return entity.key === startEventKey;
    });

    if (!matchingStartEvent) {
      throw new NotFoundError(`Start event ${startEventKey} not found.`);
    }

    return matchingStartEvent;
  }

  private async _getEndEventEntity(executionContext: ExecutionContext, processModelKey: string, endEventKey: string): Promise<INodeDefEntity> {

    const accessibleEndEventEntities: Array<INodeDefEntity> = await this._getAccessibleEndEvents(executionContext, processModelKey);

    const matchingEndEvent: INodeDefEntity = accessibleEndEventEntities.find((entity: INodeDefEntity): boolean => {
      return entity.key === endEventKey;
    });

    if (!matchingEndEvent) {
      throw new NotFoundError(`End event ${endEventKey} not found.`);
    }

    return matchingEndEvent;
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

  private async _getAccessibleUserTasksForProcessModel(executionContext: ExecutionContext, processModelKey: string): Promise<Array<IUserTaskEntity>> {

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

  private async _getAccessibleUserTasksForProcessInstance(executionContext: ExecutionContext,
                                                          processInstance: IProcessEntity): Promise<Array<IUserTaskEntity>> {

    const userTasks: Array<IUserTaskEntity> = await this._getUserTasksForProcessInstance(executionContext, processInstance.id);
    const accessibleLaneIds: Array<string> = await this._getIdsOfLanesThatCanBeAccessed(executionContext, processInstance.processDef.key);

    if (accessibleLaneIds.length === 0) {
      throw new ForbiddenError(`Access to Process Model '${processInstance.processDef.key}' not allowed`);
    }

    const processDefinitions: IDefinition = await this._getDefinitionsFromProcessModel(processInstance.processDef);

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

  private async _getUserTasksForProcessInstance(executionContext: ExecutionContext, processInstanceId: string): Promise<Array<IUserTaskEntity>> {

    const userTaskEntityType: IEntityType<IUserTaskEntity> = await this.datastoreService.getEntityType<IUserTaskEntity>('UserTask');

    const query: IPrivateQueryOptions = {
      query: {
        operator: 'and',
        queries: [
          {
            attribute: 'process.id',
            operator: '=',
            value: processInstanceId,
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
            {
              attribute: 'processDef',
              childAttributes: [
                {attribute: 'id'},
                {attribute: 'key'},
              ],
            },
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
    return this._getNodesByTypeForProcessModel(executionContext, processModelKey, BpmnType.startEvent);
  }

  private async _getEndEventsForProcessModel(executionContext: ExecutionContext, processModelKey: string): Promise<Array<INodeDefEntity>> {
    return this._getNodesByTypeForProcessModel(executionContext, processModelKey, BpmnType.endEvent);
  }

  private async _getNodesByTypeForProcessModel(executionContext: ExecutionContext,
                                               processModelKey: string,
                                               nodeType: BpmnType): Promise<Array<INodeDefEntity>> {

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
            value: nodeType,
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

    const nodeDefEntityType: IEntityType<INodeDefEntity> = await this.datastoreService.getEntityType<INodeDefEntity>('NodeDef');
    const nodeDefCollection: IEntityCollection<INodeDefEntity> = await nodeDefEntityType.query(executionContext, queryOptions);

    const nodes: Array<INodeDefEntity> = [];
    await nodeDefCollection.each(executionContext, (node: INodeDefEntity) => {
      nodes.push(node);
    });

    return nodes;
  }

  // Manually implements "IProcessEntity.start()"
  private async startProcessInstance(context: ExecutionContext,
                                     processInstanceId: string,
                                     startEventDef: INodeDefEntity,
                                     payload: ProcessStartRequestPayload): Promise<string> {

    const processInstance: IProcessEntity = await this._getProcessInstanceById(context, processInstanceId);

    const processTokenType: IEntityType<IProcessTokenEntity> = await this.datastoreService.getEntityType<IProcessTokenEntity>('ProcessToken');
    const startEventType: IEntityType<IStartEventEntity> = await this.datastoreService.getEntityType<IStartEventEntity>('StartEvent');

    const internalContext: ExecutionContext = await this.processEngineiamService.createInternalContext('processengine_system');

    processInstance.status = 'progress';

    if (processInstance.processDef.persist) {
      await processInstance.save(internalContext, { reloadAfterSave: false });
    }

    await processInstance.initializeProcess();

    // create an empty process token
    const processToken: any = await processTokenType.createEntity(internalContext);
    processToken.process = processInstance;
    processToken.data = {
      current: payload.input_values,
    };

    if (processInstance.processDef.persist) {
      await processToken.save(internalContext, { reloadAfterSave: false });
    }

    logger.verbose(`process id ${processInstance.id} started: `);

    const startEvent: IStartEventEntity = <IStartEventEntity> await this.nodeInstanceEntityTypeService.createNode(internalContext, startEventType);
    startEvent.name = startEventDef.name;
    startEvent.key = startEventDef.key;
    startEvent.process = processInstance;
    startEvent.nodeDef = startEventDef;
    startEvent.type = startEventDef.type;
    startEvent.processToken = processToken;
    startEvent.participant = null; // TODO: Clarify if this might be needed in conjunction with the correlation ID.
    startEvent.application = null;

    startEvent.changeState(context, 'start', this);

    const correlationid: string = payload.correlation_id || uuid.v4();
    this._correlations[correlationid] = processInstanceId;

    return correlationid;
  }

  // Pretty much the same as the private function of the process engine service with the same name,
  //  except that it only resolves on a specific end event.
  private _executeProcessInstanceLocally(executionContext: ExecutionContext,
                                         processInstanceId: string,
                                         startEventEntity: INodeDefEntity,
                                         endEventEntity: INodeDefEntity,
                                         payload: ProcessStartRequestPayload): Promise<any> {

    return new Promise(async(resolve: Function, reject: Function): Promise<void> => {

      let correlationId: string;

      const processInstanceChannel: string = `/processengine/process/${processInstanceId}`;
      const processEndSubscription: IMessageSubscription = await this.messageBusService.subscribe(processInstanceChannel, (message: IDataMessage) => {

        if (message.data.event === 'error') {

          if (!this.errorDeserializer) {
            logger.error('No error deserializer has been set!');
            logger.error(message.data);
            throw new Error(message.data.data);
          }

          const deserializedError: Error = this.errorDeserializer(message.data.data);
          logger.error(deserializedError.message);

          // The requester may not be allowed to know why the process terminated
          reject(new InternalServerError('The process terminated with an error.'));
          processEndSubscription.cancel();

          return;
        }

        if (!(message.data.event === 'end' || message.data.event === 'terminate')) {
          return;
        }

        logger.info(`Reached EndEvent '${message.data.endEventKey}'`);

        if (message.data.endEventKey !== endEventEntity.key) {
          return;
        }

        resolve(correlationId);
        processEndSubscription.cancel();
      });

      correlationId = await this.startProcessInstance(executionContext, processInstanceId, startEventEntity, payload);
    });
  }

  private _executionContextFromConsumerContext(consumerContext: ConsumerContext): Promise<ExecutionContext> {
    return this.processEngineiamService.resolveExecutionContext(consumerContext.identity, TokenType.jwt);
  }

  private _getUserTaskConfigFromUserTaskData(userTaskData: IUserTaskMessageData, userTaskKey: string): UserTaskConfig {

    const userTaskHasNoFormFields: boolean = userTaskData.userTaskEntity.nodeDef.extensions === undefined
                                          || userTaskData.userTaskEntity.nodeDef.extensions === null
                                          || userTaskData.userTaskEntity.nodeDef.extensions.formFields === undefined
                                          || userTaskData.userTaskEntity.nodeDef.extensions.formFields.length === 0;
    if (userTaskHasNoFormFields) {
      throw new UnprocessableEntityError(`UserTask with key '${userTaskKey}' has no form fields`);
    }

    const nodeDefFormFields: Array<NodeDefFormField> = userTaskData.userTaskEntity.nodeDef.extensions.formFields;
    const formFields: Array<UserTaskFormField> = nodeDefFormFields.map((processEngineFormField: NodeDefFormField) => {
      const result: UserTaskFormField = {
        id: processEngineFormField.id,
        label: processEngineFormField.label,
        type: processEngineFormField.type,
        default_value: processEngineFormField.defaultValue,
      };

      return result;
    });

    return {
      form_fields: formFields,
    };
  }

  private _getUserTaskResultFromUserTaskConfig(finishedTask: UserTaskResult): any {
    const userTaskIsNotAnObject: boolean = finishedTask === undefined
                                        || finishedTask.form_fields === undefined
                                        || typeof finishedTask.form_fields !== 'object'
                                        || Array.isArray(finishedTask.form_fields);

    if (userTaskIsNotAnObject) {
      throw new BadRequestError('The UserTasks form_fields is not an object.');
    }

    const noFormfieldsSubmitted: boolean = Object.keys(finishedTask.form_fields).length === 0;
    if (noFormfieldsSubmitted) {
      throw new BadRequestError('The UserTasks form_fields are empty.');
    }

    return finishedTask.form_fields;
  }

  private _createDataMessage(data: any, authToken?: string, participantId?: string): IDataMessage {
    const message: IDataMessage = {
      data: data,
      metadata: {
        id: uuid.v4(),
        applicationId: undefined,
        token: undefined,
      },
    };

    if (authToken !== undefined && authToken !== null) {
      message.metadata.token = authToken;
    }

    if (participantId !== undefined && participantId !== null) {
      message.metadata.options = {
        participantId: participantId,
      };
    }

    return message;
  }
}
