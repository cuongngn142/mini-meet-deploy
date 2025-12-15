const mongoose = require('mongoose');

let gridfsBucket;

mongoose.connection.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

const getGridFSBucket = () => gridfsBucket;

module.exports = { getGridFSBucket };

