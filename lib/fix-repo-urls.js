'use strict';

var npmatchub    =  require('npmatchub')
  , concatStream =  require('concat-stream')
  , asyncreduce  =  require('asyncreduce')
  , xtend        =  require('xtend')
  , log          =  require('valuepack-core/util/log')
  , sublevels    =  require('valuepack-core/mine/sublevels')
  , map          =  require('valuepack-core/mine/map')
  , sep          =  require('valuepack-core').sep
  , nib          =  require('valuepack-core').nib
  , ghroot       =  'https://github.com/'
  ;

var setImmediate = setImmediate || function (fn) { setTimeout(fn, 0) };

function resolve (byOwner, pack, logins, trust, cb) {
  var stabs = npmatchub.stabs(logins, pack.name);
  asyncreduce(
      stabs
    , null
    , function (match, stab, cb_) {
        // pass the match thru the function chain once we found one
        if (match) return setImmediate(cb_.bind(null, null, match))
        var login = stab.login;
        var repo = stab.repo;

        byOwner.get(login + sep + repo, function (err, value) {
          return err 
            ? cb_(null, null)
            : cb_(null, { repoUrl: ghroot + login + '/' + repo })
        });
      }
    , cb
  );
}

function updateFixedRepos (packages, fixed, cb) {
  var batch = fixed.map(function (f) { return { key: f.name, value: f, type: 'put' } });
  packages.batch(batch, cb);
}

/**
 * Matches up npm user to a github login and his packages to github repositories
 * 
 * @name exports
 * @function
 * @param db {LevelDb} mining db
 * @param npmuser {String} npm user name
 * @param logins {String} github logins for the npm user 
 * @param cb {Function} called back with an error or npm packages whose repoUrl was filled in where ever possible
 * */
var go = module.exports = function (db, npmuser, logins, cb) {
  var subs        =  sublevels(db)
    , subnpm      =  subs.npm
    , subgithub   =  subs.github
    ;

    map
      .npmUserToPackageInfoStream(subnpm.packages, subnpm.byOwner, npmuser)
      .pipe(concatStream(fixMissingUrls));

    function fixMissingUrls (packageData) {
      var packages = packageData.map(function (d) { return d.pack });
      var needFixing = packages.filter(function (p) { return !p.repoUrl || !p.repoUrl.length });

      if (!needFixing.length) return cb();
      
      log.verbose('fix-repo-urls', 'Attempting to fix %s repo urls for npm user %s', needFixing.length, npmuser);

      var opts = { 
          packages :  packages
        , logins   :  logins[npmuser]
        , resolve  :  resolve.bind(null, subgithub.byOwner)
      };

      var fixingNames = needFixing
        .reduce(function (acc, p) { 
          acc[p.name] = true;
          return acc;
        }, {});

      npmatchub.repos(opts, function (err, packs) {
        if (err) return cb(err); 

        var stillNeedFixing = packs.filter(function (p) { return !p.repoUrl || !p.repoUrl.length });

        var fixed = packs.filter(function (p) {
          return fixingNames[p.name] && p.repoUrl && p.repoUrl.length;
        });

        if (!fixed.length) return cb();
  
        log.verbose('fix-repo-urls', 'Applying fixes to %s of these packages', fixed.length);
        updateFixedRepos(subnpm.packages, fixed, cb);
      });
    }
};

if (!module.parent) {
  var leveldb =  require('valuepack-core/mine/leveldb')
    , dump = require('level-dump')
    , tapStream = require('tap-stream')
    , clearDb = require('valuepack-core/util/clear-db')


  log.level = 'verbose';
  leveldb.open(function (err, db) {
    if (err) return console.error(err);

    var subs        =  sublevels(db)
      , subnpm      =  subs.npm
      , subgithub   =  subs.github

    var logins = { 
      dominictarr: [ 'dominictarr' ],
      raynos: [ 'Raynos', 'termi' ],
      substack: [ 'substack' ],
      thlorenz: [ 'thlorenz' ],
      tjholowaychuk:
        [ 'visionmedia',
          'component',
          'learnboost' ] }

    function run () {
      go(db, 'dominictarr', logins, function () { db.close(); });
    }

    run()
  });

}
