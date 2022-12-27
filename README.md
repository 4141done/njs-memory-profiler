# njs-memory-profiler

This is a small tool designed to allow you understand the per-request memory usage of your njs script in a **non-production environment**.

> This library is under active development and the interface may change without notice.

## TODO:

- Unit tests
- Complete jsdocs
- Add CHANGELOG
- NPM push on version change via github actions
- Implement various backends for the various store: http://nginx.org/en/docs/http/ngx_http_memcached_module.html
  nginx keyvalue store
  https://www.nginx.com/resources/wiki/modules/memc/
  raw nginx variables [DONE]

## Installation

This library can be installed using the normal npm workflow:

```bash
npm install njs-memory-profiler
```

This module will install to a folder called `njs_modules` in the root of your project.

Note: As the installation will be performed by an npm postinstall script. NodeJS version 16 or greater is required.

We recommend using [asdf](https://asdf-vm.com/) or [nvm](https://github.com/nvm-sh/nvm) to manage your node versions.

If using `nvm`, just run `nvm install` from the root of the project.
If using `asdf`, just run `asdf install` from the root of the project.

## Usage

Assume we have a basic setup like this:

`main.mjs`

```javascript
function hello(r) {
  r.return(200, "hello");
}

export default { hello };
```

`nginx.conf`

```nginx
events {}

error_log /tmp/error.log debug;

http {
  js_import main from main.mjs;

  server {
    listen 4000;

    location / {
      js_content main.hello;
    }
  }
}
```

First, `include` the `profiler_vars.conf` file like this anywhere in the `http` context:

```nginx
http {
    include njs_modules/njs-memory-profiler/conf/profiler_vars.conf;
    # < OTHER CONFIG >
}
```

Next, import the package, and initialize the profiler in the javascript file:

`main.mjs`

```javascript
import profiler from "./njs_modules/njs-memory-profiler/njs-memory-profiler.mjs";

function hello(r) {
  profiler.init(r);
  r.return(200, "Hello");
}

export default { hello };
```

By default, per-request memory information will be written to the error log (in this case, `/tmp/error.log`). It is not necessary to call `profiler.collect`
yourself unless you are going to use "Access Log Reporting" (see below)

## Reporting Options

### Error Log Reporting

By default, the profiler will simply log some json to the error log at the end of each request. This is the default behavior. Invoking the profiler as described in "Usage" will have this effect.

### Access Log Reporting

The library provides nginx configuration files that can be used to set up additional variables and provides a log format.

To enable additional variables:

```nginx
include njs_modules/njs-memory-profiler/conf/profiler_extra_vars.conf;
```

Using the provided variables you may set up your own log or use the provided format:

```nginx
include njs_modules/njs-memory-profiler/conf/profiler_log_format.conf;
# Or if you'd prefer JSON in the logs
include njs_modules/njs-memory-profiler/conf/profiler_log_format_json.conf;

access_log /my/log/location/profiler.log profiler;
```

> :warning: **You MUST call `collect` explicitly** when using this strategy.
> Since usually the profiler reports on the njs `exit` event, you must call the `collect` function with this reporter explicitly in the last part of your njs script because access logs are written before that event:

```javascript
import profiler from "./njs-memory-profiler.mjs";

// Pass `null` for the reporter on init since you
// will be calling `collect` yourself later.
profiler.init(r, null);
// your code
profiler.collect(r, profiler.varReporter);
r.return(200, "We made it!");
```

### File Reporting

```javascript
import profiler from "./njs-memory-profiler.mjs";

profiler.init(r, profiler.fileReporter);
```

will write files to the current directory. The filename is in the format `<request_id>.json`

### Custom reporting

If log-based or file-based reporting isn't what you need, you can provide a
function that will receive the report.

The function will be passed the `report` as well as the njs `request` object shown as `r` in the example below.

To understand the format of the `report` object, see "Interpreting the Data" below.

To pass a handler:

```javascript
profiler.init(r, (report, r) => {
  // Your custom reporting
  // Do not use async operations in this context
);
```

**Note that the exit hook happens right before the njs vm for the request is destroyed. Long-running work may have strange consequences. Async operations will allow the vm to shut down and work will not be completed**

## Measuring Memory at Points

At any point after you initialize the profiler, you can take a snapshot of the memory state at a certain point:

```javascript
import profiler from "./njs-memory-profiler.mjs";

function hello(r) {
  profiler.init(r);
  // ... do things
  profiler.pushEvent("event_name");
  r.return(200, "Hello");
}

export default { hello };
```

## Interpreting the data

See the annotated example of output below:

```json
{
  // A random id generated by the profiler to tie together events for this request
  "id": "cc7da804b5a8fdd9b803a87965cde018",
  // The `events` key contains all the actual profiling events
  "events": [
    {
      // There are three types of events: `profiler:start`, `profiler:snapshot`, `profiler:end`
      "type": "profiler:start",

      // Arbitrary name for the event.  For start and end they will default to
      // `profiler:start` and `profiler:end`
      "name": "profiler:start",

      // Unix timestamp for the event. In this case, when the profiler was initialized
      "createdAt": 1671144443913,

      // Size in bytes allocated to the njs vm at this point
      "size": 47600,

      // Number of blocks of memory allocated to the njs vm at this point
      "nblocks": 3
    },
    {
      "type": "profiler:snapshot",
      "name": "main_func",
      "createdAt": 1671144443913,
      "size": 47600,
      "nblocks": 3
    },
    {
      "type": "profiler:snapshot",
      "name": "js_var",
      "createdAt": 1671144443913,
      "size": 47600,
      "nblocks": 3
    },
    {
      "name": "profiler:end",
      "type": "profiler:end",
      "createdAt": 1671144443913,
      "size": 47600,
      "nblocks": 3
    }
  ]
}
```

## Profiling overhead

There is a small amount of overhead from the profiler, however it is smaller than one "block" of memory so adding the profiler won't make a difference in your baseline number. However you will roll over to the next block more quickly. For any measurements, assume that you have a variance of `page_size`.

## Interpreting memory growth

Njs pre-allocates memory and then continues to preallocate more in "nblocks" of `page_size` bytes. This means that it's possible to add code that will certainly use more memory, but `size` may not change because njs is working within its preallocated memory footprint already.

## Profiling Backends

As part of its operation the profile needs to save some information for the duration of the request. By default, this data will be saved in njs variables.

The choice of backend will not affect how you instrument your code - but it could be useful if you find that the profiler overhead is too great.

### NGINX Variables (default)

Profiling snapshots are condensed

### [TODO] NGINX key-value store (NGINX Plus only)

### [TODO] Memcached

### [TODO] Redis

## Directory Structure and Files

```bash
.
├── conf    <----- NGINX configuration files
├── package-lock.json
├── package.json
├── scripts <----- internal scripts used by the library.
└── src     <----- Njs-compatible Javascript sources
```

## Contributing

Please see the [contribution guide](CONTRIBUTING.md)
