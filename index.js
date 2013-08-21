'use strict';

var runnel = require('runnel') 
  , log = require('valuepack-core/util/log')
  , updateNpm = require('valuepack-mine-npm')
  , updateGithub = require('valuepack-mine-github')
  , getGithubLogins = require('./lib/get-github-logins')
  , updateByGithub = require('./lib/update-by-github')
  ;
  
function getLoginsAndApplyFixes (db, cb) {
  getGithubLogins(db, [ 'raynos', 'thlorenz', 'tjholowaychuk' ], function (err, logins) {
    if (err) return cb(err);
    
    updateByGithub(db, logins.byOwner, cb);
  });
}

// 1. update npm

// 2. for each user determine possible github logins (not only the one that is given)
//    instead use npmatchub to deduce possible logins
//    this will give long list of github logins we need to get from github
  
// 3. pull down repo and user info for all these users

// 4. fix repo urls by trying to match npm packages to repos we pulled down - don't 
//    do more (i.e. don't try to ping github -- too slow and unreliable)

// at this point we should have mined all data

var go = module.exports = function (db, cb) {
  /*runnel(
      updateNpm
  );*/

 getLoginsAndApplyFixes(db, cb);

};


// Test
if (!module.parent) {
  log.level = 'silly';

  var leveldb = require('valuepack-core/mine/leveldb')
  leveldb.open(function (err, db) {
    if (err) return console.error(err);
    go(db, function (err) {
      if (err) return console.error(err);
      console.log('DONE')  
    });
  })
}

function inspect(obj, depth) {
  console.log(require('util').inspect(obj, false, depth || 5, true));
}
