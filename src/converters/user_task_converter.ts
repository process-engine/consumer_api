import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/consumer_api_contracts';
import {
  ICorrelationService,
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

import * as ProcessModelCache from './process_model_cache';

export class UserTaskConverter {

  private readonly _correlationService: ICorrelationService;
  private readonly _processModelService: IProcessModelService;
  private readonly _flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly _processModelFacadeFactory: IProcessModelFacadeFactory;
  private readonly _processTokenFacadeFactory: IProcessTokenFacadeFactory;

  constructor(
    correlationRepository: ICorrelationService,
    processModelService: IProcessModelService,
    flowNodeInstanceService: IFlowNodeInstanceService,
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processTokenFacadeFactory: IProcessTokenFacadeFactory,
  ) {
    this._correlationService = correlationRepository;
    this._processModelService = processModelService;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processTokenFacadeFactory = processTokenFacadeFactory;
  }

  public async convertUserTasks(
    identity: IIdentity,
    suspendedFlowNodes: Array<Runtime.Types.FlowNodeInstance>,
  ): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedUserTasks: Array<DataModels.UserTasks.UserTask> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      const processModelFacade: IProcessModelFacade =
        await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);

      const flowNodeModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(suspendedFlowNode.flowNodeId);

      // Note that UserTasks are not the only types of FlowNodes that can be suspended.
      // So we must make sure that what we have here is actually a UserTask and not, for example, a TimerEvent.
      const flowNodeIsNotAUserTask: boolean = flowNodeModel.constructor.name !== 'UserTask';

      if (flowNodeIsNotAUserTask) {
        continue;
      }

      const userTask: DataModels.UserTasks.UserTask =
        await this.convertToConsumerApiUserTask(flowNodeModel as Model.Activities.UserTask, suspendedFlowNode);

      suspendedUserTasks.push(userTask);
    }

    const userTaskList: DataModels.UserTasks.UserTaskList = {
      userTasks: suspendedUserTasks,
    };

    return userTaskList;
  }

  private async getProcessModelForFlowNodeInstance(
    identity: IIdentity,
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
  ): Promise<IProcessModelFacade> {

    let processModel: Model.Types.Process;

    const cacheHasMatchingEntry: boolean = ProcessModelCache.hasEntry(flowNodeInstance.processInstanceId);
    if (cacheHasMatchingEntry) {
      processModel = ProcessModelCache.get(flowNodeInstance.processInstanceId);
    } else {
      const processModelHash: string = await this.getProcessModelHashForProcessInstance(identity, flowNodeInstance.processInstanceId);
      processModel = await this._processModelService.getByHash(identity, flowNodeInstance.processModelId, processModelHash);
      ProcessModelCache.add(flowNodeInstance.processInstanceId, processModel);
    }

    const processModelFacade: IProcessModelFacade = this._processModelFacadeFactory.create(processModel);

    return processModelFacade;
  }

  private async getProcessModelHashForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<string> {
    const correlationForProcessInstance: Runtime.Types.Correlation =
      await this._correlationService.getByProcessInstanceId(identity, processInstanceId);

    // Note that ProcessInstances will only ever have one processModel and therefore only one hash attached to them.
    return correlationForProcessInstance.processModels[0].hash;
  }

  private async convertToConsumerApiUserTask(
    userTaskModel: Model.Activities.UserTask,
    userTaskInstance: Runtime.Types.FlowNodeInstance,
  ): Promise<DataModels.UserTasks.UserTask> {

    const currentUserTaskToken: Runtime.Types.ProcessToken = userTaskInstance.getTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

    const userTaskTokenOldFormat: any = await this._getUserTaskTokenInOldFormat(currentUserTaskToken);

    const userTaskFormFields: Array<DataModels.UserTasks.UserTaskFormField> = userTaskModel.formFields.map((formField: Model.Types.FormField) => {
      return this.convertToConsumerApiFormField(formField, userTaskTokenOldFormat);
    });

    const userTaskConfig: DataModels.UserTasks.UserTaskConfig = {
      formFields: userTaskFormFields,
      preferredControl: this._evaluateExpressionWithOldToken(userTaskModel.preferredControl, userTaskTokenOldFormat),
      description: userTaskModel.description,
      finishedMessage: userTaskModel.finishedMessage,
    };

    const consumerApiUserTask: DataModels.UserTasks.UserTask = {
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

  private convertToConsumerApiFormField(formField: Model.Types.FormField, oldTokenFormat: any): DataModels.UserTasks.UserTaskFormField {

    const userTaskFormField: DataModels.UserTasks.UserTaskFormField = new DataModels.UserTasks.UserTaskFormField();
    userTaskFormField.id = formField.id;
    userTaskFormField.label = this._evaluateExpressionWithOldToken(formField.label, oldTokenFormat);
    userTaskFormField.type = DataModels.UserTasks.UserTaskFormFieldType[formField.type];
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
      await this._flowNodeInstanceService.queryProcessTokensByProcessInstanceId(processInstanceId);

    const filteredInstanceTokens: Array<Runtime.Types.ProcessToken> = processInstanceTokens.filter((token: Runtime.Types.ProcessToken) => {
      return token.type === Runtime.Types.ProcessTokenType.onExit;
    });

    const processTokenFacade: IProcessTokenFacade =
      this._processTokenFacadeFactory.create(processInstanceId, processModelId, correlationId, identity);

    const processTokenResultPromises: Array<Promise<IProcessTokenResult>> =
      filteredInstanceTokens.map(async(processToken: Runtime.Types.ProcessToken) => {

        const processTokenFlowNodeInstance: Runtime.Types.FlowNodeInstance =
          await this._flowNodeInstanceService.queryByInstanceId(processToken.flowNodeInstanceId);

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
