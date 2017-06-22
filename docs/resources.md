# [pony-express.Resource](../src/resource.js)

A pony-express Resource is a highly extendable way to kickstart a RESTful API resource.

+ [Request Pipeline](#request-pipeline)
+ [The bundle object](#bundle)
+ [Resource Hooks](#resource-hooks)
+ [Common Methods](#methods)
+ [Resource Configuration](#configuration)
+ [Filtering requests](#filters)
+ [Ordering results](#ordering)
+ [Paginating results](#pagination)

## Request Pipeline

Each request goes through a standard, hookable pipeline in pony-express. Every function is passed a [bundle](#bundle).

+ [authenticate](./authentication.md)
+ [preAuthorize](./authorization.md)
+ beforeAll
+ beforeHandler
+ handler
+ afterHandler
+ afterAll
+ [authorize](./authorization.md)

## Bundle

In pony-express, a bundle is passed around to each function in the middleware stack.

A bundle has the following properties:

+ `body` - A cleaned version of req.body. For example, readOnly fields are omitted from `bundle.body`.
+ `filters` - Array of [filters](#filters) parsed from the request.
+ `include` - Array of includes parsed from the request.
+ `orderBy` - Parsed orderBy string passed to Knex.js `orderByRaw`
+ `query` - Copy of req.query
+ `where` - Parsed array of `where` clauses to be passed to Knex.js `whereRaw`
+ `req` - Express `req` object
+ `res` - Express `res` object
+ `next` - Express `next` object
+ `resource` - Reference to self/`this`
+ `objects` - bundle.objects the resulting bookshelf model/collection set after the main `handler` function is called and resource.toJSON uses this value to generate the response

## Resource Hooks

### `beforeAll(bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Hook called if `beforeAll` is a function on your resource. See [request pipeline](#request-pipeline) for hook order.

### `before[Handler](bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Hook called if `before[Handler]` is a function on your resource where [Handler] is based on `request.method`. For example, a GET request to a list endpoint will call `beforeGetList` and a PUT request will call `beforePut`. Custom endpoints are also given hooks based on their handler function name.

See [request pipeline](#request-pipeline) for hook order.

### `[handler](bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Required. Main handler function that is called for each request.

GET to a list endpoint -> getList
GET to a detail endpoint -> getDetail
PUT -> put
POST -> post
DELETE -> delete

See [request pipeline](#request-pipeline) for hook order.

### `after[Handler](bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Hook called if `after[Handler]` is a function on your resource where [Handler] is based on `request.method`. For example, a GET request to a list endpoint will call `afterGetList` and a PUT request will call `afterPut`. Custom endpoints are also given hooks based on their handler function name.

See [request pipeline](#request-pipeline) for hook order.

### `afterAll(bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Hook called if `afterAll` is a function on your resource. See [request pipeline](#request-pipeline) for hook order.

## Methods

### `resource.expose(app)`

+ `app` Express app

Mounts all hooks/handlers on a router for the given express app.

### `resource.getDetail(bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Main handler for GET requests to a detail endpoint.

### `resource.getList(bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Main handler for GET requests to a list endpoint.

### `resource.post(bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Main handler for POST requests.

### `resource.put(bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Main handler for PUT requests.

### `resource.delete(bundle)`

+ `bundle` Object - pony-express [bundle](#bundle) object

Main handler for DELETE requests.

## Configuration

The following settings can all be used to configue your resources in `Resource.initialize`.

```
class MyResource extends pony.Resource {
  initialize() {
    // override options here
    this.allowedEndpoints = ['getList'];
    this.Model = Todo;
  }
}
```

### `resource.Model`, `Bookshelf.Model` (REQUIRED)

This is the only required option that must be set on every pony-express resource. By default, this will generate a RESTful resource for the model with all fields and be mounted at the `tableName` of the model once the resource is exposed.

For example, if you have a `Todo` model with a `todos` tableName, the default endpoints would be mounted at `/todos` on your Express router.

### `resource.allowedEndpoints`, `Array[String]`

+ Default -> `['getList', 'getDetail', 'post', 'put', 'delete']`

An array of endpoints that will be exposed. This is the easiest way to limit functionality of a resource. Passing an empty array can be useful for resources that are only used as related resources.

### `resource.allowedFilters`, `Array[String]`

+ Default -> `'ALL'`

An array of the fields that can be [filtered](#filters) on.

### `resource.allowedIncludes`, `Array[String]`

+ Default -> `'ALL'`

An array of fields that can be included as related resources.

### `resource.allowedOrderBy`, `Array[String]`

+ Default -> `'ALL'`

An array of fields that can be used for ordering.

### `resource.apiRoot`, `String`

+ Default -> `''`

A string that sets the root path of the API/resource. This will be set automatically for resources mounted on a [pony-express.Api](./api.md).

### `resource.authentication`, [pony-express.authentication](./authentication.md)

+ Default -> `authentication.BaseAuthentication`

Specifies the authentication class to be used for this resource.

See [pony-express.authentication](./authentication.md) for more docs on authentication classes.

### `resource.authorization`, [pony-express.authorization](./authorization.md)

+ Default -> `authorization.BaseAuthorization`

Specifies the authorization class to be used for this resource.

See [pony-express.authorization](./authorization.md) for more docs on authorization classes.

### `resource.customEndpoints`, `Array[String]`

+ Default -> `[]`

Defines the custom endpoints for this resource. The strings in the array use the following format:

`[method] [path] [handler] [options]`

`method` is one of: `get`, `put`, `post`, and `delete`. The method can be supplemented with `#list` or `#detail`, defaults to `detail`. 
`path` is the relative path/url that you want the custom endpoint to be mounted to.
`handler` is the method name on your resource that should be called.
`options` currently supports `skipAuthorization` and `skipAuthentication`

If `path` and `handler` are the same, you don't need to specify both.

Examples for a resource mounted at `uploads`:

+ `get download` -> Calls the `download` method when a GET request is made to `uploads/:id/download`.
+ `get share/email shareViaEmail skipAuthentication skipAuthorization` -> Calls the `shareViaEmail` method when a GET request is made to `uploads/:id/share/email`, authorization and authentication is skipped.
+ `post#list sign signRequest` -> Calls the `signRequest` method when a POST request is made to `uploads/sign`.

In context, this would look like:

```
class UploadResource extends pony.Resource {
  initialize() {
    this.customEndpoints = [
      'get download',
      'get share/email shareViaEmail skipAuthentication skipAuthorization',
      'post#list sign signRequest'
    ];
    this.Model = Upload;
  }

  shareViaEmail(bundle) {
    // implementation...
  }

  download(bundle) {
    // implementation...
  }

  signRequest(bundle) {
    // implementation...
  }
}
```

### `resource.fields`, `Array[String]` or `Object`

+ Default -> `'ALL'`

The fields property is used to build the response and define how different request body data should be handled. By default (`'ALL'`), all fields are returned in GET requests and can be modified in POST/PUT requests.

If given an array, GET requests will be filtered to only the field/column names.

For anything more than a basic setup, you'll want to use an object to define the fields and properties for each. The following properties can be used to further define fields:

+ `readOnly` (defaut: false) -> If true, this field will be ignored if it's passed in req.body
+ `related` -> When using a [pony.Api](./api.md), use this property to specify a related resource that has been mounted on the Api.
  + `full` (default: false) -> Used with the `related` property. If true, the related resource will be fully embedded based on it's own `fields` property when it is included.
+ `required` (default: false) -> If true, this field will be required in req.body **on POST requests**
+ `virtual` (default: false) -> If true, this field will be ignored if it's passed in req.body

Example:

```
class TodoResource extends pony.Resource {

  initialize() {
    this.Model = Todo;
    this.fields = {
      createdAt: { readOnly: true },
      description: {},
      isDone: {},
      title: {},
      updatedAt: { readOnly: true },
      user: { related: 'UserResource', full: true },
      uuid: { readOnly: true }
    };
  }

}

class UserResource extends pony.Resource {

  initialize() {
    this.Model = User;
  }

}
```

In the above example, a GET `todos?include=user` would fetch the related user and embed it in the response JSON.

### `resource.identifier`, `String`

+ Default -> `'id'`

The field used for detail endpoints and for querying the Model. Useful when using a different public identifier than a model's `id`.

### `resource.include`, `Array[String]`

+ Default -> `[]`

Array of fields that the user should be able to include as related resources.

You can include resources by add the `include` query paramater to any request with a comma separate list of values.

For example: GET `www.example.com/api/todos?include=user,uploads`

### `resource.limit`, `Integer`

+ Defaut -> `100`

Sets the default limit on the number of results returned in a GET list request when no `limit` query parameter is specified.

To specify a limit on a per request bases, use the `limit` query param: `?limit=20`.

### `resource.offset`, `Integer`

+ Default -> `0`

Sets the default offset on the results returned in a GET list request when no `offset` query parameter is specified.

To specify an offset on a per request bases, use the `offset` query param: `?offset=20`.

### `resource.orderBy`, `String`

+ Default -> `this.identifier`

Sets the default field the results are ordered by.

To specify `orderBy` on a per request basis, use the `orderBy` query param: `?orderBy=createdAt`.

### `resource.orderDirection`, `String`

+ Default -> `'DESC'`

Sets the default order direction (`ASC` or `DESC`) for the results.

To specify `orderDirection` on a per request basis, use the `orderDirection` query param: `?orderDirection=asc`.

### `resource.resourceName`, `String`

+ Default -> `this.Model.prototype.tableName`

Sets the resource name to be used in the generated routes.

Example: Using a `User` model that has `tableName = users` with `this.resourceName = 'auth'` will generate endpoints at `/auth/` rather than `user`.

### `resource.virtuals`, `Array[String]`

+ Default -> `[]`

Array of method names as strings to be mapped back to each object as a custom "virtual" field.

Virtual methods take in an `object` (the attributes of a Bookshelf model) and `bundle` parameter and should return the value that should be set for the virtual field.

Example:

```
class TodoResource extends pony.Resource {
  
  initialize() {
    this.Model = Todo;
    this.virtuals = [
      'prefixedTitle'
    ];
  }

  prefixedTitle(object, bundle) {
    return 'Title: ' + object.title;
  }

}
```

### `resource.where`, `Array[String]`

+ Default -> `[]`

Default set of `where` clauses to be applied to the Bookshelf/Knex query. Follows the `operator` syntax of [knex.where](http://knexjs.org/#Builder-where).

You can import `pony.utils` to use [pony.utils.buildWhereFilter](../src/utils.js#L51).

Example:

```
const pony = require('pony-express');

class PublicTodoResource extends pony.Resource {
  
  initialize() {
    this.Model = Todo;
    this.where = [
      pony.utils.buildWhereFilter('is_public', '=', true);
    ];
  }

}
```

## Filtering Requests

Resources can filter objects on fields listed in `this.allowedFilters` (defaults to ALL fields).

### Direct Match // Equal

Fetches all objects where the field equals the given value.

Example: `/api/v1/resource?field=value`

### Not Equal

Fetches all objects where the field does NOT equal the given value.

Filter Suffix: `ne`

Example: `/api/v1/resource?field__ne=value`

### In

Fetches all objects where the field is in a comma separated list.

Filter Suffix: `in` (case sensitive), `iin` (case insensitive)

Examples: 

+ Case Sensitive: `/api/v1/resource?field__in=value1,value2,value2`
+ Case Insensitive: `/api/v1/resource?field__iin=value1,value2,value2`

### Greater Than or Less Than

Fetches all objects where the field is greater than or less than a given value.

Filter Suffix: `gt`, `lt`, `gte`, `lte`

Examples: 

+ Greater Than: `/api/v1/resource?field__gt=value`
+ Greater Than or Equal To: `/api/v1/resource?field__gte=value`
+ Less Than: `/api/v1/resource?field__lt=value`
+ Less Than or Equal To: `/api/v1/resource?field__lte=value`
+ Greater than and less than: `/api/v1/resource?field__gt=value1&field__lt=value2`

### Starts With or Ends With

Fetches all objects where the field starts with or ends with a given value.

Filter Suffix: `startswith`, `endswith`, `istartswith`, `iendswith`

Examples: 

+ Starts with (Case Sensitive): `/api/v1/resource?field__startswith=value`
+ Ends with (Case Sensitive): `/api/v1/resource?field__endswith=value`
+ Starts with (Case Insensitive): `/api/v1/resource?field__istartswith=value`
+ Ends with (Case Insensitive): `/api/v1/resource?field__iendswith=value`

### Contains

Fetches all objects where the field contains a given value.

Filter Suffix: `contains`, `icontains`

Examples: 

+ Contains (Case Sensitive): `/api/v1/resource?field__contains=value`
+ Contains (Case Insensitive): `/api/v1/resource?field__icontains=value`

## Ordering

Use `orderBy` and `orderDirection` query parameters to perform per-request ordering.

Example: `/api/v1/resource?orderBy=createdAt&orderDirection=desc`

## Pagination

Use `limit` and `offset` to paginate results.

Example: `/api/v1/resource?limit=20&offset=20`