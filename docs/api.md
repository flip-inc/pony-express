# [pony-express.Api](../src/api.js)

A pony-express Api is beneficial for anything beyond a very basic use-case. It's a very basic way to mount multiple resources for using relations, add middleware before/after resource request handling, and mount resources on a specific URL.

## Usage

```
const pony = require('pony-express');

const api = new pony.Api({ apiRoot: '/api/v1' });

const resources = require('path/to/resources');

// Middleware functions ran before each resource handler.
api.before((req, res, next) => {
  // code to run
  next();
});

api.mount([
  resources.AuthResource,
  resources.TodoResource,
  resources.UserResource,
]);

// If "app" if your express app...
api.expose(app);
```

## Methods

### `api.mount(resources)`

+ `resources` {Resource|Array} - A pony-express Resource class or array of Resources.

Adds the resource(s) to this Api instance. All mounted resources will have `resource.expose` called when `api.expose` is called.

### `api.before(middleware)`

+ `middleware` {Function} - Express middleware function

Pushes a new middleware function to be run before each request. Can be called multiple times to push more middleware functions to the stack.

### `api.after(middleware)`

+ `middleware` {Function} - Express middleware function

Pushes a new middleware function to be run after each request. Can be called multiple times to push more middleware functions to the stack.

### `api.expose(app)`

+ `app` {ExpressApp} - An express app

Runs `resource.expose` for all exposed 

### `api.register(Resource)`

+ `Resource` {pony.Resource} - A pony.Resource class

Registers the resource to the Api so it can be used as a related resource but will NOT try to expose it on the Express router. Useful for embedded resources.

### `api.errorHandler`

This can be changed to a standard Express error handler function that will be called on an error during a pony-express API request.

Default pony-express error handler:

```
/** Error handler middleware */
errorHandler(err, req, res, next) {
  // Check if this is a v1 route
  let json = {};

  Object.assign(json, {
    statusCode: err.statusCode || 500,
    message: err.errorMessage || 'Sorry, we ran in to an error while processing your request. If this problem persists, please contact support.'
  });

  if (err.hasOwnProperty('errorCode')) json.errorCode = err.errorCode;

  res.status(json.statusCode).json(json);
}
```