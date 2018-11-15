import {IIdentity} from '@essential-projects/iam_contracts';

import {InternalServerError} from '@essential-projects/errors_ts';
import {Event, EventList, EventType} from '@process-engine/consumer_api_contracts';
import {
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessModelService,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

/**
 * Used to cache ProcessModels during Event conversion.
 * This helps to avoid repeated queries against the database for the same ProcessModel.
 */
type ProcessModelCache = {[processModelId: string]: Model.Types.Process};

export class EventConverter {

  private _processModelService: IProcessModelService;
  private _processModelFacadeFactory: IProcessModelFacadeFactory;

  constructor(processModelService: IProcessModelService,
              processModelFacadeFactory: IProcessModelFacadeFactory) {
    this._processModelService = processModelService;
    this._processModelFacadeFactory = processModelFacadeFactory;
  }

  private get processModelService(): IProcessModelService {
    return this._processModelService;
  }

  private get processModelFacadeFactory(): IProcessModelFacadeFactory {
    return this._processModelFacadeFactory;
  }

  public async convertEvents(identity: IIdentity, suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance>): Promise<EventList> {

    const suspendedEvents: Array<Event> = [];

    const processModelCache: ProcessModelCache = {};

    for (const suspendedFlowNode of suspendedFlowNodes) {

      // A triggerable suspended event will always have an eventType attached to it, to indicate what the event is waiting for.
      // This will be either a signal or a message.
      const flowNodeIsNotATriggerableEvent: boolean = suspendedFlowNode.eventType !== EventType.messageEvent &&
                                                      suspendedFlowNode.eventType !== EventType.signalEvent;

      if (flowNodeIsNotATriggerableEvent) {
        continue;
      }

      const processModelFacade: IProcessModelFacade =
        await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode.processModelId, processModelCache);

      const flowNodeModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(suspendedFlowNode.flowNodeId);

      const event: Event = await this._convertToConsumerApiEvent(flowNodeModel as Model.Events.Event, suspendedFlowNode);

      suspendedEvents.push(event);
    }

    const eventList: EventList = {
      events: suspendedEvents,
    };

    return eventList;
  }

  private async getProcessModelForFlowNodeInstance(
    identity: IIdentity,
    processModelId: string,
    processModelCache: ProcessModelCache,
  ): Promise<IProcessModelFacade> {

    let processModel: Model.Types.Process;

    // To avoid repeated Queries against the database for the same ProcessModel,
    // the retrieved ProcessModels will be cached.
    // So when we want to get a ProcessModel for an Event, we first check the cache and
    // get the ProcessModel from there.
    // We only query the database, if the ProcessModel was not yet retrieved.
    // This avoids timeouts and request-lags when converting large numbers of events.
    const cacheHasMatchingEntry: boolean = processModelCache[processModelId] !== undefined;

    if (cacheHasMatchingEntry) {
      processModel = processModelCache[processModelId];
    } else {
      processModel = await this.processModelService.getProcessModelById(identity, processModelId);
      processModelCache[processModelId] = processModel;
    }

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);

    return processModelFacade;
  }

  private _convertToConsumerApiEvent(flowNodeModel: Model.Events.Event, suspendedFlowNode: Runtime.Types.FlowNodeInstance): Event {

    const consumerApiEvent: Event = {
      id: suspendedFlowNode.flowNodeId,
      flowNodeInstanceId: suspendedFlowNode.id,
      correlationId: suspendedFlowNode.correlationId,
      processModelId: suspendedFlowNode.processModelId,
      processInstanceId: suspendedFlowNode.processInstanceId,
      // TODO: The Runtime.Types.FlowNodeInstance model should also use a corresponding enum for the eventType property.
      eventType: <EventType> suspendedFlowNode.eventType,
      eventName: this._getEventDefinitionFromFlowNodeModel(flowNodeModel, suspendedFlowNode.eventType),
      bpmnType: suspendedFlowNode.flowNodeType,
    };

    return consumerApiEvent;
  }

  private _getEventDefinitionFromFlowNodeModel(flowNodeModel: Model.Events.Event, eventType: string): string {

    switch (eventType) {
      case EventType.messageEvent:
        return (flowNodeModel as any).messageEventDefinition.name;
      case EventType.signalEvent:
        return (flowNodeModel as any).signalEventDefinition.name;
      default:
        throw new InternalServerError(`${flowNodeModel.id} is not a triggerable event!`);
    }
  }
}
