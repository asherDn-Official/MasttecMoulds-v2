const payrollController = require('../controllers/payrollController');

async function payrollRoutes(fastify, options) {
  // Create a new payroll record
  fastify.post('/payrolls', {
    schema: {
      description: 'Create a new payroll record',
      tags: ['Payroll'],
      body: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' },
          payrunData: { type: 'object' }
        },
        required: ['employeeId', 'payrunData']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    handler: payrollController.createPayroll
  });

  // Process payroll from attendance data
  fastify.post('/payrolls/process-from-attendance', {
    schema: {
      description: 'Process payroll from attendance data for a period',
      tags: ['Payroll'],
      body: {
        type: 'object',
        properties: {
          periodFrom: { type: 'string', format: 'date' },
          periodTo: { type: 'string', format: 'date' }
        },
        required: ['periodFrom', 'periodTo']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    handler: payrollController.processPayrollFromAttendance
  });

  // Get all payroll records
  fastify.get('/payrolls', {
    schema: {
      description: 'Get all payroll records',
      tags: ['Payroll'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'number' },
            data: { type: 'array' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: payrollController.getAllPayrolls
  });

  // Get payroll by employee ID
  fastify.get('/payrolls/employee/:employeeId', {
    schema: {
      description: 'Get payroll record by employee ID',
      tags: ['Payroll'],
      params: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' }
        },
        required: ['employeeId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    },
    handler: payrollController.getPayrollByEmployeeId
  });

  // Update payroll by employee ID
  fastify.put('/payrolls/employee/:employeeId', {
    schema: {
      description: 'Update payroll record by employee ID',
      tags: ['Payroll'],
      params: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' }
        },
        required: ['employeeId']
      },
      body: { type: 'object' },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    handler: payrollController.updatePayrollByEmployeeId
  });

  // Update multiple payrolls
  fastify.put('/payrolls/batch', {
    schema: {
      description: 'Update multiple payroll records',
      tags: ['Payroll'],
      body: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' },
            updateData: { type: 'object' }
          },
          required: ['employeeId', 'updateData']
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            results: { type: 'array' }
          }
        }
      }
    },
    handler: payrollController.updateMultiplePayrolls
  });

  // Delete payroll by employee ID
  fastify.delete('/payrolls/employee/:employeeId', {
    schema: {
      description: 'Delete payroll record by employee ID',
      tags: ['Payroll'],
      params: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' }
        },
        required: ['employeeId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    handler: payrollController.deletePayrollByEmployeeId
  });

  // Get payrolls by month and year
  fastify.get('/payrolls/month/:month/year/:year', {
    schema: {
      description: 'Get payroll records by month and year',
      tags: ['Payroll'],
      params: {
        type: 'object',
        properties: {
          month: { type: 'string' },
          year: { type: 'string' }
        },
        required: ['month', 'year']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            count: { type: 'number' },
            data: { type: 'array' }
          }
        }
      }
    },
    handler: payrollController.getPayrollByMonth
  });

  // Create missing employee records
  fastify.post('/payrolls/create-missing-employees', {
    schema: {
      description: 'Create missing employee records from attendance data',
      tags: ['Payroll'],
      body: {
        type: 'object',
        properties: {
          employeeIds: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['employeeIds']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    handler: payrollController.createMissingEmployeeRecords
  });

  // Create or update payroll for employee
  fastify.post('/payrolls/employee/:employeeId', {
    schema: {
      description: 'Create or update payroll for a specific employee',
      tags: ['Payroll'],
      params: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' }
        },
        required: ['employeeId']
      },
      body: {
        type: 'object',
        properties: {
          salaryMonth: { type: 'string' },
          salaryYear: { type: 'string' },
          payrunData: { type: 'object' }
        },
        required: ['salaryMonth', 'salaryYear']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    handler: payrollController.createOrUpdatePayrollForEmployee
  });

  // Send payslip email
  fastify.post('/payrolls/send-payslip/:employeeId', {
    schema: {
      description: 'Send payslip email to a specific employee',
      tags: ['Payroll'],
      params: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' }
        },
        required: ['employeeId']
      },
      body: {
        type: 'object',
        properties: {
          salaryMonth: { type: 'string' },
          salaryYear: { type: 'string' }
        },
        required: ['salaryMonth', 'salaryYear']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    handler: payrollController.sendPayslipEmail
  });

  // Send bulk payslip emails
  fastify.post('/payrolls/send-bulk-payslips', {
    schema: {
      description: 'Send payslip emails to multiple employees',
      tags: ['Payroll'],
      body: {
        type: 'object',
        properties: {
          employeeIds: {
            type: 'array',
            items: { type: 'string' }
          },
          salaryMonth: { type: 'string' },
          salaryYear: { type: 'string' }
        },
        required: ['employeeIds', 'salaryMonth', 'salaryYear']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    handler: payrollController.sendBulkPayslipEmails
  });

  // Get email results
  fastify.get('/payrolls/email-results', {
    schema: {
      description: 'Get email sending results',
      tags: ['Payroll'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: payrollController.getEmailResults
  });
}

module.exports = payrollRoutes;