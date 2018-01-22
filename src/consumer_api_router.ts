import {BaseRouter} from '@essential-projects/http_node';
import {
  eventsByCorrelationRoute,
  eventsByProcessModelRoute,
  eventsByVerifiedCorrelationRoute,
  finishUserTaskRoute,
  IConsumerApiController,
  IConsumerApiRouter,
  IConsumerApiService,
  processModelRoute,
  processModelsRoute,
  startProcessRoute,
  triggerEventRoute,
  userTasksByCorrelationRoute,
  userTasksByProcessModelRoute,
  userTasksByVerifiedCorrelationRoute,
} from '@process-engine/consumer_api_contracts';

import {NextFunction, Request, Response} from 'express';

export class ConsumerApiRouter extends BaseRouter implements IConsumerApiRouter {
  public config: any = undefined;
  private _consumerApiRestController: IConsumerApiController;

  constructor(consumerApiRestController: IConsumerApiController) {
    super();
    this._consumerApiRestController = consumerApiRestController;
  }

  private get consumerApiRestController(): IConsumerApiController {
    return this._consumerApiRestController;
  }

  public get baseRoute(): string {
    return 'api/consumer/v1';
  }

  public async initializeRouter(): Promise<void> {

    // process-model-routes
    this.router.get(processModelsRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModels(request, response);
    });

    this.router.get(processModelRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModelByKey(request, response);
    });

    this.router.post(startProcessRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.startProcess(request, response);
    });

    // event-routes
    this.router.get(eventsByProcessModelRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getEventsByProcessModel(request, response);
    });

    this.router.get(eventsByCorrelationRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getEventsByCorrelation(request, response);
    });

    this.router.get(eventsByVerifiedCorrelationRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getEventsByVerifiedCorrelation(request, response);
    });

    this.router.post(triggerEventRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.triggerEvent(request, response);
    });

    // user-task-routes
    this.router.get(userTasksByProcessModelRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getUserTasksByProcessModel(request, response);
    });

    this.router.get(userTasksByCorrelationRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getUserTasksByCorrelation(request, response);
    });

    this.router.get(userTasksByVerifiedCorrelationRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getUserTasksByVerifiedCorrelation(request, response);
    });

    this.router.post(finishUserTaskRoute, (request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.finishUserTask(request, response);
    });
  }
}
