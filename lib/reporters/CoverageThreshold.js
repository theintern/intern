define([
    'dojo/node!istanbul/lib/collector',
    'dojo/node!istanbul/lib/object-utils',
    'dojo/node!istanbul/lib/report/common/defaults'
], function (Collector, utils, defaults) {
    var logger;
    function CoverageThreshold(config) {
        var defaultThresholds = defaults.watermarks();

        for (var key in defaultThresholds) {
            defaultThresholds[key] = defaultThresholds[key][0];
        }

        this.config = config || {};
        logger = this.config.logger ? this.config.logger : console;

        config.threshold = config.threshold || defaultThresholds;
        this._collector = new Collector();
    }

    function enforceThreshold(threshold, actual, expected) {
        var name = threshold[0].toUpperCase() + threshold.slice(1);
        var success = actual >= expected;
        var placing = success ? 'above' : 'below';
        var passed = success ? 'PASSED! ' : 'FAILED! ';
        var status = success ? 'log' : 'error';
        var msg = passed + name + ': ' + actual + '%, ' + placing + ' threshold of ' + expected + '%';

        logger[status](msg);
        return success;
    }

    CoverageThreshold.prototype.coverage = function (sessionId, coverage) {
        this._collector.add(coverage);
    };

    CoverageThreshold.prototype.runEnd = function () {
        var collector = this._collector;
        var summaries = [];
        var total = 0;
        var overall = 0;
        var success = true;
        var finalSummary;

        collector.files().forEach(function (file) {
            summaries.push(utils.summarizeFileCoverage(collector.fileCoverageFor(file)));
        });

        finalSummary = utils.mergeSummaryObjects.apply(null, summaries);

        for (var key in finalSummary) {
            if (finalSummary[key].pct) {
                if (key in this.config.threshold) {
                    success = success && enforceThreshold(key, finalSummary[key].pct, this.config.threshold[key]);
                }
                overall += finalSummary[key].pct;
                total++;
            }
        }

        overall = overall / total;

        if (this.config.threshold.overall) {
            success = success && enforceThreshold('Overall', overall, this.config.threshold.overall);
        }

        if (!success) {
            logger.error('Coverage threshold not met!');
        }
    };

    return CoverageThreshold;
});
