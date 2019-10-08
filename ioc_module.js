const {
  EventConverter,
  ManualTaskConverter,
  NotificationAdapter,
  UserTaskConverter,
} = require('./dist/commonjs/index');

const {
  EmptyActivityService,
  EventService,
  ExternalTaskService,
  FlowNodeInstanceService,
  ManualTaskService,
  NotificationService,
  ProcessModelService,
  UserTaskService,
} = require('./dist/commonjs/index');

function registerInContainer(container) {
  registerConvertersAndAdapters(container);
  registerServices(container);
}

function registerConvertersAndAdapters(container) {

  container
    .register('ConsumerApiNotificationAdapter', NotificationAdapter)
    .dependencies('EventAggregator')
    .singleton();

  container
    .register('ConsumerApiEventConverter', EventConverter)
    .dependencies('CorrelationService', 'ProcessModelFacadeFactory', 'ProcessModelUseCases')
    .singleton();

  container
    .register('ConsumerApiUserTaskConverter', UserTaskConverter)
    .dependencies('CorrelationService', 'FlowNodeInstanceService', 'ProcessModelFacadeFactory', 'ProcessModelUseCases', 'ProcessTokenFacadeFactory')
    .singleton();

  container
    .register('ConsumerApiManualTaskConverter', ManualTaskConverter)
    .dependencies('CorrelationService', 'ProcessModelFacadeFactory', 'ProcessModelUseCases')
    .singleton();
}

function registerServices(container) {

  container
    .register('ConsumerApiEmptyActivityService', EmptyActivityService)
    .dependencies(
      'CorrelationService',
      'EventAggregator',
      'FlowNodeInstanceService',
      'IamService',
      'ConsumerApiNotificationAdapter',
      'ProcessModelFacadeFactory',
      'ProcessModelUseCases',
    )
    .singleton();

  container
    .register('ConsumerApiEventService', EventService)
    .dependencies(
      'EventAggregator',
      'FlowNodeInstanceService',
      'IamService',
      'ProcessModelUseCases',
      'ConsumerApiEventConverter',
    )
    .singleton();

  container.register('ConsumerApiExternalTaskService', ExternalTaskService)
    .dependencies('EventAggregator', 'ExternalTaskService')
    .singleton();

  container
    .register('ConsumerApiManualTaskService', ManualTaskService)
    .dependencies(
      'EventAggregator',
      'FlowNodeInstanceService',
      'IamService',
      'ConsumerApiNotificationAdapter',
      'ConsumerApiManualTaskConverter',
    )
    .singleton();

  container
    .register('ConsumerApiFlowNodeInstanceService', FlowNodeInstanceService)
    .dependencies(
      'FlowNodeInstanceService',
      'ConsumerApiEmptyActivityService',
      'ConsumerApiManualTaskService',
      'ConsumerApiUserTaskService',
    )
    .singleton();

  container
    .register('ConsumerApiNotificationService', NotificationService)
    .dependencies('IamService', 'ConsumerApiNotificationAdapter')
    .singleton();

  container
    .register('ConsumerApiProcessModelService', ProcessModelService)
    .dependencies(
      'ExecuteProcessService',
      'FlowNodeInstanceService',
      'IamService',
      'ProcessModelFacadeFactory',
      'ProcessModelUseCases',
      'ConsumerApiNotificationAdapter',
    )
    .singleton();

  container
    .register('ConsumerApiUserTaskService', UserTaskService)
    .dependencies(
      'EventAggregator',
      'FlowNodeInstanceService',
      'IamService',
      'ConsumerApiNotificationAdapter',
      'ConsumerApiUserTaskConverter',
    )
    .singleton();

}

module.exports.registerInContainer = registerInContainer;
