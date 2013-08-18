'use strict';

var through = require('through')
  , asyncThru = require('async-through')
  , nestStream = require('nest-stream')
  , npmatchub = require('npmatchub')
  , log = require('valuepack-core/util/log');

var npm = require('valuepack-core/mine/namespaces').npm;
var nib = '\xff\xff';
var sep = '';

function fixLogin (login) {
  return login
    .toLowerCase()
    .replace(/ ,'"/g, '');
}

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
 * @param filter {Array} of npm user names to include (optional, by default all are included)
 * @param cb {Function} called back with error or [String] of gitub logins
 */
var go = module.exports = function (db, filter, cb) {

  if (typeof filter === 'function') {
    cb = filter;
    filter = null;
  }

  var npmPackages =  db.sublevel(npm.packages, { valueEncoding: 'json' })
    , byOwner     =  db.sublevel(npm.byOwner, { valueEncoding: 'utf8' })
    , npmUsers    =  db.sublevel(npm.users, { valueEncoding: 'json' })
    , byGithub    =  db.sublevel(npm.byGithub, { valueEncoding: 'utf8' });

  var githubLogins = {};

  var nestedStream = nestStream(getPackStream, sep);

  function getPackStream (username) {

    function packInfo (name) {
      npmPackages.get(name, function (err, pack) {
        if (!err && pack) this.queue({ user: username, pack: pack });  
      }.bind(this));
    }

    return byOwner
      .createReadStream({ start: username, end: username + nib, keys: false, values: true })
      .pipe(asyncThru(packInfo))
  }

  var userPackages = {}
  function groupByUser (packInfo) {
    if (!userPackages[packInfo.user]) userPackages[packInfo.user] = [];  
    userPackages[packInfo.user].push(packInfo.pack);
    this.queue(packInfo);
  }

  function callbackLogins () {

    var allLogins = Object.keys(userPackages)
      .reduce(function (acc, k) {
        var packs = userPackages[k];
        if (!packs[0] || typeof packs[0].repoUrl === 'undefined') return acc;

        try {
          var logins = npmatchub.logins(packs);
          var percents = npmatchub.loginPercents(logins);
          
          percents.forEach(function (p) { 
            var login = fixLogin(p.login);
            if (p.percent > 5) acc[login] = true; 
          });
          
        } catch (e) {
          log.error('github-logins', 'problem resolving', packs);
          log.error('github-logins', e);
        }

        return acc;
      }, {});

    cb(null, Object.keys(allLogins));
  }

  function filterUsers (user) {
    if (!filter || ~filter.indexOf(user)) this.queue(user); 
  }

  function filterSep (data) {
    if (data !== sep) this.queue(data);
  }

  npmUsers 
    .createReadStream({ values: false } )
    .pipe(through(filterUsers))
    .pipe(nestedStream)
    .pipe(through(filterSep))
    .pipe(through(groupByUser, callbackLogins));
};

// Test
if (!module.parent) {
  var tapStream = require('tap-stream');
  log.level = 'silly';

  var leveldb = require('valuepack-core/mine/leveldb')
  leveldb.open(function (err, db) {
    if (err) return console.error(err);
    
    go(db, [ 'tjholowaychuk', 'thlorenz' ], function (err, logins) {
      if (err) return console.error(err);
      console.log(logins);  
    });
  });
}
