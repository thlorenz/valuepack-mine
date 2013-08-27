'use strict';

var test      =  require('tap').test
  , level     =  require('level-test')
  , sublevel  =  require('level-sublevel')
  , dump      =  require('level-dump')
  , sublevels =  require('valuepack-core/mine/sublevels')
  , sep       =  require('valuepack-core').sep
  , fixrepos  =  require('../lib/fix-repo-urls')
  , log          =  require('valuepack-core/util/log')

log.level = 'silly';
function inspect(obj, depth) {
  console.error(require('util').inspect(obj, false, depth || 5, true));
}

test('\ngiven 5 packages with 4 missing urls of which 3 exist as githubs in the db', function (t) {
  var db        =  sublevel(level({ mem: true })(null, { valueEncoding: 'json' }))
    , subnpm    =  sublevels(db).npm
    , subgithub =  sublevels(db).github

  var npmuser = 'foo'
  var logins = { 'foo': [ 'foo', 'bar' ] }

  var packages = [
      { name: 'pack1', repoUrl: 'https://github.com/pack1.git'}
    , { name: 'pack2', repoUrl: null }
    , { name: 'pack3', repoUrl: null }
    , { name: 'pack4', repoUrl: null }
    , { name: 'pack5', repoUrl: null }
  ];

  var packagesByOwnerBatch = packages.map(function (p) {
    return { key: npmuser + sep + p.name, value: p.name, type: 'put', valueEncoding: 'utf8' }
  })

  var packagesBatch = packages.map(function (p) {
    return { key: p.name, value: p, type: 'put' }
  })

  // has repos for packages 3-5 only and is missing them for package 2 and 1
  var reposByOwnerBatch = [
      [ logins.foo[0], 'pack1' ]
    , [ logins.foo[0], 'pack3' ]
    , [ logins.foo[1], 'pack4' ]
    , [ logins.foo[0], 'jspack5' ]
  ].map(function (x) {
    return { key: x[0] + sep + x[1], value: x[0] + '/' + x[1], type: 'put', valueEncoding: 'utf8' }
  })

  subnpm.byOwner.batch(packagesByOwnerBatch, function (err) {
    if (err) return t.fail(err)
    subnpm.packages.batch(packagesBatch, function (err) {
      if (err) return t.fail(err)
      subgithub.byOwner.batch(reposByOwnerBatch, function (err) {
        if (err) return t.fail(err)

        fixrepos(db, npmuser, logins, function (err) {
          if (err) return t.fail(err)

          var packs = [];
          dump.values(
              subnpm.packages
            , function (p) { packs.push(p) }
            , function () {
                t.deepEqual(
                    packs
                  , [ { name: 'pack1', repoUrl: 'https://github.com/pack1.git' },
                      { name: 'pack2', repoUrl: null },
                      { name: 'pack3', repoUrl: 'https://github.com/foo/pack3' },
                      { name: 'pack4', repoUrl: 'https://github.com/bar/pack4' },
                      { name: 'pack5', repoUrl: 'https://github.com/foo/jspack5' } ]
                  , 'fixes the repo urls for the 3 packages for which github repos exist in the db'
                )
                t.end()
            }
          )
        })
      })
    })
  })
})
