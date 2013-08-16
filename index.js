'use strict';

var runnel = require('runnel') 
  , updateNpm = require('valuepack-mine-npm')
  , updateGithub = require('valuepack-mine-github');
  

// 1. update npm

// 2. for each user determine possible github logins (not only the one that is given)
//    instead use npmatchub to deduce possible logins
//    this will give long list of github logins we need to get from github
  
// 3. pull down repo and user info for all these users

// 4. fix repo urls by trying to match npm packages to repos we pulled down - don't 
//    do more (i.e. don't try to ping github -- too slow and unreliable)

// at this point we should have mined all data

var go = module.exports = function (db) {
  /*runnel(
      updateNpm
  );*/


};

