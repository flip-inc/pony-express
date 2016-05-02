# Resources

## Filters

Resources can filter objects on fields listed in `this.allowedFilters`.

+ [Equal](#equal)
+ [Not Equal](#not-equal)
+ [In](#in)
+ [Greater Than/Less Than](#greater-than-or-less-than)
+ [Starts with/Ends with](#starts-with-or-ends-with)
+ [Contains](#contains)

### Equal

This is the default filter type for fields passed through the querystring. Fetches all objects where the field equals the given value.

Filter Suffix (optional): `__equals`, `__equal`, `__eq`

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

## Contains

Fetches all objects where the field contains a given value.

Filter Suffix: `contains`, `icontains`

Examples: 

+ Contains (Case Sensitive): `/api/v1/resource?field__contains=value`
+ Contains (Case Insensitive): `/api/v1/resource?field__icontains=value`