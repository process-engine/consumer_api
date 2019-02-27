import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/consumer_api_contracts';
import {Correlation, ICorrelationService} from '@process-engine/correlation.contracts';
import {FlowNodeInstance, ProcessToken, ProcessTokenType} from '@process-engine/flow_node_instance.contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import * as ProcessModelCache from './process_model_cache';

export class ManualTaskConverter {

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
  ): Promise<DataModels.ManualTasks.ManualTaskList> {

    const suspendedManualTasks: Array<DataModels.ManualTasks.ManualTask> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      const taskIsNotAManualTask: boolean = suspendedFlowNode.flowNodeType !== BpmnType.manualTask;
      if (taskIsNotAManualTask) {
        continue;
      }

      const processModelFacade: IProcessModelFacade =
        await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);

      const manualTask: DataModels.ManualTasks.ManualTask =
        await this._convertSuspendedFlowNodeToManualTask(suspendedFlowNode, processModelFacade);

      suspendedManualTasks.push(manualTask);
    }

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = {
      manualTasks: suspendedManualTasks,
    };

    return manualTaskList;
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

  private async _convertSuspendedFlowNodeToManualTask(
    manualTaskInstance: FlowNodeInstance,
    processModelFacade: IProcessModelFacade,
  ): Promise<DataModels.ManualTasks.ManualTask> {

    const manualTaskModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(manualTaskInstance.flowNodeId);

    const onSuspendToken: ProcessToken = manualTaskInstance.getTokenByType(ProcessTokenType.onSuspend);

    const consumerApiManualTask: DataModels.ManualTasks.ManualTask = {
      id: manualTaskInstance.flowNodeId,
      flowNodeInstanceId: manualTaskInstance.id,
      name: manualTaskModel.name,
      correlationId: manualTaskInstance.correlationId,
      processModelId: manualTaskInstance.processModelId,
      processInstanceId: manualTaskInstance.processInstanceId,
      tokenPayload: onSuspendToken.payload,
    };

    return consumerApiManualTask;

  }
}
