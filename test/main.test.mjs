import testFramework from "./mini-jest.mjs";
import subject from "../index.mjs";
const expect = testFramework.expect;
const start = testFramework.start;
const test = testFramework.test;

test("init returns an object", (done) => {
  const p = subject.init();
  expect(p).toBe("/");
  done();
});

start();
