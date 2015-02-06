/*
 * grunt-apex-tests
 * https://github.com/SalesforceFoundation/grunt-apex-tests
 *
 * Copyright (c) 2015 Ryan Foster <ryan.foster@salesforce.com>
 * Licensed under the MIT license.
 */

'use strict';

var nforce = require('nforce'),
  tooling = require('nforce-tooling')(nforce),
  Q = require("q"),
  fs = require('fs'),
  _ = require('lodash'),
  events = require('events'),
  eventEmitter = new events.EventEmitter();


module.exports = function (grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('apex_tests', 'Run Force.com apex tests using the Force.com Tooling API.', function () {

    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      patterns: null,
      exactNames: null,
      namespacePrefixes: [null],
      coverage: false,
      pollDelay: 6000,
      credentials: {
        server: 'https://test.salesforce.com',
        username: null,
        password: null,
        clientId: null,
        clientSecret: null
      }
    });

    var queryNames = [];

    // This is an async task
    var done = this.async();

    function buildQuery() {
      var patterns = options.patterns;
      var exacts = options.exactNames;
      var namespacePrefixes = options.namespacePrefixes;

      var q = 'SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE ';

      if (namespacePrefixes) {
        var cleanOfNull = _.without(namespacePrefixes, null);
        var nullString = '';

        if (namespacePrefixes.indexOf(null) > -1) {
          nullString = 'null';
        }

        q += '(NamespacePrefix = ' + nullString;

        if (cleanOfNull.length) {
          q += ' OR NamespacePrefix = \'' + cleanOfNull.join('\' OR NamespacePrefix = ') + '\'';
        }

        q += ') AND (';
      }

      if (patterns) {
        q += 'Name LIKE \'' + patterns.join('\' OR Name LIKE \'') + '\'';
      }

      if (patterns && exacts) {
        q += ' OR ';
      }

      if (exacts) {
        q += 'Name = \'' + exacts.join('\' OR Name = \'') + '\'';
      }

      if (namespacePrefixes) {
        q += ')';
      }
      return q;
    }

    var failed = false;
    var testClasses = [];

    var credentials = options.credentials;

    if (!credentials.server ||
        !credentials.username ||
        !credentials.password ||
        !credentials.clientId ||
        !credentials.clientSecret) {
      grunt.fail.warn('Valid credentials are required to run Apex tests, include server, username password, clientId and clientSecret.');
    }

    var org = nforce.createConnection({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectUri: 'http://localhost:3000/oauth/_callback',
      loginUri: credentials.server + '/services/oauth2/token',
      mode: 'single',
      plugins: ['tooling']
    });

    function queryTestClasses() {
      var q = buildQuery();
      org.tooling.query({q: q}, function(err, resp) {
        if (err) {
          eventEmitter.emit('error', err);
        }
        if (!err) {

          if (!resp.records.length) {
            eventEmitter.emit('error', 'No tests classes found to execute.');
          }

          grunt.log.writeln('Found the following test classes to execute:');
          for(var obj in resp.records) {
            grunt.log.writeln(' - ' +resp.records[obj].Name);
            testClasses.push({
              Id: resp.records[obj].Id,
              Name: resp.records[obj].Name,
              Coverage: null,
              Outcomes: {
                Pass: 0,
                Fail: 0,
                CompileFail: 0,
                Skip: 0
              },
              results: []
            });
          }
        }
        eventEmitter.emit('queried');
      });
    }

    function executeTests() {
      grunt.log.writeln('\nQueuing tests for execution...');

      var hasRun = false;
      function runJob() {
        var timeout = setTimeout(function() {
          org.tooling.runTestsAsync({ids: _.pluck(testClasses, 'Id')}, function(err, results) {
            if (!err) {
              eventEmitter.emit('status', results);
            } else {
              if (err.errorCode === 'ALREADY_IN_PROCESS') {
                if (!hasRun) {
                  grunt.log.writeln('Waiting for an existing test queue to finish...');
                } else {
                  grunt.log.write('.');
                }
                hasRun = true;
                runJob();
              } else {
                eventEmitter.emit('error', err);
              }
            }
          });
        }, options.pollDelay);
      }
      runJob();
    }

    function checkJobStatus(jobId) {
      var completedStatuses = ['Aborted', 'Completed', 'Failed'];

      grunt.log.writeln('\nTests are running...');

      function getStatus(jobId) {
        var timeout = setTimeout(function() {
          org.tooling.getAsyncTestStatus({id: jobId}, function(err, resp) {
            grunt.log.write('.');
            var statuses = _.uniq(_.pluck(resp.records, 'Status'));

            if (statuses.length === 1 && completedStatuses.indexOf(statuses[0]) > -1) {
              var apexTestQueueItemIds = _.uniq(_.pluck(resp.records, 'Id'));
              eventEmitter.emit('results', apexTestQueueItemIds);
            } else {
              getStatus(jobId);
            }
          });
        }, options.pollDelay);
      }
      getStatus(jobId);
    }

    function handleTestResults(ids) {
      // keep track of how many test results we've processed so we know when done (async)
      var counter = 0;

      grunt.log.writeln('\nJob Complete! Collecting results...');

      org.tooling.getAsyncTestResults({ids: ids}, function(err, resp) {

        if (!err) {

          _(resp.records).forEach(function(result) {

            var testClass = _.findWhere(testClasses, {Id: result.ApexClass.Id});

            testClass.Outcomes[result.Outcome] += 1;

            if (testClass) {
              testClass.results.push(result);
            }

            if (result.Outcome !== 'Pass') {
              failed = true;
            }

          });

          // Collect coverage
          if (options.coverage) {
            var classIds = _.pluck(testClasses, 'Id');
            var q = 'SELECT Coverage, ApexClassorTriggerId FROM ApexCodeCoverageAggregate ' +
            'WHERE ApexClassOrTriggerId IN (\'' + classIds.join('\', \'') + '\')';

            console.log(q);
            org.tooling.query({q: q}, function(err, resp) {
              if (err) {
                eventEmitter.emit('error', err);
              } else {
                console.log(resp);
                _.each(resp.records, function(result) {
                  console.log(result);
                  var testClass = _.findWhere(testClasses, {Id: result.ApexClassorTriggerId});

                  console.log(testClass);
                  if (testClass) {
                    testClass.Coverage = result.Coverage;
                  }
                });
              }
              eventEmitter.emit('complete');
            });
          } else {
            eventEmitter.emit('complete');
          }
        }

        if (err) { eventEmitter.emit('error', err); }
      });

    }

    function renderResults(classes) {
      grunt.log.writeln('\nResults:\n========');
      _.each(classes, function(testClass) {
        grunt.log.writeln(testClass.Name + ' ' + testClass.Outcomes.Pass + '/' + testClass.results.length + ' test methods passed');

        if (options.Coverage) {
          grunt.log.writeln('Coverage: ' + testClass.Coverage);
        }
        //
        // grunt.log.writeln('- Passed: ' + testClass.Outcomes.Pass);
        // grunt.log.writeln('- Skipped: ' + testClass.Outcomes.Skip);
        // grunt.log.writeln('- Compile Failed: ' + testClass.Outcomes.CompileFail);
        // grunt.log.writeln('- Failed: ' + testClass.Outcomes.Fail);
      });

      _.each(classes, function(testClass) {
        if (testClass.Outcomes.Skip ||
          testClass.Outcomes.CompileFail ||
          testClass.Outcomes.Fail) {

          grunt.log.writeln('\nFailures:\n=========');
          _.each(testClass.results, function(result) {
            if (result.Outcome !== 'Pass') {
              grunt.log.error(result.Outcome + ' ' + testClass.Name+'.'+result.MethodName+':');
              grunt.log.errorlns(result.Message + '\n');
            }
          });
        }
      });
    }

    // Authenticate with the org
    org.authenticate({ username: credentials.username, password: credentials.password}, function(err, resp){
      if(!err) {
        eventEmitter.emit('authenticated');
      } else {
        eventEmitter.emit('error', err.message);
      }
    });

    // authenticated, query for test class ids
    eventEmitter.on('authenticated', function() {
      queryTestClasses();
    });


    // Start, query for test class ids then run the tests
    eventEmitter.on('queried', function() {
      executeTests();
    });

    // Query the job until it is complete
    eventEmitter.on('status', function(jobId) {
      checkJobStatus(jobId);
    });

    // Handle Results
    eventEmitter.on('results', function(ids) {
      handleTestResults(ids);
    });

    // Handle errors
    eventEmitter.on('error', function(error) {
      grunt.fail.warn('Error!! ' + error);
      done();
    });

    // Handle complete, render the results
    eventEmitter.on('complete', function() {
      renderResults(testClasses);
      if (!failed) {
        grunt.log.writeln('\nApex tests complete!');
      } else {
        grunt.fail.warn('\nApex tests ran with failures.');
      }
      done();
    });


  });

};
