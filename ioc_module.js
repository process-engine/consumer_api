'use strict'

const {
  ConsumerApiIamService,
  ConsumerApiService,
  ConsumerApiProcessEngineAdapter,
} = require('./dist/commonjs/index');

function registerInContainer(container) {
  
  container.register('ConsumerApiProcessEngineAdapter', ConsumerApiProcessEngineAdapter)
    .dependencies('DatastoreService',
                  'IamService',
                  'ProcessEngineService',
                  'NodeInstanceEntityTypeService',
                  'MessageBusService',
                  'ConsumerApiIamService',
                  'EventAggregator')
    .singleton();

  container.register('ConsumerApiService', ConsumerApiService)
    .dependencies('ConsumerApiProcessEngineAdapter')
    .singleton();

  // TODO: Temporary workaround until the IdentityServer is in place.
  container.register('ConsumerApiIamService', ConsumerApiIamService)
    .configure('consumer_api_core:consumer_api_iam_service')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
