const Payroll = require("../models/Payroll");
const Employee = require("../models/Employee");
const PayrollEmailResponse = require("../models/PayrollEmailResponse");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");
const nodemailer = require("nodemailer");
const htmlToPdf = require("html-pdf"); 
const payrollService = require("../services/payrollService");

// Load logo as a Base64 data URI to embed in the PDF
const logoPath = path.join(__dirname, '../utils/logo/logo.png');
const logoBase64 = fs.readFileSync(logoPath, 'base64');
const logo = `data:image/png;base64,${logoBase64}`; 

// Helper function to format date
const formatDate = (dateString) => {
  const date = new Date(dateString); 
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();

  const daySuffix = (day) => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  return `${day}${daySuffix(day)} ${month} ${year}`;
};

// Helper function to get value or dash
const getValueOrDash = (value) =>
  value !== undefined && value !== null && value !== "" ? value : "-";

// Helper function to get month name
function getMonthName(monthNumber) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[parseInt(monthNumber) - 1] || "Unknown";
}

// Helper function to calculate total earnings
function calculateTotalEarnings(payrun) {
  return (
    parseFloat(payrun.basic || 0) +
    parseFloat(payrun.houseRent || 0) +
    parseFloat(payrun.incentives || 0) +
    parseFloat(payrun.allowances || 0) +
    parseFloat(payrun.OT1Amount || 0) +
    parseFloat(payrun.OT2Amount || 0)
  );
}

// Helper function to calculate total deductions
function calculateTotalDeductions(payrun) {
  return (
    parseFloat(payrun.EPF || 0) +
    parseFloat(payrun.ESIC || 0) +
    parseFloat(payrun.advance || 0) +
    parseFloat(payrun.paymentLossAmount || 0)
  );
}

// Create a new payroll record
async function createPayroll(request, reply) {
  try {
    const { employeeId, payrunData } = request.body;

    if (!employeeId || !payrunData) {
      return reply.status(400).send({
        success: false,
        message: "Employee ID and payrun data are required",
      });
    }

    // Check if payroll record already exists for this employee
    let payrollRecord = await Payroll.findOne({ employeeId });

    if (payrollRecord) {
      // Add new payrun to history
      payrollRecord.payrunHistory.push(payrunData);
      await payrollRecord.save();
    } else {
      // Create new payroll record
      payrollRecord = new Payroll({
        employeeId,
        payrunHistory: [payrunData],
      });
      await payrollRecord.save();
    }

    reply.status(201).send({
      success: true,
      message: "Payroll record created successfully",
      data: payrollRecord,
    });
  } catch (error) {
    console.error("Error creating payroll record:", error);
    reply.status(500).send({
      success: false,
      message: "Error creating payroll record",
      error: error.message,
    });
  }
}

// Process payroll from attendance data
async function processPayrollFromAttendance(request, reply) {
  try {
    const { periodFrom, periodTo } = request.body;

    if (!periodFrom || !periodTo) {
      return reply.status(400).send({
        success: false,
        message: "Period from and to dates are required",
      });
    }

    const result = await payrollService.processPayrollForPeriod(
      periodFrom,
      periodTo
    );

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        message: result.message || "Failed to process payroll",
        errors: result.errors,
      });
    }

    reply.status(200).send({
      success: true,
      message: `Successfully processed payroll for ${result.processedCount} employees`,
      data: {
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        payrolls: result.payrolls,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("Error processing payroll from attendance:", error);
    reply.status(500).send({
      success: false,
      message: "Error processing payroll from attendance",
      error: error.message,
    });
  }
}

// Get all payroll records
async function getAllPayrolls(request, reply) {
  try {
    console.log("getAllPayrolls endpoint called");
    const payrolls = await payrollService.getAllPayrolls();
    console.log(`Found ${payrolls.length} payroll records`);

    reply.status(200).send({
      success: true,
      count: payrolls.length,
      data: payrolls,
      message: `Retrieved ${payrolls.length} payroll records successfully`,
    });
  } catch (error) {
    console.error("Error retrieving payroll records:", error);
    reply.status(500).send({
      success: false,
      message: "Error retrieving payroll records",
      error: error.message,
    });
  }
}

// Get a specific payroll record by employee ID
async function getPayrollByEmployeeId(request, reply) {
  const { employeeId } = request.params;

  try {
    const payroll = await payrollService.getPayrollByEmployeeId(employeeId);

    if (!payroll) {
      return reply.status(404).send({
        success: false,
        message: `Payroll record not found for employee ${employeeId}`,
      });
    }

    reply.status(200).send({
      success: true,
      data: payroll,
    });
  } catch (error) {
    console.error(
      `Error retrieving payroll for employee ${employeeId}:`,
      error
    );
    reply.status(500).send({
      success: false,
      message: "Error retrieving payroll record",
      error: error.message,
    });
  }
}

// Update a payroll record by employee ID
async function updatePayrollByEmployeeId(request, reply) {
  const { employeeId } = request.params;
  const updateData = request.body;

  try {
    const updatedPayroll = await payrollService.updatePayrollByEmployeeId(
      employeeId,
      updateData
    );

    reply.status(200).send({
      success: true,
      message: "Payroll record updated successfully",
      data: updatedPayroll,
    });
  } catch (error) {
    console.error(`Error updating payroll for employee ${employeeId}:`, error);
    reply.status(500).send({
      success: false,
      message: "Error updating payroll record",
      error: error.message,
    });
  }
}

// Update multiple payroll records
async function updateMultiplePayrolls(request, reply) {
  const updates = request.body; // Expecting an array of { employeeId, updateData }

  if (!Array.isArray(updates)) {
    return reply.status(400).send({
      success: false,
      message: "Request body must be an array of updates",
    });
  }

  try {
    const results = await Promise.all(
      updates.map(async ({ employeeId, updateData }) => {
        try {
          const updatedPayroll = await payrollService.updatePayrollByEmployeeId(
            employeeId,
            updateData
          );
          return {
            employeeId,
            success: true,
            data: updatedPayroll,
          };
        } catch (error) {
          return {
            employeeId,
            success: false,
            error: error.message,
          };
        }
      })
    );

    reply.status(200).send({
      success: true,
      message: "Batch payroll update completed",
      results,
    });
  } catch (error) {
    console.error("Error processing batch payroll update:", error);
    reply.status(500).send({
      success: false,
      message: "Error processing batch payroll update",
      error: error.message,
    });
  }
}

// Delete a payroll record by employee ID
async function deletePayrollByEmployeeId(request, reply) {
  const { employeeId } = request.params;

  try {
    const deletedPayroll = await payrollService.deletePayrollByEmployeeId(
      employeeId
    );

    if (!deletedPayroll) {
      return reply.status(404).send({
        success: false,
        message: `Payroll record not found for employee ${employeeId}`,
      });
    }

    reply.status(200).send({
      success: true,
      message: "Payroll record deleted successfully",
      data: deletedPayroll,
    });
  } catch (error) {
    console.error(`Error deleting payroll for employee ${employeeId}:`, error);
    reply.status(500).send({
      success: false,
      message: "Error deleting payroll record",
      error: error.message,
    });
  }
}

// Get payroll records by month and year
async function getPayrollByMonth(request, reply) {
  const { month, year } = request.params;

  try {
    if (!month || !year) {
      return reply.status(400).send({
        success: false,
        message: "Month and year are required",
      });
    }
    console.log("month and year", month, year);
    const payrolls = await payrollService.getPayrollWithEmployeeDetailsByMonth(
      month,
      year
    );

    reply.status(200).send({
      success: true,
      message: `Payroll records retrieved for ${month}/${year}`,
      count: payrolls.length,
      data: payrolls,
    });
  } catch (error) {
    console.error(
      `Error retrieving payroll for month ${month}/${year}:`,
      error
    );
    reply.status(500).send({
      success: false,
      message: "Error retrieving payroll records",
      error: error.message,
    });
  }
}

// Create missing employee records
async function createMissingEmployeeRecords(request, reply) {
  try {
    const { employeeIds } = request.body;

    if (!employeeIds || !Array.isArray(employeeIds)) {
      return reply.status(400).send({
        success: false,
        message: "Employee IDs array is required",
      });
    }

    const createdEmployees = [];
    const existingEmployees = [];
    const errors = [];

    for (const employeeId of employeeIds) {
      try {
        // Check if employee already exists
        const existingEmployee = await Employee.findOne({ employeeId });

        if (existingEmployee) {
          existingEmployees.push(employeeId);
          continue;
        }

        // Create basic employee record
        const newEmployee = new Employee({
          employeeId: employeeId,
          employeeName: `Employee ${employeeId}`,
          salary: "0",
          epf: "0",
          esic: "0",
          status: true,
        });

        await newEmployee.save();
        createdEmployees.push(employeeId);
        console.log(`Created basic employee record for ID: ${employeeId}`);
      } catch (error) {
        console.error(
          `Error creating employee record for ID ${employeeId}:`,
          error
        );
        errors.push({
          employeeId,
          error: error.message,
        });
      }
    }

    reply.status(200).send({
      success: true,
      message: `Processed ${employeeIds.length} employee IDs`,
      data: {
        created: createdEmployees,
        existing: existingEmployees,
        errors: errors,
        summary: {
          totalProcessed: employeeIds.length,
          created: createdEmployees.length,
          existing: existingEmployees.length,
          errors: errors.length,
        },
      },
    });
  } catch (error) {
    console.error("Error creating missing employee records:", error);
    reply.status(500).send({
      success: false,
      message: "Error creating missing employee records",
      error: error.message,
    });
  }
}

// Create or update payroll for employee
async function createOrUpdatePayrollForEmployee(request, reply) {
  try {
    const { employeeId } = request.params;
    const { salaryMonth, salaryYear, payrunData } = request.body;

    if (!employeeId || !salaryMonth || !salaryYear) {
      return reply.status(400).send({
        success: false,
        message: "Employee ID, salary month, and salary year are required",
      });
    }

    // Check if payroll record already exists for this employee
    let payrollRecord = await payrollService.getPayrollByEmployeeId(employeeId);

    if (payrollRecord) {
      // Check if payrun for this month and year already exists
      const existingPayrunIndex = payrollRecord.payrunHistory.findIndex(
        (payrun) =>
          payrun.salaryMonth === salaryMonth && payrun.salaryYear === salaryYear
      );

      if (existingPayrunIndex !== -1) {
        // Update existing payrun
        // Merge new data into the existing payrun
        Object.assign(payrollRecord.payrunHistory[existingPayrunIndex], {
          ...payrunData,
          salaryMonth,
          salaryYear,
        });

        // Mark the array as modified for Mongoose to detect the change
        payrollRecord.markModified('payrunHistory');
        const updatedPayroll = await payrollRecord.save();

        return reply.status(200).send({
          success: true,
          message: "Payroll record updated successfully",
          data: updatedPayroll,
        });
      } else {
        // Add new payrun to existing record
        payrollRecord.payrunHistory.push({
          ...payrunData,
          salaryMonth,
          salaryYear,
        });
        const updatedPayroll = await payrollRecord.save();

        return reply.status(201).send({
          success: true,
          message: "New payroll record added successfully",
          data: updatedPayroll,
        });
      }
    } else {
      // Create new payroll record
      const newPayrunData = {
        salaryMonth,
        salaryYear,
        present: payrunData.present || "0",
        absent: payrunData.absent || "0",
        basic: payrunData.basic || "0",
        houseRent: payrunData.houseRent || "0",
        EPF: payrunData.EPF || "0",
        ESIC: payrunData.ESIC || "0",
        incentives: payrunData.incentives || "0",
        allowances: payrunData.allowances || "0",
        advance: payrunData.advance || "0",
        paymentLossDays: payrunData.paymentLossDays || "0",
        paymentLossAmount: payrunData.paymentLossAmount || "0",
        OT1Hours: payrunData.OT1Hours || "0",
        OT1Amount: payrunData.OT1Amount || "0",
        OT2Hours: payrunData.OT2Hours || "0",
        OT2Amount: payrunData.OT2Amount || "0",
        holdOT: payrunData.holdOT || "0",
        totalBasicPayment: payrunData.totalBasicPayment || "0",
        totalOTPayment: payrunData.totalOTPayment || "0",
        salary: payrunData.salary || "0",
        balance: payrunData.balance || "0",
      };

      const newPayroll = await Payroll.create({
        employeeId,
        payrunHistory: [newPayrunData],
      });

      return reply.status(201).send({
        success: true,
        message: "Payroll record created successfully",
        data: newPayroll,
      });
    }
  } catch (error) {
    console.error("Error creating/updating payroll record:", error);
    reply.status(500).send({
      success: false,
      message: "Error creating/updating payroll record",
      error: error.message,
    });
  }
}

// Generate PDF buffer from HTML
async function generatePDFBufferFromHTML(htmlContent) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();
  return pdfBuffer;
}

// Send payslip email
// Send payslip email (with DB record)
async function sendPayslipEmail(request, reply) {
  try {
    const { salaryMonth, salaryYear } = request.body;
    const { employeeId } = request.params;

    if (!employeeId || !salaryMonth || !salaryYear) {
      return reply.status(400).send({
        success: false,
        message: "Employee ID, salary month, and salary year are required",
      });
    }

    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return reply.status(404).send({
        success: false,
        message: `Employee not found with ID: ${employeeId}`,
      });
    }

    if (!employee.mailId || employee.mailId.trim() === "") {
      return reply.status(400).send({
        success: false,
        message: `Email address not found for employee: ${employee.employeeName}`,
      });
    }

    const payroll = await Payroll.findOne({ employeeId });
    if (!payroll) {
      return reply.status(404).send({
        success: false,
        message: `Payroll record not found for employee: ${employee.employeeName}`,
      });
    }

    const payrun = payroll.payrunHistory.find(
      (p) => p.salaryMonth === salaryMonth && p.salaryYear === salaryYear
    );

    if (!payrun) {
      return reply.status(404).send({
        success: false,
        message: `Payroll record not found for ${salaryMonth}/${salaryYear}`,
      });
    }

    // Generate HTML and PDF
    const payslipHTML = createPayslipHTML(employee, payrun);
    const pdfBuffer = await generatePDFBufferFromHTML(payslipHTML);

    // Create a pending record first
    const emailRecord = new PayrollEmailResponse({
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      emailId: employee.mailId,
      salaryMonth,
      salaryYear,
      status: "PENDING",
      responseMessage: "Attempting to send email...",
    });

    await emailRecord.save();

    // Email setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER || "your-email@gmail.com",
        pass: process.env.EMAIL_PASS || "your-app-password",
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || "your-email@gmail.com",
      to: employee.mailId,
      subject: `Payslip for ${getMonthName(salaryMonth)} ${salaryYear} - ${employee.employeeName}`,
      text: `Dear ${employee.employeeName},\n\nPlease find attached your payslip for ${getMonthName(
        salaryMonth
      )} ${salaryYear}.\n\nRegards,\nMasttec HR`,
      attachments: [
        {
          filename: `Payslip_${employee.employeeName}_${salaryMonth}_${salaryYear}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // ✅ Update record to SUCCESS
    emailRecord.status = "SUCCESS";
    emailRecord.responseMessage = `Payslip sent successfully to ${employee.mailId}`;
    emailRecord.sentAt = new Date();
    await emailRecord.save();

    reply.status(200).send({
      success: true,
      message: `Payslip PDF sent successfully to ${employee.mailId}`,
      data: {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        email: employee.mailId,
        period: `${getMonthName(salaryMonth)} ${salaryYear}`,
        salary: payrun.salary,
      },
    });
  } catch (error) {
    console.error("Error sending payslip email:", error);

    // ❌ Log the failure in the same collection
    try {
      await PayrollEmailResponse.create({
        employeeId: request.params.employeeId || "unknown",
        employeeName: "Unknown",
        emailId: "N/A",
        salaryMonth: request.body.salaryMonth,
        salaryYear: request.body.salaryYear,
        status: "FAILED",
        responseMessage: "Error sending payslip email",
        errorDetails: error.message,
      });
    } catch (logErr) {
      console.error("Error logging email failure:", logErr);
    }

    reply.status(500).send({
      success: false,
      message: "Error sending payslip email",
      error: error.message,
    });
  }
}


// Send bulk payslip emails
async function sendBulkPayslipEmails(request, reply) {
  try {
    const { employeeIds, salaryMonth, salaryYear } = request.body;

    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return reply.status(400).send({
        success: false,
        message: "Employee IDs array is required",
      });
    }

    if (!salaryMonth || !salaryYear) {
      return reply.status(400).send({
        success: false,
        message: "Salary month and year are required",
      });
    }

    const results = {
      successful: [],
      failed: [],
      total: employeeIds.length,
    };

    // Configure nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER || "your-email@gmail.com",
        pass: process.env.EMAIL_PASS || "your-app-password",
      },
    });

    // Process each employee
    for (const employeeId of employeeIds) {
      try {
        // Get employee data
        const employee = await Employee.findOne({ employeeId });
        if (!employee) {
          results.failed.push({
            employeeId,
            error: "Employee not found",
          });
          continue;
        }

        // Check if employee has email
        if (!employee.mailId || employee.mailId.trim() === "") {
          results.failed.push({
            employeeId,
            employeeName: employee.employeeName,
            error: "Email address not found",
          });
          continue;
        }

        // Get payroll data
        const payroll = await Payroll.findOne({ employeeId });
        if (!payroll) {
          results.failed.push({
            employeeId,
            employeeName: employee.employeeName,
            error: "Payroll record not found",
          });
          continue;
        }

        // Find the specific payrun
        const payrun = payroll.payrunHistory.find(
          (p) => p.salaryMonth === salaryMonth && p.salaryYear === salaryYear
        );

        if (!payrun) {
          results.failed.push({
            employeeId,
            employeeName: employee.employeeName,
            error: `Payroll record not found for ${salaryMonth}/${salaryYear}`,
          });
          continue;
        }

        // Create HTML payslip
        const payslipHTML = createPayslipHTML(employee, payrun);

        // Email options
        const mailOptions = {
          from: process.env.EMAIL_USER || "your-email@gmail.com",
          to: employee.mailId,
          subject: `Payslip for ${getMonthName(salaryMonth)} ${salaryYear} - ${
            employee.employeeName
          }`,
          html: payslipHTML,
        };

        // Send email
        await transporter.sendMail(mailOptions);

        results.successful.push({
          employeeId,
          employeeName: employee.employeeName,
          email: employee.mailId,
          salary: payrun.salary,
        });

        // Add small delay to avoid overwhelming the email server
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(
          `Error sending payslip to employee ${employeeId}:`,
          error
        );
        results.failed.push({
          employeeId,
          error: error.message,
        });
      }
    }

    // Save results to the database
    const emailResult = new PayrollEmailResponse({
      employeeId: 'bulk',
      employeeName: 'Bulk Email',
      emailId: 'bulk@masttec.com',
      salaryMonth,
      salaryYear,
      status: results.failed.length > 0 ? 'FAILED' : 'SUCCESS',
      responseMessage: `Sent: ${results.successful.length}, Failed: ${results.failed.length}`,
      errorDetails: JSON.stringify(results.failed)
    });
    await emailResult.save();

    reply.status(200).send({
      success: true,
      message: `Bulk payslip sending completed. Sent: ${results.successful.length}, Failed: ${results.failed.length}`,
      data: results,
    });
  } catch (error) {
    console.error("Error sending bulk payslip emails:", error);
    reply.status(500).send({
      success: false,
      message: "Error sending bulk payslip emails",
      error: error.message,
    });
  }
}

// Get email results
async function getEmailResults(request, reply) {
  try {
    console.log("getEmailResults endpoint called");
    const emailResults = await PayrollEmailResponse.find();
    reply.status(200).send({
      success: true,
      data: emailResults,
      message: "Email results retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving email results:", error);
    reply.status(500).send({
      success: false,
      message: "Error retrieving email results",
      error: error.message,
    });
  }
}

// Create payslip HTML template
function createPayslipHTML(employee, payrun) {
  const monthName = getMonthName(payrun.salaryMonth);

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Pay Slip - ${monthName} ${payrun.salaryYear}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 800px;
          margin: auto;
          padding: 20px;
          border: 1px solid #ccc;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }
        .header h2 {
          margin: 5px 0 0;
          font-size: 18px;
          color: #666;
        }
        .section {
          margin-bottom: 20px;
        }
        .section h3 {
          margin-bottom: 10px;
          font-size: 18px;
          color: #333;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        table, th, td {
          border: 1px solid #ddd;
        }
        th, td {
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #eeeff5;
        }
        .total {
          font-weight: bold;
          background-color: #f9f9f9;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 14px;
          color: #555;
        }
        .title {
          text-align: center;
        }
        .table-title {
          background-color: #17215e;
          color: #fff;
        }
        .bg-light {
          background-color: #eeeff5 !important;
        }
        .logo {
          display: flex;
          flex-direction: column;
          text-align: left;
        }
        .logo p {
          font-size: 12px;
          color: #17215e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo" style="float: left;">
            <img
              src="${logo}"
              alt="Logo"
              width="250"
              height="80"
            />
            <p>
              No,18-A JEEVA NAGAR EXTN,DRR AVENUE,
              <br />
              KATTUPAKKAM,CHENNAI-56
            </p>
          </div>
          <h2 style="float: right;">Pay Slip - ${monthName} ${payrun.salaryYear}</h2>
        </div>
        <div style="clear: both;"></div>

        <div class="section">
          <h3 class="title">Employee Details</h3>
          <table>
            <tr>
              <th>Name</th>
              <td>${employee?.employeeName}</td>
              <th>Aadhaar No.</th>
              <td>${employee?.employeeAadhaarNo || "N/A"}</td>
            </tr>
            <tr>
              <th>Designation</th>
              <td>${employee?.designation}</td>
              <th>Bank A/c No.</th>
              <td>${employee?.bankAccountNumber || "N/A"}</td>
            </tr>
            <tr>
              <th>Department</th>
              <td>${employee?.department}</td>
              <th>Bank & Branch</th>
              <td>${employee?.bankName || "N/A"}/${employee?.bankBranch || "N/A"}</td>
            </tr>
            <tr>
              <th>Date of Joining</th>
              <td>${employee?.doj || "N/A"}</td>
              <th>IFSC Code</th>
              <td>${employee?.bankIFSCCode || "N/A"}</td>
            </tr>
            <tr>
              <th>Increment on Salary</th>
              <td>N/A</td>
              <th>EPF Member ID</th>
              <td>${parseFloat(payrun.EPF || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <th>Payable Days</th>
              <td>${payrun.present}</td>
              <th>UAN No.</th>
              <td>${employee?.UANNo || "N/A"}</td>
            </tr>
            <tr>
              <th>Per Day Salary</th>
              <td>${(parseFloat(employee?.salary || 0) / 30).toFixed(2)}</td>
              <th>ESIC No</th>
              <td>${parseFloat(payrun.ESIC || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <th>1 Hour salary</th>
              <td>${(parseFloat(employee?.salary || 0) / 30).toFixed(2)}</td>
              <th>PAN NO</th>
              <td>${employee?.PANNumber || "N/A"}</td>
            </tr>
            <tr>
              <th>Leave/Absent</th>
              <td>${payrun.absent}</td>
              <th>Employment ID</th>
              <td>${employee?.employeeId}</td>
            </tr>
            <tr>
              <th>Mobile number</th>
              <td>${employee?.mobileNumber || "N/A"}</td>
              <th></th>
              <td></td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h3 class="title">Salary Details</h3>
          <table>
            <thead>
              <tr>
                <th class="table-title">Employee's</th>
                <th class="table-title">Earned</th>
                <th class="table-title">Deductions</th>
                <th class="table-title">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="bg-light">Basic</td>
                <td>${parseFloat(payrun.basic || 0).toFixed(2)}</td>
                <td class="bg-light">Loss of Pay</td>
                <td>${parseFloat(payrun.paymentLossAmount || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td class="bg-light">Incentive</td>
                <td>${parseFloat(payrun.incentives || 0).toFixed(2)}</td>
                <td class="bg-light">EPF</td>
                <td>${parseFloat(payrun.EPF || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td class="bg-light">Allowances</td>
                <td>${parseFloat(payrun.allowances || 0).toFixed(2)}</td>
                <td class="bg-light">ESIC</td>
                <td>${parseFloat(payrun.ESIC || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td class="bg-light">HRA</td>
                <td>${parseFloat(payrun.houseRent || 0).toFixed(2)}</td>
                <td class="bg-light">Advance</td>
                <td>${parseFloat(payrun.advance || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td class="bg-light">Others</td>
                <td>0</td>
                <td class="bg-light">TDS Debits</td>
                <td>-</td>
              </tr>
              <tr>
                <td class="bg-light">Bonus</td>
                <td>-</td>
                <td class="bg-light">Other Debits</td>
                <td>-</td>
              </tr>
              <tr>
                <td class="bg-light">O.T @ 1.25</td>
                <td>${getValueOrDash(payrun.OT1Amount)} (${getValueOrDash(payrun.OT1Hours)})</td>
                <td class="bg-light">Production Loss</td>
                <td>-</td>
              </tr>
              <tr>
                <td class="bg-light">O.T @ 1.75</td>
                <td>${getValueOrDash(payrun.OT2Amount)} (${getValueOrDash(payrun.OT2Hours)})</td>
                <td class="bg-light">-</td>
                <td>-</td>
              </tr>
              <tr class="total">
                <td class="bg-light">Salary Gross</td>
                <td>${getValueOrDash(payrun.salary)}</td>
                <td>Total Deductions -B</td>
                <td>${getValueOrDash(calculateTotalDeductions(payrun))}</td>
              </tr>
              <tr class="total">
                <td colspan="3">Salary Net - A-B</td>
                <td>${getValueOrDash(payrun.salary)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </body>
  </html>
  `;
}

module.exports = {
  createPayroll,
  processPayrollFromAttendance,
  getAllPayrolls,
  getPayrollByEmployeeId,
  updatePayrollByEmployeeId,
  updateMultiplePayrolls,
  deletePayrollByEmployeeId,
  getPayrollByMonth,
  createMissingEmployeeRecords,
  createOrUpdatePayrollForEmployee,
  sendPayslipEmail,
  sendBulkPayslipEmails,
  getEmailResults,
};