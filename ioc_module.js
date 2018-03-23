'use strict'

const {
  ConsumerApiService,
  ConsumerProcessEngineAdapter,
  ConsumerApiIamService,
} = require('./dist/commonjs/index');

function registerInContainer(container) {
  
  container.register('ConsumerProcessEngineAdapter', ConsumerProcessEngineAdapter)
    .dependencies('DatastoreService',
                  'IamService',
                  'ProcessEngineService',
                  'NodeInstanceEntityTypeService',
                  'MessageBusService',
                  'ConsumerApiIamService');

  container.register('ConsumerApiService', ConsumerApiService)
    .dependencies('ConsumerProcessEngineAdapter')
    .singleton();

  // TODO: Temporary workaround until the IdentityServer is in place.
  container.register('ConsumerApiIamService', ConsumerApiIamService)
    .configure('consumer_api_core:consumer_api_iam_service');
}

module.exports.registerInContainer = registerInContainer;
