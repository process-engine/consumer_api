'use strict'

const {
  ConsumerApiService,
  ConsumerProcessEngineAdapter,
  ComsumerApiIamService,
} = require('./dist/commonjs/index');

function registerInContainer(container) {
  
  container.register('ConsumerProcessEngineAdapter', ConsumerProcessEngineAdapter)
    .dependencies('DatastoreService', 'IamService', 'ProcessEngineService', 'ConsumerApiIamService');

  container.register('ConsumerApiService', ConsumerApiService)
    .dependencies('ConsumerProcessEngineAdapter');

  container.register('ConsumerApiIamService', ComsumerApiIamService);
}

module.exports.registerInContainer = registerInContainer;
