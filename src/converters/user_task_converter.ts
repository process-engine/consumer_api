import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/consumer_api_contracts';
import {Correlation, ICorrelationService} from '@process-engine/correlation.contracts';
import {FlowNodeInstance, IFlowNodeInstanceService, ProcessToken, ProcessTokenType} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeInstanceResult,
  IProcessModelFacade,
  IProcessModelFacadeFactory,
  IProcessTokenFacade,
  IProcessTokenFacadeFactory,
} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import * as ProcessModelCache from './process_model_cache';

export class UserTaskConverter {

  private readonly _correlationService: ICorrelationService;
  private readonly _flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly _processModelFacadeFactory: IProcessModelFacadeFactory;
  private readonly _processModelUseCase: IProcessModelUseCases;
  private readonly _processTokenFacadeFactory: IProcessTokenFacadeFactory;

  constructor(
    correlationRepository: ICorrelationService,
    flowNodeInstanceService: IFlowNodeInstanceService,
    processModelFacadeFactory: IProcessModelFacadeFactory,
    processModelUse: IProcessModelUseCases,
    processTokenFacadeFactory: IProcessTokenFacadeFactory,
  ) {
    this._correlationService = correlationRepository;
    this._processModelUseCase = processModelUse;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._processModelFacadeFactory = processModelFacadeFactory;
    this._processTokenFacadeFactory = processTokenFacadeFactory;
  }

  public async convertUserTasks(
    identity: IIdentity,
    suspendedFlowNodes: Array<FlowNodeInstance>,
  ): Promise<DataModels.UserTasks.UserTaskList> {

    const suspendedUserTasks: Array<DataModels.UserTasks.UserTask> = [];

    for (const suspendedFlowNode of suspendedFlowNodes) {

      // Note that UserTasks are not the only types of FlowNodes that can be suspended.
      // So we must make sure that what we have here is actually a UserTask and not, for example, a TimerEvent.
      const flowNodeIsNotAUserTask: boolean = suspendedFlowNode.flowNodeType !== BpmnType.userTask;
      if (flowNodeIsNotAUserTask) {
        continue;
      }

      const processModelFacade: IProcessModelFacade =
        await this.getProcessModelForFlowNodeInstance(identity, suspendedFlowNode);

      const flowNodeModel: Model.Base.FlowNode = processModelFacade.getFlowNodeById(suspendedFlowNode.flowNodeId);

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
    flowNodeInstance: FlowNodeInstance,
  ): Promise<IProcessModelFacade> {

    let processModel: Model.Process;

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
    return correlationForProcessInstance.processInstances[0].hash;
  }

  private async convertToConsumerApiUserTask(
    userTaskModel: Model.Activities.UserTask,
    userTaskInstance: FlowNodeInstance,
  ): Promise<DataModels.UserTasks.UserTask> {

    const currentUserTaskToken: ProcessToken = userTaskInstance.getTokenByType(ProcessTokenType.onSuspend);

    const userTaskTokenOldFormat: any = await this._getUserTaskTokenInOldFormat(currentUserTaskToken);

    const userTaskFormFields: Array<DataModels.UserTasks.UserTaskFormField> =
      userTaskModel.formFields.map((formField: Model.Activities.Types.UserTaskFormField) => {
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

  private convertToConsumerApiFormField(
    formField: Model.Activities.Types.UserTaskFormField,
    oldTokenFormat: any,
  ): DataModels.UserTasks.UserTaskFormField {

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

  private async _getUserTaskTokenInOldFormat(currentProcessToken: ProcessToken): Promise<any> {

    const {processInstanceId, processModelId, correlationId, identity} = currentProcessToken;

    const processInstanceTokens: Array<ProcessToken> =
      await this._flowNodeInstanceService.queryProcessTokensByProcessInstanceId(processInstanceId);

    const filteredInstanceTokens: Array<ProcessToken> = processInstanceTokens.filter((token: ProcessToken) => {
      return token.type === ProcessTokenType.onExit;
    });

    const processTokenFacade: IProcessTokenFacade =
      this._processTokenFacadeFactory.create(processInstanceId, processModelId, correlationId, identity);

    const processTokenResultPromises: Array<Promise<IFlowNodeInstanceResult>> =
      filteredInstanceTokens.map(async(processToken: ProcessToken) => {

        const processTokenFlowNodeInstance: FlowNodeInstance =
          await this._flowNodeInstanceService.queryByInstanceId(processToken.flowNodeInstanceId);

        return <IFlowNodeInstanceResult> {
          flowNodeInstanceId: processTokenFlowNodeInstance.id,
          flowNodeId: processTokenFlowNodeInstance.flowNodeId,
          result: processToken.payload,
        };
      });

    const processTokenResults: Array<IFlowNodeInstanceResult> = await Promise.all(processTokenResultPromises);

    processTokenFacade.importResults(processTokenResults);

    return await processTokenFacade.getOldTokenFormat();
  }
}
