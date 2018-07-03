'use strict'

const ConsumerApiService = require('./dist/commonjs/index').ConsumerApiService;

function registerInContainer(container) {

  container.register('ConsumerApiService', ConsumerApiService)
    .dependencies(
      'EventAggregator',
      'ExecuteProcessService',
      'ExecutionContextFacadeFactory',
      'FlowNodeInstancePersistence',
      'IamService',
      'ProcessModelFacadeFactory',
      'ProcessModelPersistence')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
