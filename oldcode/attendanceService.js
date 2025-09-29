const AttendanceRecord = require('../Models/AttendanceRecord');
const pdfExtractor = require('./pdfExtractor');
const csvExcelExtractor = require('./csvExcelExtractor');
const payrollService = require('./payrollService');

class AttendanceService {
    async extractAndSaveAttendanceData(filePath, fileName = '') {
        try {
            console.log(`Starting PDF extraction from: ${filePath}`);
            
            // Extract text from PDF
            const extractedText = await pdfExtractor.extractTextFromPdf(filePath);
            if (!extractedText) {
                throw new Error('Failed to extract text from PDF');
            }

            // Parse attendance data
            const parsedData = pdfExtractor.parseAttendanceData(extractedText);
            if (!parsedData.employees || parsedData.employees.length === 0) {
                throw new Error('No employee data found in PDF');
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
                    pdfFileName: fileName
                });

                // Check if record already exists
                const existingRecord = await AttendanceRecord.findOne({
                    employeeId: employee.id,
                    reportPeriodFrom: parsedData.reportPeriodFrom,
                    reportPeriodTo: parsedData.reportPeriodTo
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
                    console.error(`Error generating payroll for employee ${employee.id}:`, payrollError);
                    // Continue processing other employees even if payroll generation fails for one
                }
            }

            return {
                success: true,
                message: `Successfully processed ${savedRecords.length} employee records`,
                data: {
                    reportPeriod: `${parsedData.reportPeriodFrom} to ${parsedData.reportPeriodTo}`,
                    employeesProcessed: savedRecords.length,
                    recordIds: savedRecords.map(record => record._id)
                }
            };

        } catch (error) {
            console.error('Error in extractAndSaveAttendanceData:', error);
            throw error;
        }
    }

    async processAndSaveCSVExcelData(attendanceData, dateHeaders, reportPeriod) {
        try {
            console.log(`Processing CSV/Excel data for ${attendanceData.length} employees`);
            
            // Process the data using the CSV/Excel extractor
            const parsedData = csvExcelExtractor.processAttendanceData(attendanceData, dateHeaders, reportPeriod);
            
            if (!parsedData.employees || parsedData.employees.length === 0) {
                throw new Error('No employee data found in processed data');
            }

            console.log(`Found ${parsedData.employees.length} employees in the processed data`);

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
                    pdfFileName: 'CSV_Excel_Upload'
                });

                // Check if record already exists
                const existingRecord = await AttendanceRecord.findOne({
                    employeeId: employee.id,
                    reportPeriodFrom: parsedData.reportPeriodFrom,
                    reportPeriodTo: parsedData.reportPeriodTo
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
                    console.error(`Error generating payroll for employee ${employee.id}:`, payrollError);
                    // Continue processing other employees even if payroll generation fails for one
                }
            }

            return {
                success: true,
                message: `Successfully processed ${savedRecords.length} employee records from CSV/Excel`,
                data: {
                    reportPeriod: `${parsedData.reportPeriodFrom} to ${parsedData.reportPeriodTo}`,
                    employeesProcessed: savedRecords.length,
                    recordIds: savedRecords.map(record => record._id)
                }
            };

        } catch (error) {
            console.error('Error in processAndSaveCSVExcelData:', error);
            throw error;
        }
    }

    async getEmployeeAttendance(employeeId, periodFrom = null, periodTo = null) {
        try {
            const query = { employeeId };
            
            if (periodFrom && periodTo) {
                query.reportPeriodFrom = periodFrom;
                query.reportPeriodTo = periodTo;
            }

            const records = await AttendanceRecord.find(query).sort({ reportPeriodFrom: -1 });
            return records;
        } catch (error) {
            console.error('Error fetching employee attendance:', error);
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

            const records = await AttendanceRecord.find(query)
                .sort({ employeeId: 1, reportPeriodFrom: -1 });
            return records;
        } catch (error) {
            console.error('Error fetching all employees attendance:', error);
            throw error;
        }
    }

    async getAttendanceByDateRange(startDate, endDate) {
        try {
            const records = await AttendanceRecord.find({
                $or: [
                    { reportPeriodFrom: { $gte: startDate, $lte: endDate } },
                    { reportPeriodTo: { $gte: startDate, $lte: endDate } }
                ]
            }).sort({ employeeId: 1, reportPeriodFrom: -1 });
            
            return records;
        } catch (error) {
            console.error('Error fetching attendance by date range:', error);
            throw error;
        }
    }

    async getEmployeeDailyAttendance(employeeId, date) {
        try {
            const records = await AttendanceRecord.find({
                employeeId,
                'dailyAttendance.date': date
            });

            const dailyRecords = [];
            records.forEach(record => {
                const dailyRecord = record.dailyAttendance.find(day => day.date === date);
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
                        ot2: dailyRecord.ot2
                    });
                }
            });

            return dailyRecords;
        } catch (error) {
            console.error('Error fetching daily attendance:', error);
            throw error;
        }
    }

    async getAttendanceSummary(employeeId = null, periodFrom = null, periodTo = null) {
        try {
            const query = {};
            
            if (employeeId) query.employeeId = employeeId;
            if (periodFrom && periodTo) {
                query.reportPeriodFrom = periodFrom;
                query.reportPeriodTo = periodTo;
            }

            const records = await AttendanceRecord.find(query);
            
            return records.map(record => ({
                employeeId: record.employeeId,
                employeeName: record.employeeName,
                department: record.department,
                designation: record.designation,
                reportPeriod: `${record.reportPeriodFrom} to ${record.reportPeriodTo}`,
                summary: record.monthlySummary
            }));
        } catch (error) {
            console.error('Error fetching attendance summary:', error);
            throw error;
        }
    }

    async deleteAttendanceRecord(recordId) {
        try {
            const deletedRecord = await AttendanceRecord.findByIdAndDelete(recordId);
            return deletedRecord;
        } catch (error) {
            console.error('Error deleting attendance record:', error);
            throw error;
        }
    }

    async getAttendanceStats() {
        try {
            const totalRecords = await AttendanceRecord.countDocuments();
            const uniqueEmployees = await AttendanceRecord.distinct('employeeId');
            const latestRecord = await AttendanceRecord.findOne().sort({ extractedAt: -1 });
            
            return {
                totalRecords,
                uniqueEmployees: uniqueEmployees.length,
                latestExtraction: latestRecord ? latestRecord.extractedAt : null,
                latestPeriod: latestRecord ? `${latestRecord.reportPeriodFrom} to ${latestRecord.reportPeriodTo}` : null
            };
        } catch (error) {
            console.error('Error fetching attendance stats:', error);
            throw error;
        }
    }
}

module.exports = new AttendanceService();