'use strict';

const {
  ConsumerApiService,
  ProcessModelExecutionAdapter,
} = require('./dist/commonjs/index');

function registerInContainer(container) {

  container
    .register('ProcessModelExecutionAdapter', ProcessModelExecutionAdapter)
    .dependencies('container', 'ExecuteProcessService', 'ProcessModelService')
    .singleton();

  container
    .register('ConsumerApiService', ConsumerApiService)
    .dependencies(
      'EventAggregator',
      'ExecutionContextFacadeFactory',
      'FlowNodeInstanceService',
      'ProcessModelExecutionAdapter',
      'ProcessModelFacadeFactory',
      'ProcessModelService')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
