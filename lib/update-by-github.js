'use strict';

var sublevels = require('valuepack-core/mine/sublevels');
var asyncReduce = require('asyncreduce');
var runnel = require('runnel');
var log = require('valuepack-core/util/log');

var go = module.exports = function (db, byOwnerGithubLogins, cb) {

  function batchNonExistingLogins(acc, k, cb) {
    var logins = byOwnerGithubLogins[k];
    if (!logins.length) return cb();

    // don't override logins we already found, i.e. if it was supplied by some user which we consider a better source
    function batchIfNotExists (login) {
      return function (cb_) {
        byGithub.get(login, function (err) {
          if (err) { 
            acc.push({ key: login, value: k, type: 'put' });
            log.silly('update-bygithub', 'updating', login, k);
          }
          cb_();
        });
      }
    }

    var tasks = logins
      .map(batchIfNotExists)
      .concat(function (err) { cb(err, acc) })

    runnel(tasks)
  }

  var subnpm = sublevels(db).npm;

  var byGithub = subnpm.byGithub;
  asyncReduce(
      Object.keys(byOwnerGithubLogins)
    , []
    , batchNonExistingLogins
    , function (err, acc) {
        if (err) return cb(err);
        byGithub.batch(acc, cb);
      }
  );
};

// Test
if (!module.parent) {

  log.level = 'silly';
  var byOwnerLogins = 
    { thlorenz: [ 'thlorenz' ],
      tjholowaychuk:
        [ 'visionmedia',
          'LearnBoost',
          'component' ] }

  var dump = require('level-dump');
  var leveldb = require('valuepack-core/mine/leveldb')
  leveldb.open(function (err, db) {
    if (err) return console.error(err);
    var subnpm = sublevels(db).npm;
    var byGithub = subnpm.byGithub;
    go(db, byOwnerLogins, function (err) {
      if (err) return console.error(err);
      console.log('done');
    });

  })
}

