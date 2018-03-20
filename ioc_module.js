'use strict'

const {
  ConsumerApiService,
  ConsumerProcessEngineAdapter
} = require('./dist/commonjs/index');

function registerInContainer(container) {
  
  container.register('ConsumerProcessEngineAdapter', ConsumerProcessEngineAdapter)
    .dependencies('DatastoreService', 'IamService', 'ProcessEngineService');

  container.register('ConsumerApiService', ConsumerApiService)
    .dependencies('ConsumerProcessEngineAdapter');
}

module.exports.registerInContainer = registerInContainer;
