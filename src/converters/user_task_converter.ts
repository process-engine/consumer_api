import { IIdentity } from '@essential-projects/iam_contracts';
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

  private async _getOldTokenFormatForFlowNodeInstance(flowNodeInstance: Runtime.Types.FlowNodeInstance): Promise<any> {

    const processInstanceId: string = flowNodeInstance.token.processInstanceId;
    const processModelId: string = flowNodeInstance.token.processModelId;
    const correlationId: string = flowNodeInstance.token.correlationId;
    const identity: IIdentity = flowNodeInstance.token.identity;

    const processInstanceTokens: Array<Runtime.Types.ProcessToken> =
      await this.flowNodeInstanceService.queryProcessTokensByProcessInstance(processInstanceId);

    const processTokenFacade: IProcessTokenFacade = this.processTokenFacadeFactory.create(processInstanceId, processModelId, correlationId, identity);

    const processTokenResultPromises: Array<Promise<IProcessTokenResult>> =
      processInstanceTokens.map(async(processToken: Runtime.Types.ProcessToken) => {

      const processTokenFlowNodeInstance: Runtime.Types.FlowNodeInstance =
        await this.flowNodeInstanceService.getFlowNodeInstanceById(processToken.flowNodeInstanceId);

      return {
        flowNodeId: processTokenFlowNodeInstance.flowNodeId,
        result: processToken.payload,
      };
    });

    const processTokenResults: Array<IProcessTokenResult> = await Promise.all(processTokenResultPromises);

    processTokenFacade.importResults(processTokenResults);

    return await processTokenFacade.getOldTokenFormat();
  }

  private _evaluateExpressionWithOldToken(expression: string, oldTokenFormat: any): string {

    let result: string = '';

    if (!expression) {
      return result;
    }

    const expressionStartsOn: string = '${';
    const expressionEndsOn: string = '}';

    const isExpression: boolean = expression.charAt(0) === '$';
    if (isExpression === false) {
      return result;
    }

    const expressionBody: string = expression.substr(expressionStartsOn.length, expression.length - expressionStartsOn.length - expressionEndsOn.length);

    const functionString: string = `return ${expressionBody}`;
    const scriptFunction: Function = new Function('token', functionString);

    result = scriptFunction.call(undefined, oldTokenFormat);
    result = result === undefined ? null : result;

    return result;
  }

  public async convertToConsumerApiUserTask(userTask: Model.Activities.UserTask,
                                            flowNodeInstance: Runtime.Types.FlowNodeInstance): Promise<UserTask> {

    const oldTokenFormat: any = await this._getOldTokenFormatForFlowNodeInstance(flowNodeInstance);

    const consumerApiFormFields: Array<UserTaskFormField> = userTask.formFields.map((formField: Model.Types.FormField) => {
      return this.convertToConsumerApiFormField(formField, oldTokenFormat);
    });

    const userTaskConfig: UserTaskConfig = {
      formFields: consumerApiFormFields,
      preferredControl: this._evaluateExpressionWithOldToken(userTask.preferredControl, oldTokenFormat),
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

  public convertToConsumerApiFormField(formField: Model.Types.FormField, oldTokenFormat: any): UserTaskFormField {

    const userTaskFormField: UserTaskFormField = new UserTaskFormField();
    userTaskFormField.id = formField.id;
    userTaskFormField.label = this._evaluateExpressionWithOldToken(formField.label, oldTokenFormat);
    userTaskFormField.type = this.convertToConsumerApiFormFieldType(formField.type);
    userTaskFormField.enumValues = formField.enumValues;
    userTaskFormField.defaultValue = this._evaluateExpressionWithOldToken(formField.defaultValue, oldTokenFormat);
    userTaskFormField.preferredControl = this._evaluateExpressionWithOldToken(formField.preferredControl, oldTokenFormat);

    return userTaskFormField;
  }

  public convertToConsumerApiFormFieldType(type: string): UserTaskFormFieldType {
    return UserTaskFormFieldType[type];
  }

  public getOldProcessTokenFormat(): any {
    // const processTokenFacade = this.processTokenFacadeFactory.create();

  }
}
