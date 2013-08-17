'use strict';

var through = require('through')
  , concatStream = require('concat-stream')
  , npmatchub = require('npmatchub')
  , dump = require('level-dump')
  , log = require('valuepack-core/util/log');

var npm = require('valuepack-core/mine/namespaces').npm;
var nib = '\xff\xff';


/**
 * For each user determine possible github logins (not only the one that is given)
 * instead use npmatchub to deduce possible logins
 * this will give long list of github logins we need to get from github.
 *
 * Possibly not needed:
 * -------------------
 * Additionally it fills in the user's github login by deducing it from the
 * package repos and corrects all byGitub entryies that weren't added before b/c the
 * user didn't provide it.
 *
 * @name exports
 * @function
 * @param db {LevelDb} mine db instance 
 */
var go = module.exports = function (db) {
  var npmPackages =  db.sublevel(npm.packages, { valueEncoding: 'json' })
    , byOwner     =  db.sublevel(npm.byOwner, { valueEncoding: 'utf8' })
    , npmUsers    =  db.sublevel(npm.users, { valueEncoding: 'json' })
    , byGithub    =  db.sublevel(npm.byGithub, { valueEncoding: 'utf8' });

  var githubLogins = {}
    , usersPending = 0
    , usersEnded;

  var userStream = through(onuser, onusers);

  function onuser (user) {
    ++usersPending;

    var packs = []
      , username = user.key
      , packsPending = 0
      , packsEnded;

    var packStream = through(onpack, onpacks);

    function onpack (name) {
      ++packsPending;
      npmPackages.get(name, function (err, pack) {
        if (!err && pack) packs.push(pack);

        --packsPending;
        packStream.queue('');
        maybeEndPacks();
      });
    }

    function onpacks() {
      var logins = npmatchub.logins(packs);
      var percents = npmatchub.loginPercents(logins);
      percents.forEach(function (p) { 
        if (p.percent > 5) githubLogins[p.login] = true; 
      });

      log.verbose('get-github-logins', 'user: %s, packs: %s, logins:', username, packs.length, percents);
      packsEnded = true;
      maybeEndPacks();
    }

    function maybeEndPacks () {
      if (!packsPending && packsEnded) packStream.queue(null);
    }

    byOwner
      .createReadStream({ start: username, end: username + nib, keys: false, values: true })
      .pipe(packStream)
      .on('end', function () {
        --usersPending;
        userStream.queue('');
        maybeEndUsers();
      });
  }

  function onusers () {
    usersEnded = true;
    maybeEndUsers();
  }


  function maybeEndUsers () {
    if (!usersPending && usersEnded) userStream.queue(null);
  }

  npmUsers 
    .createReadStream({ start: 'thlorenz', end: 'thz' + nib } )
    .pipe(userStream)
    .on('end', function () { console.log(githubLogins); })
};

// Test
if (!module.parent) {
  log.level = 'silly';
  var leveldb = require('valuepack-core/mine/leveldb')
  leveldb.open(function (err, db) {
    if (err) return console.error(err);
    
    go(db);
  });
}
