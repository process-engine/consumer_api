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
  public getProcessModels(request: Request, response: Response): Promise<IProcessModelList> {
    return this.consumerApiService.getProcessModels();
  }

  public getProcessModelByKey(request: Request, response: Response): Promise<IProcessModel> {
    const processModelKey: string = request.params.process_model_key;

    return this.consumerApiService.getProcessModelByKey(processModelKey);
  }

  public startProcess(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const startEventKey: string = request.params.start_event_key;

    return this.consumerApiService.startProcess(processModelKey, startEventKey);
  }

  // event-routes
  public getEventsByProcessModel(request: Request, response: Response): Promise<IEventList> {
    const processModelKey: string = request.params.process_model_key;

    return this.consumerApiService.getEventsByProcessModel(processModelKey);
  }

  public getEventsByCorrelation(request: Request, response: Response): Promise<IEventList> {
    const correlationId: string = request.params.correlation_id;

    return this.consumerApiService.getEventsByCorrelation(correlationId);
  }

  public getEventsByVerifiedCorrelation(request: Request, response: Response): Promise<IEventList> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;

    return this.consumerApiService.getEventsByProcessModelAndCorrelation(processModelKey, correlationId);
  }

  public triggerEvent(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;
    const eventId: string = request.params.event_id;
    const eventTriggerPayload: IEventTriggerPayload = request.body;

    return this.consumerApiService.triggerEvent(processModelKey, correlationId, eventId, eventTriggerPayload);
  }

  // user-task-routes
  public getUserTasksByProcessModel(request: Request, response: Response): Promise<IUserTaskList> {
    const processModelKey: string = request.params.process_model_key;

    return this.consumerApiService.getUserTasksByProcessModel(processModelKey);
  }

  public getUserTasksByCorrelation(request: Request, response: Response): Promise<IUserTaskList> {
    const correlationId: string = request.params.correlation_id;

    return this.consumerApiService.getUserTasksByCorrelation(correlationId);
  }

  public getUserTasksByVerifiedCorrelation(request: Request, response: Response): Promise<IUserTaskList> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;

    return this.consumerApiService.getUserTasksByProcessModelAndCorrelation(processModelKey, correlationId);
  }

  public finishUserTask(request: Request, response: Response): Promise<void> {
    const processModelKey: string = request.params.process_model_key;
    const correlationId: string = request.params.correlation_id;
    const userTaskId: string = request.params.event_id;
    const userTaskResult: IUserTaskResult = request.body;

    return this.consumerApiService.finishUserTask(processModelKey, correlationId, userTaskId, userTaskResult);
  }
}
