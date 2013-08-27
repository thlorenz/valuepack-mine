'use strict';
/*jshint asi: true */

var test      =  require('tap').test
  , xtend     =  require('xtend')
  , level     =  require('level-test')
  , sublevel  =  require('level-sublevel')
  , dump      =  require('level-dump')
  , getLogins =  require('../lib/get-github-logins')
  , sublevels = require('valuepack-core/mine/sublevels');

function toPut (o, valEnc) {
  return xtend(o, { type: 'put' }); 
}

function getPackagesBatch () {
  // each file contains subset of each user's packages
  return require('./fixtures/npm-packages-dominictarr.json')
    .concat(require('./fixtures/npm-packages-raynos.json'))
    .concat(require('./fixtures/npm-packages-substack.json'))
    .concat(require('./fixtures/npm-packages-thlorenz.json'))
    .concat(require('./fixtures/npm-packages-tj.json'))
    .map(toPut)
}

function setup (cb) {
  // contains metadata of these users
  var users = require('./fixtures/npm-users-tj-thlorenz-substack-dominictarr-raynos.json')

  // contains byOwner indexes for all batched packages
    , owners = require('./fixtures/byOwner-tj-thlorenz-substack-dominictarr-raynos.json')
    , usersBatch = users.map(toPut)
    , byOwnerBatch = owners.map(toPut).map(function (x) { return xtend(x, { valueEncoding: 'utf8' }) })
    , packagesBatch = getPackagesBatch()

  var db = sublevel(level({ mem: true })(null, { valueEncoding: 'json' }))

  var subnpm      =  sublevels(db).npm
    , npmPackages =  subnpm.packages
    , npmUsers    =  subnpm.users
    , npmByOwner  =  subnpm.byOwner


  npmPackages.batch(packagesBatch, function (err) {
    if (err) return cb(err);
    npmByOwner.batch(byOwnerBatch, function (err) {
      if (err) return cb(err);
      npmUsers.batch(usersBatch, function (err) {
        if (err) return cb(err);
        cb(null, db);
      })
    })
  })
}

test('\nunfiltered - empty db', function (t) {
  var db = sublevel(level({ mem: true })(null, { valueEncoding: 'json' }))

  getLogins(db, function (err, logins) {
    if (err) return console.error(err);
    t.deepEqual(logins.byOwner, {}, 'empty byOwner')
    t.deepEqual(logins.all, [], 'empty all')
    t.end()
  });
})

test('\nempty db - filtered', function (t) {
  var db = sublevel(level({ mem: true })(null, { valueEncoding: 'json' }))

  getLogins(db, [ 'tjholowaychuk', 'thlorenz', 'substack' ], function (err, logins) {
    if (err) return console.error(err);
    t.deepEqual(logins.byOwner, {}, 'empty byOwner')
    t.deepEqual(logins.all, [], 'empty all')
    t.end()
  });
})

test('\nnon-empty db - non-filtered', function (t) {
  setup(function (err, db) {

    if (err) return t.fail(err);

    getLogins(db, function (err, logins) {
      if (err) return t.fail(err);

      t.deepEqual(
          logins.byOwner
        , { dominictarr: [ 'dominictarr' ],
            raynos: [ 'Raynos', 'termi' ],
            substack: [ 'substack' ],
            thlorenz: [ 'thlorenz' ],
            tjholowaychuk:
              [ 'visionmedia',
                'component',
                'learnboost' ] }
        , 'byOwner'
      )
      t.deepEqual(
          logins.all
        , [ 'dominictarr',
            'Raynos',
            'termi',
            'substack',
            'thlorenz',
            'visionmedia',
            'component',
            'learnboost' ]
        , 'all'
      )
      t.end()
    })
  })
})

test('\nnon-empty db - [ thlorenz ]', function (t) {
  setup(function (err, db) {

    if (err) return t.fail(err);

    getLogins(db, [ 'thlorenz' ], function (err, logins) {
      if (err) return t.fail(err);

      t.deepEqual(
          logins.byOwner
        , { thlorenz: [ 'thlorenz' ] }
        , 'byOwner'
      )
      t.deepEqual(
          logins.all
        , [ 'thlorenz' ]
        , 'all'
      )
      t.end()
    })
  })
})

test('\nnon-empty db - [ substack, Raynos, tjholowaychuk ]', function (t) {
  setup(function (err, db) {

    if (err) return t.fail(err);

    getLogins(db, [ 'substack', 'Raynos', 'tjholowaychuk' ], function (err, logins) {
      if (err) return t.fail(err);

      t.deepEqual(
          logins.byOwner
        , { raynos: [ 'Raynos', 'termi' ],
            substack: [ 'substack' ],
            tjholowaychuk:
              [ 'visionmedia',
                'component',
                'learnboost' ] }
        , 'byOwner'
      )
      t.deepEqual(
          logins.all
        , [ 'Raynos',
            'termi',
            'substack',
            'visionmedia',
            'component',
            'learnboost' ]
        , 'all'
      )
      t.end()
    })
  })
})
