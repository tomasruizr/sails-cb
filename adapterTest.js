var couchbase = require('couchbase');
var N1qlQuery = require('couchbase').N1qlQuery;
var cluster = new couchbase.Cluster('couchbase://127.0.0.1');
var bucket = cluster.openBucket('beer-sample');

bucket.upsert('testdoc', { name: 'Frank' }, function (err, result) {
  if (err) throw err;

  bucket.get('testdoc', function (err, result) {
    if (err) throw err;

    console.log(result.value);
    // {name: Frank}
  });
	var query = N1qlQuery.fromString('select * from default userTable Where type = ".create() test create a list" and META(userTable).id like "userTable%"');
	bucket.query(query, function(err, res) {
	  if (err) {
	    console.log('query failed', err);
	    return;
	  }
	  console.log('success!', res);
	});
});

