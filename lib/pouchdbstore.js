'use strict';

var util = require('util');
var bcrypt = require('bcrypt');
var TokenStore = require('passwordless-tokenstore');
var PouchDB = require('pouchdb');

/**
 */
function PouchDBStore(connection, options) {

  if (arguments.length === 0 || typeof arguments[0] !== 'string') {
    throw new Error('A valid connection string has to be provided');
  }

  TokenStore.call(this);

  this.options = options || {};
  this.DB_NAME = connection;
  this.db = null;
}

util.inherits(PouchDBStore, TokenStore);

/**
 * Checks if the provided token / user id combination exists and is
 * valid in terms of time-to-live. If yes, the method provides the
 * the stored referrer URL if any.
 * @param  {String}   token to be authenticated
 * @param  {String}   uid Unique identifier of an user
 * @param  {Function} callback in the format (error, valid, referrer).
 * In case of error, error will provide details, valid will be false and
 * referrer will be null. If the token / uid combination was not found
 * found, valid will be false and all else null. Otherwise, valid will
 * be true, referrer will (if provided when the token was stored) the
 * original URL requested and error will be null.
 */
PouchDBStore.prototype.authenticate = function(token, uid, callback) {
  if(!token || !uid || !callback) {
    throw new Error('TokenStore:authenticate called with invalid parameters');
  }
  this.getDB(function(db) {
    db.get(uid, function(err, doc) {
      if ((err && err.name === 'not_found') ||
          (doc && doc.ttl < Date.now())) {
        return callback(null, false, null);
      }
      if (err) {
        return callback(err, false, null);
      }
      bcrypt.compare(token, doc.hashedToken, function(err, res) {
        if (err) {
          return callback(err, false, null);
        }
        if (res) {
          return callback(null, true, doc.originUrl);
        }
        callback(null, false, null);
      });
    });
  });
};

/**
 * Stores a new token / user ID combination or updates the token of an
 * existing user ID if that ID already exists. Hence, a user can only
 * have one valid token at a time
 * @param  {String}   token Token that allows authentication of _uid_
 * @param  {String}   uid Unique identifier of an user
 * @param  {Number}   msToLive Validity of the token in ms
 * @param  {String}   originUrl Originally requested URL or null
 * @param  {Function} callback Called with callback(error) in case of an
 * error or as callback() if the token was successully stored / updated
 */
PouchDBStore.prototype.storeOrUpdate = function(token, uid, msToLive,
                                                originUrl, callback) {
  if (!token || !uid || !msToLive || !callback) {
    throw new Error('TokenStore:storeOrUpdate called with invalid parameters');
  }

  this.getDB(function(db) {
    bcrypt.hash(token, 10, function (err, hashedToken) {
      if (err) {
        return callback(err);
      }
      var newRecord = {
        _id: uid,
        hashedToken: hashedToken,
        ttl: Date.now() + msToLive,
        originUrl: originUrl
      }
      db.get(uid, function(err, doc) {
        if (doc) {
          newRecord._rev = doc._rev;
        }
        db.put(newRecord).then(function(err, res) {
          callback();
        });
      });
    });
  });
}

/**
 * Invalidates and removes a user and the linked token
  * @param  {String}   user ID
 * @param  {Function} callback called with callback(error) in case of an
 * error or as callback() if the uid was successully invalidated
 */
PouchDBStore.prototype.invalidateUser = function(uid, callback) {
  if (!uid || !callback) {
    throw new Error('TokenStore:invalidateUser called with invalid parameters');
  }
  this.getDB(function(db) {
    db.get(uid, function(err, doc) {
      if (err) {
        return callback();
      }
      db.remove(doc, function() {
        callback();
      });
    });
  });
}

/**
 * Removes and invalidates all token
 * @param  {Function} callback Called with callback(error) in case of an
 * error or as callback() if the token was successully stored / updated
 */
PouchDBStore.prototype.clear = function(callback) {
  if (!callback) {
    throw new Error('TokenStore:clear called with invalid parameters');
  }
  PouchDB.destroy(this.DB_NAME, (function() {
    this.db = null;
    callback();
  }).bind(this));
}

/**
 * Number of tokens stored (no matter the validity)
 * @param  {Function} callback Called with callback(null, count) in case
 * of success or with callback(error) in case of an error
 */
PouchDBStore.prototype.length = function(callback) {
  this.getDB(function(db) {
    db.info(function(err, data) {
      callback(null, data.doc_count);
    });
  });
}

PouchDBStore.prototype.getDB = function(callback) {
  if (this.db) {
    return callback(this.db);
  }
  new PouchDB(this.DB_NAME, (function(err, db) {
    this.db = db;
    callback(this.db);
  }).bind(this));
};

module.exports = PouchDBStore;
