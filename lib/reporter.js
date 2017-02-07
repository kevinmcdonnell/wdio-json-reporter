import events from 'events';
import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import uuid from 'uuid';
import marge from 'mochawesome-report-generator';

/**
 * Create report json and generate mochawesome report
 *
 * @param {Runner} runner
 * @api public
 */
class JsonReporter extends events.EventEmitter {
    constructor (baseReporter, config, options = {}) {
        super();

        this.baseReporter = baseReporter;
        this.config = config;
        this.options = options;

        const { epilogue } = this.baseReporter;

        var deleteFolderRecursive = function(path) {
          if( fs.existsSync(path) ) {
            fs.readdirSync(path).forEach(function(file,index){
              var curPath = path + '/' + file;
              if(fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
              } else { // delete file
                fs.unlinkSync(curPath);
              }
            });
            fs.rmdirSync(path);
          }
        };

        deleteFolderRecursive(this.options.outputDir)

        this.on('end', () => {
            // console.log(this.baseReporter.stats.runners)
            for (let cid of Object.keys(this.baseReporter.stats.runners)) {
                const runnerInfo = this.baseReporter.stats.runners[cid];
                const start = this.baseReporter.stats.start;
                const end = this.baseReporter.stats.end;
                const duration = this.baseReporter.stats._duration;
                const testsRegistered = this.baseReporter.stats.counts.tests;
                const json = this.prepareJson(start, end, duration, testsRegistered, runnerInfo);
                this.write(runnerInfo, cid, json);
            }


            // var obj = JSON.parse(fs.readFileSync('file', 'utf8'));
            // recursively read json files generated
            // for this.options.outputDir

            const master_obj = {
              'stats': {
                'start': '2017-02-06T11:04:32.527Z',
                'end': '2017-02-06T11:04:40.867Z',
                'duration': 0,
                'testsRegistered': 0,
                'tests': 0,
                'other': 0,
                'hasOther': false,
                'skipped': 0,
                'hasSkipped': false,
                'passPercentClass': 'danger',
                'pendingPercentClass': 'danger',
                'suites': 0,
                'passes': 0,
                'pending': 0,
                'failures': 0,
                'passPercent': 0,
                'pendingPercent': 0
              },
              'state': {
                'passed': 0,
                'failed': 0,
                'skipped': 0
              },
              'suites': {
                'hasTests': false,
                'totalTests': 0,
                'title': '',
                'suites': [],
                'tests': [],
                'pending': [],
                'root': true,
                '_timeout': 999,
                'file': '',
                'uuid': '',
                'fullFile': '',
                'passes': [],
                'failures': [],
                'skipped': [],
                'hasSuites': true,
                'totalPasses': 0,
                'totalFailures': 0,
                'totalPending': 0,
                'totalSkipped': 0,
                'hasPasses': false,
                'hasFailures': false,
                'hasPending': false,
                'hasSkipped': false,
                'duration': 0
              },
              'allTests': [],
              'allPasses': [],
              'allPending': [],
              'allFailures': [],
              'copyrightYear': 2016
            }
            var dir = this.options.outputDir + '/json/'
            var files = fs.readdirSync(dir)
            files.forEach(function (file) {
              let obj = JSON.parse(fs.readFileSync(dir + file, 'utf8'));

              master_obj.stats.duration += obj.stats.duration
              master_obj.stats.testsRegistered += obj.stats.testsRegistered
              master_obj.stats.tests += obj.stats.tests
              master_obj.stats.skipped += obj.stats.skipped
              master_obj.stats.suites += obj.stats.suites
              master_obj.stats.passes += obj.stats.passes
              master_obj.stats.pending += obj.stats.pending
              master_obj.stats.failures += obj.stats.failures
              master_obj.stats.passPercent += 50
              master_obj.stats.pendingPercent += 50

              master_obj.state.passed += obj.state.passed
              master_obj.state.failed += obj.state.failed
              master_obj.state.skipped += obj.state.skipped
              // console.log(obj.suites.suites)
              obj.suites.suites.forEach(function (suite) {
                master_obj.suites.suites.push(suite)

              })

              master_obj.allTests.push(obj.allTests)
              master_obj.allPasses.push(obj.allPasses)
              master_obj.allPending.push(obj.allPending)
              master_obj.allFailures.push(obj.allFailures)
            })

            marge.createSync(JSON.stringify(master_obj), {reportDir : this.options.outputDir})

            epilogue.call(baseReporter);
        });
    }

    prepareJson (start, end, duration, testsRegistered, runnerInfo) {
        var resultSet = {};
        var skippedCount = 0;
        var passedCount = 0;
        var failedCount = 0;

        // root stats
        resultSet.stats = {};

        /*
        / These can be configured immediately
        */
        resultSet.stats.start = start;
        resultSet.stats.end = end;
        resultSet.stats.duration = duration;
        resultSet.stats.testsRegistered = testsRegistered;
        resultSet.stats.tests = testsRegistered;

        /*
        / Not sure what these are for
        */
        resultSet.stats.other = 0;
        resultSet.stats.hasOther = false;
        resultSet.stats.skipped = 0;
        resultSet.stats.hasSkipped = false;
        resultSet.stats.passPercentClass = 'danger';
        resultSet.stats.pendingPercentClass = 'danger';

        resultSet.state = {}
        resultSet.state.passed = 0
        resultSet.state.failed = 0
        resultSet.state.skipped = 0
        /*
        / Containers
        */
        resultSet.suites = {};
        resultSet.allTests = [];
        resultSet.allPasses = [];
        resultSet.allPending = [];
        resultSet.allFailures = [];

        resultSet.copyrightYear = 2016;

        for (let specId of Object.keys(runnerInfo.specs)) {
            const spec = runnerInfo.specs[specId];
            let suite_counter = 0;

            for (let suiteName of Object.keys(spec.suites)) {
                const suite = spec.suites[suiteName];
                this.create_test_suite(suite, suiteName, resultSet, spec, suite_counter)
                suite_counter++;

            }
        }

        resultSet.stats.suites = resultSet.suites.suites.length;
        resultSet.stats.tests = resultSet.allTests.length;
        resultSet.stats.passes = resultSet.allPasses.length
        resultSet.stats.pending = resultSet.allPending.length
        resultSet.stats.failures = resultSet.allFailures.length

        resultSet.stats.passPercent = resultSet.allPasses.length / resultSet.allTests.length * 100;
        resultSet.stats.pendingPercent = resultSet.allPending.length / resultSet.allTests.length * 100;

        return resultSet
    }

    create_test_suite (suite, suiteName, resultSet, spec, suite_counter) {
        const testSuite = {};

        if (Object.keys(suite.tests).length > 0){
            testSuite.hasTests = true;
            testSuite.totalTests = Object.keys(suite.tests).length;
        } else {
            testSuite.hasTests = false;
            testSuite.totalTests = 0;
        }

        testSuite.title = suite_counter !== 0 ? suiteName : '';
        testSuite.suites = [];
        testSuite.tests = [];
        testSuite.pending = [];
        testSuite.root = suite_counter !== 0 ? false : true;
        testSuite._timeout = 999; // Cant get this value
        testSuite.file = suite_counter !== 0 ? spec.files[0] : '';
        testSuite.uuid = suite_counter !== 0 ? spec.specHash : '';
        testSuite.fullFile = suite_counter !== 0 ? spec.files[0] : '';
        testSuite.passes = [];
        testSuite.failures = [];
        testSuite.skipped = [];
        testSuite.hasSuites = true;

        testSuite.totalPasses = 0;
        testSuite.totalFailures = 0;
        testSuite.totalPending = 0;
        testSuite.totalSkipped = 0; // need to add support for skipped
        testSuite.hasPasses = false;
        testSuite.hasFailures = false;
        testSuite.hasPending = false;
        testSuite.hasSkipped = false; // need to add support for skipped
        testSuite.duration = suite_counter !== 0 ? suite._duration : 0;

        // Assume the first suite is the parent suite
        // Will need to refactor for multiple files
        // if (x === 0){
        //     testSuite.root = true;
        //     resultSet.suites = testSuite;
        //     x++;
        // } else {
        //     resultSet.suites.suites.push(testSuite);
        // }

        /*
        / Iterate over hooks
        */
        for (let hookName of Object.keys(suite.hooks)){
            const hook = suite.hooks[hookName];
            const hookResult = {};

            hookResult.start = hook.start
            hookResult.end = hook.end
            hookResult.duration = hook.duration
            hookResult.title = hook.title
            hookResult.associatedSuite = hook.parent
            hookResult.associatedTest = hook.currentTest

            // Dont do anythinh with hooks right now
            // testSuite.hooks.push(hookResult)
        }

        /*
        / Iterate over tests
        */
        if (suite_counter !== 0) {
            for (let testName of Object.keys(suite.tests)) {
                const test = suite.tests[testName]
                const testCase = this.create_test_case(test, suiteName, resultSet, testSuite)

                resultSet.allTests.push(testCase)
                testSuite.tests.push(testCase)
            }
        }

        // Assume the first suite is the parent suite
        // Will need to refactor for multiple files
        if (suite_counter === 0) {
            resultSet.suites = testSuite;
        } else {
           resultSet.suites.suites.push(testSuite);
        }
    }

    create_test_case (test, suiteName, resultSet, testSuite) {
        const testCase = {}

        if (test.state === 'fail') {
            test.state = 'failed'
        }

        testCase.title = test.title;
        testCase.fullTitle = suiteName + test.title;
        testCase.timedOut = false; //?
        testCase.duration = 3; //?
        testCase.state = test.state;
        testCase.speed = 'fast'; //?
        testCase.pass = testCase.state === 'pass' ? true : false;
        testCase.fail = testCase.state === 'failed' ? true : false;
        testCase.pending = testCase.state === 'pending' ? true : false;
        testCase.code = JSON.stringify(test.output); // future effort
        testCase.err = {}; // future effort
        testCase.isRoot = false;
        testCase.uuid = Date.now().toString() + '-' + testCase.fullTitle;
        testCase.parentUUID = testSuite.uuid;
        testCase.skipped = false;

        testSuite.hasPasses = false
        testSuite.hasPending = false
        testSuite.hasFailures = false

        if (test.state === 'pending') {
            testCase.skipped = false;
            resultSet.state.skipped = resultSet.state.skipped + 1
            resultSet.allPending.push(testCase)
            testSuite.skipped.push(testCase)
            testSuite.hasPending = true
            testSuite.totalPending++

        } else if (test.state === 'pass') {
            resultSet.state.passed = resultSet.state.passed + 1
            resultSet.allPasses.push(testCase)
            testSuite.passes.push(testCase)
            testSuite.hasPasses = true
            testSuite.totalPasses++

        } else if (test.state === 'failed') {
            resultSet.state.failed = resultSet.state.failed + 1
            resultSet.allFailures.push(testCase)
            testSuite.failures.push(testCase)
            testSuite.hasFailures = true
            testSuite.totalFailures++
        } else {
            testCase.state = test.state
        }

        if (test.error) {
            if (test.error.type) {
                testCase.errorType = test.error.type
            }
            if (test.error.message) {
                testCase.error = test.error.message
            }
            if (test.error.stack) {
                testCase.standardError = test.error.stack
            }
        }
        return testCase
    }

    write (runnerInfo, cid, json) {
        if (!this.options || typeof this.options.outputDir !== 'string') {
            return console.log(`Cannot write json report: empty or invalid 'outputDir'.`)
        }

        try {
            const dir = path.resolve(this.options.outputDir + '/json')
            const filename = 'WDIO.json.' + runnerInfo.sanitizedCapabilities + '.' + uuid.v1() + '.json'
            const filepath = path.join(dir, filename)
            mkdirp.sync(dir)
            // marge.create(JSON.stringify(json), {reportDir : this.options.outputDir})
            fs.writeFileSync(filepath, JSON.stringify(json))
            console.log(`Wrote json report to [${this.options.outputDir}].`)
        } catch (e) {
            console.log(`Failed to write json report to [${this.options.outputDir}]. Error: ${e}`)
        }
    }

    format (val) {
        return JSON.stringify(this.baseReporter.limit(val))
    }

}

export default JsonReporter
