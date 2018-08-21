'use strict';

const {
  ConsumerApiService,
  ProcessModelExecutionAdapter,
  UserTaskConverter,
  ProcessModelConverter,
} = require('./dist/commonjs/index');

function registerInContainer(container) {

  container
    .register('ProcessModelExecutionAdapter', ProcessModelExecutionAdapter)
    .dependencies('ExecuteProcessService', 'ProcessModelService')
    .singleton();

  container
    .register('ConsumerApiUserTaskConverter', UserTaskConverter)
    .dependencies('ProcessModelService', 'FlowNodeInstanceService', 'ProcessModelFacadeFactory', 'ProcessTokenFacadeFactory')
    .singleton();

  container
    .register('ConsumerApiProcessModelConverter', ProcessModelConverter)
    .dependencies('ProcessModelFacadeFactory')
    .singleton();

  container
    .register('ConsumerApiService', ConsumerApiService)
    .dependencies(
      'EventAggregator',
      'ExecutionContextFacadeFactory',
      'FlowNodeInstanceService',
      'ProcessModelExecutionAdapter',
      'ProcessModelFacadeFactory',
      'ProcessModelService',
      'ConsumerApiUserTaskConverter',
      'ConsumerApiProcessModelConverter')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
