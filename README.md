# njs-memory-profiler

This is a small tool designed to allow you understand the per-request memory usage of your njs script in a non-production environment.

> This library is under active development and the interface may change without notice.

## TODO:

* Unit tests
* Add CONTRIBUTING.md
* Add Code of conduct file
* Allow report to be written to variable in access log
* Complete jsdocs
* Add CHANGELOG
* NPM push on version change via github actions
* Implement various backends for the various store: http://nginx.org/en/docs/http/ngx_http_memcached_module.html
nginx keyvalue store
https://www.nginx.com/resources/wiki/modules/memc/
raw nginx variables


## Installation
This library can be installed using the normal npm workflow:
```bash
npm install njs-memory-profiler
```

This module will install to a folder called `njs_modules` in the root of your project. If you want to use a different directory, run the install with the `NJS_MODULES_DIR` environment variable specified:

```bash
NJS_MODULES_DIR=./ npm install njs-memory-profiler
```

Note: As the installation will be performed by a post-install JavaScript using `node` the minimal required version of Node will be 16 or greater.

We recommend to use [nvm](https://github.com/nvm-sh/nvm) or [asdf](https://asdf-vm.com/) to manage your node versions.

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

Next, import the package, and initialize the profiler:

`main.mjs`


```javascript
import profiler from "./njs_modules/njs-memory-profiler/njs-memory-profiler.mjs";

function hello(r) {
  profiler.init(r);
  r.return(200, "Hello");
}

export default { hello };
```

By default, per-request memory information will be written to the error log (in this cast, `/tmp/error.log`).

## Reporting Options

### Error Log Reporting

By default, the profiler will simply log some json to the error log. This is the default behavior. Invoking the profiler as described in "Usage" will have this effect.

### Access Log Reporting

The library provides nginx configuration files that can be used to set up additional variables and provides a log format.

To enable additional variables:
```nginx
include njs_modules/conf/profiler_extra_vars.conf;
```

Using the provided variables you may set up your own log or use the provided format:
```nginx
include njs_modules/conf/profiler_log_format;
access_log /my/log/location/profiler.log profiler;
```

# TODO: this can't be used with the vm destroy hook. How do we represent events in this model?

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
);
```

**Note that the exit hook has an enforced shutdown. Long-running work may be cut short**

## Measuring Memory at Points

At any point after you initialize the profiler, you can take a snapshot of the memory state at a certain point:


```javascript
import profiler from "./njs-memory-profiler.mjs";

function hello(r) {
  const p = profiler.init(r);
  // ... do things
  p.pushEvent("event_name", { foo: "bar" });
  r.return(200, "Hello");
}

export default { hello };
```

Where in the above example, the third argument is random metadata.

## Interpreting the data

In the report, we diverge from the Javascript convention of camelCase to be consistent with the output of the `njs.memoryStats` object.

See the annotated example of output below:

```json
{
  "request_id": "f005408d17a3b420132bb554c19a2066",
  // These values are static and depend on your system
  "cluster_size": 32768,
  "page_size": 512,
  "begin": {
    // all timestamps are milliseconds since January 1, 1970 00:00:00 UTC.
    "req_start_ms": 1669241329831,
    // memory usage in bytes at the beginning of the request
    "size": 47600,
    // Number of memory blocks from the system allocated by njs
    "nblocks": 3
  },
  "end": {
    "req_end_ms": 1669241331834,
    "size": 48216,
    "nblocks": 4
  },
  "growth": {
    // memory growth over the course of the request in bytes
    "size_growth": 616,
    // number of additional memory block allocated over the course of the request
    "nblocks_growth": 1
  },
  "elapsed_time_ms": 2003,
  "events": [
    {
      "event": "before_wait",
      // arbitrary keys and values can be passed to `meta`
      // created_at_ms is created by the library
      "meta": {
        "foo": "bar",
        "created_at_ms": 1669241329831
      },
      "raw_stats": {
        "size": 47600,
        "nblocks": 3
      }
    },
    {
      "event": "after_wait",
      "meta": {
        "foo": "bar",
        "created_at_ms": 1669241331833
      },
      "raw_stats": {
        "size": 56408,
        "nblocks": 5
      }
    }
  ]
}
```

## Profiling overhead

There is a small amount of overhead from the profiler, however it is smaller than one "block" of memory so adding the profiler won't make a difference in your baseline number. However you will roll over to the next block more quickly. For any measurements, assume that you have a variance of `page_size`.

## Interpreting memory growth

Njs pre-allocates memory and then continues to preallocate more in "blocks" of `page_size` bytes. This means that it's possible to add code that will certainly use more memory, but `size` may not change because njs is working within its preallocated memory footprint already.

## Profiling Backends
As part of its operation the profile needs to save some information for the duration of the request.  By default, this data will be saved in njs variables.

The choice of backend will not affect how you instrument your code - but it could be useful if you find that the profiler overhead is too great.

### NGINX Variables (default)
Profiling snapshots are condensed
### NGINX key-value store (NGINX Plus only)

### Memcached (TODO)

### Redis (TODO)

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

