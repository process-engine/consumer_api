import {DataModels} from '@process-engine/consumer_api_contracts';
import {Runtime} from '@process-engine/process_engine_contracts';

export class ProcessInstanceConverter {

  public convertFlowNodeInstances(flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>): Array<DataModels.ProcessInstance> {

    const activeProcessInstances: Array<DataModels.ProcessInstance> = [];

    for (const flowNodeInstance of flowNodeInstances) {

      const processInstanceListHasNoMatchingEntry: boolean =
        !activeProcessInstances.some((entry: DataModels.ProcessInstance): boolean => {
          return entry.id === flowNodeInstance.processInstanceId;
        });

      if (processInstanceListHasNoMatchingEntry) {
        const processInstance: DataModels.ProcessInstance =
          new DataModels.ProcessInstance(flowNodeInstance.processInstanceId,
                                         flowNodeInstance.processModelId,
                                         flowNodeInstance.correlationId,
                                         flowNodeInstance.owner,
                                         flowNodeInstance.parentProcessInstanceId);
        activeProcessInstances.push(processInstance);
      }
    }

    return activeProcessInstances;
  }
}
