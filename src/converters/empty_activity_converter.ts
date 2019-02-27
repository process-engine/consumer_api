import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/consumer_api_contracts';
import {Correlation, ICorrelationService} from '@process-engine/correlation.contracts';
import {FlowNodeInstance, ProcessToken, ProcessTokenType} from '@process-engine/flow_node_instance.contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import * as ProcessModelCache from './process_model_cache';

export class EmptyActivityConverter {

  private readonly _correlationService: ICorrelationService;
  private readonly _processModelUseCase: IProcessModelUseCases;
  private readonly _processModelFacadeFactory: IProcessModelFacadeFactory;

  constructor(
    correlationService: ICorrelationService,
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processModelUseCase: IProcessModelUseCases,
  ) {
    this._correlationService = correlationService;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processModelUseCase = processModelUseCase;
  }

  public async convert(
    identity: IIdentity,
    suspendedFlowNodes: Array<FlowNodeInstance>,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {

    const suspendedEmptyActivities: Array<DataModels.EmptyActivities.EmptyActivity> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      const taskIsNotAnEmptyActivity: boolean = suspendedFlowNode.flowNodeType !== BpmnType.emptyActivity;
      if (taskIsNotAnEmptyActivity) {
        continue;
      }

      const processModelFacade: IProcessModelFacade =
        await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);

      const emptyActivity: DataModels.EmptyActivities.EmptyActivity =
        await this._convertSuspendedFlowNodeToEmptyActivity(suspendedFlowNode, processModelFacade);

      suspendedEmptyActivities.push(emptyActivity);
    }

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = {
      emptyActivities: suspendedEmptyActivities,
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
    const correlationForProcessInstance: Correlation =
      await this._correlationService.getByProcessInstanceId(identity, processInstanceId);

    // Note that ProcessInstances will only ever have one processModel and therefore only one hash attached to them.
    return correlationForProcessInstance.processModels[0].hash;
  }

  private async _convertSuspendedFlowNodeToEmptyActivity(
    emptyActivityInstance: FlowNodeInstance,
    processModelFacade: IProcessModelFacade,
  ): Promise<DataModels.EmptyActivities.EmptyActivity> {

    const emptyActivityModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(emptyActivityInstance.flowNodeId);

    const currentProcessToken: ProcessToken =
      emptyActivityInstance.tokens.find((token: ProcessToken): boolean => {
        return token.type === ProcessTokenType.onSuspend;
      });

    const consumerApiManualTask: DataModels.EmptyActivities.EmptyActivity = {
      id: emptyActivityInstance.flowNodeId,
      flowNodeInstanceId: emptyActivityInstance.id,
      name: emptyActivityModel.name,
      correlationId: emptyActivityInstance.correlationId,
      processModelId: emptyActivityInstance.processModelId,
      processInstanceId: emptyActivityInstance.processInstanceId,
      tokenPayload: currentProcessToken.payload,
    };

    return consumerApiManualTask;

  }
}
