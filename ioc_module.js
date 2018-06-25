'use strict'

const ConsumerApiService = require('./dist/commonjs/index').ConsumerApiService;

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
