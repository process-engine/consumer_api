import {Event, ProcessModel} from '@process-engine/consumer_api_contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory, Model} from '@process-engine/process_engine_contracts';

export class ProcessModelConverter {

  private _processModelFacadeFactory: IProcessModelFacadeFactory;

  constructor(processModelFacadeFactory: IProcessModelFacadeFactory) {
    this._processModelFacadeFactory = processModelFacadeFactory;
  }

  private get processModelFacadeFactory(): IProcessModelFacadeFactory {
    return this._processModelFacadeFactory;
  }

  public convertProcessModel(processModel: Model.Types.Process): ProcessModel {

    const processModelFacade: IProcessModelFacade = this.processModelFacadeFactory.create(processModel);

    function consumerApiEventConverter(event: Model.Events.Event): Event {
      const consumerApiEvent: Event = new Event();
      consumerApiEvent.id = event.id;

      return consumerApiEvent;
    }

    let consumerApiStartEvents: Array<Event> = [];
    let consumerApiEndEvents: Array<Event> = [];

    const processModelIsExecutable: boolean = processModelFacade.getIsExecutable();

    if (processModelIsExecutable) {
      const startEvents: Array<Model.Events.StartEvent> = processModelFacade.getStartEvents();
      consumerApiStartEvents = startEvents.map(consumerApiEventConverter);

      const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
      consumerApiEndEvents = endEvents.map(consumerApiEventConverter);
    }

    const processModelResponse: ProcessModel = {
      id: processModel.id,
      startEvents: consumerApiStartEvents,
      endEvents: consumerApiEndEvents,
    };

    return processModelResponse;
  }

}
