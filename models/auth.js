const User = require('../models/User');

/**
 * Creates a Fastify preHandler hook for authentication and authorization.
 *
 * @param {string[]} [allowedRoles=[]] - An array of roles allowed to access the route.
 *   If empty, only authentication is required.
 * @returns {function(request, reply): Promise<void>} A Fastify pre-handler hook.
 */
function authorize(allowedRoles = []) {
  return async function(request, reply) {
    try {
      // `request.jwtVerify()` is a decorator from @fastify/jwt.
      // It verifies the token from the Authorization header and returns the payload.
      const decoded = await request.jwtVerify();

      // The decoded token should contain user information, like `id`.
      const user = await User.findById(decoded.id);

      if (!user) {
        return reply.code(401).send({ message: 'Authentication failed. User not found.' });
      }

      // Attach the user object to the request for use in route handlers
      request.user = user;

      // If roles are specified, perform authorization check.
      if (allowedRoles.length > 0) {
        // 'superadmin' can access any route
        const hasPermission = user.role === 'superadmin' || allowedRoles.includes(user.role);

        if (!hasPermission) {
          return reply.code(403).send({ message: 'Forbidden. You do not have permission to access this resource.' });
        }
      }

      // If no roles are specified, being authenticated is sufficient.
    } catch (err) {
      // This will catch errors from `jwtVerify` (e.g., invalid or expired token)
      reply.code(401).send({ message: 'Authentication failed. Invalid or expired token.', error: err.message });
    }
  };
}

module.exports = {
  authorize
};