const AttendanceRecord = require("../models/AttendanceRecord");
const Employee = require("../models/Employee");
const csvExcelExtractor = require("./csvExcelExtractor");
const payrollService = require("./payrollService");

class AttendanceService {
  async extractAndSaveAttendanceData(filePath, fileName = "") {
    try {
      console.log(`Starting PDF extraction from: ${filePath}`);

      // Extract text from PDF
      const extractedText = await pdfExtractor.extractTextFromPdf(filePath);
      if (!extractedText) {
        throw new Error("Failed to extract text from PDF");
      }

      // Parse attendance data
      const parsedData = pdfExtractor.parseAttendanceData(extractedText);
      if (!parsedData.employees || parsedData.employees.length === 0) {
        throw new Error("No employee data found in PDF");
      }

      console.log(`Found ${parsedData.employees.length} employees in the PDF`);

      // Save each employee's data to MongoDB
      const savedRecords = [];
      for (const employee of parsedData.employees) {
        const attendanceRecord = new AttendanceRecord({
          reportOverallDate: parsedData.reportOverallDate,
          reportPeriodFrom: parsedData.reportPeriodFrom,
          reportPeriodTo: parsedData.reportPeriodTo,
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department,
          designation: employee.designation,
          category: employee.category,
          branch: employee.branch,
          dailyAttendance: employee.attendance,
          monthlySummary: employee.summary,
          pdfFileName: fileName,
        });

        // Check if record already exists
        const existingRecord = await AttendanceRecord.findOne({
          employeeId: employee.id,
          reportPeriodFrom: parsedData.reportPeriodFrom,
          reportPeriodTo: parsedData.reportPeriodTo,
        });

        if (existingRecord) {
          console.log(`Updating existing record for employee ${employee.id}`);
          Object.assign(existingRecord, attendanceRecord.toObject());
          existingRecord.extractedAt = new Date();
          await existingRecord.save();
          savedRecords.push(existingRecord);
        } else {
          console.log(`Creating new record for employee ${employee.id}`);
          const savedRecord = await attendanceRecord.save();
          savedRecords.push(savedRecord);
        }

        // Generate payroll data from attendance record
        try {
          await payrollService.createOrUpdatePayrollFromAttendance(
            existingRecord || savedRecords[savedRecords.length - 1]
          );
          console.log(`Generated payroll data for employee ${employee.id}`);
        } catch (payrollError) {
          console.error(
            `Error generating payroll for employee ${employee.id}:`,
            payrollError
          );
          // Continue processing other employees even if payroll generation fails for one
        }
      }

      return {
        success: true,
        message: `Successfully processed ${savedRecords.length} employee records`,
        data: {
          reportPeriod: `${parsedData.reportPeriodFrom} to ${parsedData.reportPeriodTo}`,
          employeesProcessed: savedRecords.length,
          recordIds: savedRecords.map((record) => record._id),
        },
      };
    } catch (error) {
      console.error("Error in extractAndSaveAttendanceData:", error);
      throw error;
    }
  }

  async processAndSaveCSVExcelData(attendanceData, dateHeaders, reportPeriod) {
    try {
      console.log(
        `Processing CSV/Excel data for ${attendanceData.length} employees`
      );
      console.log("=== CSV/EXCEL PROCESSING STARTED ===");
      console.log(
        "Input attendanceData sample:",
        attendanceData && attendanceData[0]
          ? {
              number: attendanceData[0].number,
              name: attendanceData[0].name,
              detailsCount: attendanceData[0].details
                ? attendanceData[0].details.length
                : 0,
              summary: attendanceData[0].summary,
            }
          : "No data"
      );
      console.log("Date headers:", dateHeaders);
      console.log("Report period:", reportPeriod);
      // First, create missing employees
      const createdEmployees = await this.createMissingEmployees(
        attendanceData
      );

      // Process the data using the CSV/Excel extractor
      const parsedData = csvExcelExtractor.processAttendanceData(
        attendanceData,
        dateHeaders,
        reportPeriod
      );

      if (!parsedData.employees || parsedData.employees.length === 0) {
        throw new Error("No employee data found in processed data");
      }

      console.log(
        `Found ${parsedData.employees.length} employees in the processed data`
      );

      // Save each employee's data to MongoDB
      const savedRecords = [];
      for (const employee of parsedData.employees) {
        const attendanceRecord = new AttendanceRecord({
          reportOverallDate: parsedData.reportOverallDate,
          reportPeriodFrom: parsedData.reportPeriodFrom,
          reportPeriodTo: parsedData.reportPeriodTo,
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department,
          designation: employee.designation,
          category: employee.category,
          branch: employee.branch,
          dailyAttendance: employee.attendance,
          monthlySummary: employee.summary,
          pdfFileName: "CSV_Excel_Upload",
        });

        // Check if record already exists
        const existingRecord = await AttendanceRecord.findOne({
          employeeId: employee.id,
          reportPeriodFrom: parsedData.reportPeriodFrom,
          reportPeriodTo: parsedData.reportPeriodTo,
        });

        if (existingRecord) {
          console.log(`Updating existing record for employee ${employee.id}`);
          Object.assign(existingRecord, attendanceRecord.toObject());
          existingRecord.extractedAt = new Date();
          await existingRecord.save();
          savedRecords.push(existingRecord);
        } else {
          console.log(`Creating new record for employee ${employee.id}`);
          const savedRecord = await attendanceRecord.save();
          savedRecords.push(savedRecord);
        }

        // Generate payroll data from attendance record
        try {
          await payrollService.createOrUpdatePayrollFromAttendance(
            existingRecord || savedRecords[savedRecords.length - 1]
          );
          console.log(`Generated payroll data for employee ${employee.id}`);
        } catch (payrollError) {
          console.error(
            `Error generating payroll for employee ${employee.id}:`,
            payrollError
          );
          // Continue processing other employees even if payroll generation fails for one
        }
      }

      return {
        success: true,
        message: `Successfully processed ${savedRecords.length} employee records from CSV/Excel`,
        data: {
          reportPeriod: `${parsedData.reportPeriodFrom} to ${parsedData.reportPeriodTo}`,
          employeesProcessed: savedRecords.length,
          recordIds: savedRecords.map((record) => record._id),
          employeesCreated: createdEmployees.length,
        },
      };
    } catch (error) {
      console.error("Error in processAndSaveCSVExcelData:", error);
      throw error;
    }
  }

  async createMissingEmployees(attendanceData) {
    const createdEmployees = [];

    for (const employeeData of attendanceData) {
      const employeeId = employeeData.number;
      const employeeName = employeeData.name;

      try {
        // Check if employee already exists
        const existingEmployee = await Employee.findOne({ employeeId });

        if (!existingEmployee) {
          // Create basic employee record
          const newEmployee = new Employee({
            employeeId: employeeId,
            employeeName: employeeName,
            salary: 0,
            esic: 0,
            status: true,
            mailId: `${employeeId}@temp.com`, // Temporary unique mailId
            // Other fields will have default values or empty strings
          });

          await newEmployee.save();
          createdEmployees.push({ employeeId, employeeName });
          console.log(`Created basic employee record for ID: ${employeeId}`);
        }
      } catch (error) {
        console.error(
          `Error creating employee record for ID ${employeeId}:`,
          error
        );
        // Continue with other employees
      }
    }

    return createdEmployees;
  }

  async getEmployeeAttendance(employeeId, periodFrom = null, periodTo = null) {
    try {
      const query = { employeeId };

      if (periodFrom && periodTo) {
        query.reportPeriodFrom = periodFrom;
        query.reportPeriodTo = periodTo;
      }

      const records = await AttendanceRecord.find(query).sort({
        reportPeriodFrom: -1,
      });
      return records;
    } catch (error) {
      console.error("Error fetching employee attendance:", error);
      throw error;
    }
  }

  async getAllEmployeesAttendance(periodFrom = null, periodTo = null) {
    try {
      const query = {};

      if (periodFrom && periodTo) {
        query.reportPeriodFrom = periodFrom;
        query.reportPeriodTo = periodTo;
      }

      const records = await AttendanceRecord.find(query).sort({
        employeeId: 1,
        reportPeriodFrom: -1,
      });
      return records;
    } catch (error) {
      console.error("Error fetching all employees attendance:", error);
      throw error;
    }
  }

  async getAttendanceByDateRange(startDate, endDate) {
    try {
      const records = await AttendanceRecord.find({
        $or: [
          { reportPeriodFrom: { $gte: startDate, $lte: endDate } },
          { reportPeriodTo: { $gte: startDate, $lte: endDate } },
        ],
      }).sort({ employeeId: 1, reportPeriodFrom: -1 });

      return records;
    } catch (error) {
      console.error("Error fetching attendance by date range:", error);
      throw error;
    }
  }
  async getAllEmployeeDateAttendance(date) {
    try {
      // Use an aggregation pipeline for a more robust and efficient query
      const attendanceForDate = await AttendanceRecord.aggregate([
        // Stage 1: Find documents where the date is within the report period
        {
          $match: {
            reportPeriodFrom: { $lte: date },
            reportPeriodTo: { $gte: date },
          },
        },
        // Stage 2: Deconstruct the dailyAttendance array
        { $unwind: "$dailyAttendance" },
        // Stage 3: Filter for the specific date
        { $match: { "dailyAttendance.date": date } },
        // Stage 4: Project the desired output format
        {
          $project: {
            _id: 1, // keep parent doc ID
            employeeId: 1,
            employeeName: 1,
            department: 1,
            designation: 1,
            category: 1,
            branch: 1,
            reportOverallDate: 1,
            reportPeriodFrom: 1,
            reportPeriodTo: 1,
            pdfFileName: 1,
            extractedAt: 1,

            // only keep the matched dailyAttendance subdoc
            dailyAttendance: [
              {
                _id: "$dailyAttendance._id",
                date: "$dailyAttendance.date",
                status: "$dailyAttendance.status",
                shift: "$dailyAttendance.shift",
                timeIn: "$dailyAttendance.timeIn",
                timeOut: "$dailyAttendance.timeOut",
                workedHrs: "$dailyAttendance.workedHrs",
                late: "$dailyAttendance.late",
                earlyOut: "$dailyAttendance.earlyOut",
                ot1: "$dailyAttendance.ot1",
                ot2: "$dailyAttendance.ot2",
              },
            ],
          },
        },
      ]);

      return attendanceForDate;
    } catch (error) {
      console.error("Error fetching all employees daily attendance:", error);
      throw error;
    }
  }
  async getEmployeeDailyAttendance(employeeId, date) {
    try {
      const records = await AttendanceRecord.find({
        employeeId,
        "dailyAttendance.date": date,
      });

      const dailyRecords = [];
      records.forEach((record) => {
        const dailyRecord = record.dailyAttendance.find(
          (day) => day.date === date
        );
        if (dailyRecord) {
          dailyRecords.push({
            employeeId: record.employeeId,
            employeeName: record.employeeName,
            department: record.department,
            designation: record.designation,
            date: dailyRecord.date,
            status: dailyRecord.status,
            shift: dailyRecord.shift,
            timeIn: dailyRecord.timeIn,
            timeOut: dailyRecord.timeOut,
            workedHrs: dailyRecord.workedHrs,
            late: dailyRecord.late,
            earlyOut: dailyRecord.earlyOut,
            ot1: dailyRecord.ot1,
            ot2: dailyRecord.ot2,
          });
        }
      });

      return dailyRecords;
    } catch (error) {
      console.error("Error fetching daily attendance:", error);
      throw error;
    }
  }

  async getAttendanceSummary(
    employeeId = null,
    periodFrom = null,
    periodTo = null
  ) {
    try {
      const query = {};

      if (employeeId) query.employeeId = employeeId;
      if (periodFrom && periodTo) {
        query.reportPeriodFrom = periodFrom;
        query.reportPeriodTo = periodTo;
      }

      const records = await AttendanceRecord.find(query);

      return records.map((record) => ({
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        department: record.department,
        designation: record.designation,
        reportPeriod: `${record.reportPeriodFrom} to ${record.reportPeriodTo}`,
        summary: record.monthlySummary,
      }));
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
      throw error;
    }
  }

  async deleteAttendanceRecord(recordId) {
    try {
      const deletedRecord = await AttendanceRecord.findByIdAndDelete(recordId);
      return deletedRecord;
    } catch (error) {
      console.error("Error deleting attendance record:", error);
      throw error;
    }
  }

  async getAttendanceStats() {
    try {
      const totalRecords = await AttendanceRecord.countDocuments();
      const uniqueEmployees = await AttendanceRecord.distinct("employeeId");
      const latestRecord = await AttendanceRecord.findOne().sort({
        extractedAt: -1,
      });

      return {
        totalRecords,
        uniqueEmployees: uniqueEmployees.length,
        latestExtraction: latestRecord ? latestRecord.extractedAt : null,
        latestPeriod: latestRecord
          ? `${latestRecord.reportPeriodFrom} to ${latestRecord.reportPeriodTo}`
          : null,
      };
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
      throw error;
    }
  }
}

module.exports = new AttendanceService();
