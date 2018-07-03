import {Event, ProcessModel} from '@process-engine/consumer_api_contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory, Model} from '@process-engine/process_engine_contracts';

export function createProcessModelConverter(processModelFacadeFactory: IProcessModelFacadeFactory): Function {

  return (processModel: Model.Types.Process): ProcessModel => {

    const processModelFacade: IProcessModelFacade = processModelFacadeFactory.create(processModel);

    function consumerApiEventConverter(event: Model.Events.Event): Event {
      const consumerApiEvent: Event = new Event();
      consumerApiEvent.key = event.id;
      consumerApiEvent.id = event.id;

      return consumerApiEvent;
    }

    const startEvents: Array<Model.Events.StartEvent> = processModelFacade.getStartEvents();
    const consumerApiStartEvents: Array<Event> = startEvents.map(consumerApiEventConverter);

    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
    const consumerApiEndEvents: Array<Event> = endEvents.map(consumerApiEventConverter);

    const processModelResponse: ProcessModel = {
      key: processModel.id,
      startEvents: consumerApiStartEvents,
      endEvents: consumerApiEndEvents,
    };

    return processModelResponse;
  };
}
