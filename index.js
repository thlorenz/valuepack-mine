'use strict';

var log             =  require('valuepack-core/util/log')
  , updateNpm       =  require('valuepack-mine-npm')
  , updateGithub    =  require('valuepack-mine-github')
  , getGithubLogins =  require('./lib/get-github-logins')
  , updateByGithub  =  require('./lib/update-by-github')
  , fixRepoUrls     =  require('./lib/fix-repo-urls')
  ;
  
// 1. update npm

// 2. for each user determine possible github logins (not only the one that is given)
//    instead use npmatchub to deduce possible logins
//    this will give long list of github logins we need to get from github
  
// 3. pull down repo and user info for all these users

// 4. fix repo urls by trying to match npm packages to repos we pulled down - don't 
//    do more (i.e. don't try to ping github -- too slow and unreliable)

// at this point we should have mined all data

var go = module.exports = function (db, opts, cb) {
  log.info('mine', opts);

  if (opts.npm) {
    // TODO: updateNpm needs to allow passing db and also provide script that passes it
    updateNpm(db, function (err) {
      if (err) return cb(err);
      thenGetGithubLogins();
    });
  } else {
    thenGetGithubLogins();
  }

  function thenGetGithubLogins () {
    getGithubLogins(db, opts.npmUserFilter, function (err, logins) {
      if (err) return cb(err);
      return opts.github 
        ? thenUpdateGithub(logins)
        : thenUpdateByGithub(logins); 
    });
  }

  function thenUpdateGithub (logins) {
    // TODO: updateGithub needs to allow passing db
    updateGithub(db, logins.byOwner, function (err) {
      if (err) return cb(err);
      thenUpdateByGithub(logins);
    });
  }

  function thenUpdateByGithub (logins) {
    updateByGithub(db, logins.byOwner, function (err) {
      if (err) return cb(err);
      thenFixRepoUrls(logins);
    });
  }

  function thenFixRepoUrls (logins) {
    // logins.byOwner are the github logins grouped by the npm user for which the logins where found
    console.error('fixing repo urls', Object.keys(logins.byOwner).length);
  }

};


// Test
if (!module.parent) {
  log.level = 'silly';

  var leveldb = require('valuepack-core/mine/leveldb')
  var opts = {
      npm           :  false
    , github        :  false
//    , npmUserFilter :  [ 'tjholowaychuk', 'thlorenz', 'substack', 'dominictarr', 'Raynos' ]
  };

  leveldb.open(function (err, db) {
    if (err) return console.error(err);
    go(db, opts, function (err) {
      if (err) return console.error(err);
      console.log('DONE')  
    });
  })
}

function inspect(obj, depth) {
  console.log(require('util').inspect(obj, false, depth || 5, true));
}
