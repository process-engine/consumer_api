'use strict'

const {
  ConsumerApiRouter,
  ConsumerApiController,
  ConsumerApiService
} = require('./dist/commonjs/index');

const routerDiscoveryTag = require('@essential-projects/core_contracts').RouterDiscoveryTag;

function registerInContainer(container) {
  container.register('ConsumerApiRouter', ConsumerApiRouter)
    .dependencies('ConsumerApiController')
    .tags(routerDiscoveryTag)
    .configure('consumer_api:consumer_api_router');

  container.register('ConsumerApiController', ConsumerApiController)
    .dependencies('ConsumerApiService')
    .configure('consumer_api:consumer_api_controller');

  container.register('ConsumerApiService', ConsumerApiService)
    .configure('consumer_api:consumer_api_service');
}

module.exports.registerInContainer = registerInContainer;
