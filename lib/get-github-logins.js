'use strict';

var through = require('through')
  , asyncThru = require('async-through')
  , map = require('map-stream')
  , nestStream = require('nest-stream')
  , npmatchub = require('npmatchub')
  , log = require('valuepack-core/util/log');

var tapStream = require('tap-stream');

var sublevels = require('valuepack-core/mine/sublevels');
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
  var subnpm = sublevels(db).npm;

  if (typeof filter === 'function') {
    cb = filter;
    filter = null;
  } else {
    filter = filter.map(function (s) { return s.toLowerCase() });
  }

  var npmPackages =  subnpm.packages
    , byOwner     =  subnpm.byOwner
    , npmUsers    =  subnpm.users

  var githubLogins = {};

  var nestedStream = nestStream(getPackStream, sep);

  function getPackStream (username) {

    function packInfo (name, cb) {
      npmPackages.get(name, function (err, pack) {
        if (err) log.warn('github-logins', 'name', name, err);
        if (!err && pack) cb(null, { user: username, pack: pack }); 
        else cb();
      });
    }

    return byOwner
      .createReadStream({ start: username, end: username + nib, keys: false, values: true })
      .pipe(map(packInfo))
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
    if (!filter || ~filter.indexOf(user.toLowerCase())) this.queue(user); 
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
  var dump = require('level-dump');
  log.level = 'silly';

  var leveldb = require('valuepack-core/mine/leveldb')
  leveldb.open(function (err, db) {
    if (err) return console.error(err);

    function stringify (o) {
      this.queue(JSON.stringify(o, null, 2) + ',');
    }

    go(db, [ 'tjholowaychuk', 'thlorenz', 'substack', 'dominictarr', 'Raynos' ], function (err, logins) {
      if (err) return console.error(err);
      inspect(logins);  
    })
  });
}

function inspect(obj, depth) {
  console.log(require('util').inspect(obj, false, depth || 5, true));
}
