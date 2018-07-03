'use strict'

const {
  ConsumerApiService,
  ProcessModelExecutionAdapter,
} = require('./dist/commonjs/index');

function registerInContainer(container) {

  container.register('ProcessModelExecutionAdapter', ProcessModelExecutionAdapter)
    .dependencies('ExecuteProcessService','ProcessModelPersistenceService')
    .injectPromiseLazy('ProcessModelPersistenceService')
    .singleton();

  container.register('ConsumerApiService', ConsumerApiService)
    .dependencies(
      'EventAggregator',
      'ExecutionContextFacadeFactory',
      'FlowNodeInstancePersistenceService',
      'IamService',
      'ProcessModelExecutionAdapter',
      'ProcessModelFacadeFactory',
      'ProcessModelPersistenceService')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
