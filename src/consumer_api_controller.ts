import {BaseRouter} from '@essential-projects/http_node';
import {IConsumerApiController, IConsumerApiService} from '@process-engine/consumer_api_contracts';

export class ConsumerApiController implements IConsumerApiController {
  public config: any = undefined;
  private _consumerApiService: IConsumerApiService;

  constructor(consumerApiService: IConsumerApiService) {
    this._consumerApiService = consumerApiService;
  }

  private get consumerApiService(): IConsumerApiService {
    return this._consumerApiService;
  }
  public getProcessModels(request: Request, response: Response): void {

  }

  public getProcessModelByKey(request: Request, response: Response): void {

  }

  public startProcess(request: Request, response: Response): void {

  }

  // event-routes
  public getEventsByProcessModel(request: Request, response: Response): void {

  }

  public getEventsByCorrelation(request: Request, response: Response): void {

  }

  public getEventsByVerifiedCorrelation(request: Request, response: Response): void {

  }

  public triggerEvent(request: Request, response: Response): void {

  }

  // user-task-routes
  public getUserTasksByProcessModel(request: Request, response: Response): void {

  }

  public getUserTasksByCorrelation(request: Request, response: Response): void {

  }

  public getUserTasksByVerifiedCorrelation(request: Request, response: Response): void {

  }

  public finishUserTask(request: Request, response: Response): void {

  }
}
