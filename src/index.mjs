/**
 * @module Profiler
 * Single module to allow collection of timing and memory statistics. In order to
 * maintain collection accross njs directives profiling information is stored as a text
 * string in an nginx variable.  The format is as follows:
 * * Everything is an event (including start and end)
 * * Events are separated by `||`
 * * Values within an event are separeted by `|`
 * * Values are mapped to fields given the order in `EVENT_MAPPING` defined in this module
 *
 * Here is an example of the content of the variable:
 * `1|profiler:start|1671143290831|47600|3||2|main_func|1671143290831|47600|3||2|js_var|1671143290831|47600|3``
 */

/**
 * The njs request object defined at http://nginx.org/en/docs/njs/reference.html#http
 * This type is not complete, just the elements relevant to operation of this library
 * @typedef {Object} NJSRequest
 * @property {Object} variables - A read/write map of all variables usable by njs
 */

/**
 * The report of timing and memory for a single request.  A report is made up of many events
 * @typedef {Object} Report
 * @property {string} id - An id to link together all events in a single request.
 * @property {Event[]} events - the list of all events collected by the profiler
 */

/**
 * An event is a snapshot at a certain time of the memory measurements for the njs vm
 * @typedef {Object} Event
 * @proproperty {string} name - The name of the event.
 * @proproperty {string} type - The type (one of `start`, `snapshot`, `end`)
 * @proproperty {number} createdAt - A unix timestamp recording when the event was recorded
 * @proproperty {number} size - Size in bytes of memory allocated by the njs vm
 * @property {size} nblocks - Number of memory blocks allocated by the njs vm
 */

/** @constant
* Integer enums for the different event types. Numbers to keep down size of
* state stored in the nginx variable
* @type {Object}
* @property {number} START - Numerical enum for the start event.
* @property {number} SNAPSHOT - Numerical enum for the snapshot event.
* @property {number} END - Numerical enum for the end event.
@default
*/
const EVENT_TYPES = {
  START: 1,
  SNAPSHOT: 2,
  END: 3,
};

/** @constant
* Simple mapping to rehydrate event types for human display.
* The keys are strings because strings are what comes out of the
* nginx variable. This saves us from having to parse them to int just for a lookup
* @type {Object}
* @property {string} 1 - Numerical enum for the start event.
* @property {string} 2 - Numerical enum for the snapshot event.
* @property {string} 2 - Numerical enum for the end event.
@default
*/
const EVENT_TYPE_TO_STRING = {
  1: "profiler:start",
  2: "profiler:snapshot",
  3: "profiler:end",
};

/** @constant
* This constant defines the order
* that values are encoded into the `profiler_internal_events` nginx variable
* Example:`1|profiler:start|1671143290831|47600|3`
* 
* @type {Object}
* @property {number} 0 - Zero-indexed position of the "type" value in the internal event format
* @property {number} 1 - Zero-indexed position of the "name" value in the internal event format
* @property {number} 2 - Zero-indexed position of the "createdAt" value in the internal event format
* @property {number} 3 - Zero-indexed position of the "size" value in the internal event format
* @property {number} 4 - Zero-indexed position of the "nblocks" value in the internal event format
@default
*/
const EVENT_MAPPING = {
  0: "type",
  1: "name",
  2: "createdAt",
  3: "size",
  4: "nblocks",
};

/** @constant
* Mapping of fields that are integers and need parsing when deserialized
* @type {Object}
* @property {string} "createdAt" - A unix timestamp recording when the event was recorded
* @property {string} "size" - Size in bytes of memory allocated by the njs vm
* @property {string} "nblocks" - Number of memory blocks allocated by the njs vm
@default
*/
const INT_FIELDS = {
  createdAt: true,
  size: true,
  nblocks: true,
};

/** @constant
* Enums for the status of the profiler.  Used to prevent multiple initializations/collections
* Enums as strings to avoid unnecessary parsing when taking out of nginx variables
* @type {Object}
* @property {string} "RUNNING" - Enum indicating that the profiler has been initialized
* @property {string} "DONE" - Enum indicating that the profiler is done for the request
@default
*/
const PROFILER_STATUS = {
  RUNNING: "1",
  DONE: "2",
};

/**
 * Starts the profiler. You can provide an arbitrary id to indentify the profile.
 * If not given, one will be generated for you.
 *
 * @param {NJSRequest} r - The njs request object for variable access
 * @param {string} requestId - Arbitrary id to indentify the profile. Defaults to a value generated by `request_id`
 * @param {function} reporterFn - One of the reporter functions exported by this module. Defaults to `logReporter`
 *
 * @example
 *
 *    import profiler from "./njs_modules/njs-memory-profiler/njs-memory-profiler.js";
 *    profiler.init(r, "my_id", profiler.fileReporter);
 */
function init(r, requestId, reporterFn) {
  // Don't init more than once
  if (r.variables.profiler_status === PROFILER_STATUS.RUNNING) return;

  // You can specify your own id for the request profile, or the profiler will generate one
  r.variables.profiler_request_id = requestId || r.variables.request_id;
  reporterFn = reporterFn || logReporter;

  pushEvent(r, EVENT_TYPE_TO_STRING[`${EVENT_TYPES.START}`], EVENT_TYPES.START);
  r.variables.profiler_status = PROFILER_STATUS.RUNNING;

  // We run final collection on vm exit, but you can manually
  // invoke collection earlier by manually calling `collect`.
  // If this is done, we don't collect again on vm exit.
  njs.on("exit", () => {
    // No async work in this context
    collect(r, reporterFn);
  });
}

/**
 * Finishes the profiling and generates the report. Can be invoked anytime.  If it is
 * not called explicitly, it will be invoked on the `exit` event emitted by the njs vm.
 *
 * @param {NJSRequest} r - The njs request object for variable access
 * @param {function} reporterFn - One of the reporter functions exported by this module.
 *
 * @example
 *
 *    import profiler from "./njs_modules/njs-memory-profiler/njs-memory-profiler.js";
 *    profiler.collect(r, profiler.fileReporter);
 */
function collect(r, reporterFn) {
  if (r.variables.profiler_status === PROFILER_STATUS.DONE) return;

  reporterFn = reporterFn || logReporter;
  const endEventName = EVENT_TYPE_TO_STRING[`${EVENT_TYPES.END}`];

  const events = r.variables.profiler_internal_events
    .split("||")
    .map((rawEvent) => {
      const event = deserializeEvent(rawEvent);
      event.type = EVENT_TYPE_TO_STRING[event.type];
      return event;
    });

  events.push(createEvent(endEventName, endEventName));

  reporterFn(
    {
      id: r.variables.profiler_request_id,
      events: events,
    },
    r
  );

  // Stops other `collect` calls from initiating
  r.variables.profiler_status = PROFILER_STATUS.DONE;
}

/**
 * Creates an event in the profiler report. Use this
 * before and after events you think may be taking a long time
 * or using a lot of memory to understand the timeing and memory
 * differenty before and after the event.
 *
 * @param {NJSRequest} r - The njs request object for variable access
 * @param {string} eventName - The name of the event. Make this meaningful.
 * @param {number} type - From the enum `EVENT_TYPES`. If not given defaults to `SNAPSHOT`
 *
 * @example
 *
 *    import profiler from "./njs_modules/njs-memory-profiler/njs-memory-profiler.js";
 *    pushEvent(r, "before_heavy_action");
 *    myHeavyAction();
 *    pushEvent(r, "after_heavy_action");
 */
function pushEvent(r, eventName, type) {
  const event = createEvent(eventName, type);

  if (type === EVENT_TYPES.START) {
    r.variables.profiler_internal_events += serializeEvent(event);
  } else {
    r.variables.profiler_internal_events += `||${serializeEvent(event)}`;
  }
}

/**
 * Encodes the start, end and events to nginx variables to use
 * in a custom log format.  Note that currently you must
 * call `collect` explicitly when using this method since
 * access logs are written BEFORE vm destroy.
 *
 * @param {Report} report - The profiler report
 * @param {NJSRequest} r - the njs request object for variable access
 *
 * @example
 *
 *    import profiler from "./njs_modules/njs-memory-profiler/njs-memory-profiler.js";
 *    profiler.init(r, profiler.varReporter);
 */

function varReporter(report, r) {
  const start = report.events[0];
  const end = report.events[report.events.length - 1];
  r.variables.profiler_start_size = start.size;
  r.variables.profiler_start_blocks = start.nblocks;
  r.variables.profiler_start_time = start.createdAt;

  r.variables.profiler_end_size = end.size;
  r.variables.profiler_end_blocks = end.nblocks;
  r.variables.profiler_end_time = end.createdAt;
  r.variables.profiler_full_report = JSON.stringify(report);
}

/**
 * The default reporter that simply writes the report as
 * stringified json to the error logs.
 *
 * @param {Report} report - The profiler report
 * @param {NJSRequest} r - the njs request object for variable access
 *
 * @example
 *    import profiler from "./njs_modules/njs-memory-profiler/njs-memory-profiler.js";
 *    profiler.init(r, profiler.logReporter);
 */
function logReporter(events, r) {
  r.error(JSON.stringify(events));
}

/**
 * A reporter that simply writes the report as
 * stringified json to a file.
 *
 * @param {Report} report - The profiler report
 * @param {NJSRequest} r - the njs request object for variable access
 *
 * @example
 *    import profiler from "./njs_modules/njs-memory-profiler/njs-memory-profiler.js";
 *    profiler.init(r, profiler.fileReporter);
 */
function fileReporter(report) {
  const fs = require("fs");

  return fs.writeFileSync(
    `${report.id}.json`,
    JSON.stringify(report)
  );
}

function serializeEvent(event) {
  return `${event.type}|${event.name}|${event.createdAt}|${event.size}|${event.nblocks}`;
}

function deserializeEvent(rawEvent) {
  const event = {};
  const fields = rawEvent.split("|");
  for (let i = 0; i < fields.length; i++) {
    const value = fields[i];
    const fieldName = EVENT_MAPPING[i];
    event[fieldName] = INT_FIELDS[fieldName] ? parseInt(value, 10) : value;
  }

  return event;
}

function createEvent(eventName, type) {
  return {
    name: eventName,
    type: type || EVENT_TYPES.SNAPSHOT,
    createdAt: Date.now(),
    size: njs.memoryStats.size,
    nblocks: njs.memoryStats.nblocks,
  };
}

export default {
  init,
  pushEvent,
  collect,
  logReporter,
  fileReporter,
  varReporter,
};
