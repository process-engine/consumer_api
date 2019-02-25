import {DataModels} from '@process-engine/consumer_api_contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

export class ProcessModelConverter {

  private _processModelFacadeFactory: IProcessModelFacadeFactory;

  constructor(processModelFacadeFactory: IProcessModelFacadeFactory) {
    this._processModelFacadeFactory = processModelFacadeFactory;
  }

  public convertProcessModel(processModel: Model.Process): DataModels.ProcessModels.ProcessModel {

    const processModelFacade: IProcessModelFacade = this._processModelFacadeFactory.create(processModel);

    function consumerApiEventConverter(event: Model.Events.Event): DataModels.Events.Event {
      const consumerApiEvent: DataModels.Events.Event = new DataModels.Events.Event();
      consumerApiEvent.id = event.id;

      return consumerApiEvent;
    }

    let consumerApiStartEvents: Array<DataModels.Events.Event> = [];
    let consumerApiEndEvents: Array<DataModels.Events.Event> = [];

    const processModelIsExecutable: boolean = processModelFacade.getIsExecutable();

    if (processModelIsExecutable) {
      const startEvents: Array<Model.Events.StartEvent> = processModelFacade.getStartEvents();
      consumerApiStartEvents = startEvents.map(consumerApiEventConverter);

      const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
      consumerApiEndEvents = endEvents.map(consumerApiEventConverter);
    }

    const processModelResponse: DataModels.ProcessModels.ProcessModel = {
      id: processModel.id,
      startEvents: consumerApiStartEvents,
      endEvents: consumerApiEndEvents,
    };

    return processModelResponse;
  }

}
