/**
 * Vercel Serverless Function Entry Point
 * Imports the Express app and exports it for Vercel's serverless runtime.
 * All routes, middleware, and error handling from server/index.js work unchanged.
 */

const app = require('../server/index');

module.exports = app;

// Disable Vercel's default body parser so Express and Multer can read the stream
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
