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
 * Additionally it provides github logins grouped by owner in order to update byGithub
 * db and help later when trying to fill in missing github urls
 *
 * @name exports
 * @function
 * @param db {LevelDb} mine db instance 
 * @param filter {Array} of npm user names to include (optional, by default all are included)
 * @param cb {Function} called back with error or result with the following properties
 *  - all: [String] all github logins found for all npm users whose occurrence was higher that 5%
 *  - byOwner: [String] github logins for particular npm users sorted by most to least found
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

    var aggregated = Object.keys(userPackages)
      .reduce(function (acc, k) {
        var packs = userPackages[k];
        if (!packs[0] || typeof packs[0].repoUrl === 'undefined') return acc;

        try {
          var logins = npmatchub.logins(packs);
          var percents = npmatchub.loginPercents(logins);
          
          var validLogins = percents
            .filter(function (p) { 
              var login = fixLogin(p.login);
              return (p.percent > 5); 
            })
            .map(function (p) { return p.login; });

          acc.byOwner[k] = validLogins;
          validLogins.forEach(function (l) { acc.all[l] = true; })

        } catch (e) {
          log.error('github-logins', 'problem resolving', packs);
          log.error('github-logins', e);
        }

        return acc;
      }, { byOwner: {}, all: {} });

    var logins = { byOwner: aggregated.byOwner, all: Object.keys(aggregated.all) };
    cb(null, logins);
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
  var dump = require('level-dump');
  log.level = 'silly';

  var leveldb = require('valuepack-core/mine/leveldb')
  leveldb.open(function (err, db) {
    var byGithub    =  db.sublevel(npm.byGithub, { valueEncoding: 'utf8' });
    if (err) return console.error(err);
    
    go(db, [ 'tjholowaychuk', 'thlorenz', 'substack', 'dominictarr', 'Raynos' ], function (err, logins) {
      if (err) return console.error(err);
      inspect(logins);  
    });
  });
}

function inspect(obj, depth) {
  console.log(require('util').inspect(obj, false, depth || 5, true));
}
