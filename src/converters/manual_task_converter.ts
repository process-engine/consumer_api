import {IIdentity} from '@essential-projects/iam_contracts';

import {ManualTask, ManualTaskList} from '@process-engine/consumer_api_contracts';
import {
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessModelService,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';
/**
 * Used to cache process models during ManualTask conversion.
 * This helps to avoid repeated queries against the database for the same ProcessModel.
 */
type ProcessModelCache = {[processModelId: string]: Model.Types.Process};

export class ManualTaskConverter {

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

  public async convert(identity: IIdentity, suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance>): Promise<ManualTaskList> {

    const suspendedManualTasks: Array<ManualTask> = [];

    const processModelCache: ProcessModelCache = {};

    for (const suspendedFlowNode of suspendedFlowNodes) {

      const currentProcessToken: Runtime.Types.ProcessToken = suspendedFlowNode.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === Runtime.Types.ProcessTokenType.onSuspend;
      });

      let processModel: Model.Types.Process;

      // To avoid repeated Queries against the database for the same process model,
      // the retrieved process models will be cached.
      // So when we want to get a ProcessModel for a ManualTask, we first check the cache and
      // get the ProcessModel from there.
      // We only query the database, if the ProcessModel was not yet retrieved.
      // This avoids timeouts and request-lags when converting large numbers of manual tasks.
      const modelInCache: boolean = processModelCache[currentProcessToken.processModelId] !== undefined;

      if (modelInCache) {
        processModel = processModelCache[currentProcessToken.processModelId];
      } else {
        processModel = await this.processModelService.getProcessModelById(identity, currentProcessToken.processModelId);
        processModelCache[currentProcessToken.processModelId] = processModel;
      }

      const manualTask: ManualTask =
        await this._convertSuspendedFlowNodeToManualTask(suspendedFlowNode, currentProcessToken, processModel);

      const taskIsNotAManualTask: boolean = manualTask === undefined;
      if (taskIsNotAManualTask) {
        continue;
      }

      suspendedManualTasks.push(manualTask);
    }

    const manualTaskList: ManualTaskList = {
      manualTasks: suspendedManualTasks,
    };

    return manualTaskList;
  }

  private async _convertSuspendedFlowNodeToManualTask(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                                      currentProcessToken: Runtime.Types.ProcessToken,
                                                      processModel: Model.Types.Process,
                                                    ): Promise<ManualTask> {

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
    const flowNodeModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(flowNodeInstance.flowNodeId);

    // Note that ManualTasks are not the only types of FlowNodes that can be suspended.
    // So we must make sure that what we have here is actually a ManualTask and not, for example, a TimerEvent.
    const flowNodeIsNotAManualTask: boolean = flowNodeModel.constructor.name !== 'ManualTask';

    if (flowNodeIsNotAManualTask) {
      return undefined;
    }

    return this._convertToConsumerApiManualTask(flowNodeModel as Model.Activities.ManualTask, flowNodeInstance, currentProcessToken);
  }

  private async _convertToConsumerApiManualTask(manualTask: Model.Activities.ManualTask,
                                                flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                                currentProcessToken: Runtime.Types.ProcessToken,
                                              ): Promise<ManualTask> {

    const consumerApiManualTask: ManualTask = {
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
