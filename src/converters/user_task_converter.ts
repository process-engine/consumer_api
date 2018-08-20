import {UserTask, UserTaskConfig, UserTaskFormField, UserTaskFormFieldType, UserTaskList} from '@process-engine/consumer_api_contracts';
import {
  IExecutionContextFacade,
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessModelService,
  IProcessTokenFacadeFactory,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

export class UserTaskConverter {

  private _processModelService: IProcessModelService;
  private _processModelFacadeFactory: IProcessModelFacadeFactory;
  private _processTokenFacadeFactory: IProcessTokenFacadeFactory;

  constructor(processModelService: IProcessModelService,
              processModelFacadeFactory: IProcessModelFacadeFactory,
              processTokenFacadeFactory: IProcessTokenFacadeFactory) {
    this._processModelService = processModelService;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processTokenFacadeFactory = processTokenFacadeFactory;
  }

  private get processModelService(): IProcessModelService {
    return this._processModelService;
  }

  private get processModelFacadeFactory(): IProcessModelFacadeFactory {
    return this._processModelFacadeFactory;
  }

  private get processTokenFacadeFactory(): IProcessTokenFacadeFactory {
    return this._processTokenFacadeFactory;
  }

  public async convertUserTasks(executionContextFacade: IExecutionContextFacade,
                                suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance>,
                                processModelId?: string): Promise<UserTaskList> {

    const suspendedUserTasks: Array<UserTask> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      if (processModelId && suspendedFlowNode.token.processModelId !== processModelId) {
        continue;
      }

      const userTask: UserTask = await this.convertSuspendedFlowNodeToUserTask(executionContextFacade, suspendedFlowNode);

      if (userTask === undefined) {
        continue;
      }

      suspendedUserTasks.push(userTask);
    }

    const userTaskList: UserTaskList = {
      userTasks: suspendedUserTasks,
    };

    return userTaskList;
  }

  public async convertSuspendedFlowNodeToUserTask(executionContextFacade: IExecutionContextFacade,
                                                  flowNodeInstance: Runtime.Types.FlowNodeInstance): Promise<UserTask> {

    const processModel: Model.Types.Process =
      await this.processModelService.getProcessModelById(executionContextFacade, flowNodeInstance.token.processModelId);

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
    const userTask: Model.Activities.UserTask = processModelFacade.getFlowNodeById(flowNodeInstance.flowNodeId) as Model.Activities.UserTask;

    return this.convertToConsumerApiUserTask(userTask, flowNodeInstance);
  }

  public convertToConsumerApiUserTask(userTask: Model.Activities.UserTask, flowNodeInstance: Runtime.Types.FlowNodeInstance): UserTask {

    const consumerApiFormFields: Array<UserTaskFormField> = userTask.formFields.map((formField: Model.Types.FormField) => {
      return this.convertToConsumerApiFormField(formField);
    });

    const userTaskConfig: UserTaskConfig = {
      formFields: consumerApiFormFields,
      preferredControl: userTask.preferredControl,
    };

    const consumerApiUserTask: UserTask = {
      id: flowNodeInstance.flowNodeId,
      correlationId: flowNodeInstance.token.correlationId,
      processModelId: flowNodeInstance.token.processModelId,
      data: userTaskConfig,
      tokenPayload: flowNodeInstance.token.payload,
    };

    return consumerApiUserTask;
  }

  public convertToConsumerApiFormField(formField: Model.Types.FormField): UserTaskFormField {

    const userTaskFormField: UserTaskFormField = new UserTaskFormField();
    userTaskFormField.id = formField.id;
    userTaskFormField.label = formField.label;
    userTaskFormField.type = this.convertToConsumerApiFormFieldType(formField.type);
    userTaskFormField.enumValues = formField.enumValues;
    userTaskFormField.defaultValue = formField.defaultValue;
    userTaskFormField.preferredControl = formField.preferredControl;

    return userTaskFormField;
  }

  public convertToConsumerApiFormFieldType(type: string): UserTaskFormFieldType {
    return UserTaskFormFieldType[type];
  }

  public getOldProcessTokenFormat(): any {
    // const processTokenFacade = this.processTokenFacadeFactory.create();

  }
}
