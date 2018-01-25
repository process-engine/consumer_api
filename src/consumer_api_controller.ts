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

  public startProcess(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const startEventKey: string = request.params.start_event_key;

    return this.consumerApiService.startProcess(processModelKey, startEventKey);
  }

  // event-routes
  public async getEventsByProcessModel(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;

    const result: IEventList = await this.consumerApiService.getEventsByProcessModel(processModelKey);
  }

  public async getEventsByCorrelation(request: Request, response: Response): Promise<void> {
    const correlationId: string = request.params.correlation_id;

    const result: IEventList = await this.consumerApiService.getEventsByCorrelation(correlationId);
  }

  public async getEventsByVerifiedCorrelation(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;

    const result: IEventList = await this.consumerApiService.getEventsByProcessModelAndCorrelation(processModelKey, correlationId);
  }

  public triggerEvent(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;
    const eventId: string = request.params.event_id;
    const eventTriggerPayload: IEventTriggerPayload = request.body;

    return this.consumerApiService.triggerEvent(processModelKey, correlationId, eventId, eventTriggerPayload);
  }

  // user-task-routes
  public async getUserTasksByProcessModel(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;

    const result: IUserTaskList = await this.consumerApiService.getUserTasksByProcessModel(processModelKey);
  }

  public async getUserTasksByCorrelation(request: Request, response: Response): Promise<void> {
    const correlationId: string = request.params.correlation_id;

    const result: IUserTaskList = await this.consumerApiService.getUserTasksByCorrelation(correlationId);
  }

  public async getUserTasksByVerifiedCorrelation(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;

    const result: IUserTaskList = await this.consumerApiService.getUserTasksByProcessModelAndCorrelation(processModelKey, correlationId);
  }

  public finishUserTask(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;
    const userTaskId: string = request.params.event_id;
    const userTaskResult: IUserTaskResult = request.body;

    return this.consumerApiService.finishUserTask(processModelKey, correlationId, userTaskId, userTaskResult);
  }
}
