import {IIdentity} from '@essential-projects/iam_contracts';

import {InternalServerError} from '@essential-projects/errors_ts';
import {DataModels} from '@process-engine/consumer_api_contracts';
import {
  ICorrelationService,
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessModelService,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import * as ProcessModelCache from './process_model_cache';

export class EventConverter {

  private readonly _correlationService: ICorrelationService;
  private readonly _processModelService: IProcessModelService;
  private readonly _processModelFacadeFactory: IProcessModelFacadeFactory;

  constructor(
    correlationService: ICorrelationService,
    processModelService: IProcessModelService,
    processModelFacadeFactory: IProcessModelFacadeFactory,
  ) {
    this._correlationService = correlationService;
    this._processModelService = processModelService;
    this._processModelFacadeFactory = processModelFacadeFactory;
  }

  public async convertEvents(identity: IIdentity, suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance>): Promise<DataModels.Events.EventList> {

    const suspendedEvents: Array<DataModels.Events.Event> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      // A triggerable suspended event will always have an eventType attached to it, to indicate what the event is waiting for.
      // This will be either a signal or a message.
      const flowNodeIsNotATriggerableEvent: boolean = suspendedFlowNode.eventType !== DataModels.Events.EventType.messageEvent
                                                      && suspendedFlowNode.eventType !== DataModels.Events.EventType.signalEvent;

      if (flowNodeIsNotATriggerableEvent) {
        continue;
      }

      const processModelFacade: IProcessModelFacade =
        await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);

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
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
  ): Promise<IProcessModelFacade> {

    let processModel: Model.Types.Process;

    const cacheHasMatchingEntry: boolean = ProcessModelCache.hasEntry(flowNodeInstance.processInstanceId);
    if (cacheHasMatchingEntry) {
      processModel = ProcessModelCache.get(flowNodeInstance.processInstanceId);
    } else {
      const processModelHash: string = await this.getProcessModelHashForProcessInstance(identity, flowNodeInstance.processInstanceId);
      processModel = await this._processModelService.getByHash(identity, flowNodeInstance.processModelId, processModelHash);
      ProcessModelCache.add(flowNodeInstance.processInstanceId, processModel);
    }

    const processModelFacade: IProcessModelFacade = this._processModelFacadeFactory.create(processModel);

    return processModelFacade;
  }

  private async getProcessModelHashForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<string> {
    const correlationForProcessInstance: Runtime.Types.Correlation =
      await this._correlationService.getByProcessInstanceId(identity, processInstanceId);

    // Note that ProcessInstances will only ever have one processModel and therefore only one hash attached to them.
    return correlationForProcessInstance.processModels[0].hash;
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
