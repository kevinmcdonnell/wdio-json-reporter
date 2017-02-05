import events from 'events';
import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import uuid from 'uuid';

/**
 * Initialize a new `Json` test reporter.
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

        this.on('end', () => {
            for (let cid of Object.keys(this.baseReporter.stats.runners)) {
                const runnerInfo = this.baseReporter.stats.runners[cid];
                const start = this.baseReporter.stats.start;
                const end = this.baseReporter.stats.end;
                const duration = this.baseReporter.stats._duration;
                const testsRegistered = this.baseReporter.stats.counts.tests;
                const json = this.prepareJson(start, end, duration, testsRegistered, runnerInfo);
                this.write(runnerInfo, cid, json);
            }
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
            let x = 0;

            for (let suiteName of Object.keys(spec.suites)) {
                const suite = spec.suites[suiteName];
                const testSuite = {};

                if (Object.keys(suite.tests).length > 0){
                    testSuite.hasTests = true;
                    testSuite.totalTests = Object.keys(suite.tests).length;
                } else {
                    testSuite.hasTests = false;
                    testSuite.totalTests = 0;
                }

                testSuite.title = suiteName;
                testSuite.suites = [];
                testSuite.tests = [];
                testSuite.pending = [];
                testSuite.root = false;
                testSuite._timeout = 999; // Cant get this value
                testSuite.file = spec.files[0];
                testSuite.uuid = spec.specHash;
                testSuite.fullFile = spec.files[0];
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
                testSuite.duration = suite._duration;

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
                for (let testName of Object.keys(suite.tests)) {
                    const test = suite.tests[testName]
                    const testCase = {}
                    // console.log(suite)
                    // console.log(test)
                    if (test.state === 'fail') {
                        test.state = 'failed'
                    }

                    // testCase.name = test.title
                    // testCase.start = test.start
                    // testCase.end = test.end
                    // testCase.duration = test.duration

                    //
                    // This is everything needed for a test
                    //
                    console.log(JSON.stringify(test.output))
                    testCase.title = test.title;
                    testCase.fullTitle = suiteName + test.title;
                    testCase.timedOut = false; //?
                    testCase.duration = 3; //?
                    testCase.state = test.state;
                    testCase.speed = "fast"; //?
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
                        skippedCount = skippedCount + 1
                        resultSet.allPending.push(testCase)
                        testSuite.skipped.push(testCase)
                        testSuite.hasPending = true
                        testSuite.totalPending++

                    } else if (test.state === 'pass') {
                        passedCount = passedCount + 1
                        resultSet.allPasses.push(testCase)
                        testSuite.passes.push(testCase)
                        testSuite.hasPasses = true
                        testSuite.totalPasses++

                    } else if (test.state === 'failed') {
                        failedCount = failedCount + 1
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


                    resultSet.allTests.push(testCase)
                    testSuite.tests.push(testCase)
                }
                resultSet.state = {}
                resultSet.state.passed = passedCount
                resultSet.state.failed = failedCount
                resultSet.state.skipped = skippedCount

                // Assume the first suite is the parent suite
                // Will need to refactor for multiple files
                if (x === 0){
                    testSuite.root = true;
                    resultSet.suites = testSuite;
                    x++;
                } else {
                    resultSet.suites.suites.push(testSuite);
                }

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

    write (runnerInfo, cid, json) {
        if (!this.options || typeof this.options.outputDir !== 'string') {
            return console.log(`Cannot write json report: empty or invalid 'outputDir'.`)
        }

        try {
            const dir = path.resolve(this.options.outputDir)
            const filename = 'WDIO.json.' + runnerInfo.sanitizedCapabilities + '.' + uuid.v1() + '.json'
            const filepath = path.join(dir, filename)
            mkdirp.sync(dir)
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
