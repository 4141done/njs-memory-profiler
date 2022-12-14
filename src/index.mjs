const EVENT_TYPES = {
  START: 1,
  SNAPSHOT: 2,
  END: 3
};

// string numbers to avoid unnecessary parsing
const EVENT_TYPE_TO_STRING = {
  "1": "profiler:start",
  "2": "profiler:snapshot",
  "3": "profiler:end"
};

const EVENT_MAPPING = {
  0: "type",
  1: "name",
  2: "created_at",
  3: "size",
  4: "nblocks"
};

const PROFILER_STATUS = {
  RUNNING: 1,
  DONE: 2
}

function init(r, requestId, reporterFn) {
  // Don't init more than once
  if (r.variables.profiler_status === PROFILER_STATUS.RUNNING) return;
  
  r.variables.profiler_request_id = requestId || r.variables.request_id;
  reporterFn = reporterFn || logReporter;
  
  pushEvent(r, EVENT_TYPE_TO_STRING[`${EVENT_TYPES.START}`], EVENT_TYPES.START);
  r.variables.profiler_status = PROFILER_STATUS.RUNNING;
  // We run final collection on vm exit, but you can manually
  // invoke collection earlier by manually calling `collect`.
  // If this is done, we don't collect again on vm exit.
  njs.on("exit", () => {
    if (r.variables.profiler_status !== PROFILER_STATUS.DONE) {
      r.error("RUNNING EXIT");
    // No async work in this context
    collect(r, reporterFn);
    } else {
      r.error(`SKIPPING EXIT: ${r.variables.profiler_status}`)
    }
  });
}

function collect(r, reporterFn) {
  r.error('in the collector');
  reporterFn = reporterFn || logReporter;
  const endEventName = EVENT_TYPE_TO_STRING[`${EVENT_TYPES.END}`];

  const events = r.variables.profiler_internal_events
      .split("||")
      .map((rawEvent) => {
        const event = deserializeEvent(rawEvent);
        event.id = r.profiler_request_id;
        event.type = EVENT_TYPE_TO_STRING[type]
        return event;
      });
  r.error(`after map: ${endEventName}`);
  events.push({
        name: endEventName,
        type: endEventName,
        created_at: Date.now(),
        size: njs.memoryStats.size,
        nblocks: njs.memoryStats.nblocks
      });
  r.error(JSON.stringify(events));
  reporterFn(events, r);
}

function pushEvent(r, eventName, type) {
  const event = {
    name: eventName,
    type: type || EVENT_TYPES.SNAPSHOT,
    created_at: Date.now(),
    size: njs.memoryStats.size,
    nblocks: njs.memoryStats.nblocks
    
  }
  r.variables.profiler_internal_events += `${event.type === EVENT_TYPES.START || "||"}${serializeEvent(event)}`;
}

function serializeEvent(event) {
  return `${event.type}|${event.name}|${event.created_at}|${event.size}|${event.nblocks}||`;
}

function deserializeEvent(rawEvent) {
  const event = {};
  const fields = rawEvent.split("|");
  for (let i = 0;  i < fields.length; i++) {
    event[EVENT_MAPPING[i]] = fields[i];
  }
  
  return event;
}


/**
 * The njs request object defined at http://nginx.org/en/docs/njs/reference.html#http
 * This type is not complete, just the elements relevant to operation of this library
 * @typedef {Object} NJSRequest
 * @property {function} getReport - Returns the current tracked memory state
 */
function varReporter(report, r) {
  r.error(`In the varReporter, ${JSON.stringify(report)}`);
  r.variables.profile_end = serialize(report.end);
  r.variables.profile_elapsed_time_ms = report.elapsed_time_ms;
  r.variables.profile_memory_growth_bytes = report.growth.size_growth;
  r.variables.profile_memory_growth_blocks = report.growth.nblocks_growth;
}

function logReporter(events, r) {
  r.eror('in the log reporter');
  r.error(JSON.stringify(events));
}

function fileReporter(report) {
  const fs = require("fs");

  return fs.writeFileSync(`${report.request_id}.json`, JSON.stringify(report));
}

export default { init, pushEvent, collect, logReporter, fileReporter, varReporter };
