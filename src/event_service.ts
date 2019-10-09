/* eslint-disable @typescript-eslint/no-explicit-any */
import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {APIs, DataModels, Messages} from '@process-engine/consumer_api_contracts';
import {
  FlowNodeInstance,
  ICorrelationService,
  IFlowNodeInstanceService,
  IProcessModelUseCases,
  Model,
} from '@process-engine/persistence_api.contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory} from '@process-engine/process_engine_contracts';

import {applyPagination} from './paginator';
import * as ProcessModelCache from './process_model_cache';

export class EventService implements APIs.IEventConsumerApi {

  private readonly correlationService: ICorrelationService;
  private readonly eventAggregator: IEventAggregator;
  private readonly flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly iamService: IIAMService;
  private readonly processModelUseCase: IProcessModelUseCases;
  private readonly processModelFacadeFactory: IProcessModelFacadeFactory;

  private readonly canTriggerMessagesClaim = 'can_trigger_messages';
  private readonly canTriggerSignalsClaim = 'can_trigger_signals';

  constructor(
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    flowNodeInstanceService: IFlowNodeInstanceService,
    iamService: IIAMService,
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processModelUseCase: IProcessModelUseCases,
  ) {
    this.correlationService = correlationService;
    this.eventAggregator = eventAggregator;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.iamService = iamService;
    this.processModelFacadeFactory = processModelFacadeFactory;
    this.processModelUseCase = processModelUseCase;
  }

  public async getEventsForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.Events.EventList> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const suspendedEvents = suspendedFlowNodeInstances.filter(this.isFlowNodeAnEvent);

    const eventList = await this.convertFlowNodeInstancesToEvents(identity, suspendedEvents);

    // TODO: Remove that useless `EventList` datatype and just return an Array of Events.
    // Goes for the other UseCases as well.
    eventList.events = applyPagination(eventList.events, offset, limit);

    return eventList;
  }

  public async getEventsForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.Events.EventList> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedEvents = suspendedFlowNodeInstances.filter(this.isFlowNodeAnEvent);

    const accessibleEvents = await Promise.filter(suspendedEvents, async (flowNode: FlowNodeInstance): Promise<boolean> => {
      try {
        await this.processModelUseCase.getProcessModelById(identity, flowNode.processModelId);

        return true;
      } catch (error) {

        return false;
      }
    });

    const eventList = await this.convertFlowNodeInstancesToEvents(identity, accessibleEvents);

    eventList.events = applyPagination(eventList.events, offset, limit);

    return eventList;
  }

  public async getEventsForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.Events.EventList> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedEvents = suspendedFlowNodeInstances.filter((flowNode: FlowNodeInstance): boolean => {

      const flowNodeIsEvent = this.isFlowNodeAnEvent(flowNode);
      const flowNodeBelongsToProcessModel = flowNode.processModelId === processModelId;

      return flowNodeIsEvent && flowNodeBelongsToProcessModel;
    });

    const eventList = await this.convertFlowNodeInstancesToEvents(identity, suspendedEvents);

    eventList.events = applyPagination(eventList.events, offset, limit);

    return eventList;
  }

  public async triggerMessageEvent(identity: IIdentity, messageName: string, payload?: DataModels.Events.EventTriggerPayload): Promise<void> {

    await this.iamService.ensureHasClaim(identity, this.canTriggerMessagesClaim);

    const messageEventName = Messages.EventAggregatorSettings.messagePaths.messageEventReached
      .replace(Messages.EventAggregatorSettings.messageParams.messageReference, messageName);

    this.eventAggregator.publish(messageEventName, payload);
  }

  public async triggerSignalEvent(identity: IIdentity, signalName: string, payload?: DataModels.Events.EventTriggerPayload): Promise<void> {

    await this.iamService.ensureHasClaim(identity, this.canTriggerSignalsClaim);

    const signalEventName = Messages.EventAggregatorSettings.messagePaths.signalEventReached
      .replace(Messages.EventAggregatorSettings.messageParams.signalReference, signalName);

    this.eventAggregator.publish(signalEventName, payload);
  }

  private async convertFlowNodeInstancesToEvents(
    identity: IIdentity,
    suspendedFlowNodes: Array<FlowNodeInstance>,
  ): Promise<DataModels.Events.EventList> {

    const suspendedEvents =
      await Promise.map(suspendedFlowNodes, async (flowNode): Promise<DataModels.Events.Event> => {
        return this.convertToConsumerApiEvent(identity, flowNode);
      });

    const eventList: DataModels.Events.EventList = {
      events: suspendedEvents,
      totalCount: suspendedEvents.length,
    };

    return eventList;
  }

  private isFlowNodeAnEvent(flowNodeInstance: FlowNodeInstance): boolean {
    return flowNodeInstance.eventType !== undefined;
  }

  private async convertToConsumerApiEvent(identity: IIdentity, suspendedFlowNode: FlowNodeInstance): Promise<DataModels.Events.Event> {

    const processModelFacade = await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);
    const flowNodeModel = processModelFacade.getFlowNodeById(suspendedFlowNode.flowNodeId);

    const consumerApiEvent: DataModels.Events.Event = {
      id: suspendedFlowNode.flowNodeId,
      flowNodeInstanceId: suspendedFlowNode.id,
      correlationId: suspendedFlowNode.correlationId,
      processModelId: suspendedFlowNode.processModelId,
      processInstanceId: suspendedFlowNode.processInstanceId,
      eventType: <DataModels.Events.EventType> suspendedFlowNode.eventType,
      eventName: this.getEventDefinitionFromFlowNodeModel(flowNodeModel, suspendedFlowNode.eventType),
      bpmnType: suspendedFlowNode.flowNodeType,
    };

    return consumerApiEvent;
  }

  private async getProcessModelForFlowNodeInstance(
    identity: IIdentity,
    flowNodeInstance: FlowNodeInstance,
  ): Promise<IProcessModelFacade> {

    let processModel: Model.Process;

    // We must store the ProcessModel for each user, to account for lane-restrictions.
    // Some users may not be able to see some lanes that are visible to others.
    const cacheKeyToUse = `${flowNodeInstance.processInstanceId}-${identity.userId}`;

    const cacheHasMatchingEntry = ProcessModelCache.hasEntry(cacheKeyToUse);
    if (cacheHasMatchingEntry) {
      processModel = ProcessModelCache.get(cacheKeyToUse);
    } else {
      const processModelHash = await this.getProcessModelHashForProcessInstance(identity, flowNodeInstance.processInstanceId);
      processModel = await this.processModelUseCase.getByHash(identity, flowNodeInstance.processModelId, processModelHash);
      ProcessModelCache.add(cacheKeyToUse, processModel);
    }

    const processModelFacade = this.processModelFacadeFactory.create(processModel);

    return processModelFacade;
  }

  private async getProcessModelHashForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<string> {
    const processInstance = await this.correlationService.getByProcessInstanceId(identity, processInstanceId);

    return processInstance.hash;
  }

  private getEventDefinitionFromFlowNodeModel(flowNodeModel: Model.Events.Event, eventType: string): string {

    switch (eventType) {
      case DataModels.Events.EventType.messageEvent:
        return (flowNodeModel as any).messageEventDefinition.name;
      case DataModels.Events.EventType.signalEvent:
        return (flowNodeModel as any).signalEventDefinition.name;
      default:
        throw new InternalServerError(`${flowNodeModel.id} is not a triggerable event!`);
    }
  }

}
