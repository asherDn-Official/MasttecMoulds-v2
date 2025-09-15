const authController = require('../contollers/authController');

const authRoutes = async (fastify, options) => {

  const registerOpts = {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new user only for server-side use',
      description: 'Register a user (for server-side use only, not for frontend).',
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', maxLength: 50, minLength: 3, example: 'John Doe' },
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          password: { type: 'string', minLength: 6, example: 'secret123' },
          role: { type: 'string', enum: ['admin', 'superadmin', 'accountant'], example: 'admin' }
        }
      },
      response: {
        201: {
          description: 'User registered successfully',
          type: 'object',
          properties: {
            message: { type: 'string', example: 'User registered successfully' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '64f1b7b8c23a1c2b8f9a1234' },
                name: { type: 'string', example: 'John Doe' },
                email: { type: 'string', example: 'john@example.com' },
                role: { type: 'string', example: 'admin' }
              }
            }
          }
        },
        400: {
          description: 'Validation error',
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Email already exists' }
          }
        }
      }
    }
  };
  fastify.post('/register', registerOpts, authController.register);

  
  const loginOpts = {
    schema: {
      tags: ['Auth'],
      summary: 'Login user',
      description: 'Authenticate user and return a JWT token.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          password: { type: 'string', example: 'secret123' }
        }
      },
      response: {
        200: {
          description: 'Successful login',
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR...' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '64f1b7b8c23a1c2b8f9a1234' },
                name: { type: 'string', example: 'John Doe' },
                email: { type: 'string', example: 'john@example.com' },
                role: { type: 'string', example: 'admin' }
              }
            }
          }
        },
        401: {
          description: 'Invalid credentials',
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Invalid email or password' }
          }
        }
      }
    }
  };
  fastify.post('/login', loginOpts, authController.login);

 
  const forgotPasswordOpts = {
    schema: {
      tags: ['Auth'],
      summary: 'Forgot password',
      description: 'Send an OTP to the user’s registered email to reset the password.',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'john@example.com' }
        }
      },
      response: {
        200: {
          description: 'OTP sent successfully',
          type: 'object',
          properties: {
            message: { type: 'string', example: 'OTP sent to email successfully' }
          }
        },
        404: {
          description: 'User not found',
          type: 'object',
          properties: {
            error: { type: 'string', example: 'User with this email does not exist' }
          }
        }
      }
    }
  };
  fastify.post('/forgot-password', forgotPasswordOpts, authController.forgotPassword);

 
  const resetPasswordOpts = {
    schema: {
      tags: ['Auth'],
      summary: 'Reset password',
      description: 'Reset password using OTP sent to email.',
      body: {
        type: 'object',
        required: ['email', 'otp', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          otp: { type: 'string', minLength: 6, maxLength: 6, example: '123456' },
          password: { type: 'string', minLength: 6, example: 'newpassword123' }
        }
      },
      response: {
        200: {
          description: 'Password reset successfully',
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Password has been reset successfully' }
          }
        },
        400: {
          description: 'Invalid OTP',
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Invalid or expired OTP' }
          }
        }
      }
    }
  };
  fastify.post('/reset-password', resetPasswordOpts, authController.resetPassword);
};

module.exports = authRoutes;
