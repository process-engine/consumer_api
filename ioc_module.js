'use strict'

const {ConsumerApiService} = require('./dist/commonjs/index');

const routerDiscoveryTag = require('@essential-projects/core_contracts').RouterDiscoveryTag;

function registerInContainer(container) {
  
  container.register('ConsumerApiService', ConsumerApiService);
}

module.exports.registerInContainer = registerInContainer;
