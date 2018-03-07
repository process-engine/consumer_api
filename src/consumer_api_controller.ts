import {BaseRouter} from '@essential-projects/http_node';
import {
  IConsumerApiController,
  IConsumerApiService,
  IEventList,
  IEventTriggerPayload,
  IProcessModel,
  IProcessModelList,
  IUserTaskList,
  IUserTaskResult,
} from '@process-engine/consumer_api_contracts';
import {Request, Response} from 'express';

export class ConsumerApiController implements IConsumerApiController {
  public config: any = undefined;
  private _consumerApiService: IConsumerApiService;

  constructor(consumerApiService: IConsumerApiService) {
    this._consumerApiService = consumerApiService;
  }

  private get consumerApiService(): IConsumerApiService {
    return this._consumerApiService;
  }

  public async getProcessModels(request: Request, response: Response): Promise<void> {
    const result: IProcessModelList = await this.consumerApiService.getProcessModels();
  }

  public async getProcessModelByKey(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;

    const result: IProcessModel = await this.consumerApiService.getProcessModelByKey(processModelKey);
  }

  public async startProcess(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const startEventKey: string = request.params.start_event_key;

    return this.consumerApiService.startProcess(processModelKey, startEventKey);
  }

  public async startProcessAndAwaitEndEvent(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const startEventKey: string = request.params.start_event_key;
    const endEventKey: string = request.params.end_event_key;

    return this.consumerApiService.startProcessAndAwaitEndEvent(processModelKey, startEventKey, endEventKey);
  }

  // event-routes
  public async getProcessModelEvents(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;

    const result: IEventList = await this.consumerApiService.getProcessModelEvents(processModelKey);
  }

  public async getCorrelationEvents(request: Request, response: Response): Promise<void> {
    const correlationId: string = request.params.correlation_id;

    const result: IEventList = await this.consumerApiService.getCorrelationEvents(correlationId);
  }

  public async getProcessModelCorrelationEvents(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;

    const result: IEventList = await this.consumerApiService.getProcessModelCorrelationEvents(processModelKey, correlationId);
  }

  public async triggerEvent(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const eventId: string = request.params.event_id;
    const eventTriggerPayload: IEventTriggerPayload = request.body;

    return this.consumerApiService.triggerEvent(processModelKey, eventId, eventTriggerPayload);
  }

  public async triggerProcessModelCorrelationEvent(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;
    const eventId: string = request.params.event_id;
    const eventTriggerPayload: IEventTriggerPayload = request.body;

    return this.consumerApiService.triggerProcessModelCorrelationEvent(processModelKey, correlationId, eventId, eventTriggerPayload);
  }

  // user-task-routes
  public async getProcessModelUserTasks(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;

    const result: IUserTaskList = await this.consumerApiService.getProcessModelUserTasks(processModelKey);
  }

  public async getCorrelationUserTasks(request: Request, response: Response): Promise<void> {
    const correlationId: string = request.params.correlation_id;

    const result: IUserTaskList = await this.consumerApiService.getCorrelationUserTasks(correlationId);
  }

  public async getProcessModelCorrelationUserTasks(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;

    const result: IUserTaskList = await this.consumerApiService.getProcessModelCorrelationUserTasks(processModelKey, correlationId);
  }

  public finishUserTask(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const userTaskId: string = request.params.event_id;
    const userTaskResult: IUserTaskResult = request.body;

    return this.consumerApiService.finishUserTask(processModelKey, userTaskId, userTaskResult);
  }

  public finishProcessModelCorrelationUserTask(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;
    const userTaskId: string = request.params.event_id;
    const userTaskResult: IUserTaskResult = request.body;

    return this.consumerApiService.finishProcessModelCorrelationUserTask(processModelKey, correlationId, userTaskId, userTaskResult);
  }
}
