'use strict'

const {ConsumerApiService} = require('./dist/commonjs/index');

function registerInContainer(container) {
  
  container.register('ConsumerApiService', ConsumerApiService)
    .dependencies('DatastoreService', 'IamService', 'ProcessEngineService');
}

module.exports.registerInContainer = registerInContainer;
