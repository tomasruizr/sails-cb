![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png)

# waterline-sails-cb

Provides easy access to `Couchbase` from Sails.js & Waterline.

Is mostly based in the `N1QL` language to query the data and the SDK api to insert and update the documents.

### Interfaces

>`This adapter implements the [semantic]() interface. For now. Working on Queryable..`

### Requirements

**Couchbase Server CE 4.0.0-4051** or later.

This adapter was developed and tested with **Couchbase Server CE 4.0.0-4051**

It should work with the later versions althoug it's not tested... yet.

Since the adapter makes an extensive use of `N1QL` I assume it won't work with prior versions.
althou althoug it's not tested either.


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
      consistency: 1
    }
```

+ `host`: The address of the Couchbase server.
+ `port`: Port for the connection.
+ `username`: Username to connect to the Couchbase Server.
+ `password`: Password to connect to the Couchbase Server.
+ `bucket`: The Bucket to connect with.
+ `bucketPassword`: Password to connect to the bucket.

The next attributes can be specified when specifying the connection for defaults, and can be overrided per transactions. Look at the `find`, `update`, `create`, `delete` methods for more info.
+ `updateConcurrency`: "optimistic" for optimistic transformations of Docs or anything else for pesimistic. 
+ `maxOptimisticRetries`: In case of optimistic concurrency, the amount of times it will try to update the docs before fail.
+ `persist_to`: The amount of servers to ensure persistance of the data before invoking the success callback for `create`, `update` and `delete` operations when working with sdk operations other than `N1QL`.
+ `replicate_to`: The amount of servers to ensure replication of the data before invoking the success callback for `create`, `update` and `delete` operations when working with sdk operations other than `N1QL`.
+ `doNotReturn`: Whether to return the result of a Insert, Update, Destroy operation or just a confirmation.
  The default is false and every operation will return the full object. In case is true the methods will return:
  + Insert: The `id` of the created Record or `error`.
  + Update: empty if success or `error`.
  + Destroy: empty if success or `error`.
+ `caseSensitive`: By Default all waterline queries are case-insensitive. This can be overrided for this adapter in the connection configuration or in a request basis. 
+ `consistency`: The Consistency level that should have de N1QL querys (select) in database: Must be one of the following integer Values:

  **1**: NOT_BOUNDED: This is the default (for single-statement requests).
  
  **2**: REQUEST_PLUS: This implements strong consistency per request.
  
  **3**: STATEMENT_PLUS: This implements strong consistency per statement.

**Please refer to the couchbase documentation for more information about the configuration**

### Usage

This adapter exposes the following methods:

###### `find()`

+ **Status**
  + Tested for `Semantic` interface.

  Special Attributes:
  + when querying: `consistency`, `caseSensitive`.

  + when getting by id: `expiry`, `format`

  For the list of aggregate functions supported by the group by function refer to
  [http://developer.couchbase.com/documentation/server/4.1/n1ql/n1ql-language-reference/aggregatefun.html](http://developer.couchbase.com/documentation/server/4.1/n1ql/n1ql-language-reference/aggregatefun.html)

###### `create()`

+ **Status**
  + Tested for `Semantic` interface.

  Special Attributes: `persist_to`, `replicate_to`


###### `update()`

+ **Status**
  + Tested for `Semantic` interface.

  Special Attributes: 
  + when update by quiery (with a where condition): `consistency`, `caseSensitive`  
  
  + when updating by id: `maxOptimisticRetries`, `cas`, `expiry`, `flags`, `format`, `persist_to`, `replicate_to`, `updateConcurrency`.

###### `destroy()`

+ **Status**
  + Tested for `Semantic` interface.

  Special Attributes: 
  + when deleting by query (with a where condition): `consistency`, `caseSensitive`
  
  + when deleting by id: `cas`, `persist_to`, `replicate_to`

###### `query()`

+ **Status**
  + Not Tested.

  Direct access to make N1QL queries. Its response is in the raw format provided by couchbase so you can configure the `returning` clause as you like.

  Special Attributes: `consistency`.


### Running the tests

You can run the integration tests provided by waterline just by runing `npm test` command.

To tests the adapter specific tests run `mocha test/unit/*.js`

## Publish your adapter

> You're welcome to write proprietary adapters and use them any way you wish--
> these instructions are for releasing an open-source adapter.

1. Create a [new public repo](https://github.com/new) and add it as a remote (`git remote add origin git@github.com:yourusername/sails-youradaptername.git)
2. Make sure you attribute yourself as the author and set the license in the package.json to "MIT".
3. Run the tests one last time.
4. Do a [pull request to sails-docs](https://github.com/balderdashy/sails-docs/compare/) adding your repo to `data/adapters.js`.  Please let us know about any special instructions for usage/testing.
5. We'll update the documentation with information about your new adapter
6. Then everyone will adore you with lavish praises.  Mike might even send you jelly beans.

7. Run `npm version patch`
8. Run `git push && git push --tags`
9. Run `npm publish`




### Questions?

See [`FAQ.md`](./FAQ.md).



### More Resources

- [Stackoverflow](http://stackoverflow.com/questions/tagged/sails.js)
- [#sailsjs on Freenode](http://webchat.freenode.net/) (IRC channel)
- [Twitter](https://twitter.com/sailsjs)
- [Professional/enterprise](https://github.com/balderdashy/sails-docs/blob/master/FAQ.md#are-there-professional-support-options)
- [Tutorials](https://github.com/balderdashy/sails-docs/blob/master/FAQ.md#where-do-i-get-help)
- <a href="http://sailsjs.org" target="_blank" title="Node.js framework for building realtime APIs."><img src="https://github-camo.global.ssl.fastly.net/9e49073459ed4e0e2687b80eaf515d87b0da4a6b/687474703a2f2f62616c64657264617368792e6769746875622e696f2f7361696c732f696d616765732f6c6f676f2e706e67" width=60 alt="Sails.js logo (small)"/></a>


### License

**[MIT](./LICENSE)**
&copy; 2014 [balderdashy](http://github.com/balderdashy) & [contributors]
[Mike McNeil](http://michaelmcneil.com), [Balderdash](http://balderdash.co) & contributors

[Sails](http://sailsjs.org) is free and open-source under the [MIT License](http://sails.mit-license.org/).


[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/8acf2fc2ca0aca8a3018e355ad776ed7 "githalytics.com")](http://githalytics.com/balderdashy/waterline-sails-cb/README.md)


