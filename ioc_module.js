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
    .tags(routerDiscoveryTag);

  container.register('ConsumerApiController', ConsumerApiController)
    .dependencies('ConsumerApiService');

  container.register('ConsumerApiService', ConsumerApiService);
}

module.exports.registerInContainer = registerInContainer;
