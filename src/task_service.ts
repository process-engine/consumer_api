import {APIs, DataModels} from '@process-engine/consumer_api_contracts';
import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  IFlowNodeInstanceService,
} from '@process-engine/flow_node_instance.contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {EmptyActivityConverter, ManualTaskConverter, UserTaskConverter} from './converters/index';

export class TaskService implements APIs.ITaskConsumerApi {

  private readonly flowNodeInstanceService: IFlowNodeInstanceService;

  private readonly userTaskConverter: UserTaskConverter;
  private readonly manualTaskConverter: ManualTaskConverter;
  private readonly emptyActivityConverter: EmptyActivityConverter;

  constructor(
    flowNodeInstanceService: IFlowNodeInstanceService,
    emptyActivityConverter: EmptyActivityConverter,
    manualTaskConverter: ManualTaskConverter,
    userTaskConverter: UserTaskConverter,
  ) {
    this.flowNodeInstanceService = flowNodeInstanceService;

    this.emptyActivityConverter = emptyActivityConverter;
    this.manualTaskConverter = manualTaskConverter;
    this.userTaskConverter = userTaskConverter;
  }

  public async getAllSuspendedTasks(identity: IIdentity): Promise<DataModels.Tasks.TaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.queryByState(FlowNodeInstanceState.suspended);

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);
    const manualTaskList = await this.manualTaskConverter.convert(identity, suspendedFlowNodes);
    const emptyActivityList = await this.emptyActivityConverter.convert(identity, suspendedFlowNodes);

    const taskList: DataModels.Tasks.TaskList = {
      emptyActivities: emptyActivityList.emptyActivities,
      userTasks: userTaskList.userTasks,
      manualTasks: manualTaskList.manualTasks,
    };

    return taskList;
  }

  public async getTasksForProcessModel(identity: IIdentity, processModelId: string): Promise<DataModels.Tasks.TaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByProcessModel(processModelId);

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);
    const manualTaskList = await this.manualTaskConverter.convert(identity, suspendedFlowNodes);
    const emptyActivityList = await this.emptyActivityConverter.convert(identity, suspendedFlowNodes);

    const taskList: DataModels.Tasks.TaskList = {
      emptyActivities: emptyActivityList.emptyActivities,
      userTasks: userTaskList.userTasks,
      manualTasks: manualTaskList.manualTasks,
    };

    return taskList;
  }

  public async getTasksForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<DataModels.Tasks.TaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByProcessInstance(processInstanceId);

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);
    const manualTaskList = await this.manualTaskConverter.convert(identity, suspendedFlowNodes);
    const emptyActivityList = await this.emptyActivityConverter.convert(identity, suspendedFlowNodes);

    const taskList: DataModels.Tasks.TaskList = {
      emptyActivities: emptyActivityList.emptyActivities,
      userTasks: userTaskList.userTasks,
      manualTasks: manualTaskList.manualTasks,
    };

    return taskList;
  }

  public async getTasksForCorrelation(identity: IIdentity, correlationId: string): Promise<DataModels.Tasks.TaskList> {

    const suspendedFlowNodes = await this.flowNodeInstanceService.querySuspendedByCorrelation(correlationId);

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodes);
    const manualTaskList = await this.manualTaskConverter.convert(identity, suspendedFlowNodes);
    const emptyActivityList = await this.emptyActivityConverter.convert(identity, suspendedFlowNodes);

    const taskList: DataModels.Tasks.TaskList = {
      emptyActivities: emptyActivityList.emptyActivities,
      userTasks: userTaskList.userTasks,
      manualTasks: manualTaskList.manualTasks,
    };

    return taskList;
  }

  public async getTasksForProcessModelInCorrelation(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
  ): Promise<DataModels.Tasks.TaskList> {

    const flowNodeInstances = await this.flowNodeInstanceService.queryActiveByCorrelationAndProcessModel(correlationId, processModelId);

    const suspendedFlowNodeInstances = flowNodeInstances.filter((flowNodeInstance: FlowNodeInstance): boolean => {
      return flowNodeInstance.state === FlowNodeInstanceState.suspended;
    });

    const noSuspendedFlowNodesFound = !suspendedFlowNodeInstances || suspendedFlowNodeInstances.length === 0;
    if (noSuspendedFlowNodesFound) {
      return <DataModels.Tasks.TaskList> {
        manualTasks: [],
        userTasks: [],
        emptyActivities: [],
      };
    }

    const userTaskList = await this.userTaskConverter.convertUserTasks(identity, suspendedFlowNodeInstances);
    const manualTaskList = await this.manualTaskConverter.convert(identity, suspendedFlowNodeInstances);
    const emptyActivityList = await this.emptyActivityConverter.convert(identity, suspendedFlowNodeInstances);

    const taskList: DataModels.Tasks.TaskList = {
      emptyActivities: emptyActivityList.emptyActivities,
      userTasks: userTaskList.userTasks,
      manualTasks: manualTaskList.manualTasks,
    };

    return taskList;
  }

}
