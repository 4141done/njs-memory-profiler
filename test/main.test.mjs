import testFramework from "./support/mini-jest.mjs";
import subject from "../src/index.mjs";
const expect = testFramework.expect;
const start = testFramework.start;
const test = testFramework.test;

test("init returns an with the correct functions", (done) => {
  const p = subject.init({
    variables: { request_id: "322nk32iu" },
    error: () => {},
  });
  expect(typeof p.getReport).toBe("function");
  expect(typeof p.pushEvent).toBe("function");
  done();
});

start();
