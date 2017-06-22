# pony-express.errors

Default error handler patter for resources/api:

```
/** Middleware for error handling. */
errorHandler(err, req, res, next) {
  if (this.api) return this.api.errorHandler.call(this, err, req, res, next);

  let json = {};

  Object.assign(json, {
    statusCode: err.statusCode || 500,
    message: err.errorMessage || 'Sorry, we ran in to an error while processing your request. If this problem persists, please contact support.'
  });

  if (err.hasOwnProperty('errorCode')) json.errorCode = err.errorCode;

  res.status(json.statusCode).json(json);
}
```

Implement a custom `errorHandler(err, req, res, next)` method on your pony.Resource or pony.Api to change this.

## pony.errors.CleanExitError

Sometimes you'll want custom endpoints with completely custom logic on your pony-express resources. If you return `return Promise.reject(new pony.errors.CleanExitError());` in any handler, pony-express will ignore it and let you handle the response yourself.

```
class TodoResource extends pony.Resource {
  
  initialize() {
    this.customEndpoints = [
      'get customEndpoint customHandler'
    ];
    this.Model = Todo;
  }

  customHandler(bundle) {
    Promise.delay(1000).then(() => {
      bundle.res.send('Delayed custom response with pony');
    });

    return Promise.reject(new pony.errors.CleanExitError());
  }

}