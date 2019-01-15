import {IIdentity} from '@essential-projects/iam_contracts';

import {InternalServerError} from '@essential-projects/errors_ts';
import {DataModels} from '@process-engine/consumer_api_contracts';
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

  private readonly _processModelService: IProcessModelService;
  private readonly _processModelFacadeFactory: IProcessModelFacadeFactory;

  constructor(processModelService: IProcessModelService,
              processModelFacadeFactory: IProcessModelFacadeFactory) {
    this._processModelService = processModelService;
    this._processModelFacadeFactory = processModelFacadeFactory;
  }

  public async convertEvents(identity: IIdentity, suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance>): Promise<DataModels.Events.EventList> {

    const suspendedEvents: Array<DataModels.Events.Event> = [];

    const processModelCache: ProcessModelCache = {};

    for (const suspendedFlowNode of suspendedFlowNodes) {

      // A triggerable suspended event will always have an eventType attached to it, to indicate what the event is waiting for.
      // This will be either a signal or a message.
      const flowNodeIsNotATriggerableEvent: boolean = suspendedFlowNode.eventType !== DataModels.Events.EventType.messageEvent &&
                                                      suspendedFlowNode.eventType !== DataModels.Events.EventType.signalEvent;

      if (flowNodeIsNotATriggerableEvent) {
        continue;
      }

      const processModelFacade: IProcessModelFacade =
        await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode.processModelId, processModelCache);

      const flowNodeModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(suspendedFlowNode.flowNodeId);

      const event: DataModels.Events.Event = await this._convertToConsumerApiEvent(flowNodeModel as Model.Events.Event, suspendedFlowNode);

      suspendedEvents.push(event);
    }

    const eventList: DataModels.Events.EventList = {
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
      processModel = await this._processModelService.getProcessModelById(identity, processModelId);
      processModelCache[processModelId] = processModel;
    }

    const processModelFacade: IProcessModelFacade = this._processModelFacadeFactory.create(processModel);

    return processModelFacade;
  }

  private _convertToConsumerApiEvent(flowNodeModel: Model.Events.Event, suspendedFlowNode: Runtime.Types.FlowNodeInstance): DataModels.Events.Event {

    const consumerApiEvent: DataModels.Events.Event = {
      id: suspendedFlowNode.flowNodeId,
      flowNodeInstanceId: suspendedFlowNode.id,
      correlationId: suspendedFlowNode.correlationId,
      processModelId: suspendedFlowNode.processModelId,
      processInstanceId: suspendedFlowNode.processInstanceId,
      eventType: <DataModels.Events.EventType> suspendedFlowNode.eventType,
      eventName: this._getEventDefinitionFromFlowNodeModel(flowNodeModel, suspendedFlowNode.eventType),
      bpmnType: suspendedFlowNode.flowNodeType,
    };

    return consumerApiEvent;
  }

  private _getEventDefinitionFromFlowNodeModel(flowNodeModel: Model.Events.Event, eventType: string): string {

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
