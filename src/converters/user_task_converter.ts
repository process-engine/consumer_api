import {IIdentity} from '@essential-projects/iam_contracts';

import {UserTask, UserTaskConfig, UserTaskFormField, UserTaskFormFieldType, UserTaskList} from '@process-engine/consumer_api_contracts';
import {
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

/**
 * Used to cache ProcessModels during UserTask conversion.
 * This helps to avoid repeated queries against the database for the same ProcessModel.
 */
type ProcessModelCache = {[processModelId: string]: Model.Types.Process};

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

  public async convertUserTasks(identity: IIdentity, suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance>): Promise<UserTaskList> {

    const suspendedUserTasks: Array<UserTask> = [];

    const processModelCache: ProcessModelCache = {};

    for (const suspendedFlowNode of suspendedFlowNodes) {

      const processModelFacade: IProcessModelFacade =
        await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode.processModelId, processModelCache);

      const flowNodeModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(suspendedFlowNode.flowNodeId);

      // Note that UserTasks are not the only types of FlowNodes that can be suspended.
      // So we must make sure that what we have here is actually a UserTask and not, for example, a TimerEvent.
      const flowNodeIsNotAUserTask: boolean = flowNodeModel.constructor.name !== 'UserTask';

      if (flowNodeIsNotAUserTask) {
        continue;
      }

      const userTask: UserTask = await this.convertToConsumerApiUserTask(flowNodeModel as Model.Activities.UserTask, suspendedFlowNode);

      suspendedUserTasks.push(userTask);
    }

    const userTaskList: UserTaskList = {
      userTasks: suspendedUserTasks,
    };

    return userTaskList;
  }

  private async getProcessModelForFlowNodeInstance(
    identity: IIdentity,
    processModelId: string,
    processModelCache: ProcessModelCache,
  ): Promise<IProcessModelFacade> {

    let processModel: Model.Types.Process;

    // To avoid repeated Queries against the database for the same ProcessModel,
    // the retrieved ProcessModels will be cached.
    // So when we want to get a ProcessModel for a UserTask, we first check the cache and
    // get the ProcessModel from there.
    // We only query the database, if the ProcessModel was not yet retrieved.
    // This avoids timeouts and request-lags when converting large numbers of user tasks.
    const cacheHasMatchingEntry: boolean = processModelCache[processModelId] !== undefined;

    if (cacheHasMatchingEntry) {
      processModel = processModelCache[processModelId];
    } else {
      processModel = await this.processModelService.getProcessModelById(identity, processModelId);
      processModelCache[processModelId] = processModel;
    }

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);

    return processModelFacade;
  }

  private async convertToConsumerApiUserTask(userTaskModel: Model.Activities.UserTask,
                                             userTaskInstance: Runtime.Types.FlowNodeInstance,
                                            ): Promise<UserTask> {

    const currentUserTaskToken: Runtime.Types.ProcessToken =
      userTaskInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === Runtime.Types.ProcessTokenType.onSuspend;
      });

    const userTaskTokenOldFormat: any = await this._getUserTaskTokenInOldFormat(currentUserTaskToken);

    const userTaskFormFields: Array<UserTaskFormField> = userTaskModel.formFields.map((formField: Model.Types.FormField) => {
      return this.convertToConsumerApiFormField(formField, userTaskTokenOldFormat);
    });

    const userTaskConfig: UserTaskConfig = {
      formFields: userTaskFormFields,
      preferredControl: this._evaluateExpressionWithOldToken(userTaskModel.preferredControl, userTaskTokenOldFormat),
    };

    const consumerApiUserTask: UserTask = {
      id: userTaskInstance.flowNodeId,
      flowNodeInstanceId: userTaskInstance.id,
      name: userTaskModel.name,
      correlationId: userTaskInstance.correlationId,
      processModelId: userTaskInstance.processModelId,
      processInstanceId: userTaskInstance.processInstanceId,
      data: userTaskConfig,
      tokenPayload: currentUserTaskToken.payload,
    };

    return consumerApiUserTask;
  }

  private convertToConsumerApiFormField(formField: Model.Types.FormField, oldTokenFormat: any): UserTaskFormField {

    const userTaskFormField: UserTaskFormField = new UserTaskFormField();
    userTaskFormField.id = formField.id;
    userTaskFormField.label = this._evaluateExpressionWithOldToken(formField.label, oldTokenFormat);
    userTaskFormField.type = UserTaskFormFieldType[formField.type];
    userTaskFormField.enumValues = formField.enumValues;
    userTaskFormField.defaultValue = this._evaluateExpressionWithOldToken(formField.defaultValue, oldTokenFormat);
    userTaskFormField.preferredControl = this._evaluateExpressionWithOldToken(formField.preferredControl, oldTokenFormat);

    return userTaskFormField;
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

  private async _getUserTaskTokenInOldFormat(currentProcessToken: Runtime.Types.ProcessToken): Promise<any> {

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
