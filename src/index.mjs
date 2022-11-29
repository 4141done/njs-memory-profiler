/**
 * The njs request object defined at http://nginx.org/en/docs/njs/reference.html#http
 * This type is not complete, just the elements relevant to operation of this library
 * @typedef {Object} NJSRequest
 * @property {function} getReport - Returns the current tracked memory state
 */

/**
 * The report generated by the profiler.
 * @typedef {Object} Report
 * @property {function} getReport - Returns the current tracked memory state
 */

/**
 * An object representing the profiler. Provides methods
 * to track events, and get the current profile at any point
 * @typedef {Object} Profiler
 * @property {function} getReport - Returns the current tracked memory state
 * @property {function} pushEvent - A function that allows specification of a named event.
 */

/**
 * Initializes the memory profiler. Call this function as
 * early as possible in your handler
 * @param NJSRequest r - the njs request object.
 * @param {function} reporterFn - function that takes the output and reports it. Built in options are `logReporter`, `fileReporter` functions provided in this module
 */
function init(r, reporterFn) {
  const requestId = r.variables.request_id;
  const initialStats = njs.memoryStats;
  const req_start_ms = Date.now();
  const events = [];
  const reporter = reporterFn === null ? null : reporterFn || logReporter;

  const getReport = function getReport() {
    const req_end_ms = Date.now();

    return {
      request_id: requestId,
      cluster_size: initialStats.cluster_size,
      page_size: initialStats.page_size,
      begin: Object.assign(
        { req_start_ms },
        nonStaticMemoryStats(initialStats)
      ),
      end: Object.assign({ req_end_ms }, nonStaticMemoryStats(njs.memoryStats)),
      growth: diff(initialStats, njs.memoryStats),
      elapsed_time_ms: req_end_ms - req_start_ms,
      events,
    };
  };

  const pushEvent = function pushEvent(event, meta) {
    meta = meta || {};
    meta.created_at_ms = Date.now();
    events.push({
      event,
      meta,
      raw_stats: nonStaticMemoryStats(njs.memoryStats),
    });
  };

  if (reporter) {
    njs.on("exit", () => {
      // No async work in this context
      reporter(getReport(), r);
    });
  }

  return {
    getReport,
    pushEvent,
  };
}

function nonStaticMemoryStats(rawStats) {
  return {
    size: rawStats.size,
    nblocks: rawStats.nblocks,
  };
}

function logReporter(report, r) {
  r.error("======== BEGIN MEMORY REPORT ==========");
  r.error(JSON.stringify(report));
  r.error("========  END MEMORY REPORT  ==========");
}

function fileReporter(report) {
  const fs = require("fs");

  return fs.writeFileSync(`${report.request_id}.json`, JSON.stringify(report));
}

function diff(initial, point) {
  return {
    size_growth: point.size - initial.size,
    nblocks_growth: point.nblocks - initial.nblocks,
  };
}

export default { init, logReporter, fileReporter };