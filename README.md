# grunt-apex-tests

> Run Force.com apex tests using the Force.com Tooling API.

> Warning: This is experimental and is not production ready and includes no unit tests. Use at your own risk.

## Getting Started
This plugin requires Grunt.

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:


## The "apex_tests" task

### Overview
In your project's Gruntfile, add a section named `apex_tests` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  apex_tests: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific  options go here.
    },
  },
})
```

### Options

#### options.patterns
Type: `Array`
Default value: `['%\\_Test']`

An array of patterns used to contruct the query of test classes. This is inserted into a SOQL Like comparison.

#### options.exactNames
Type: `Array`
Default value: `null`

An array of exact class names to query for.

#### options.namespacePrefixes
Type: `Array`
Default value: `[null]`

An array of namespaces to filter the classnames by.

#### options.credentials
Type: `Object`

An object containing the Salesforce server and authentication credentials.

#### options.credentials.server
Type: `String`
Default value: `'https://test.salesforce.com'`

Salesforce endpoint to authenticate to.

#### options.credentials.username
Type: `String`
Default value: `null`

Required: The Salesforce username used to connect.

#### options.credentials.password
Type: `String`
Default value: `null`

Required: Salesforce password and/or security token.

#### options.credentials.clientId
Type: `String`
Default value: `null`

Required: Salesforce clientId of the Connected App.

#### options.credentials.clientSecret
Type: `String`
Default value: `null`

Required: Client secret for the Connected App.

### Usage Examples

In this example, we query for all test classes with names containing `_Test` and `UnitTest` along with the specific class name `Test_someOldClassWithWrongName`.

```js
grunt.initConfig({
  apex_tests: {
    options: {
      patterns: ['%\\_Test', 'UnitTest'],
      exactNames: ['Test_someOldClassWithWrongName'],
      credentials: {
        ...
      }
    },
  },
})
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_

## License
Copyright (c) 2015 Ryan Foster <ryan.foster@salesforce.com>, Salesforce Foundation. Licensed under the MIT license.
