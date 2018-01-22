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
}
