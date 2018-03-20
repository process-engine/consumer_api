'use strict'

const {ConsumerApiService} = require('./dist/commonjs/index');

function registerInContainer(container) {
  
  container.register('ConsumerApiService', ConsumerApiService);
}

module.exports.registerInContainer = registerInContainer;
