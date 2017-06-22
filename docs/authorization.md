# [pony-express.authorization](../src/authorization)

Authorization hooks should implement more fine-grained control over resource authorization. Authorization classes have two hooks. One is called after the `authorize` hook and the other is called at the end of the [resource request pipeline](./resources.md#request-pipeline).

## [pony.authorization.BaseAuthorization](../src/authorization/base.js)

The default authorization class used on resources. All requests are allowed.

## [pony.authorization.UserAuthorization](../src/authorization/user.js)

By default, adds an additional `where` filter that joins the model's `user_id` field on `req.user.id`. The relation id (`user_id`) and user id field (`id`) can be overridden in the authorization constructor.

Additionally, POST requests will force the new object's "relation id" to the user id field to make sure `req.user` is the owner.

```
const pony = require('pony-express');

const Todo = require('path/to/models/todo');

class TodoResource extends pony.Resource {
  
  initialize() {
    this.authorization = new pony.authorization.UserAuthorization({
      relationIdField: 'owner_id',
    });
    this.Model = Todo;
  }

}
```

## Custom Authorization Classes

To write a custom authorization class that can be implemented on any resource, you can extend `pony.authorization.BaseAuthentication` (or UserAuthentication) and implement a new `preDefault(bundle)` and/or `default(bundle)` method along with any endpoint specicific authorization methods.

Authorization methods should return a rejected Promise with an error message to reject access or a resolved Promise to grant access.

```
const pony = require('pony-express');

class CustomAuthorization extends pony.authorization.BaseAuthorization {

  // Fallback if no handler specific function is on the authentication class, runs after authentication and before resource specific hooks
  preDefault(bundle) {
    return Promise.resolve();
  }
  
  // Fallback if no handler specific function is on the authentication class, runs after resource hooks
  default(bundle) {
    return Promise.resolve();
  }

  // Runs after authentication and before resource specific hooks
  preGetList(bundle) {
    // Do someting
  }

  // Runs after resource hooks
  getList(bundle) {
    // Do someting
  }
  
  // Runs after authentication and before resource specific hooks
  preCustomHandler(bundle) {
    // Do someting
  }

  // Runs after resource hooks
  customHandler(bundle) {
    // Do someting
  }

}

```