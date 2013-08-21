'use strict';

var test           =  require('tap').test
  , level          =  require('level-test')
  , sublevel       =  require('level-sublevel')
  , dump           =  require('level-dump')
  , updateByGithub =  require('../lib/update-by-github')
  , sublevels      =  require('valuepack-core/mine/sublevels');

test('\ngiven three byOwner logins of which some already exist, one with different value', function (t) {
  
  var db     =  sublevel(level({ mem: true })(null, { valueEncoding: 'json' }))
  var subnpm =  sublevels(db).npm
  var byGithub = subnpm.byGithub

  var byOwnerLogins = { 
    thlorenz      :  [ 'thlorenz' ],
    tjholowaychuk :  [ 'visionmedia', 'LearnBoost', 'component' ],
    bessern       :  [ 'ver' /* byGithub - ver: loren already exists */ ],
    canny         :  [ 'un', 'not' /* byGithub - not: good already exists */ ],
    empty         :  [] // this user did not provide a github login and we couldn't determine it either
  }

  byGithub.batch([ 
      { key: 'ver', value: 'loren', type: 'put' }
    , { key: 'not', value: 'good', type: 'put' }
  ], function (err) {
    if (err) return t.fail(err);
    updateByGithub(db, byOwnerLogins, function (err) {
      if (err) return t.fail(err);

      var entries = [];
      dump(
          byGithub
        , function (e) { entries.push(e) }
        , function (err) {
            if (err) return t.fail(err);
            var hash = entries.reduce(function (acc, e) {
              acc[e.key] = e.value
              return acc
            }, {})

            t.deepEqual(
                hash
              , { LearnBoost: '"tjholowaychuk"',
                  component: '"tjholowaychuk"',
                  not: '"good"',
                  thlorenz: '"thlorenz"',
                  un: '"canny"',
                  ver: '"loren"',
                  visionmedia: '"tjholowaychuk"' }
              , 'fills in missing byGithub entries, but does not overwrite existing once and ignores users without github login'
            )
            t.end()
          }
      )
    });
  })

})
