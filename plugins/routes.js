    const fp = require('fastify-plugin');
    const authRoutes = require('../routes/authRoutes');
const employeeRoutes = require('../routes/employeeRoutes');

    async function routes(fastify, options) {
    fastify.register(authRoutes, { prefix: '/api/auth' });
    fastify.register(employeeRoutes, { prefix: '/api/employees' });
    
    }

    module.exports = fp(routes); 