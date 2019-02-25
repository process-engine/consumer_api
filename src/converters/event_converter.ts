import {IIdentity} from '@essential-projects/iam_contracts';

import {InternalServerError} from '@essential-projects/errors_ts';
import {DataModels} from '@process-engine/consumer_api_contracts';
import {Correlation, ICorrelationService} from '@process-engine/correlation.contracts';
import {FlowNodeInstance} from '@process-engine/flow_node_instance.contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory} from '@process-engine/process_engine_contracts';
import {IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import * as ProcessModelCache from './process_model_cache';

export class EventConverter {

  private readonly _correlationService: ICorrelationService;
  private readonly _processModelFacadeFactory: IProcessModelFacadeFactory;
  private readonly _processModelUseCase: IProcessModelUseCases;

  constructor(
    correlationService: ICorrelationService,
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processModelUseCase: IProcessModelUseCases,
  ) {
    this._correlationService = correlationService;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processModelUseCase = processModelUseCase;
  }

  public async convertEvents(identity: IIdentity, suspendedFlowNodes: Array<FlowNodeInstance>): Promise<DataModels.Events.EventList> {

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
    flowNodeInstance: FlowNodeInstance,
  ): Promise<IProcessModelFacade> {

    let processModel: Model.Process;

    // We must store the ProcessModel for each user, to account for lane-restrictions.
    // Some users may not be able to see some lanes that are visible to others.
    const cacheKeyToUse: string = `${flowNodeInstance.processInstanceId}-${identity.userId}`;

    const cacheHasMatchingEntry: boolean = ProcessModelCache.hasEntry(cacheKeyToUse);
    if (cacheHasMatchingEntry) {
      processModel = ProcessModelCache.get(cacheKeyToUse);
    } else {
      const processModelHash: string = await this.getProcessModelHashForProcessInstance(identity, flowNodeInstance.processInstanceId);
      processModel = await this._processModelUseCase.getByHash(identity, flowNodeInstance.processModelId, processModelHash);
      ProcessModelCache.add(cacheKeyToUse, processModel);
    }

    const processModelFacade: IProcessModelFacade = this._processModelFacadeFactory.create(processModel);

    return processModelFacade;
  }

  private async getProcessModelHashForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<string> {
    const correlationForProcessInstance: Correlation = await this._correlationService.getByProcessInstanceId(identity, processInstanceId);

    // Note that ProcessInstances will only ever have one processModel and therefore only one hash attached to them.
    return correlationForProcessInstance.processModels[0].hash;
  }

  private _convertToConsumerApiEvent(flowNodeModel: Model.Events.Event, suspendedFlowNode: FlowNodeInstance): DataModels.Events.Event {

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
