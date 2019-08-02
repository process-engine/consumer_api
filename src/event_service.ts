import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {APIs, DataModels, Messages} from '@process-engine/consumer_api_contracts';
import {FlowNodeInstance, IFlowNodeInstanceService} from '@process-engine/flow_node_instance.contracts';
import {IProcessModelUseCases} from '@process-engine/process_model.contracts';

import {EventConverter} from './converters/index';

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

  public async getEventsForProcessModel(identity: IIdentity, processModelId: string): Promise<DataModels.Events.EventList> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const suspendedEvents = suspendedFlowNodeInstances.filter(this.isFlowNodeAnEvent);

    const eventList = await this.eventConverter.convertEvents(identity, suspendedEvents);

    return eventList;
  }

  public async getEventsForCorrelation(identity: IIdentity, correlationId: string): Promise<DataModels.Events.EventList> {

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

    return eventList;
  }

  public async getEventsForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
  ): Promise<DataModels.Events.EventList> {

    const suspendedFlowNodeInstances = await this.flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const suspendedEvents = suspendedFlowNodeInstances.filter((flowNode: FlowNodeInstance): boolean => {

      const flowNodeIsEvent = this.isFlowNodeAnEvent(flowNode);
      const flowNodeBelongstoCorrelation = flowNode.processModelId === processModelId;

      return flowNodeIsEvent && flowNodeBelongstoCorrelation;
    });

    const triggerableEvents = await this.eventConverter.convertEvents(identity, suspendedEvents);

    return triggerableEvents;
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
