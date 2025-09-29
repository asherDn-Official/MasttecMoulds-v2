const fp = require('fastify-plugin');
const mongoose = require('mongoose');

async function mongoosePlugin(fastify, options) {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(process.env.MONGO_URI);
    fastify.log.info('MongoDB connected successfully.');
    fastify.decorate('mongoose', mongoose);
  } catch (err) {
    fastify.log.error(err, 'MongoDB connection error');
    process.exit(1);
  }
}

module.exports = fp(mongoosePlugin); 