import {UserTask, UserTaskConfig, UserTaskFormField, UserTaskFormFieldType, UserTaskList} from '@process-engine/consumer_api_contracts';
import {
  IExecutionContextFacade,
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessModelService,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

let _processModelFacadeFactory: IProcessModelFacadeFactory;
let _processModelService: IProcessModelService;

export function createUserTaskConverter(processModelFacadeFactory: IProcessModelFacadeFactory,
                                        processModelService: IProcessModelService): Function {

  _processModelFacadeFactory = processModelFacadeFactory;
  _processModelService = processModelService;

  return async(executionContextFacade: IExecutionContextFacade,
               suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance>,
               processModelId?: string,
              ): Promise<UserTaskList> => {

    const suspendedUserTasks: Array<UserTask> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      const currentProcessToken: Runtime.Types.ProcessToken = suspendedFlowNode.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === Runtime.Types.ProcessTokenType.onSuspend;
      });

      if (processModelId && currentProcessToken.processModelId !== processModelId) {
        continue;
      }

      const userTask: UserTask = await convertSuspendedFlowNodeToUserTask(executionContextFacade, suspendedFlowNode, currentProcessToken);

      if (userTask === undefined) {
        continue;
      }

      suspendedUserTasks.push(userTask);
    }

    const userTaskList: UserTaskList = {
      userTasks: suspendedUserTasks,
    };

    return userTaskList;
  };
}

async function convertSuspendedFlowNodeToUserTask(executionContextFacade: IExecutionContextFacade,
                                                  flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                                  currentProcessToken: Runtime.Types.ProcessToken,
                                                 ): Promise<UserTask> {

  const processModel: Model.Types.Process =
    await _processModelService.getProcessModelById(executionContextFacade, currentProcessToken.processModelId);

  const processModelFacade: IProcessModelFacade = _processModelFacadeFactory.create(processModel);
  const userTask: Model.Activities.UserTask = processModelFacade.getFlowNodeById(flowNodeInstance.flowNodeId) as Model.Activities.UserTask;

  return convertToConsumerApiUserTask(userTask, flowNodeInstance, currentProcessToken);
}

function convertToConsumerApiUserTask(userTask: Model.Activities.UserTask,
                                      flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                      currentProcessToken: Runtime.Types.ProcessToken,
                                     ): UserTask {

  const consumerApiFormFields: Array<UserTaskFormField> = userTask.formFields.map((formField: Model.Types.FormField) => {
    return convertToConsumerApiFormField(formField);
  });

  const userTaskConfig: UserTaskConfig = {
    formFields: consumerApiFormFields,
    preferredControl: userTask.preferredControl,
  };

  const consumerApiUserTask: UserTask = {
    id: flowNodeInstance.flowNodeId,
    correlationId: currentProcessToken.correlationId,
    processModelId: currentProcessToken.processModelId,
    data: userTaskConfig,
    tokenPayload: currentProcessToken.payload,
  };

  return consumerApiUserTask;
}

function convertToConsumerApiFormField(formField: Model.Types.FormField): UserTaskFormField {

  const userTaskFormField: UserTaskFormField = new UserTaskFormField();
  userTaskFormField.id = formField.id;
  userTaskFormField.label = formField.label;
  userTaskFormField.type = convertToConsumerApiFormFieldType(formField.type);
  userTaskFormField.enumValues = formField.enumValues;
  userTaskFormField.defaultValue = formField.defaultValue;
  userTaskFormField.preferredControl = formField.preferredControl;

  return userTaskFormField;
}

function convertToConsumerApiFormFieldType(type: string): UserTaskFormFieldType {
  return UserTaskFormFieldType[type];
}
