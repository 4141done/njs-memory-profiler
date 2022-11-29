// Note that code in this file must be njs compatible

import testFramework from "./support/micro-jest.mjs";
import subject from "../src/index.mjs";
const expect = testFramework.expect;
const start = testFramework.start;
const test = testFramework.test;

function njsRequest(rawOverrides) {
  const overrides = rawOverrides || {};
  return Object.assign(
    {},
    {
      variables: { request_id: "322nk32iu" },
      error: () => {},
    },
    overrides
  );
}

test("init returns an with the correct functions", (done) => {
  const p = subject.init(njsRequest());
  expect(typeof p.getReport).toBe("function");
  expect(typeof p.pushEvent).toBe("function");
  done();
});

test("getReport contains byte size allocated to vm from init to time report generated", (done) => {
  const p = subject.init(njsRequest());

  const results = p.getReport();
  expect(results.begin.size).toBeGreaterThanOrEqual(0);
  expect(results.end.size).toBeGreaterThanOrEqual(results.begin.size);
  done();
});

test("pushEvent adds a named event", (done) => {
  const expected = "event_one";
  const p = subject.init(njsRequest());

  p.pushEvent(expected);
  const results = p.getReport();
  expect(results.events.length).toBe(1);

  expect(results.events[0].event).toBe(expected);
  done();
});

start();
