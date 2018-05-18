'use strict'

const {
  ConsumerApiIamService,
  ConsumerApiProcessEngineAdapter,
  ConsumerApiService,
  CorrelationStore,
} = require('./dist/commonjs/index');

function registerInContainer(container) {

  // TODO: Temporary workaround until the IdentityServer is in place.
  container.register('ConsumerApiIamService', ConsumerApiIamService)
    .configure('consumer_api_core:consumer_api_iam_service')
    .singleton();

  container.register('ConsumerApiCorrelationStore', CorrelationStore)
    .singleton();
  
  container.register('ConsumerApiProcessEngineAdapter', ConsumerApiProcessEngineAdapter)
    .dependencies('ConsumerApiCorrelationStore',
                  'ConsumerApiIamService',
                  'DatastoreService',
                  'EventAggregator',
                  'IamService',
                  'MessageBusService',
                  'NodeInstanceEntityTypeService',
                  'ProcessEngineService')
    .singleton();

  container.register('ConsumerApiService', ConsumerApiService)
    .dependencies('ConsumerApiProcessEngineAdapter')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
