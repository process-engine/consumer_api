import {ProcessInstance} from '@process-engine/consumer_api_contracts';
import {Runtime} from '@process-engine/process_engine_contracts';

export class ProcessInstanceConverter {

  public convertFlowNodeInstances(flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>): Array<ProcessInstance> {

    const activeProcessInstances: Array<ProcessInstance> = [];

    for (const flowNodeInstance of flowNodeInstances) {

      const processInstanceListHasNoMatchingEntry: boolean =
        !activeProcessInstances.some((entry: ProcessInstance): boolean => {
          return entry.id === flowNodeInstance.processInstanceId;
        });

      if (processInstanceListHasNoMatchingEntry) {
        const processInstance: ProcessInstance = new ProcessInstance(flowNodeInstance.processInstanceId,
                                                                     flowNodeInstance.processModelId,
                                                                     flowNodeInstance.correlationId,
                                                                     flowNodeInstance.identity,
                                                                     flowNodeInstance.parentProcessInstanceId);
        activeProcessInstances.push(processInstance);
      }
    }

    return activeProcessInstances;

  }

}
