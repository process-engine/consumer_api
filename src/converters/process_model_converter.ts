import {DataModels} from '@process-engine/consumer_api_contracts';
import {IProcessModelFacadeFactory} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

export class ProcessModelConverter {

  private processModelFacadeFactory: IProcessModelFacadeFactory;

  constructor(processModelFacadeFactory: IProcessModelFacadeFactory) {
    this.processModelFacadeFactory = processModelFacadeFactory;
  }

  public convertProcessModel(processModel: Model.Process): DataModels.ProcessModels.ProcessModel {

    const processModelFacade = this.processModelFacadeFactory.create(processModel);

    function consumerApiEventConverter(event: Model.Events.Event): DataModels.Events.Event {
      const consumerApiEvent = new DataModels.Events.Event();
      consumerApiEvent.id = event.id;

      return consumerApiEvent;
    }

    let consumerApiStartEvents: Array<DataModels.Events.Event> = [];
    let consumerApiEndEvents: Array<DataModels.Events.Event> = [];

    const processModelIsExecutable = processModelFacade.getIsExecutable();

    if (processModelIsExecutable) {
      const startEvents = processModelFacade.getStartEvents();
      consumerApiStartEvents = startEvents.map(consumerApiEventConverter);

      const endEvents = processModelFacade.getEndEvents();
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
