'use strict';

var log             =  require('valuepack-core/util/log')
  , updateNpm       =  require('valuepack-mine-npm')
  , updateGithub    =  require('valuepack-mine-github')
  , getGithubLogins =  require('./lib/get-github-logins')
  , updateByGithub  =  require('./lib/update-by-github')
  , fixRepoUrls     =  require('./lib/fix-repo-urls')
  , nib             =  require('valuepack-core').nib
  , tap             =  require('tap-stream')
  ;
  
var go = module.exports = function (db, opts, cb) {
  log.info('mine', opts);

  if (opts.npm) {
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
    updateGithub(db, logins.all, function (err) {
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

  var dump = require('level-dump');
  var sublevels = require('valuepack-core/mine/sublevels')
  var leveldb = require('valuepack-core/mine/leveldb')
  var opts = {
      npm           :  false
    , github        :  true
   // , npmUserFilter :  [ 'tjholowaychuk', 'thlorenz', 'substack', 'dominictarr', 'Raynos' ]
  };

  leveldb.open(function (err, db) {
    if (err) return console.error(err);
    var subnpm = sublevels(db).npm;

    /*go(db, opts, function (err) {
      if (err) return console.error(err);
      console.log('DONE')  
    });*/

  /*subnpm.users
    .createReadStream({ start: 'thlorenz', end: 'thlorenz' + '\xff', keys: true, values: true })
    .pipe(tap())
*/
  })
}

function inspect(obj, depth) {
  console.log(require('util').inspect(obj, false, depth || 5, true));
}
