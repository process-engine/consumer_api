'use strict';

const {
  ConsumerApiService,
  EventConverter,
  ManualTaskConverter,
  NotificationAdapter,
  ProcessInstanceConverter,
  ProcessModelConverter,
  ProcessModelExecutionAdapter,
  UserTaskConverter,
} = require('./dist/commonjs/index');

function registerInContainer(container) {

  container
    .register('ProcessModelExecutionAdapter', ProcessModelExecutionAdapter)
    .dependencies('ExecuteProcessService', 'ProcessModelUseCases')
    .singleton();

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

  container
    .register('ConsumerApiProcessInstanceConverter', ProcessInstanceConverter)
    .singleton();

  container
    .register('ConsumerApiProcessModelConverter', ProcessModelConverter)
    .dependencies('ProcessModelFacadeFactory')
    .singleton();

  container
    .register('ConsumerApiService', ConsumerApiService)
    .dependencies(
      'EventAggregator',
      'FlowNodeInstanceService',
      'IamService',
      'ProcessModelExecutionAdapter',
      'ProcessModelFacadeFactory',
      'ProcessModelUseCases',
      'ConsumerApiNotificationAdapter',
      'ConsumerApiEventConverter',
      'ConsumerApiUserTaskConverter',
      'ConsumerApiManualTaskConverter',
      'ConsumerApiProcessInstanceConverter',
      'ConsumerApiProcessModelConverter')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
