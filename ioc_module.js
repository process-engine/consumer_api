'use strict'

const {
  ConsumerApiIamService,
  ConsumerApiProcessEngineAdapter,
  ConsumerApiService,
} = require('./dist/commonjs/index');

function registerInContainer(container) {

  container.register('ConsumerApiService', ConsumerApiService)
    .dependencies(
      'ExecuteProcessService',
      'ProcessModelFacadeFactory',
      'ProcessModelPersistence',
      'FlowNodeInstancePersistence',
      'EventAggregator',
      'IamService')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
