import {UserTask, UserTaskConfig, UserTaskFormField, UserTaskFormFieldType, UserTaskList} from '@process-engine/consumer_api_contracts';
import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessModelService,
  IProcessTokenFacade,
  IProcessTokenFacadeFactory,
  IProcessTokenResult,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

export class UserTaskConverter {

  private _processModelService: IProcessModelService;
  private _flowNodeInstanceService: IFlowNodeInstanceService;
  private _processModelFacadeFactory: IProcessModelFacadeFactory;
  private _processTokenFacadeFactory: IProcessTokenFacadeFactory;

  constructor(processModelService: IProcessModelService,
              flowNodeInstanceService: IFlowNodeInstanceService,
              processModelFacadeFactory: IProcessModelFacadeFactory,
              processTokenFacadeFactory: IProcessTokenFacadeFactory) {
    this._processModelService = processModelService;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processTokenFacadeFactory = processTokenFacadeFactory;
  }

  private get processModelService(): IProcessModelService {
    return this._processModelService;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
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

      const currentProcessToken: Runtime.Types.ProcessToken = suspendedFlowNode.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === Runtime.Types.ProcessTokenType.onSuspend
          || token.type === Runtime.Types.ProcessTokenType.onExit;
      });

      const tokenBelongsToDifferentProcessModel: boolean = processModelId && currentProcessToken.processModelId !== processModelId;
      if (tokenBelongsToDifferentProcessModel) {
        continue;
      }

      const userTask: UserTask = await this.convertSuspendedFlowNodeToUserTask(executionContextFacade, suspendedFlowNode, currentProcessToken);

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

  private async convertSuspendedFlowNodeToUserTask(executionContextFacade: IExecutionContextFacade,
                                                   flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                                   currentProcessToken: Runtime.Types.ProcessToken,
                                                  ): Promise<UserTask> {

    const processModel: Model.Types.Process =
      await this.processModelService.getProcessModelById(executionContextFacade, currentProcessToken.processModelId);

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);
    const flowNodeModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(flowNodeInstance.flowNodeId);

    // Note that UserTasks are not the only types of FlowNodes that can be suspended.
    // So we must make sure that what we have here is actually a UserTask and not, for example, a TimerEvent.
    const flowNodeIsAUserTask: boolean = flowNodeModel.constructor.name === 'UserTask';

    if (!flowNodeIsAUserTask) {
      return undefined;
    }

    return this.convertToConsumerApiUserTask(flowNodeModel as Model.Activities.UserTask, flowNodeInstance, currentProcessToken);
  }

  private async convertToConsumerApiUserTask(userTask: Model.Activities.UserTask,
                                             flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                             currentProcessToken: Runtime.Types.ProcessToken,
                                            ): Promise<UserTask> {

    const oldTokenFormat: any = await this._getOldTokenFormatForFlowNodeInstance(flowNodeInstance, currentProcessToken);

    const consumerApiFormFields: Array<UserTaskFormField> = userTask.formFields.map((formField: Model.Types.FormField) => {
      return this.convertToConsumerApiFormField(formField, oldTokenFormat);
    });

    const userTaskConfig: UserTaskConfig = {
      formFields: consumerApiFormFields,
      preferredControl: this._evaluateExpressionWithOldToken(userTask.preferredControl, oldTokenFormat),
    };

    const consumerApiUserTask: UserTask = {
      id: flowNodeInstance.flowNodeId,
      correlationId: currentProcessToken.correlationId,
      processModelId: currentProcessToken.processModelId,
      processInstanceId: currentProcessToken.processInstanceId,
      data: userTaskConfig,
      tokenPayload: currentProcessToken.payload,
    };

    return consumerApiUserTask;
  }

  private convertToConsumerApiFormField(formField: Model.Types.FormField, oldTokenFormat: any): UserTaskFormField {

    const userTaskFormField: UserTaskFormField = new UserTaskFormField();
    userTaskFormField.id = formField.id;
    userTaskFormField.label = this._evaluateExpressionWithOldToken(formField.label, oldTokenFormat);
    userTaskFormField.type = this.convertToConsumerApiFormFieldType(formField.type);
    userTaskFormField.enumValues = formField.enumValues;
    userTaskFormField.defaultValue = this._evaluateExpressionWithOldToken(formField.defaultValue, oldTokenFormat);
    userTaskFormField.preferredControl = this._evaluateExpressionWithOldToken(formField.preferredControl, oldTokenFormat);

    return userTaskFormField;
  }

  private convertToConsumerApiFormFieldType(type: string): UserTaskFormFieldType {
    return UserTaskFormFieldType[type];
  }

  private _evaluateExpressionWithOldToken(expression: string, oldTokenFormat: any): string | null {

    let result: string = expression;

    if (!expression) {
      return result;
    }

    const expressionStartsOn: string = '${';
    const expressionEndsOn: string = '}';

    const isExpression: boolean = expression.charAt(0) === '$';
    if (isExpression === false) {
      return result;
    }

    const finalExpressionLength: number = expression.length - expressionStartsOn.length - expressionEndsOn.length;
    const expressionBody: string = expression.substr(expressionStartsOn.length, finalExpressionLength);

    const functionString: string = `return ${expressionBody}`;
    const scriptFunction: Function = new Function('token', functionString);

    result = scriptFunction.call(undefined, oldTokenFormat);
    result = result === undefined ? null : result;

    return result;
  }

  private async _getOldTokenFormatForFlowNodeInstance(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                                      currentProcessToken: Runtime.Types.ProcessToken,
                                                     ): Promise<any> {

    const {processInstanceId, processModelId, correlationId, identity} = currentProcessToken;

    const processInstanceTokens: Array<Runtime.Types.ProcessToken> =
      await this.flowNodeInstanceService.queryProcessTokensByProcessInstanceId(processInstanceId);

    const filteredInstanceTokens: Array<Runtime.Types.ProcessToken> = processInstanceTokens.filter((token: Runtime.Types.ProcessToken) => {
      return token.type === Runtime.Types.ProcessTokenType.onExit;
    });

    const processTokenFacade: IProcessTokenFacade = this.processTokenFacadeFactory.create(processInstanceId, processModelId, correlationId, identity);

    const processTokenResultPromises: Array<Promise<IProcessTokenResult>> =
      filteredInstanceTokens.map(async(processToken: Runtime.Types.ProcessToken) => {

      const processTokenFlowNodeInstance: Runtime.Types.FlowNodeInstance =
        await this.flowNodeInstanceService.queryByInstanceId(processToken.flowNodeInstanceId);

      return {
        flowNodeId: processTokenFlowNodeInstance.flowNodeId,
        result: processToken.payload,
      };
    });

    const processTokenResults: Array<IProcessTokenResult> = await Promise.all(processTokenResultPromises);

    processTokenFacade.importResults(processTokenResults);

    return await processTokenFacade.getOldTokenFormat();
  }
}
