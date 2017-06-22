# Pony Express

RESTful API generator for Express apps using [Bookshelf.js](http://bookshelfjs.org/).

## Features

+ Quickly generate a REST API for your existing Bookshelf.js models
+ Supports custom authentication and authorization for each resource
+ Extend REST endpoints with pre/post hooks or by simply overriding them for custom functionality
+ Supports custom endpoints on any resource
+ Out of the box filtering, ordering, and pagination
+ Easily extendable for fine-grained control over responses, validation, and more

## Installation

Install the `pony-express` package:

```npm install pony-express --save```

Import it and use it!

```const pony = require('pony-express');```

## Quick Start Example

### CRUD Resource for basic Todo Model

```
const pony = require('pony-express');

const Todo = require('path/to/models/todo');

class TodoResource extends pony.Resource {
  
  initialize() {
    this.Model = Todo;
  }

}

```

That's it! The above gives you the following endpoints:

+ [GET] `todos` -> Gets a list of todos
+ [GET] `todos/:id` -> Gets a specific todo
+ [PUT] `todos/:id` -> Updates a todo
+ [POST] `todos` -> Creates a todo
+ [DELETE] `todos/:id` -> Deletes a todo

From there, you can continue to modify resources by mounting then as an [API](docs/api.md), adding [authentication](docs/authentication.md) and [authorization](docs/authorization.md), and learning about [filtering, pagination, ordering, and more advanced resource level features](docs/resources.md).

## Documentation & Examples

The API reference is located in the [docs](docs) directory or there's a [todo example](docs/examples) and [getting started guide](docs/getting-started.md) to check out.

---

+ [Api](docs/api.md)
+ [Authentication](docs/authentication.md)
+ [Authorization](docs/authorization.md)
+ [Errors](docs/errors.md)
+ [Resource](docs/resources.md)

## License

Copyright (c) 2016, Flip Technologies, Inc.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.