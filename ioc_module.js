'use strict';

const {
  ConsumerApiService,
  EventConverter,
  ProcessModelExecutionAdapter,
  UserTaskConverter,
  ProcessModelConverter,
  ManualTaskConverter,
} = require('./dist/commonjs/index');

function registerInContainer(container) {

  container
    .register('ProcessModelExecutionAdapter', ProcessModelExecutionAdapter)
    .dependencies('ExecuteProcessService', 'ProcessModelService')
    .singleton();

  container
    .register('ConsumerApiEventConverter', EventConverter)
    .dependencies('ProcessModelService', 'ProcessModelFacadeFactory')
    .singleton();

  container
    .register('ConsumerApiUserTaskConverter', UserTaskConverter)
    .dependencies('ProcessModelService', 'FlowNodeInstanceService', 'ProcessModelFacadeFactory', 'ProcessTokenFacadeFactory')
    .singleton();
  
  container
    .register('ConsumerApiManualTaskConverter', ManualTaskConverter)
    .dependencies('ProcessModelService', 'ProcessModelFacadeFactory')
    .singleton();

  container
    .register('ConsumerApiProcessModelConverter', ProcessModelConverter)
    .dependencies('ProcessModelFacadeFactory')
    .singleton();

  container
    .register('ConsumerApiService', ConsumerApiService)
    .dependencies(
      'ConsumerApiEventConverter',
      'ConsumerApiUserTaskConverter',
      'ConsumerApiProcessModelConverter',
      'EventAggregator',
      'FlowNodeInstanceService',
      'IamService',
      'ProcessModelExecutionAdapter',
      'ProcessModelFacadeFactory',
      'ProcessModelService',
      'ConsumerApiUserTaskConverter',
      'ConsumerApiManualTaskConverter',
      'ConsumerApiProcessModelConverter')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
