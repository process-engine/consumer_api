import {BaseRouter} from '@essential-projects/http_node';
import {IConsumerApiController, IConsumerApiRouter, routes} from '@process-engine/consumer_api_contracts';

import {wrap} from 'async-middleware';

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
    this.router.get(routes.processModels, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModels(request, response);
    }));

    this.router.get(routes.processModel, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModelByKey(request, response);
    }));

    this.router.post(routes.startProcess, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.startProcess(request, response);
    }));

    this.router.post(routes.startProcessAndAwaitEndEvent, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.startProcessAndAwaitEndEvent(request, response);
    }));

    // event-routes
    this.router.get(routes.processModelEvents, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModelEvents(request, response);
    }));

    this.router.get(routes.correlationEvents, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getCorrelationEvents(request, response);
    }));

    this.router.get(routes.processModelCorrelationEvents, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModelCorrelationEvents(request, response);
    }));

    this.router.post(routes.triggerEvent, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.triggerEvent(request, response);
    }));

    this.router.post(routes.triggerProcessModelCorrelationEvent, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.triggerProcessModelCorrelationEvent(request, response);
    }));

    // user-task-routes
    this.router.get(routes.processModelUserTasks, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModelUserTasks(request, response);
    }));

    this.router.get(routes.correlationUserTasks, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getCorrelationUserTasks(request, response);
    }));

    this.router.get(routes.processModelCorrelationUserTasks, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.getProcessModelCorrelationUserTasks(request, response);
    }));

    this.router.post(routes.finishUserTask, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.finishUserTask(request, response);
    }));

    this.router.post(routes.finishProcessModelCorrelationUserTask, wrap((request: Request, response: Response, next: NextFunction): void => {
      this.consumerApiRestController.finishProcessModelCorrelationUserTask(request, response);
    }));
  }
}
