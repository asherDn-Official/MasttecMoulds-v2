const employeeController = require("../contollers/employeeController");

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
            type: "string", 
            minLength: 3, 
            maxLength: 100,
            description: "Full name of the employee",
            example: "John Doe"
          },
          employeePicture: { 
            type: "string", 
            format: "binary",  
            description: "Profile picture of the employee"
          },
          employeeId: { 
            type: "string", 
            minLength: 3, 
            maxLength: 20,
            description: "Unique Employee ID",
            example: "EMP123"
          },
          department: { type: "string", maxLength: 50, example: "HR" },
          departmentCode: { type: "string", maxLength: 20, example: "HR01" },
          designation: { type: "string", maxLength: 50, example: "Manager" },
          qualification: { type: "string", maxLength: 100, example: "MBA" },
          dateOfBirth: { type: "string", format: "date", example: "1995-08-15" },
          dateOfJoining: { type: "string", format: "date", example: "2023-05-01" },
          bloodGroup: {
            type: "string",
            enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
            description: "Blood group of the employee",
            example: "O+"
          },
          mobileNumber: { 
            type: "string", 
            pattern: "^[6-9]\\d{9}$",
            description: "Indian mobile number (10 digits)",
            example: "9876543210"
          },
          mailId: { type: "string", format: "email", example: "employee@example.com" },
          address: { type: "string", maxLength: 255, example: "123 Street, City" },
          bankDetails: {
            type: "object",
            properties: {
              bankName: { type: "string", example: "SBI" },
              bankBranch: { type: "string", example: "Bangalore Main" },
              bankAccountNumber: { 
                type: "string", 
                pattern: "^\\d{9,18}$",
                example: "123456789012"
              },
              bankIFSCCode: { 
                type: "string", 
                pattern: "^[A-Z]{4}0[A-Z0-9]{6}$",
                example: "SBIN0001234"
              },
            },
          },
          PANNumber: { 
            type: "string", 
            pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$",
            example: "ABCDE1234F"
          },
          aadhaarNo: { type: "string", pattern: "^\\d{12}$", example: "123412341234" },
          UANNo: { type: "string", pattern: "^\\d{12}$", example: "123456789012" },
          esicId: { type: "string", example: "ESIC123456" },
          epfId: { type: "string", example: "EPF123456" },
          documents: {
            type: "object",
            properties: {
              addressProof: { type: "string", format: "binary", description: "Upload Address Proof" },
              educationCertificate: { type: "string", format: "binary", description: "Upload Education Certificate" },
              passbookProof: { type: "string", format: "binary", description: "Upload Bank Passbook" },
              PANCardProof: { type: "string", format: "binary", description: "Upload PAN Card" },
            },
          },
          salary: { type: "number", minimum: 0, example: 40000 },
          allowance: { type: "number", minimum: 0, example: 5000 },
          hra: { type: "number", minimum: 0, example: 8000 },
          esic: { type: "number", minimum: 0, example: 2000 },
          password: { type: "string", minLength: 6, example: "SecurePass123", description: "Password for employees will be automatically generated as dob as frontend side it self and its now important for employees" },
          status: { type: "boolean", example: true },
        },
      },
      response: {
        201: {
          description: "Employee created successfully",
          type: "object",
          properties: {
            message: { type: "string", example: "Employee created successfully" },
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

  
};

module.exports = employeeRoutes;
