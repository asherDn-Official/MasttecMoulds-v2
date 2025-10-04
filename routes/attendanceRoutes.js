const attendanceController = require("../controllers/attendanceController");

const attendanceRoutes = async (fastify, options) => {
  // Upload attendance data from frontend
  fastify.post(
    "/upload",
    {
      schema: {
        tags: ["Attendance"],
        summary: "Upload attendance data from frontend",
        description:
          "Process and save attendance data uploaded from the frontend application",
        body: {
          type: "object",
          required: ["attendanceData", "dateHeaders", "reportPeriod"],
          properties: {
            attendanceData: {
              type: "array",
              description: "Array of employee attendance data",
              items: {
                type: "object",
                properties: {
                  number: { type: "string", description: "Employee ID" },
                  name: { type: "string", description: "Employee name" },
                  details: {
                    type: "array",
                    description: "Daily attendance details",
                  },
                  summary: {
                    type: "object",
                    properties: {
                      Present: { type: "string" },
                      Absent: { type: "string" },
                      "Weekly OFF": { type: "string" },
                      Holiday: { type: "string" },
                      "Worked Hrs.": { type: "string" },
                      Late: { type: "string" },
                      "OT 1": { type: "string" },
                      "OT 2": { type: "string" },
                    },
                  },
                },
              },
            },
            dateHeaders: {
              type: "array",
              description: "Array of date strings for the attendance period",
              items: { type: "string", format: "date" },
            },
            reportPeriod: {
              type: "object",
              required: ["from", "to"],
              properties: {
                from: { type: "string", format: "date" },
                to: { type: "string", format: "date" },
              },
            },
          },
        },
        // response: {
        //   200: {
        //     description: 'Attendance data processed successfully',
        //     type: 'object',
        //     properties: {
        //       success: { type: 'boolean' },
        //       message: { type: 'string' },
        //       data: {
        //         type: 'object',
        //         properties: {
        //           reportPeriod: { type: 'string' },
        //           employeesProcessed: { type: 'integer' },
        //           recordIds: { type: 'array', items: { type: 'string' } },
        //           employeesCreated: { type: 'integer' }
        //         }
        //       }
        //     }
        //   },
        //   400: {
        //     description: 'Bad request - missing required fields',
        //     type: 'object',
        //     properties: {
        //       success: { type: 'boolean' },
        //       message: { type: 'string' }
        //     }
        //   },
        //   500: {
        //     description: 'Server error',
        //     type: 'object',
        //     properties: {
        //       success: { type: 'boolean' },
        //       message: { type: 'string' },
        //       error: { type: 'string' }
        //     }
        //   }
        // }
      },
    },
    attendanceController.uploadAttendanceData
  );

  // Get attendance records for a specific employee
  fastify.get(
    "/employee/:employeeId",
    {
      schema: {
        tags: ["Attendance"],
        summary: "Get attendance records for an employee",
        description:
          "Retrieve attendance records for a specific employee with optional date filtering",
        params: {
          type: "object",
          required: ["employeeId"],
          properties: {
            employeeId: { type: "string", description: "Employee ID" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            periodFrom: {
              type: "string",
              format: "date",
              description: "Start date for filtering",
            },
            periodTo: {
              type: "string",
              format: "date",
              description: "End date for filtering",
            },
          },
        },
        response: {
          200: {
            description: "Employee attendance records retrieved successfully",
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    employeeId: { type: "string" },
                    employeeName: { type: "string" },
                    reportPeriodFrom: { type: "string", format: "date" },
                    reportPeriodTo: { type: "string", format: "date" },
                    dailyAttendance: { type: "array" },
                    monthlySummary: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    },
    attendanceController.getEmployeeAttendance
  );

  // Get all attendance records
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Attendance"],
        summary: "Get all attendance records",
        description:
          "Retrieve all attendance records with optional date filtering",
        querystring: {
          type: "object",
          properties: {
            periodFrom: {
              type: "string",
              format: "date",
              description: "Start date for filtering",
            },
            periodTo: {
              type: "string",
              format: "date",
              description: "End date for filtering",
            },
            date: {
              type: "string",
              format: "date",
              description: "Exact attenadance date for filtering",
            },
          },
        },
        response: {
          200: {
            description: "All attendance records retrieved successfully",
            type: "object",
            properties: {
              success: { type: "boolean" },
              count: { type: "integer" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    employeeId: { type: "string" },
                    employeeName: { type: "string" },
                    reportPeriodFrom: { type: "string", format: "date" },
                    reportPeriodTo: { type: "string", format: "date" },
                    dailyAttendance: { type: "array" },
                    monthlySummary: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    },
    attendanceController.getAllAttendance
  );

  // Get attendance summary
  fastify.get(
    "/summary/:employeeId",
    {
      schema: {
        tags: ["Attendance"],
        summary: "Get attendance summary for an employee",
        description: "Retrieve attendance summary for a specific employee",
        params: {
          type: "object",
          required: ["employeeId"],
          properties: {
            employeeId: { type: "string", description: "Employee ID" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            periodFrom: {
              type: "string",
              format: "date",
              description: "Start date for filtering",
            },
            periodTo: {
              type: "string",
              format: "date",
              description: "End date for filtering",
            },
          },
        },
      },
    },
    attendanceController.getAttendanceSummary
  );

  // Get attendance statistics
  fastify.get(
    "/stats",
    {
      schema: {
        tags: ["Attendance"],
        summary: "Get attendance statistics",
        description: "Retrieve overall attendance statistics",
        response: {
          200: {
            description: "Attendance statistics retrieved successfully",
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  totalRecords: { type: "integer" },
                  uniqueEmployees: { type: "integer" },
                  latestExtraction: { type: "string", format: "date-time" },
                  latestPeriod: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    attendanceController.getAttendanceStats
  );

  // Delete attendance record
  fastify.delete(
    "/:recordId",
    {
      schema: {
        tags: ["Attendance"],
        summary: "Delete attendance record",
        description: "Delete a specific attendance record",
        params: {
          type: "object",
          required: ["recordId"],
          properties: {
            recordId: { type: "string", description: "Attendance record ID" },
          },
        },
        response: {
          200: {
            description: "Attendance record deleted successfully",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: { type: "object" },
            },
          },
          404: {
            description: "Attendance record not found",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    attendanceController.deleteAttendanceRecord
  );
};

module.exports = attendanceRoutes;
