import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/consumer_api_contracts';
import {Correlation, ICorrelationService} from '@process-engine/correlation.contracts';
import {FlowNodeInstance, ProcessToken, ProcessTokenType} from '@process-engine/flow_node_instance.contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory} from '@process-engine/process_engine_contracts';
import {IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

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

      const processModelFacade: IProcessModelFacade =
        await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);

      const manualTask: DataModels.ManualTasks.ManualTask =
        await this._convertSuspendedFlowNodeToManualTask(suspendedFlowNode, processModelFacade);

      const taskIsNotAManualTask: boolean = manualTask === undefined;
      if (taskIsNotAManualTask) {
        continue;
      }

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

    let processModel: Model.Types.Process;

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
    flowNodeInstance: FlowNodeInstance,
    processModelFacade: IProcessModelFacade,
  ): Promise<DataModels.ManualTasks.ManualTask> {

    const flowNodeModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(flowNodeInstance.flowNodeId);

    // Note that ManualTasks are not the only types of FlowNodes that can be suspended.
    // So we must make sure that what we have here is actually a ManualTask and not, for example, a TimerEvent.
    const flowNodeIsNotAManualTask: boolean = flowNodeModel.constructor.name !== 'ManualTask';

    if (flowNodeIsNotAManualTask) {
      return undefined;
    }

    return this._convertToConsumerApiManualTask(flowNodeModel as Model.Activities.ManualTask, flowNodeInstance);
  }

  private async _convertToConsumerApiManualTask(
    manualTask: Model.Activities.ManualTask,
    flowNodeInstance: FlowNodeInstance,
  ): Promise<DataModels.ManualTasks.ManualTask> {

    const currentProcessToken: ProcessToken =
      flowNodeInstance.tokens.find((token: ProcessToken): boolean => {
        return token.type === ProcessTokenType.onSuspend;
      });

    const consumerApiManualTask: DataModels.ManualTasks.ManualTask = {
      id: flowNodeInstance.flowNodeId,
      flowNodeInstanceId: flowNodeInstance.id,
      name: manualTask.name,
      correlationId: flowNodeInstance.correlationId,
      processModelId: flowNodeInstance.processModelId,
      processInstanceId: flowNodeInstance.processInstanceId,
      tokenPayload: currentProcessToken.payload,
    };

    return consumerApiManualTask;
  }
}
