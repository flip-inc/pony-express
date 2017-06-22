# [pony-express.authentication](../src/authentication.js)

Authentication hooks should check if a request is authenticated for a given resource. Authentication classes have one hook that is called after [api.before](./api.md#methods) and before [all other hooks](./resources.md#request-pipeline).

## [pony.authentication.BaseAuthentication](../src/authentication/base.js)

The default authentication class used on resources. All requests are allowed.

## [pony.authentication.UserAuthentication](../src/authentication/user.js)

Rejects all requests with a `401` `Authentication is required.` error if `req.user` is not set. We use middleware to set `req.user` at [Flip](https://flip.lease).

```
const pony = require('pony-express');

const Todo = require('path/to/models/todo');

class TodoResource extends pony.Resource {
  
  initialize() {
    this.authentication = new pony.authentication.UserAuthentication();
    this.Model = Todo;
  }

}
```

## Custom Authentication Classes

To write a custom authentication class that can be implemented on any resource, you can extend `pony.authentication.BaseAuthentication` (or UserAuthentication) and implement a new `default(bundle)` method along with any endpoint specicific authentication methods.

Authentication methods should return a rejected Promise with an error message to reject access or a resolved Promise to grant access.

```
const pony = require('pony-express');

class CustomAuthentication extends pony.authentication.BaseAuthentication {
  
  default(bundle) {
    if (req.query.token !== 'letmein') return Promise.reject({ errorMessage: 'Authentication required.', statusCode: 401 });

    return Promise.resolve();
  }

  // Allows public access to getList
  getList(bundle) {
    return Promise.resolve();
  }
  
  // Allows public access to a custom endpoint with a handler function called "customHandler"
  customHandler(bundle) {
    return Promise.resolve();
  }

}

```