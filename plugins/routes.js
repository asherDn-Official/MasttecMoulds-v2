const fp = require("fastify-plugin");
const authRoutes = require("../routes/authRoutes");
const employeeRoutes = require("../routes/employeeRoutes");
const attendanceRoutes = require("../routes/attendanceRoutes");
const payrollRoutes = require("../routes/payrollRoutes");

async function routes(fastify, options) {
  fastify.register(authRoutes, { prefix: "/api/auth" });
  fastify.register(employeeRoutes, { prefix: "/api/employees" });
  fastify.register(attendanceRoutes, { prefix: "/api/attendance" });
  fastify.register(payrollRoutes, { prefix: "/api/payrolls" });
}

module.exports = fp(routes);
