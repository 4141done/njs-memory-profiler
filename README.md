# njs-memory-profiler
This is a small tool designed to allow you understand the per-request memory usage of your njs script in a non-production environment.

## TODO:
* Unit tests
* Write up guide to all fields
* Add CONTRIBUTING.md
* Add Code of conduct file
* Make sure post install script works as expected
* Allow report to be written to variable in access log
* Complete jsdocs

## Installation
The installation command with npm is a little different because we want the js files to exist in our source directory.

`NJS_MODULES_DIR=./ npm install njs-memory-profiler`

## Usage
Assume we have a basic setup like this:
`main.mjs`
```
function hello(r) {
  r.return(200, "hello");
}

export default { hello };
```

`nginx.conf`
```
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
```
import profiler from "./njs-memory-profiler.mjs";

function hello(r) {
  profiler.init(r);
  r.return(200, "Hello");
}

export default { hello };
```

By default, per-request memory information will be written to the error log (in this cast, `/tmp/error.log`).

## Reporting Options
### Log Reporting
By default, the profiler will simply log some json to the error log. This is the default behavior. Invoking the profiler as described in "Usage" will have this effect.

### File Reporting
```javascript
import profiler from "./njs-memory-profiler.mjs";

profiler.init(r, profiler.fileReporter);
```

will write files to the current directory.  The filename is in the format `<request_id>.json`

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

**Note that the exit hook has an enforced shutdown.  Long-running work may be cut short**

## Measuring Memory at Points
At any point after you initialize the profiler, you can take a snapshot of the memory state at a certain point:
```
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
See the annotated example of output below:
```json
{
  "requestId":"d47b0035b0c47b7370118af2e1fba49c",
  "begin":{
    "size":47600,
    "nblocks":3,
    "cluster_size":32768,
    "page_size":512
  },
  "end":{
    "size":47600,
    "nblocks":3,
    "cluster_size":32768,
    "page_size":512
  },
  "growth":{
    "size_growth":0,
    "nblocks_growth":0,
    "cluster_size_growth":0,
    "page_size_growth":0
  },
  "events":[{
    event: "file_read",
    rawStats: {
      "size":47600,
      "nblocks":3,
      "cluster_size":32768,
      "page_size":512
    },
    meta: {
      // Arbitrary keys and values
    }
  }]
}
```
## Profiling overhead
There is a small amount of overhead from the profiler, however it is smaller than one "block" of memory so adding the profiler won't make a different in your baseline number.  However you will roll over to the next block more quickly.  For any measurements, assume that you have a variance of `page_size`.

## Interpreting memory growth
Njs pre-allocates memory and then continues to preallocate more in "blocks" of `page_size` bytes. This means that it's possible to add code that will certainly use more memory, but `size` may not change because njs is working within its preallocated memory footprint already. 