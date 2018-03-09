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

  private httpCodeSuccessfulResponse: number = 200;
  private httpCodeSuccessfulNoContentResponse: number = 204;

  constructor(consumerApiService: IConsumerApiService) {
    this._consumerApiService = consumerApiService;
  }

  private get consumerApiService(): IConsumerApiService {
    return this._consumerApiService;
  }

  public async getProcessModels(request: Request, response: Response): Promise<void> {
    const result: IProcessModelList = await this.consumerApiService.getProcessModels();

    response.status(this.httpCodeSuccessfulResponse).json(result);
  }

  public async getProcessModelByKey(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const result: IProcessModel = await this.consumerApiService.getProcessModelByKey(processModelKey);

    response.status(this.httpCodeSuccessfulResponse).json(result);
  }

  public async startProcess(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const startEventKey: string = request.params.start_event_key;

    await this.consumerApiService.startProcess(processModelKey, startEventKey);

    response.status(this.httpCodeSuccessfulNoContentResponse).send();
  }

  public async startProcessAndAwaitEndEvent(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const startEventKey: string = request.params.start_event_key;
    const endEventKey: string = request.params.end_event_key;

    await this.consumerApiService.startProcessAndAwaitEndEvent(processModelKey, startEventKey, endEventKey);

    response.status(this.httpCodeSuccessfulNoContentResponse).send();
  }

  // event-routes
  public async getEventsForProcessModel(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;

    const result: IEventList = await this.consumerApiService.getEventsForProcessModel(processModelKey);

    response.status(this.httpCodeSuccessfulResponse).json(result);
  }

  public async getEventsForCorrelation(request: Request, response: Response): Promise<void> {
    const correlationId: string = request.params.correlation_id;

    const result: IEventList = await this.consumerApiService.getEventsForCorrelation(correlationId);

    response.status(this.httpCodeSuccessfulResponse).json(result);
  }

  public async getEventsForProcessModelInCorrelation(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;

    const result: IEventList = await this.consumerApiService.getEventsForProcessModelInCorrelation(processModelKey, correlationId);

    response.status(this.httpCodeSuccessfulResponse).json(result);
  }

  public async triggerEvent(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const eventId: string = request.params.event_id;
    const eventTriggerPayload: IEventTriggerPayload = request.body;

    await this.consumerApiService.triggerEvent(processModelKey, eventId, eventTriggerPayload);

    response.status(this.httpCodeSuccessfulNoContentResponse).send();
  }

  public async triggerEventInCorrelation(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;
    const eventId: string = request.params.event_id;
    const eventTriggerPayload: IEventTriggerPayload = request.body;

    await this.consumerApiService.triggerEventInCorrelation(processModelKey, correlationId, eventId, eventTriggerPayload);

    response.status(this.httpCodeSuccessfulNoContentResponse).send();
  }

  // user-task-routes
  public async getUserTasksForProcessModel(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;

    const result: IUserTaskList = await this.consumerApiService.getUserTasksForProcessModel(processModelKey);

    response.status(this.httpCodeSuccessfulResponse).json(result);
  }

  public async getUserTasksForCorrelation(request: Request, response: Response): Promise<void> {
    const correlationId: string = request.params.correlation_id;

    const result: IUserTaskList = await this.consumerApiService.getUserTasksForCorrelation(correlationId);

    response.status(this.httpCodeSuccessfulResponse).json(result);
  }

  public async getUserTasksForProcessModelInCorrelation(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;

    const result: IUserTaskList = await this.consumerApiService.getUserTasksForProcessModelInCorrelation(processModelKey, correlationId);

    response.status(this.httpCodeSuccessfulResponse).json(result);
  }

  public async finishUserTask(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const userTaskId: string = request.params.event_id;
    const userTaskResult: IUserTaskResult = request.body;

    await this.consumerApiService.finishUserTask(processModelKey, userTaskId, userTaskResult);

    response.status(this.httpCodeSuccessfulNoContentResponse).send();
  }

  public async finishUserTaskInCorrelation(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;
    const userTaskId: string = request.params.event_id;
    const userTaskResult: IUserTaskResult = request.body;

    await this.consumerApiService.finishUserTaskInCorrelation(processModelKey, correlationId, userTaskId, userTaskResult);

    response.status(this.httpCodeSuccessfulNoContentResponse).send();
  }
}
