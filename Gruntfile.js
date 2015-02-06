/*
 * grunt-apex-tests
 * https://github.com/SalesforceFoundation/grunt-apex-tests
 *
 * Copyright (c) 2015 Ryan Foster <ryan.foster@salesforce.com>
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
  // load all npm grunt tasks
  require('load-grunt-tasks')(grunt);

  var credentials;
  try {
    var secret = grunt.file.readJSON('secret.json');
    credentials = secret.staging;
  } catch(e) {
    // No secret.json found, use env vars
    if (process.env.username &&
      process.env.password &&
      process.env.server) {

      credentials = {
        username: process.env.username,
        password: process.env.password,
        server: process.env.server,
        clientId: process.env.clientId ? process.env.clientId : undefined,
        clientSecret: process.env.clientSecret ? process.env.clientSecret : undefined,
      };
    }
  }

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        '<%= nodeunit.tests %>'
      ],
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      }
    },

    // Before generating any new files, remove any previously-created files.
    clean: {
      tests: ['tmp']
    },

    // Configuration to be run (and then tested).
    apex_tests: {
      options: {
        credentials: credentials
      },
      test: {
        options: {
          patterns: null,
          exactNames: ['Volunteerforce1ControllerTest']
        }
      },
      
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js']
    }

  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['clean', 'apex_tests', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);

};
