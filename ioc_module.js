'use strict'

const {
  ConsumerApiRouter,
  ConsumerApiController,
  ConsumerApiService
} = require('./dist/commonjs/index');

function registerInContainer(container) {
  container.registerInContainer('ConsumerApiRouter', ConsumerApiRouter)
    .dependencies('ConsumerApiController')
    .configure('consumer_api:consumer_api_router');

  container.registerInContainer('ConsumerApiController', ConsumerApiController)
    .dependencies('ConsumerApiService')
    .configure('consumer_api:consumer_api_controller');

  container.registerInContainer('ConsumerApiService', ConsumerApiService)
    .configure('consumer_api:consumer_api_service');
}

module.exports.registerInContainer = registerInContainer;
