import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/consumer_api_contracts';
import {ICorrelationService} from '@process-engine/correlation.contracts';
import {FlowNodeInstance, ProcessTokenType} from '@process-engine/flow_node_instance.contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import * as ProcessModelCache from './process_model_cache';

export class EmptyActivityConverter {

  private readonly correlationService: ICorrelationService;
  private readonly processModelUseCase: IProcessModelUseCases;
  private readonly processModelFacadeFactory: IProcessModelFacadeFactory;

  constructor(
    correlationService: ICorrelationService,
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processModelUseCase: IProcessModelUseCases,
  ) {
    this.correlationService = correlationService;
    this.processModelFacadeFactory = processModelFacadeFactory;
    this.processModelUseCase = processModelUseCase;
  }

  public async convert(
    identity: IIdentity,
    suspendedFlowNodes: Array<FlowNodeInstance>,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedEmptyActivities: Array<DataModels.EmptyActivities.EmptyActivity> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      const taskIsNotAnEmptyActivity = suspendedFlowNode.flowNodeType !== BpmnType.emptyActivity;
      if (taskIsNotAnEmptyActivity) {
        continue;
      }

      const processModelFacade = await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);

      const emptyActivity = await this.convertSuspendedFlowNodeToEmptyActivity(suspendedFlowNode, processModelFacade);

      suspendedEmptyActivities.push(emptyActivity);
    }

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = {
      emptyActivities: suspendedEmptyActivities,
      totalCount: suspendedEmptyActivities.length,
    };

    return emptyActivityList;
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

  private async convertSuspendedFlowNodeToEmptyActivity(
    emptyActivityInstance: FlowNodeInstance,
    processModelFacade: IProcessModelFacade,
  ): Promise<DataModels.EmptyActivities.EmptyActivity> {

    const emptyActivityModel = processModelFacade.getFlowNodeById(emptyActivityInstance.flowNodeId);

    const onSuspendToken = emptyActivityInstance.getTokenByType(ProcessTokenType.onSuspend);

    const consumerApiEmptyActivity: DataModels.EmptyActivities.EmptyActivity = {
      flowNodeType: BpmnType.emptyActivity,
      id: emptyActivityInstance.flowNodeId,
      flowNodeInstanceId: emptyActivityInstance.id,
      name: emptyActivityModel.name,
      correlationId: emptyActivityInstance.correlationId,
      processModelId: emptyActivityInstance.processModelId,
      processInstanceId: emptyActivityInstance.processInstanceId,
      tokenPayload: onSuspendToken.payload,
    };

    return consumerApiEmptyActivity;

  }

}
