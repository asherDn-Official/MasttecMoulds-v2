const Payroll = require("../Models/PayRollModel");
const Employee = require("../Models/EmployeeModel");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");
const nodemailer = require("nodemailer");
const htmlToPdf = require("html-pdf");
const payrollService = require("../services/payrollService");
const attendanceService = require("../services/attendanceService");
const EmailResult =require("../Models/PayrollEmailResponse")

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
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Create a new payroll record
exports.createPayroll = async (req, res) => {
  try {
    const { employeeId, payrunData } = req.body;

    if (!employeeId || !payrunData) {
      return res.status(400).json({
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

    res.status(201).json({
      success: true,
      message: "Payroll record created successfully",
      data: payrollRecord,
    });
  } catch (error) {
    console.error("Error creating payroll record:", error);
    res.status(500).json({
      success: false,
      message: "Error creating payroll record",
      error: error.message,
    });
  }
};

// Process payroll from attendance data
exports.processPayrollFromAttendance = async (req, res) => {
  try {
    const { periodFrom, periodTo } = req.body;

    if (!periodFrom || !periodTo) {
      return res.status(400).json({
        success: false,
        message: "Period from and to dates are required",
      });
    }

    const result = await payrollService.processPayrollForPeriod(
      periodFrom,
      periodTo
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || "Failed to process payroll",
        errors: result.errors,
      });
    }

    res.status(200).json({
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
    res.status(500).json({
      success: false,
      message: "Error processing payroll from attendance",
      error: error.message,
    });
  }
};

// Get all payroll records
exports.getAllPayrolls = async (req, res) => {
  try {
    console.log("getAllPayrolls endpoint called");
    const payrolls = await payrollService.getAllPayrolls();
    console.log(`Found ${payrolls.length} payroll records`);

    res.status(200).json({
      success: true,
      count: payrolls.length,
      data: payrolls,
      message: `Retrieved ${payrolls.length} payroll records successfully`,
    });
  } catch (error) {
    console.error("Error retrieving payroll records:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving payroll records",
      error: error.message,
    });
  }
};

// Get a specific payroll record by employee ID
exports.getPayrollByEmployeeId = async (req, res) => {
  const { employeeId } = req.params;

  try {
    const payroll = await payrollService.getPayrollByEmployeeId(employeeId);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: `Payroll record not found for employee ${employeeId}`,
      });
    }

    res.status(200).json({
      success: true,
      data: payroll,
    });
  } catch (error) {
    console.error(
      `Error retrieving payroll for employee ${employeeId}:`,
      error
    );
    res.status(500).json({
      success: false,
      message: "Error retrieving payroll record",
      error: error.message,
    });
  }
};

// Update a payroll record by employee ID
exports.updatePayrollByEmployeeId = async (req, res) => {
  const { employeeId } = req.params;
  const updateData = req.body;

  try {
    const updatedPayroll = await payrollService.updatePayrollByEmployeeId(
      employeeId,
      updateData
    );

    res.status(200).json({
      success: true,
      message: "Payroll record updated successfully",
      data: updatedPayroll,
    });
  } catch (error) {
    console.error(`Error updating payroll for employee ${employeeId}:`, error);
    res.status(500).json({
      success: false,
      message: "Error updating payroll record",
      error: error.message,
    });
  }
};

exports.updateMultiplePayrolls = async (req, res) => {
  const updates = req.body; // Expecting an array of { employeeId, updateData }

  if (!Array.isArray(updates)) {
    return res.status(400).json({
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

    res.status(200).json({
      success: true,
      message: "Batch payroll update completed",
      results,
    });
  } catch (error) {
    console.error("Error processing batch payroll update:", error);
    res.status(500).json({
      success: false,
      message: "Error processing batch payroll update",
      error: error.message,
    });
  }
};

// Delete a payroll record by employee ID
exports.deletePayrollByEmployeeId = async (req, res) => {
  const { employeeId } = req.params;

  try {
    const deletedPayroll = await payrollService.deletePayrollByEmployeeId(
      employeeId
    );

    if (!deletedPayroll) {
      return res.status(404).json({
        success: false,
        message: `Payroll record not found for employee ${employeeId}`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Payroll record deleted successfully",
      data: deletedPayroll,
    });
  } catch (error) {
    console.error(`Error deleting payroll for employee ${employeeId}:`, error);
    res.status(500).json({
      success: false,
      message: "Error deleting payroll record",
      error: error.message,
    });
  }
};

// Get payroll records by month and year
exports.getPayrollByMonth = async (req, res) => {
  const { month, year } = req.params;

  try {
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required",
      });
    }

    const payrolls = await payrollService.getPayrollWithEmployeeDetailsByMonth(
      month,
      year
    );

    res.status(200).json({
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
    res.status(500).json({
      success: false,
      message: "Error retrieving payroll records",
      error: error.message,
    });
  }
};

// Create basic employee records for missing employees found in attendance
exports.createMissingEmployeeRecords = async (req, res) => {
  try {
    const { employeeIds } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds)) {
      return res.status(400).json({
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
          // Other fields will have default values or empty strings
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

    res.status(200).json({
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
    res.status(500).json({
      success: false,
      message: "Error creating missing employee records",
      error: error.message,
    });
  }
};

// Create or update payroll with employee and attendance data integration
exports.createOrUpdatePayrollForEmployee = async (req, res) => {
  try {
    const { employeeId, salaryMonth, salaryYear, payrunData } = req.body;

    if (!employeeId || !salaryMonth || !salaryYear) {
      return res.status(400).json({
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
        const updateData = {
          payrunIndex: existingPayrunIndex,
          payrunData: {
            ...payrunData,
            salaryMonth,
            salaryYear,
          },
        };

        const updatedPayroll = await payrollService.updatePayrollByEmployeeId(
          employeeId,
          updateData
        );

        return res.status(200).json({
          success: true,
          message: "Payroll record updated successfully",
          data: updatedPayroll,
        });
      } else {
        // Add new payrun to existing record
        const updateData = {
          payrunData: {
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
          },
        };

        const updatedPayroll = await payrollService.updatePayrollByEmployeeId(
          employeeId,
          updateData
        );

        return res.status(201).json({
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

      return res.status(201).json({
        success: true,
        message: "Payroll record created successfully",
        data: newPayroll,
      });
    }
  } catch (error) {
    console.error("Error creating/updating payroll record:", error);
    res.status(500).json({
      success: false,
      message: "Error creating/updating payroll record",
      error: error.message,
    });
  }
};

// Test payroll creation with specific attendance record
// exports.testPayrollWithAttendance = async (req, res) => {
//   try {
//     const { employeeId } = req.params;
//     const AttendanceRecord = require("../Models/AttendanceRecord");

//     if (!employeeId) {
//       return res.status(400).json({
//         success: false,
//         message: "Employee ID is required",
//       });
//     }

//     // Find attendance record for this employee
//     const attendanceRecord = await AttendanceRecord.findOne({ employeeId });

//     if (!attendanceRecord) {
//       return res.status(404).json({
//         success: false,
//         message: `No attendance record found for employee ID: ${employeeId}`,
//       });
//     }

//     console.log(`Testing payroll creation for employee: ${attendanceRecord.employeeName} (ID: ${employeeId})`);

//     // Test payroll creation
//     const payrollResult = await payrollService.createOrUpdatePayrollFromAttendance(attendanceRecord);

//     if (payrollResult.error) {
//       return res.status(500).json({
//         success: false,
//         message: "Error creating payroll from attendance",
//         error: payrollResult.message,
//         details: payrollResult.details
//       });
//     }

//     // Also check if employee record was created
//     const employeeRecord = await Employee.findOne({ employeeId });

//     res.status(200).json({
//       success: true,
//       message: `Payroll test completed for employee ${employeeId}`,
//       data: {
//         attendanceRecord: {
//           employeeId: attendanceRecord.employeeId,
//           employeeName: attendanceRecord.employeeName,
//           period: `${attendanceRecord.reportPeriodFrom} to ${attendanceRecord.reportPeriodTo}`,
//           presentDays: attendanceRecord.monthlySummary.presentDays,
//           absentDays: attendanceRecord.monthlySummary.absentDays
//         },
//         payrollRecord: payrollResult,
//         employeeRecord: employeeRecord ? {
//           employeeId: employeeRecord.employeeId,
//           employeeName: employeeRecord.employeeName,
//           salary: employeeRecord.salary,
//           epf: employeeRecord.epf,
//           esic: employeeRecord.esic,
//           wasCreated: true
//         } : null
//       }
//     });

//   } catch (error) {
//     console.error("Error in payroll test:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error testing payroll creation",
//       error: error.message,
//     });
//   }
// };

// Send payslip via email
// ✅ HTML → PDF buffer
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

// ✅ Controller
exports.sendPayslipEmail = async (req, res) => {
  try {
    const { salaryMonth, salaryYear } = req.body;
    const { employeeId } = req.params;

    if (!employeeId || !salaryMonth || !salaryYear) {
      return res.status(400).json({
        success: false,
        message: "Employee ID, salary month, and salary year are required",
      });
    }

    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee not found with ID: ${employeeId}`,
      });
    }

    if (!employee.mailId || employee.mailId.trim() === "") {
      return res.status(400).json({
        success: false,
        message: `Email address not found for employee: ${employee.employeeName}`,
      });
    }

    const payroll = await Payroll.findOne({ employeeId });
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: `Payroll record not found for employee: ${employee.employeeName}`,
      });
    }

    const payrun = payroll.payrunHistory.find(
      (p) => p.salaryMonth === salaryMonth && p.salaryYear === salaryYear
    );

    if (!payrun) {
      return res.status(404).json({
        success: false,
        message: `Payroll record not found for ${salaryMonth}/${salaryYear}`,
      });
    }

    // ✅ HTML
    const payslipHTML = createPayslipHTML(employee, payrun);
    
    // ✅ PDF
    const pdfBuffer = await generatePDFBufferFromHTML(payslipHTML);

    // ✅ Email Setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER || "gangadharana01@gmail.com",
        pass: process.env.EMAIL_PASS || "moutcnnagdjyuobq",
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || "gangadharana01@gmail.com",
      to: employee.mailId, // change to dynamic
      subject: `Payslip for ${getMonthName(salaryMonth)} ${salaryYear} - ${employee.employeeName}`,
      text: `Dear ${employee.employeeName},\n\nPlease find attached your payslip for ${getMonthName(salaryMonth)} ${salaryYear}.\n\nRegards,\nMassetec HR`,
      attachments: [
        {
          filename: `Payslip_${employee.employeeName}_${salaryMonth}_${salaryYear}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    // ✅ Send Email
    await transporter.sendMail(mailOptions);

    res.status(200).json({
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
    res.status(500).json({
      success: false,
      message: "Error sending payslip email",
      error: error.message,
    });
  }
};

// Send payslips to multiple employees
exports.sendBulkPayslipEmails = async (req, res) => {
  try {
    const { employeeIds, salaryMonth, salaryYear } = req.body;

    // Validate required fields
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee IDs array is required",
      });
    }

    if (!salaryMonth || !salaryYear) {
      return res.status(400).json({
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
    const emailResult = new EmailResult(results);
    await emailResult.save();
    res.status(200).json({
      success: true,
      message: `Bulk payslip sending completed. Sent: ${results.successful.length}, Failed: ${results.failed.length}`,
      data: results,
    });
  } catch (error) {
    console.error("Error sending bulk payslip emails:", error);
    res.status(500).json({
      success: false,
      message: "Error sending bulk payslip emails",
      error: error.message,
    });
  }
};

// In your controller file// In PayRollController.js
exports.getEmailResults = async (req, res) => {
  try {
    console.log("getEmailResults endpoint called");
    // Fetch email results from the database or service
    const emailResults = await EmailResult.find(); // Assuming EmailResult is a model
    res.status(200).json({
      success: true,
      data: emailResults,
      message: "Email results retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving email results:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving email results",
      error: error.message,
    });
  }
};


// Helper function to create payslip HTML template
function createPayslipHTML(employee, payrun) {
    const getValueOrDash = (value) =>
      value !== undefined && value !== null && value !== "" ? value : "-";
  const monthName = getMonthName(payrun.salaryMonth);

  // return `
  //   <!DOCTYPE html>
  //   <html>
  //   <head>
  //     <meta charset="utf-8">
  //     <title>Payslip - ${employee.employeeName}</title>
  //     <style>
  //       body {
  //         font-family: Arial, sans-serif;
  //         margin: 0;
  //         padding: 20px;
  //         background-color: #f5f5f5;
  //       }
  //       .payslip-container {
  //         background-color: white;
  //         max-width: 800px;
  //         margin: 0 auto;
  //         padding: 30px;
  //         border-radius: 8px;
  //         box-shadow: 0 0 10px rgba(0,0,0,0.1);
  //       }
  //       .header {
  //         text-align: center;
  //         border-bottom: 2px solid #333;
  //         padding-bottom: 20px;
  //         margin-bottom: 30px;
  //       }
  //       .company-name {
  //         font-size: 24px;
  //         font-weight: bold;
  //         color: #333;
  //         margin-bottom: 5px;
  //       }
  //       .logo {
  //         max-width: 150px;
  //         margin-bottom: 10px;
  //       }
  //       .payslip-title {
  //         font-size: 18px;
  //         color: #666;
  //         margin-bottom: 10px;
  //       }
  //       .period {
  //         font-size: 16px;
  //         color: #333;
  //         font-weight: bold;
  //       }
  //       .employee-info {
  //         display: flex;
  //         justify-content: space-between;
  //         margin-bottom: 30px;
  //         background-color: #f9f9f9;
  //         padding: 20px;
  //         border-radius: 5px;
  //       }
  //       .employee-details {
  //         flex: 1;
  //       }
  //       .detail-row {
  //         margin-bottom: 8px;
  //       }
  //       .label {
  //         font-weight: bold;
  //         display: inline-block;
  //         width: 120px;
  //       }
  //       .payslip-table {
  //         width: 100%;
  //         border-collapse: collapse;
  //         margin-bottom: 20px;
  //       }
  //       .payslip-table th,
  //       .payslip-table td {
  //         border: 1px solid #ddd;
  //         padding: 12px;
  //         text-align: left;
  //       }
  //       .payslip-table th {
  //         background-color: #f2f2f2;
  //         font-weight: bold;
  //       }
  //       .earnings {
  //         background-color: #e8f5e8;
  //       }
  //       .deductions {
  //         background-color: #ffe8e8;
  //       }
  //       .total-row {
  //         background-color: #333;
  //         color: white;
  //         font-weight: bold;
  //       }
  //       .net-salary {
  //         background-color: #4CAF50;
  //         color: white;
  //         font-size: 18px;
  //         font-weight: bold;
  //         text-align: center;
  //       }
  //       .footer {
  //         text-align: center;
  //         margin-top: 40px;
  //         padding-top: 20px;
  //         border-top: 1px solid #ddd;
  //         color: #666;
  //         font-size: 12px;
  //       }
  //       .amount {
  //         text-align: right;
  //         font-weight: bold;
  //       }
  //     </style>
  //   </head>
  //   <body>
  //     <div class="payslip-container">
  //        <div class="header">
  //         <img src="${logo}" alt="Company Logo" class="logo" />
  //         <div class="company-name">Massetec Technology Solutions</div>
  //         <div class="payslip-title">SALARY SLIP</div>
  //         <div class="period">For the month of ${monthName} ${payrun.salaryYear}</div>
  //       </div>

  //       <div class="employee-info">
  //         <div class="employee-details">
  //           <div class="detail-row">
  //             <span class="label">Employee ID:</span>
  //             <span>${employee.employeeId}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Employee Name:</span>
  //             <span>${employee.employeeName}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Date of Birth:</span>
  //             <span>${employee.dateOfBirth ? formatDate(employee.dateOfBirth) : "N/A"}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Qualification:</span>
  //             <span>${employee.qualification || "N/A"}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Blood Group:</span>
  //             <span>${employee.bloodGroup || "N/A"}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Mobile Number:</span>
  //             <span>${employee.mobileNumber || "N/A"}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Email ID:</span>
  //             <span>${employee.mailId || "N/A"}</span>
  //           </div>
  //         </div>
  //         <div class="employee-details">
  //           <div class="detail-row">
  //             <span class="label">Address:</span>
  //             <span>${employee.address || "N/A"}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Bank Account:</span>
  //             <span>${employee.bankAccountNumber || "N/A"}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Bank IFSC:</span>
  //             <span>${employee.bankIFSCCode || "N/A"}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">PAN Number:</span>
  //             <span>${employee.PANNumber || "N/A"}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Designation:</span>
  //             <span>${employee.designation || "N/A"}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Days Present:</span>
  //             <span>${payrun.present}</span>
  //           </div>
  //           <div class="detail-row">
  //             <span class="label">Days Absent:</span>
  //             <span>${payrun.absent}</span>
  //           </div>
  //         </div>
  //       </div>

  //       <table class="payslip-table">
  //         <thead>
  //           <tr>
  //             <th style="width: 50%;">EARNINGS</th>
  //             <th style="width: 25%;">AMOUNT (₹)</th>
  //             <th style="width: 25%;">DEDUCTIONS</th>
  //             <th style="width: 25%;">AMOUNT (₹)</th>
  //           </tr>
  //         </thead>
  //         <tbody>
  //           <tr>
  //             <td>Basic Salary</td>
  //             <td class="amount">₹${parseFloat(payrun.basic || 0).toFixed(
  //               2
  //             )}</td>
  //             <td>EPF</td>
  //             <td class="amount">₹${parseFloat(payrun.EPF || 0).toFixed(2)}</td>
  //           </tr>
  //           <tr>
  //             <td>House Rent Allowance</td>
  //             <td class="amount">₹${parseFloat(payrun.houseRent || 0).toFixed(
  //               2
  //             )}</td>
  //             <td>ESIC</td>
  //             <td class="amount">₹${parseFloat(payrun.ESIC || 0).toFixed(
  //               2
  //             )}</td>
  //           </tr>
  //           <tr>
  //             <td>HRA</td>
  //             <td class="amount">₹${parseFloat(payrun.hra || 0).toFixed(
  //               2
  //             )}</td>
  //             <td>Late Hours (${payrun.totalLateHours || 0} hrs)</td>
  //             <td class="amount">-</td>
  //           </tr>
  //           <tr>
  //             <td>Incentives</td>
  //             <td class="amount">₹${parseFloat(payrun.incentives || 0).toFixed(
  //               2
  //             )}</td>
  //             <td>Advance</td>
  //             <td class="amount">₹${parseFloat(payrun.advance || 0).toFixed(
  //               2
  //             )}</td>
  //           </tr>
  //           <tr>
  //             <td>Allowances</td>
  //             <td class="amount">₹${parseFloat(payrun.allowances || 0).toFixed(
  //               2
  //             )}</td>
  //             <td>Payment Loss</td>
  //             <td class="amount">₹${parseFloat(
  //               payrun.paymentLossAmount || 0
  //             ).toFixed(2)}</td>
  //           </tr>
  //           <tr>
  //             <td>OT1 Payment (${payrun.OT1Hours || 0} hrs)</td>
  //             <td class="amount">₹${parseFloat(payrun.OT1Amount || 0).toFixed(
  //               2
  //             )}</td>
  //             <td></td>
  //             <td class="amount"></td>
  //           </tr>
  //           <tr>
  //             <td>OT2 Payment (${payrun.OT2Hours || 0} hrs)</td>
  //             <td class="amount">₹${parseFloat(payrun.OT2Amount || 0).toFixed(
  //               2
  //             )}</td>
  //             <td></td>
  //             <td class="amount"></td>
  //           </tr>
  //           <tr class="total-row">
  //             <td>TOTAL EARNINGS</td>
  //             <td class="amount">₹${calculateTotalEarnings(payrun).toFixed(
  //               2
  //             )}</td>
  //             <td>TOTAL DEDUCTIONS</td>
  //             <td class="amount">₹${calculateTotalDeductions(payrun).toFixed(
  //               2
  //             )}</td>
  //           </tr>
  //           <tr class="net-salary">
  //             <td colspan="2">NET SALARY</td>
  //             <td colspan="2" class="amount">₹${parseFloat(
  //               payrun.salary || 0
  //             ).toFixed(2)}</td>
  //           </tr>
  //         </tbody>
  //       </table>

  //       <div class="footer">
  //         <p>This is a computer-generated payslip and does not require a signature.</p>
  //         <p>Generated on: ${formatDate(new Date().toISOString())}</p>
  //       </div>
  //     </div>
  //   </body>
  //   </html>
  // `;
  return `
  <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pay Slip - October 2024</title>
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
      table,
      th,
      td {
        border: 1px solid #ddd;
      }
      th,
      td {
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
      <div class="header" >
        <div class="logo" style="float: left;">
          <!-- <h1>MASTEC MOULDS</h1> -->
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
        <h2 style="float: right;">Pay Slip - ${monthName} 20
        24</h2>
        <!-- <p>Pay Date: ${monthName}</p> -->
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
            <td>${
              employee?.bankAccountNumber
            }  </td>  //not found
          </tr>
          <tr>
            <th>Department</th>
            <td>${employee?.department}</td>
            <th>Bank & Branch</th>
            <td> ${employee?.bankName}/${
      employee?.bankBranch
    }</td> 
          </tr>
          <tr>
            <th>Date of Joining</th>
            <td> ${employee?.doj}</td>  //not found
            <th>IFSC Code</th>
            <td>${employee?.bankIFSCCode}</td> 
          </tr>
          <tr>
            <th>Increment on Salary</th>
            <td> N/A </td>        //not needed
            <th>EPF Member ID</th>  
            <td> ${parseFloat(payrun.EPF || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <th>Payable Days</th>  
            <td>${payrun.present}</td>
            <th>UAN No.</th>
            <td>${employee?.UANNo || "N/A"}</td>
          </tr>

          <tr>
            <th>Per Day Salary</th>
            <td>${(employee.salary/(30)).toFixed(2)}</td>   
            <th>ESIC No</th>
            <td> ${parseFloat(payrun.ESIC || 0)}</td>
          </tr>

          <tr>
            <th>1 Hour salary</th>
            <td>${(employee.salary/(30)).toFixed(2)}</td>   
            <th>PAN NO</th>  
            <td>${employee.PANNumber}</td>
          </tr>

          <tr>
            <th>Leave/Absent</th>
            <td>${payrun.present}</td>
            <th>Emploement ID</th>
            <td>${employee.employeeId}</td>
          </tr>

          <tr>
            <th>Mobile number</th>
            <td>${employee.mobileNumber || "N/A"}</td>
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
              <td>968</td>
            </tr>
            <tr>
              <td class="bg-light">Incentive</td>
              <td>${parseFloat(payrun.incentives || 0).toFixed(2)}</td>
              <td class="bg-light">EPF</td>
              <td>${payrun.EPF || "N/A"}</td>
            </tr>
            <tr>
              <td class="bg-light">Allowances</td>s
              <td>${parseFloat(payrun.allowances || 0).toFixed(2)}</td>
              <td class="bg-light">ESIC</td>
              <td>${parseFloat(payrun.ESICID || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td class="bg-light">HRA</td>
              <td>${parseFloat(payrun.houseRent || 0).toFixed(2)}</td>
              <td class="bg-light">Advance</td>
              <td>${parseFloat(payrun.advance || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td class="bg-light">Others</td>  - not neeeded
              <td>0</td> 
              <td class="bg-light">TDS Debits</td>  - not needed
              <td>-</td>
            </tr>
            <tr>
              <td class="bg-light">Bonus</td>   -needed
              <td>-</td>
              <td class="bg-light">Other Debits</td>  - not needed
              <td>-</td>
            </tr>

            <tr>
              <td class="bg-light">O.T @ 1.25</td>
              <td> 
              ${getValueOrDash(
               payrun?.OT1Amount
              )}(${getValueOrDash(payrun.OT1Hours )}) </td>
              <td class="bg-light">Production Loss</td>  // not needed
              <td>-</td>
            </tr>
            <tr>
              <td class="bg-light">O.T @ 1.75</td>
              <td>${getValueOrDash(payrun.OT2Amount)} (${getValueOrDash(
      payrun.OT2Hours)
    })</td>
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
              <td>${getValueOrDash(payrun.salary )}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </body>
</html>
  `
}

// Helper function to get month name
function getMonthName(monthNumber) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[parseInt(monthNumber) - 1] || "Unknown";
}

// Helper function to calculate total earnings
function calculateTotalEarnings(payrun) {
  return (
    parseFloat(payrun.basic || 0) +
    parseFloat(payrun.houseRent || 0) +
    parseFloat(payrun.hra || 0) +
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
