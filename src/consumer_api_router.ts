import {BaseRouter} from '@essential-projects/http_node';
import {IConsumerApiController, IConsumerApiRouter, restSettings} from '@process-engine/consumer_api_contracts';

import {wrap} from 'async-middleware';

import {NextFunction, Request, Response} from 'express';

export class ConsumerApiRouter extends BaseRouter implements IConsumerApiRouter {

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
    this.router.get(restSettings.paths.processModels, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModels(request, response);
    }));

    this.router.get(restSettings.paths.processModelByKey, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModelByKey(request, response);
    }));

    this.router.post(restSettings.paths.startProcess, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.startProcess(request, response);
    }));

    this.router.post(restSettings.paths.startProcessAndAwaitEndEvent, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.startProcessAndAwaitEndEvent(request, response);
    }));

    // event-routes
    this.router.get(restSettings.paths.processModelEvents, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getEventsForProcessModel(request, response);
    }));

    this.router.get(restSettings.paths.correlationEvents, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getEventsForCorrelation(request, response);
    }));

    this.router.get(restSettings.paths.processModelCorrelationEvents, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getEventsForProcessModelInCorrelation(request, response);
    }));

    this.router.post(restSettings.paths.triggerEvent, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.triggerEvent(request, response);
    }));

    // user-task-routes
    this.router.get(restSettings.paths.processModelUserTasks, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getUserTasksForProcessModel(request, response);
    }));

    this.router.get(restSettings.paths.correlationUserTasks, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getUserTasksForCorrelation(request, response);
    }));

    this.router.get(restSettings.paths.processModelCorrelationUserTasks, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getUserTasksForProcessModelInCorrelation(request, response);
    }));

    this.router.post(restSettings.paths.finishUserTask, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.finishUserTask(request, response);
    }));
  }
}
