'use strict';

var expect = require('chai').expect;
var TokenStore = require('passwordless-tokenstore');
var standardTests = require('passwordless-tokenstore-test');

var PouchDBStore = require('../');
var PouchDB = require('pouchdb');

var testUri = './test_data';

function TokenStoreFactory() {
  return new PouchDBStore(testUri);
}

var wipeDB = function(done) {
  PouchDB.destroy(testUri).then(function() {
    done();
  });
}

// Call all standard tests
standardTests(TokenStoreFactory, wipeDB, wipeDB);
