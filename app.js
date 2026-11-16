/**
 * Our Space — cPanel & Phusion Passenger Entry Point
 * 
 * cPanel's Node.js application selector defaults to looking for 'app.js'
 * in the application root directory.
 */

const app = require('./server/index');

module.exports = app;
