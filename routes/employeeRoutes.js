const employeeController = require("../controllers/employeeController");

const employeeRoutes = async (fastify, options) => {
  const createOpts = {
    schema: {
      tags: ["Employee"],
      summary: "Create a new employee",
      description: "Creates a new employee with profile picture and documents",
      consumes: ["multipart/form-data"],
      body: {
        type: "object",
        required: ["employeeName", "employeeId", "password"],
        properties: {
          employeeName: {
            type: "object",
            properties: {
              value: {
                type: "string",
                minLength: 3,
                maxLength: 100,
                description: "Full name of the employee",
                example: "John Doe",
              },
            },
          },
          employeePicture: {
            type: "object",
            description: "Profile picture of the employee (file upload)",
          },
          employeeId: {
            type: "object",
            properties: {
              value: {
                type: "string",
                minLength: 3,
                maxLength: 20,
                description: "Unique Employee ID",
                example: "EMP123",
              },
            },
          },
          department: {
            type: "object",
            properties: {
              value: { type: "string", maxLength: 50, example: "HR" },
            },
          },
          departmentCode: {
            type: "object",
            properties: {
              value: { type: "string", maxLength: 20, example: "HR01" },
            },
          },
          designation: {
            type: "object",
            properties: {
              value: { type: "string", maxLength: 50, example: "Manager" },
            },
          },
          qualification: {
            type: "object",
            properties: {
              value: { type: "string", maxLength: 100, example: "MBA" },
            },
          },
          dateOfBirth: {
            type: "object",
            properties: {
              value: { type: "string", format: "date", example: "1995-08-15" },
            },
          },
          dateOfJoining: {
            type: "object",
            properties: {
              value: { type: "string", format: "date", example: "2023-05-01" },
            },
          },
          bloodGroup: {
            type: "object",
            properties: {
              value: {
                type: "string",
                enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
                description: "Blood group of the employee",
                example: "O+",
              },
            },
          },
          mobileNumber: {
            type: "object",
            properties: {
              value: {
                type: "string",
                pattern: "^[6-9]\\d{9}$",
                description: "Indian mobile number (10 digits)",
                example: "9876543210",
              },
            },
          },
          mailId: {
            type: "object",
            properties: {
              value: {
                type: "string",
                format: "email",
                example: "employee@example.com",
              },
            },
          },
          address: {
            type: "object",
            properties: {
              value: {
                type: "string",
                maxLength: 255,
                example: "123 Street, City",
              },
            },
          },
          bankDetails: {
            // type: "object",
            properties: {
              value: {
                // type: "object",
                properties: {
                  bankName: { type: "string", example: "SBI" },
                  bankBranch: { type: "string", example: "Bangalore Main" },
                  bankAccountNumber: {
                    type: "string",
                    pattern: "^\\d{9,18}$",
                    example: "123456789012",
                  },
                  bankIFSCCode: {
                    type: "string",
                    pattern: "^[A-Z]{4}0[A-Z0-9]{6}$",
                    example: "SBIN0001234",
                  },
                },
              },
            },
          },
          PANNumber: {
            type: "object",
            properties: {
              value: {
                type: "string",
                pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$",
                example: "ABCDE1234F",
              },
            },
          },
          aadhaarNo: {
            type: "object",
            properties: {
              value: {
                type: "string",
                pattern: "^\\d{12}$",
                example: "123412341234",
              },
            },
          },
          UANNo: {
            type: "object",
            properties: {
              value: {
                type: "string",
                pattern: "^\\d{12}$",
                example: "123456789012",
              },
            },
          },
          esicId: {
            type: "object",
            properties: { value: { type: "string", example: "ESIC123456" } },
          },
          epfId: {
            type: "object",
            properties: { value: { type: "string", example: "EPF123456" } },
          },
          documents: {
            type: "object",
            properties: {
              addressProof: {
                type: "object",
                description: "Upload Address Proof (file upload)",
              },
              educationCertificate: {
                type: "object",
                description: "Upload Education Certificate (file upload)",
              },
              passbookProof: {
                type: "object",
                description: "Upload Bank Passbook (file upload)",
              },
              PANCardProof: {
                type: "object",
                description: "Upload PAN Card (file upload)",
              },
            },
          },
          salary: {
            type: "object",
            properties: {
              value: { type: "number", minimum: 0, example: 40000 },
            },
          },
          allowance: {
            type: "object",
            properties: {
              value: { type: "number", minimum: 0, example: 5000 },
            },
          },
          hra: {
            type: "object",
            properties: {
              value: { type: "number", minimum: 0, example: 8000 },
            },
          },
          esic: {
            type: "object",
            properties: {
              value: { type: "number", minimum: 0, example: 2000 },
            },
          },
          password: {
            type: "object",
            properties: {
              value: {
                type: "string",
                minLength: 6,
                example: "SecurePass123",
                description:
                  "Password for employees will be automatically generated as dob as frontend side it self and its now important for employees",
              },
            },
          },
          status: {
            type: "object",
            properties: { value: { type: "boolean", example: true } },
          },
        },
      },
      response: {
        201: {
          description: "Employee created successfully",
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Employee created successfully",
            },
            employee: { type: "object" },
          },
        },
        500: {
          description: "Server error",
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  };

  fastify.post("/", createOpts, employeeController.create);
fastify.get("/", {
  schema: {
    tags: ["Employee"],
    summary: "Get all employees",
    description: "Fetch employees with optional filters, search, and pagination",
    querystring: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Search by name, ID, mobile, email",
          example: "John"
        },
        department: { type: "string", description: "Filter by department", example: "HR" },
        designation: { type: "string", description: "Filter by designation", example: "Manager" },
        status: { type: "boolean", description: "Filter by active/inactive", example: true },
        page: { type: "integer", minimum: 1, default: 1, example: 2 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 10, example: 5 }
      },
      examples: [
        {
          search: "John",
          page: 1,
          limit: 10
        },
        {
          department: "HR",
          status: true
        },
        {
          search: "EMP123",
          department: "HR",
          page: 2,
          limit: 5
        }
      ]
    },
    response: {
      200: {
        description: "List of employees",
        type: "object",
        properties: {
          status: { type: "string", example: "success" },
          pagination: {
            type: "object",
            properties: {
              totalItems: { type: "integer", example: 50 },
              totalPages: { type: "integer", example: 5 },
              currentPage: { type: "integer", example: 1 }
            }
          },
          data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string", example: "64f1a1c0b45e23" },
                employeeName: { type: "string", example: "John Doe" },
                employeePicture: { type: "string", example: "/uploads/employees/johndoe.png" },
                employeeId: { type: "string", example: "EMP123" },
                department: { type: "string", example: "HR" },
                departmentCode: { type: "string", example: "HR01" },
                designation: { type: "string", example: "Manager" },
                qualification: { type: "string", example: "MBA" },
                dateOfBirth: { type: "string", format: "date", example: "1995-08-15" },
                dateOfJoining: { type: "string", format: "date", example: "2023-05-01" },
                bloodGroup: { type: "string", example: "O+" },
                mobileNumber: { type: "string", example: "9876543210" },
                mailId: { type: "string", example: "employee@example.com" },
                address: { type: "string", example: "123 Street, City" },
                bankDetails: {
                  type: "object",
                  properties: {
                    bankName: { type: "string", example: "SBI" },
                    bankBranch: { type: "string", example: "Bangalore Main" },
                    bankAccountNumber: { type: "string", example: "123456789012" },
                    bankIFSCCode: { type: "string", example: "SBIN0001234" }
                  }
                },
                PANNumber: { type: "string", example: "ABCDE1234F" },
                aadhaarNo: { type: "string", example: "123412341234" },
                UANNo: { type: "string", example: "123456789012" },
                esicId: { type: "string", example: "ESIC123456" },
                epfId: { type: "string", example: "EPF123456" },
                documents: {
                  type: "object",
                  properties: {
                    addressProof: { type: "string", example: "/uploads/docs/address.pdf" },
                    educationCertificate: { type: "string", example: "/uploads/docs/education.pdf" },
                    passbookProof: { type: "string", example: "/uploads/docs/passbook.pdf" },
                    PANCardProof: { type: "string", example: "/uploads/docs/pan.pdf" }
                  }
                },
                salary: { type: "number", example: 40000 },
                allowance: { type: "number", example: 5000 },
                hra: { type: "number", example: 8000 },
                esic: { type: "number", example: 2000 },
                status: { type: "boolean", example: true },
                createdAt: { type: "string", format: "date-time", example: "2025-09-16T09:15:00Z" },
                updatedAt: { type: "string", format: "date-time", example: "2025-09-16T10:15:00Z" }
              }
            }
          }
        },
        examples: [
          {
            status: "success",
            pagination: { totalItems: 2, totalPages: 1, currentPage: 1 },
            data: [
              {
                _id: "64f1a1c0b45e23",
                employeeName: "John Doe",
                employeePicture: "/uploads/employees/johndoe.png",
                employeeId: "EMP123",
                department: "HR",
                designation: "Manager",
                mobileNumber: "9876543210",
                status: true,
                createdAt: "2025-09-16T09:15:00Z",
                updatedAt: "2025-09-16T10:15:00Z"
              },
              {
                _id: "64f1a1c0b45e24",
                employeeName: "Jane Smith",
                employeePicture: "/uploads/employees/janesmith.png",
                employeeId: "EMP124",
                department: "Finance",
                designation: "Analyst",
                mobileNumber: "9876543211",
                status: true,
                createdAt: "2025-09-16T09:20:00Z",
                updatedAt: "2025-09-16T09:50:00Z"
              }
            ]
          }
        ]
      },
      500: {
        description: "Server error",
        type: "object",
        properties: {
          message: { type: "string", example: "Server error" },
          error: { type: "string", example: "Database connection failed" }
        }
      }
    }
  }
}, employeeController.getAll);

const getByIdOpts = {
    schema: {
      tags: ["Employee"],
      summary: "Get a single employee by ID",
      description: "Fetches the details of a specific employee using their unique MongoDB ID.",
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string",
            description: "Employee's unique MongoDB ID",
            example: "60c72b2f9b1d8c001f8e4d1c",
          },
        },
      },
      response: {
        200: {
          description: "Successful response",
          type: "object",
          properties: {
            _id: { type: "string" },
            employeeName: { type: "string" },
            employeePicture: { type: "string" },
            employeeId: { type: "string" },
            department: { type: "string" },
            designation: { type: "string" },
            mobileNumber: { type: "string" },
            mailId: { type: "string" },
            status: { type: "boolean" },
            // Add all other employee fields you want to return
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        404: {
          description: "Employee not found",
          type: "object",
          properties: {
            message: { type: "string", example: "Employee not found" },
          },
        },
        400: {
          description: "Invalid ID format",
          type: "object",
          properties: {
            message: { type: "string", example: "Invalid employee ID format" },
          },
        },
        500: {
          description: "Server error",
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  };

fastify.get("/:id", getByIdOpts, employeeController.getById);

const updateOpts = {
    schema: {
      tags: ["Employee"],
      summary: "Update an employee",
      description: "Updates an existing employee's details by their ID. All fields are optional.",
      consumes: ["multipart/form-data"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Employee's unique MongoDB ID" },
        },
      },
      body: {
        type: "object",
        
        properties: {
          employeeName: {
            type: "object",
            properties: {
              value: { type: "string", minLength: 3, maxLength: 100 },
            },
          },
          employeePicture: {
            type: "object",
            description: "New profile picture for the employee (file upload)",
          },
          employeeId: {
            type: "object",
            properties: {
              value: { type: "string", minLength: 3, maxLength: 20 },
            },
          },
          department: {
            type: "object",
            properties: { value: { type: "string", maxLength: 50 } },
          },
          designation: {
            type: "object",
            properties: { value: { type: "string", maxLength: 50 } },
          },
          mobileNumber: {
            type: "object",
            properties: { value: { type: "string", pattern: "^[6-9]\\d{9}$" } },
          },
          mailId: {
            type: "object",
            properties: { value: { type: "string", format: "email" } },
          },
          address: {
            type: "object",
            properties: { value: { type: "string", maxLength: 255 } },
          },
          bankDetails: {
            type: "object",
            properties: {
              value: {
                type: "object",
                properties: {
                  bankName: { type: "string" },
                  bankBranch: { type: "string" },
                  bankAccountNumber: { type: "string", pattern: "^\\d{9,18}$" },
                  bankIFSCCode: { type: "string", pattern: "^[A-Z]{4}0[A-Z0-9]{6}$" },
                },
              },
            },
          },
          PANNumber: {
            type: "object",
            properties: {
              value: { type: "string", pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$" },
            },
          },
          aadhaarNo: {
            type: "object",
            properties: { value: { type: "string", pattern: "^\\d{12}$" } },
          },
          documents: {
            type: "object",
            properties: {
              addressProof: { type: "object", description: "Upload new Address Proof" },
              educationCertificate: { type: "object", description: "Upload new Education Certificate" },
              passbookProof: { type: "object", description: "Upload new Bank Passbook" },
              PANCardProof: { type: "object", description: "Upload new PAN Card" },
            },
          },
          salary: {
            type: "object",
            properties: { value: { type: "number", minimum: 0 } },
          },
          status: {
            type: "object",
            properties: { value: { type: "boolean" } },
          },
          // Add other optional fields here following the same pattern
        },
      },
      response: {
        200: {
          description: "Employee updated successfully",
          type: "object",
          properties: {
            message: { type: "string" },
            employee: { type: "object" },
          },
        },
        404: {
          description: "Employee not found",
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        500: {
          description: "Server error",
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  };

  fastify.patch("/:id", updateOpts, employeeController.update);

  const deleteOpts = {
    schema: {
      tags: ["Employee"],
      summary: "Delete an employee",
      description: "Deletes an employee by their unique MongoDB ID.",
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string",
            description: "Employee's unique MongoDB ID to delete",
            example: "60c72b2f9b1d8c001f8e4d1c",
          },
        },
      },
      response: {
        200: {
          description: "Employee deleted successfully",
          type: "object",
          properties: {
            message: { type: "string", example: "Employee deleted successfully" },
          },
        },
        404: {
          description: "Employee not found",
          type: "object",
          properties: {
            message: { type: "string", example: "Employee not found" },
          },
        },
        500: {
          description: "Server error",
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  };

  fastify.delete("/:id", deleteOpts, employeeController.deleteById);
};

module.exports = employeeRoutes;
