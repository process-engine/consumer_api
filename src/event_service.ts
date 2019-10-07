import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {APIs, DataModels, Messages} from '@process-engine/consumer_api_contracts';
import {FlowNodeInstance, IFlowNodeInstanceService, IProcessModelUseCases} from '@process-engine/persistence_api.contracts';

import {EventConverter} from './converters/index';
import {applyPagination} from './paginator';

export class EventService implements APIs.IEventConsumerApi {

  private readonly eventAggregator: IEventAggregator;
  private readonly eventConverter: EventConverter;
  private readonly flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly iamService: IIAMService;
  private readonly processModelUseCase: IProcessModelUseCases;

  private readonly canTriggerMessagesClaim = 'can_trigger_messages';
  private readonly canTriggerSignalsClaim = 'can_trigger_signals';

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeInstanceService: IFlowNodeInstanceService,
    iamService: IIAMService,
    processModelUseCase: IProcessModelUseCases,
    eventConverter: EventConverter,
  ) {
    this.eventAggregator = eventAggregator;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.iamService = iamService;
    this.processModelUseCase = processModelUseCase;
    this.eventConverter = eventConverter;
  }

  public async getEventsForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.Events.EventList> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const suspendedEvents = suspendedFlowNodeInstances.filter(this.isFlowNodeAnEvent);

    const eventList = await this.eventConverter.convertEvents(identity, suspendedEvents);

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

    const eventList = await this.eventConverter.convertEvents(identity, accessibleEvents);

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
      const flowNodeBelongstoCorrelation = flowNode.processModelId === processModelId;

      return flowNodeIsEvent && flowNodeBelongstoCorrelation;
    });

    const eventList = await this.eventConverter.convertEvents(identity, suspendedEvents);

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

  private isFlowNodeAnEvent(flowNodeInstance: FlowNodeInstance): boolean {
    return flowNodeInstance.eventType !== undefined;
  }

}
