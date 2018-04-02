var couchbase = require('couchbase');

// var conn = _.assing({}, defaults, connection);
var cluster = new couchbase.Cluster(
  "127.0.0.1" + ":" + "8091");
  cluster.authenticate('test', '123456');
var bucket = cluster.openBucket('default');
bucket.counter('assadf', 1, {'initial':1}, console.log);
  
  // "interfaces": [
    //     "associations",
    //     "queryable",
//     "semantic"
//   ],
