# Running Tests

This library uses a simple unit test framework based heavily on the [Kaluma project](https://github.com/kaluma-project/kaluma)'s test suite. **the primary goal was to make sure that njs tests run in the njs engine**.

That project uses a minimal reimplementation of the popular jest framework that requires minimal adaptation for use with njs. Other changes were made to make the test framework more friendly for CI.

The following changes were made:

- Failing test files now return a exit code of `1` via `throw`
- Test processing implemented via recursive `setTimeout` instead of `setInterval` which is not supported by njs
- Running of the whole test suite now returns a `1` exit code if any of the test files fails.

## Available Matchers

Micro-Jest provides various matchers to test values. `toBe()` is used to test a value with exact equality.

```js
test("1 + 1 = 2", (done) => {
  expect(1 + 1).toBe(2);
  done();
});
```

Here is the matchers provided.

- `expect(value).toBe(value)`
- `expect(value).notToBe(value)`
- `expect(value).toBeTruthy()`
- `expect(value).toBeFalsy()`
- `expect(number).toBeGreaterThan(number)`
- `expect(number).toBeGreaterThanOrEqual(number)`
- `expect(number).toBeLessThan(number)`
- `expect(number).toBeLessThanOrEqual(number)`
- `expect(array).toContain(value)`
- `expect(array).notToContain(value)`
- `expect(string).toMatch(regex)`
- `expect(string).notToMatch(regex)`
- `expect(function).toThrow([message])`
- `expect(function).notToThrow([message])`

## Example usage

### Requirements

`njs` must be in your `PATH`. You can install the njs cli tool like so:

1. `git clone git@github.com:nginx/njs.git && cd njs.git`
2. `./configure`
3. `make`
4. `cp build/njs <somewhere in your PATH>`

### Creating a test

Add a file in `/test`. It can be named anything you want - but let's stick with `<name>.test.mjs`
In that file add the test framework components:

```javascript
import testFramework from "./support/micro-jest.mjs";
const expect = testFramework.expect;
const start = testFramework.start;
const test = testFramework.test;

test("The laws of mathematics are still in effect", (done) => {
  expect(1 + 2).toBe(3);
  done();
});

start();
```

### Register the test

Next, add the test file in `test/support/runner.mjs`:

```javascript
...
const tests = [
cmd("njs", ["./test/main.test.mjs"]),
// Your test file here
];
...
```

### Running tests

`npm run test`
