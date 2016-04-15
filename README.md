![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png)

# sails-cb

Provides easy access to `Couchbase` from Sails.js & Waterline.

Is mostly based in the `N1QL` language to query the data and the SDK api to insert and update the documents.

### Interfaces

This adapter implements the `semantic`, `queryable` and the `association` interfaces.
For more information on interfaces please review the [waterline interfaces documentation](https://github.com/balderdashy/sails-docs/blob/master/contributing/adapter-specification.md).


### Requirements

This adapter was developed and tested with **Couchbase Server CE 4.0.0-4051**

It should work with the later versions and also with the Enterprise Edition, although it's not tested... yet.

Since the adapter makes an extensive use of `N1QL` for Selects, Updates and Deletes, It is assumed that it won't work with prior versions or version that do not support N1QL v4~.


### Installation

To install this adapter, run:

```sh
$ npm install sails-cb
```

### Configuration

This are the defaults values for the attributes that can be specified when adding the connection to `config/connections.js`

```js
defaults: {
      host: '127.0.0.1',
      port: '8091',
      username: '',
      password: '',
      bucket: 'default',
      bucketPassword: '',
      updateConcurrency: 'optimistic',
      maxOptimisticRetries: 3,
      persist_to: 1,
      replicate_to: 0,
      doNotReturn: false,
      caseSensitive: false,
      testMode: false,
      consistency: 1
    }
```

+ `host`: The address of the Couchbase server.
+ `port`: Port for the connection.
+ `username`: Username to connect to the Couchbase Server.
+ `password`: Password to connect to the Couchbase Server.
+ `bucket`: The Name of the Bucket to connect with.
+ `bucketPassword`: Password to connect to the bucket.

The next attributes can be specified when specifying the connection for defaults, and can be overridden per transactions. Look at the `find`, `update`, `create`, `delete` methods for more info and examples.
+ `updateConcurrency`: "optimistic" for optimistic transformations of Docs or anything else for pessimistic. 
+ `maxOptimisticRetries`: In case of optimistic concurrency, the amount of times it will try to update the docs before fail.
+ `persist_to`: The amount of servers to ensure persistence of the data before invoking the success callback for `create`, `update` and `delete` operations when working with sdk operations other than `N1QL`.
+ `replicate_to`: The amount of servers to ensure replication of the data before invoking the success callback for `create`, `update` and `delete` operations when working with sdk operations other than `N1QL`.
+ `testMode`: It is used to always order the query results by Primary Key ASC if no other sorting criteria was specified. It is used to pass the waterline integration tests which is expecting that to happen. It's set to false by default and It is not encouraged to use in production environments and control the sorting options manually in a request basis.
+ `doNotReturn`: Whether to return the result of a Insert, Update, Destroy operation or just a confirmation.
  The default is false and every operation will return the full object. In case is true the methods will return:
  + Insert: The `id` of the created Record or `error`.
  + Update: empty if success or `error`.
  + Destroy: empty if success or `error`.
+ `caseSensitive`: By Default all waterline queries are case-insensitive. This can be overridden for this adapter in the connection configuration or in a request basis. 
+ `consistency`: The Consistency level that should have de N1QL queries (select) in database: Must be one of the following integer Values:

  **1**: _NOT_BOUNDED_: This is the default (for single-statement requests).
  
  **2**: _REQUEST_PLUS_: This implements strong consistency per request.
  
  **3**: _STATEMENT_PLUS_: This implements strong consistency per statement.

**Please refer to the couchbase documentation for more information about the configuration**

### Usage

The methods exposed below accepts special attributes.
The usage is to pass an object with the attributes you need as second parameter as long as any other waterline option.

```js
User.find({id: 'user::some-uuid-123456'}, {consistency:1, caseSensitive: true, testMode: false, limit: 5}, function (err, record) {
  console.log(record); 
}
```
Keep in mind that to use them you won't be able to use Dynamic Finders like findOne, or findById, findByName, etc, since those methods override the `options` parameter.

This adapter exposes the following methods:

###### `find()`

+ **Status**
  + Tested for `Semantic`, `Queryable` and `Association` interfaces.

  Special Attributes:

  + when querying: `consistency`, `caseSensitive`, `testMode`.
  + when getting by id: `expiry`, `format`

  >For the list of aggregate functions supported by the group by function refer [here](http://developer.couchbase.com/documentation/server/4.1/n1ql/n1ql-language-reference/aggregatefun.html).

###### `create()`

+ **Status**
  + Tested for `Semantic`, `Queryable` and `Association` interfaces.

  Special Attributes: `persist_to`, `replicate_to`


###### `update()`

+ **Status**
  + Tested for `Semantic`, `Queryable` and `Association` interfaces.

  Special Attributes: 

  + when update by query (with a where condition): `consistency`, `caseSensitive`  
  + when updating by id: `maxOptimisticRetries`, `cas`, `expiry`, `flags`, `format`, `persist_to`, `replicate_to`, `updateConcurrency`.

###### `destroy()`

+ **Status**
  + Tested for `Semantic`, `Queryable` and `Association` interfaces.

  Special Attributes: 

  + when deleting by query (with a where condition): `consistency`, `caseSensitive`
  + when deleting by id: `cas`, `persist_to`, `replicate_to`

###### `query()`

+ **Status**
  + Not Tested.

  Direct access to make N1QL queries. Its response is in the raw format provided by couchbase so you can configure the `returning` clause as you like.

  Special Attributes: `consistency`.


### Running the tests

You can run the integration tests provided by waterline just by running `npm test` command.

To tests the adapter specific tests run `mocha test/unit/*.js`

### Considerations

+ This adapter is part of a specific software originally made to work with MySql and is now migrating to use Couchbase. So **it is not tested to fulfill all the Possible scenarios** but it may be a good place to start if you need to use Sails with Couchbase.

+ Right now all the associations and joins are based in the `waterline-cursor` default implementation and **it is currently not taking all the possible advantage in the N1QL language** for the joins between the document types. This is very possible to implement and I'm sure will be a huge performance boost once it's ready. But for now, it was needed to work so the N1QL joins implementations will come later, I'm working on it.

+ You should configure a **separate connection for each bucket** you want to work with.

+ Inside the bucket the stored **Documents are differentiated by Document Types from the Document Key (ID)**. In other words: All the keys are set to be something like `person::whatever-uuid-123456` for the table Person, and `product::whatever-uuid-123456` for table Product. If you would like to use something different than `uuid` to build your keys, take a look at the `create` function code to see where the keys are created.

+ If you are not familiar with Couchbase, **read about it**, it is a very powerful tool it used wisely. [this](http://blog.couchbase.com/10-things-developers-should-know-about-couchbase) is a good place to start.

+ There is still a lot of work and optimizations to do, feel free to **fork and make pull requests**, I will actively maintain this repository (depending on the time I have to do so, please be patient).


### More Resources

- [Couchbase Documentation](http://developer.couchbase.com/documentation/server/4.0/introduction/intro.html)
- [Couchbase Node SDK](http://developer.couchbase.com/documentation/server/4.0/sdks/node-2.0/introduction.html)
- [N1QL Tutorial](http://query.pub.couchbase.com/tutorial/#1)
- [N1QL Reference](http://developer.couchbase.com/documentation/server/4.0/n1ql/index.html)
- [Stackoverflow](http://stackoverflow.com/questions/tagged/sails.js)
- [#sailsjs on Freenode](http://webchat.freenode.net/) (IRC channel)
- [Twitter](https://twitter.com/sailsjs)
- [Professional/enterprise](https://github.com/balderdashy/sails-docs/blob/master/FAQ.md#are-there-professional-support-options)
- [Tutorials](https://github.com/balderdashy/sails-docs/blob/master/FAQ.md#where-do-i-get-help)

### License

**[MIT](./LICENSE)**
&copy; 2016 [Tomás Ruiz](mailto:tomasruizr@gmail.com).

[Sails](http://sailsjs.org) is free and open-source under the [MIT License](http://sails.mit-license.org/).


[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/8acf2fc2ca0aca8a3018e355ad776ed7 "githalytics.com")](http://githalytics.com/balderdashy/waterline-sails-cb/README.md)


