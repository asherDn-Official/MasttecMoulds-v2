const Payroll = require("../Models/PayRollModel");
const AttendanceRecord = require("../Models/AttendanceRecord");
const Employee = require("../Models/EmployeeModel");

class PayrollService {
  /**
   * Determine shift type based on time in and time out
   * @param {string} timeIn - Time in (format: HH:MM)
   * @param {string} timeOut - Time out (format: HH:MM)
   * @returns {Object} Shift configuration
   */
  determineShiftType(timeIn, timeOut) {
    if (!timeIn || !timeOut || timeIn.trim() === "" || timeOut.trim() === "") {
      // Default to general shift if times are not available
      return {
        type: "general",
        startTime: { hours: 9, minutes: 30 },
        endTime: { hours: 17, minutes: 30 },
        description: "General Shift (9:00 AM - 5:30 PM)",
      };
    }

    try {
      const [inHours, inMinutes] = timeIn.split(":").map(Number);
      const [outHours, outMinutes] = timeOut.split(":").map(Number);

      if (
        isNaN(inHours) ||
        isNaN(inMinutes) ||
        isNaN(outHours) ||
        isNaN(outMinutes)
      ) {
        // Default to general shift if parsing fails
        return {
          type: "general",
          startTime: { hours: 9, minutes: 0 },
          endTime: { hours: 17, minutes: 30 },
          description: "General Shift (9:00 AM - 5:30 PM)",
        };
      }

      // Convert to minutes for easier comparison
      const inTotalMinutes = inHours * 60 + inMinutes;
      const outTotalMinutes = outHours * 60 + outMinutes;

      // 12-hour day shift: 7:00 AM to 3:00 PM (420 to 900 minutes)
      if (
        inTotalMinutes >= 360 &&
        inTotalMinutes <= 480 &&
        outTotalMinutes >= 840 &&
        outTotalMinutes <= 960
      ) {
        return {
          type: "12hour_day",
          startTime: { hours: 7, minutes: 0 },
          endTime: { hours: 15, minutes: 0 },
          description: "12-Hour Day Shift (7:00 AM - 3:00 PM)",
        };
      }

      // Night shift: 7:00 PM to 3:00 AM (next day)
      if (
        inTotalMinutes >= 1140 ||
        (inTotalMinutes <= 240 && outTotalMinutes <= 240)
      ) {
        return {
          type: "night",
          startTime: { hours: 19, minutes: 0 },
          endTime: { hours: 3, minutes: 0 }, // 3 AM next day
          description: "Night Shift (7:00 PM - 3:00 AM)",
        };
      }

      // Default to general shift
      return {
        type: "general",
        startTime: { hours: 9, minutes: 0 },
        endTime: { hours: 17, minutes: 30 },
        description: "General Shift (9:00 AM - 5:30 PM)",
      };
    } catch (error) {
      console.error("Error determining shift type:", error);
      return {
        type: "general",
        startTime: { hours: 9, minutes: 0 },
        endTime: { hours: 17, minutes: 30 },
        description: "General Shift (9:00 AM - 5:30 PM)",
      };
    }
  }

  /**
   * Calculate late hours if employee is more than 10 minutes late
   * @param {string} timeIn - Time in (format: HH:MM)
   * @param {Object} shiftConfig - Shift configuration
   * @returns {number} Late hours
   */
  calculateLateHours(timeIn, shiftConfig) {
    if (!timeIn || timeIn.trim() === "") {
      return 0;
    }

    try {
      const [inHours, inMinutes] = timeIn.split(":").map(Number);

      if (isNaN(inHours) || isNaN(inMinutes)) {
        return 0;
      }

      const actualInMinutes = inHours * 60 + inMinutes;
      const expectedInMinutes =
        shiftConfig.startTime.hours * 60 + shiftConfig.startTime.minutes;

      // For night shift, handle day crossover
      let lateMinutes = 0;
      if (shiftConfig.type === "night") {
        // Night shift starts at 7 PM (1140 minutes)
        if (actualInMinutes < 720) {
          // If time is AM (less than 12:00 PM)
          // This means they came in the next day morning, which is very late
          lateMinutes = actualInMinutes + 24 * 60 - expectedInMinutes;
        } else {
          lateMinutes = actualInMinutes - expectedInMinutes;
        }
      } else {
        lateMinutes = actualInMinutes - expectedInMinutes;
      }

      // Only count as late if more than 10 minutes
      if (lateMinutes > 10) {
        return parseFloat((lateMinutes / 60).toFixed(2));
      }

      return 0;
    } catch (error) {
      console.error(
        `Error calculating late hours for timeIn ${timeIn}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Calculate OT1 hours (overtime on regular working days)
   * @param {string} timeIn - Time in (format: HH:MM)
   * @param {string} timeOut - Time out (format: HH:MM)
   * @param {string} status - Attendance status
   * @param {string} ot1 - Pre-calculated OT1 from attendance record
   * @param {string} shiftType - Optional shift type parameter
   * @returns {number} OT1 hours
   */
  calculateOT1Hours(timeIn, timeOut, status, ot1, shiftType = null) {
    // If OT1 is already calculated in attendance record, use that
    if (ot1 && ot1.trim() !== "") {
      // Handle different time formats (HH:MM or decimal)
      if (ot1.includes(":")) {
        const [hours, minutes] = ot1.split(":").map(Number);
        return isNaN(hours) || isNaN(minutes) ? 0 : hours + minutes / 60;
      } else {
        const hours = parseFloat(ot1);
        return isNaN(hours) ? 0 : hours;
      }
    }

    // If status is not present, return 0
    if (status !== "PRE" && status !== "P") {
      return 0;
    }

    // Parse timeOut
    if (!timeOut || timeOut.trim() === "") {
      return 0;
    }

    try {
      // Determine shift type based on timeIn and timeOut
      const shiftConfig = shiftType
        ? this.getShiftConfigByType(shiftType)
        : this.determineShiftType(timeIn, timeOut);

      const [outHours, outMinutes] = timeOut.split(":").map(Number);

      // Check if parsing was successful
      if (isNaN(outHours) || isNaN(outMinutes)) {
        console.log(`Invalid timeOut format: ${timeOut}`);
        return 0;
      }

      // Calculate minutes after shift end time
      let totalOutMinutes = outHours * 60 + outMinutes;
      let totalShiftEndMinutes =
        shiftConfig.endTime.hours * 60 + shiftConfig.endTime.minutes;

      // Handle night shift crossover (ends at 3 AM next day)
      if (shiftConfig.type === "night") {
        if (totalOutMinutes < 720) {
          // If timeOut is in AM (before 12:00 PM)
          totalOutMinutes += 24 * 60; // Add 24 hours to handle next day
        }
        totalShiftEndMinutes += 24 * 60; // Night shift end time is next day
      }

      // Only count OT if worked more than 30 minutes after shift end time
      if (totalOutMinutes > totalShiftEndMinutes + 30) {
        const overtimeMinutes = totalOutMinutes - totalShiftEndMinutes;
        const otHours = parseFloat((overtimeMinutes / 60).toFixed(2));

        console.log(
          `OT1 Calculation - Shift: ${shiftConfig.description}, End: ${shiftConfig.endTime.hours}:${shiftConfig.endTime.minutes}, Out: ${timeOut}, OT: ${otHours}h`
        );
        return otHours;
      }
    } catch (error) {
      console.error(
        `Error calculating OT1 hours for timeOut ${timeOut}:`,
        error
      );
    }

    return 0;
  }

  /**
   * Get shift configuration by type
   * @param {string} shiftType - Shift type (general, 12hour_day, night)
   * @returns {Object} Shift configuration
   */
  getShiftConfigByType(shiftType) {
    const shiftConfigs = {
      general: {
        type: "general",
        startTime: { hours: 9, minutes: 30 },
        endTime: { hours: 17, minutes: 30 },
        description: "General Shift (9:30 AM - 5:30 PM)",
      },
      "12hour_day": {
        type: "12hour_day",
        startTime: { hours: 7, minutes: 0 },
        endTime: { hours: 15, minutes: 0 },
        description: "12-Hour Day Shift (7:00 AM - 3:00 PM)",
      },
      night: {
        type: "night",
        startTime: { hours: 19, minutes: 0 },
        endTime: { hours: 3, minutes: 0 },
        description: "Night Shift (7:00 PM - 3:00 AM)",
      },
    };

    return shiftConfigs[shiftType] || shiftConfigs["general"];
  }

  /**
   * Calculate OT2 hours (overtime on holidays/weekends)
   * @param {string} timeIn - Time in (format: HH:MM)
   * @param {string} timeOut - Time out (format: HH:MM)
   * @param {string} workedHrs - Hours worked
   * @param {string} status - Attendance status
   * @param {string} ot2 - Pre-calculated OT2 from attendance record
   * @param {string} shiftType - Optional shift type parameter
   * @returns {number} OT2 hours
   */
  calculateOT2Hours(timeIn, timeOut, workedHrs, status, ot2, shiftType = null) {
    // If OT2 is already calculated in attendance record, use that
    if (ot2 && ot2.trim() !== "") {
      // Handle different time formats (HH:MM or decimal)
      if (ot2.includes(":")) {
        const [hours, minutes] = ot2.split(":").map(Number);
        return isNaN(hours) || isNaN(minutes) ? 0 : hours + minutes / 60;
      } else {
        const hours = parseFloat(ot2);
        return isNaN(hours) ? 0 : hours;
      }
    }

    // If status is OFF, W, or H (weekend or holiday), all worked hours are OT2
    if (status === "OFF" || status === "W" || status === "H") {
      // Use workedHrs if available, otherwise calculate from timeIn/timeOut
      let hoursWorked = 0;

      if (workedHrs && workedHrs.trim() !== "") {
        try {
          // Handle different time formats (HH:MM or decimal)
          if (workedHrs.includes(":")) {
            const [hours, minutes] = workedHrs.split(":").map(Number);
            hoursWorked =
              isNaN(hours) || isNaN(minutes) ? 0 : hours + minutes / 60;
          } else {
            hoursWorked = parseFloat(workedHrs);
            hoursWorked = isNaN(hoursWorked) ? 0 : hoursWorked;
          }
        } catch (error) {
          console.error(
            `Error calculating OT2 hours for workedHrs ${workedHrs}:`,
            error
          );
          hoursWorked = 0;
        }
      } else {
        // Calculate from timeIn and timeOut
        hoursWorked = this.calculateWorkedHours(timeIn, timeOut, "");
      }

      // Only count OT2 if worked more than 30 minutes (0.5 hours)
      if (hoursWorked > 0.5) {
        console.log(
          `OT2 Calculation - Holiday/Weekend: Status=${status}, Worked=${hoursWorked}h`
        );
        return parseFloat(hoursWorked.toFixed(2));
      }
    }

    return 0;
  }

  /**
   * Calculate worked hours from time in and time out
   * @param {string} timeIn - Time in (format: HH:MM)
   * @param {string} timeOut - Time out (format: HH:MM)
   * @returns {number} Worked hours
   */
  calculateWorkedHours(timeIn, timeOut, workedHrs) {
    // If workedHrs is already calculated in attendance record, use that
    if (workedHrs && workedHrs.trim() !== "") {
      try {
        // Handle different time formats (HH:MM or decimal)
        if (workedHrs.includes(":")) {
          const [hours, minutes] = workedHrs.split(":").map(Number);
          return isNaN(hours) || isNaN(minutes) ? 0 : hours + minutes / 60;
        } else {
          const hours = parseFloat(workedHrs);
          return isNaN(hours) ? 0 : hours;
        }
      } catch (error) {
        console.error(`Error parsing workedHrs ${workedHrs}:`, error);
        return 0;
      }
    }

    // If timeIn or timeOut is missing, return 0
    if (!timeIn || !timeOut || timeIn.trim() === "" || timeOut.trim() === "") {
      return 0;
    }

    try {
      // Parse timeIn and timeOut
      const [inHours, inMinutes] = timeIn.split(":").map(Number);
      const [outHours, outMinutes] = timeOut.split(":").map(Number);

      // Check if parsing was successful
      if (
        isNaN(inHours) ||
        isNaN(inMinutes) ||
        isNaN(outHours) ||
        isNaN(outMinutes)
      ) {
        console.log(
          `Invalid time format: timeIn=${timeIn}, timeOut=${timeOut}`
        );
        return 0;
      }

      // Calculate total minutes
      const totalInMinutes = inHours * 60 + inMinutes;
      const totalOutMinutes = outHours * 60 + outMinutes;

      // Handle case where timeOut is on the next day
      let diffMinutes = totalOutMinutes - totalInMinutes;
      if (diffMinutes < 0) {
        diffMinutes += 24 * 60; // Add 24 hours in minutes
      }

      return parseFloat((diffMinutes / 60).toFixed(2));
    } catch (error) {
      console.error(
        `Error calculating worked hours for timeIn=${timeIn}, timeOut=${timeOut}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Calculate OT1 amount based on hourly rate
   * @param {number} ot1Hours - OT1 hours
   * @param {number} hourlyRate - Hourly rate
   * @returns {number} OT1 amount
   */
  calculateOT1Amount(ot1Hours, hourlyRate) {
    // Check for NaN values
    if (isNaN(ot1Hours) || isNaN(hourlyRate)) {
      console.log(
        `Invalid values for OT1 calculation: ot1Hours=${ot1Hours}, hourlyRate=${hourlyRate}`
      );
      return 0;
    }

    // OT1 is calculated at 1.25x the hourly rate
    return parseFloat((ot1Hours * hourlyRate * 1.25).toFixed(2));
  }

  /**
   * Calculate OT2 amount based on hourly rate
   * @param {number} ot2Hours - OT2 hours
   * @param {number} hourlyRate - Hourly rate
   * @returns {number} OT2 amount
   */
  calculateOT2Amount(ot2Hours, hourlyRate) {
    // Check for NaN values
    if (isNaN(ot2Hours) || isNaN(hourlyRate)) {
      console.log(
        `Invalid values for OT2 calculation: ot2Hours=${ot2Hours}, hourlyRate=${hourlyRate}`
      );
      return 0;
    }

    // OT2 is calculated at 1.75x the hourly rate
    return parseFloat((ot2Hours * hourlyRate * 1.75).toFixed(2));
  }

  /**
   * Calculate total late hours for the month from daily attendance
   * @param {Array} dailyAttendance - Array of daily attendance records
   * @returns {number} Total late hours for the month
   */
  calculateMonthlyLateHours(dailyAttendance) {
    let totalLateHours = 0;

    if (!dailyAttendance || !Array.isArray(dailyAttendance)) {
      return 0;
    }

    dailyAttendance.forEach((record) => {
      if (
        record.timeIn &&
        record.status &&
        (record.status === "P" || record.status === "PRE")
      ) {
        const shiftConfig = this.determineShiftType(
          record.timeIn,
          record.timeOut
        );
        const lateHours = this.calculateLateHours(record.timeIn, shiftConfig);
        totalLateHours += lateHours;

        if (lateHours > 0) {
          console.log(
            `Late hours for ${record.date}: ${lateHours}h (Shift: ${shiftConfig.type})`
          );
        }
      }
    });

    return parseFloat(totalLateHours.toFixed(2));
  }

  /**
   * Calculate total OT1 and OT2 hours for the month from daily attendance
   * @param {Array} dailyAttendance - Array of daily attendance records
   * @returns {Object} Object containing totalOT1Hours and totalOT2Hours
   */
  calculateMonthlyOTHours(dailyAttendance) {
    let totalOT1Hours = 0;
    let totalOT2Hours = 0;

    if (!dailyAttendance || !Array.isArray(dailyAttendance)) {
      return { totalOT1Hours: 0, totalOT2Hours: 0 };
    }

    dailyAttendance.forEach((record) => {
      if (record.timeIn && record.timeOut && record.status) {
        // Calculate OT1 hours (regular working day overtime)
        const ot1Hours = this.calculateOT1Hours(
          record.timeIn,
          record.timeOut,
          record.status,
          record.ot1
        );
        totalOT1Hours += ot1Hours;

        // Calculate OT2 hours (holiday/weekend overtime)
        const ot2Hours = this.calculateOT2Hours(
          record.timeIn,
          record.timeOut,
          record.workedHrs,
          record.status,
          record.ot2
        );
        totalOT2Hours += ot2Hours;

        if (ot1Hours > 0 || ot2Hours > 0) {
          console.log(
            `OT for ${record.date}: OT1=${ot1Hours}h, OT2=${ot2Hours}h, Status=${record.status}`
          );
        }
      }
    });

    return {
      totalOT1Hours: parseFloat(totalOT1Hours.toFixed(2)),
      totalOT2Hours: parseFloat(totalOT2Hours.toFixed(2)),
    };
  }

  /**
   * Calculate hourly rate based on basic salary
   * @param {number} basicSalary - Basic salary
   * @returns {number} Hourly rate
   */
  calculateHourlyRate(basicSalary) {
    // New calculation: salary / 30 days / 8 hours per day
    const workingHoursPerMonth = 30 * 8;
    return parseFloat((basicSalary / workingHoursPerMonth).toFixed(2));
  }

  /**
   * Generate payroll data from attendance record and employee data
   * @param {Object} attendanceRecord - Attendance record
   * @param {Object} employeeData - Employee data from Employee model
   * @returns {Object} Payroll data
   */
  async generatePayrollFromAttendance(attendanceRecord, employeeData = null) {
    try {
      const {
        employeeId,
        employeeName,
        department,
        designation,
        reportPeriodFrom,
        reportPeriodTo,
        dailyAttendance,
        monthlySummary,
      } = attendanceRecord;

      // Get employee data if not provided
      if (!employeeData) {
        employeeData = await Employee.findOne({ employeeId });
        if (!employeeData) {
          console.warn(
            `Employee data not found for employeeId: ${employeeId}. Creating basic employee record.`
          );

          // Create basic employee record using the attendance data
          try {
            employeeData = new Employee({
              employeeId: employeeId,
              employeeName: employeeName || `Employee ${employeeId}`,
              salary: "0",
              epf: "0",
              hra: "0",
              esic: "0",
              allowance: "0",
              status: true,
              department: attendanceRecord.department || "", // Use department from attendance record
              designation: attendanceRecord.designation || "", // Use designation from attendance record
              // Other fields will have default values
            });

            await employeeData.save();
            console.log(
              `✓ Created basic employee record for ID: ${employeeId}, Name: ${employeeName}`
            );
          } catch (createError) {
            console.error(
              `Error creating employee record for ${employeeId}:`,
              createError
            );
            // Fall back to using a temporary employee data structure
            employeeData = {
              employeeId: employeeId,
              salary: "0",
              hra: "0",
              epf: "0",
              allowance: "0",
              esic: "0",
              employeeName: employeeName || `Employee ${employeeId}`,
            };
          }
        }
      }

      // Extract month and year from report period
      // Handle both YYYY-MM-DD and DD-MM-YYYY formats
      let salaryMonth, salaryYear;
      const dateParts = reportPeriodFrom.split("-");

      if (dateParts[0].length === 4) {
        // YYYY-MM-DD format
        const [year, month, day] = dateParts;
        salaryMonth = month;
        salaryYear = year;
      } else {
        // DD-MM-YYYY format
        const [day, month, year] = dateParts;
        salaryMonth = month;
        salaryYear = year;
      }

      // Get salary, EPF, and ESIC from employee model
      const basicSalary = parseFloat(employeeData.salary / 2 || "0");
      const hraAmount = parseFloat(employeeData.hra || "0");
      const epfAmount = parseFloat(employeeData.epf || "0");
      const esicAmount = parseFloat(employeeData.esic || "0");
      const allowance = parseFloat(employeeData.allowance || "0");

      // Calculate hourly rate
      const hourlyRate = this.calculateHourlyRate(basicSalary);
      console.log(
        `Employee ${employeeId}: Basic Salary: ${basicSalary}, EPF: ${epfAmount},HRA: ${hraAmount}, ESIC: ${esicAmount}, Hourly rate: ${hourlyRate}`
      );

      // Get present and absent days from attendance summary
      const presentDays = parseInt(monthlySummary.presentDays || "0");
      const absentDays = parseInt(monthlySummary.absentDays || "0");
      console.log(`Present days: ${presentDays}, Absent days: ${absentDays}`);

      // Calculate OT hours and late hours using enhanced calculations
      console.log(`Calculating OT and late hours for employee ${employeeId}`);

      // Calculate monthly OT hours
      const otHours = this.calculateMonthlyOTHours(dailyAttendance);
      const totalOT1Hours = otHours.totalOT1Hours;
      const totalOT2Hours = otHours.totalOT2Hours;

      // Calculate monthly late hours
      const totalLateHours = this.calculateMonthlyLateHours(dailyAttendance);

      // Calculate OT amounts
      const ot1Amount = this.calculateOT1Amount(totalOT1Hours, hourlyRate);
      const ot2Amount = this.calculateOT2Amount(totalOT2Hours, hourlyRate);
      const totalOTAmount = ot1Amount + ot2Amount;

      console.log(
        `OT Summary for ${employeeId}: OT1=${totalOT1Hours}h (₹${ot1Amount}), OT2=${totalOT2Hours}h (₹${ot2Amount}), Late=${totalLateHours}h`
      );
      const totalSalary = basicSalary + hraAmount + totalOTAmount;
      // Create payroll data with calculated values
      const payrollData = {
        salaryMonth,
        salaryYear,
        present: presentDays.toString(),
        absent: absentDays.toString(),
        basic: basicSalary.toString(),
        houseRent: absentDays > 9 ? "0" : hraAmount.toString(),
        EPF: totalSalary > 15000 ? (basicSalary * 0.12).toString() : "0",
        ESIC: totalSalary > 210000 ? esicAmount.toString() : "0", // From Employee model
        incentives: "0", // Default value for admin update
        allowances: allowance, // Default value for admin update
        advance: "0", // Default value for admin update
        paymentLossDays: absentDays.toString(), // Use absent days
        paymentLossAmount: "0.00", // Can be calculated if needed
        OT1Hours: totalOT1Hours.toString(),
        OT1Amount: ot1Amount.toString(),
        OT2Hours: totalOT2Hours.toString(),
        OT2Amount: ot2Amount.toString(),
        totalLateHours: totalLateHours.toString(), // New field for total late hours
        holdOT: "0", // Default value for admin update
        totalBasicPayment: basicSalary.toString(), // Basic salary as total basic payment
        totalOTPayment: totalOTAmount.toString(),
        salary: totalSalary.toString(), // Basic + HRA + OT
        balance: "0", // Default value for admin update
      };

      return payrollData;
    } catch (error) {
      console.error("Error generating payroll from attendance:", error);
      throw error;
    }
  }

  /**
   * Create or update payroll record from attendance record
   * @param {Object} attendanceRecord - Attendance record
   * @returns {Object} Created or updated payroll record
   */
  async createOrUpdatePayrollFromAttendance(attendanceRecord) {
    try {
      if (!attendanceRecord || !attendanceRecord.employeeId) {
        console.error("Invalid attendance record:", attendanceRecord);
        throw new Error("Invalid attendance record");
      }

      const { employeeId } = attendanceRecord;
      console.log(`Creating/updating payroll for employee ${employeeId}`);

      // Generate payroll data
      const payrollData = await this.generatePayrollFromAttendance(
        attendanceRecord
      );

      if (!payrollData) {
        console.error(
          "Failed to generate payroll data for employee:",
          employeeId
        );
        throw new Error("Failed to generate payroll data");
      }

      // Check if payroll record exists for this employee
      let payrollRecord = await Payroll.findOne({ employeeId });

      if (payrollRecord) {
        console.log(`Found existing payroll record for employee ${employeeId}`);

        // Check if payrun for this month and year already exists
        const existingPayrunIndex = payrollRecord.payrunHistory.findIndex(
          (payrun) =>
            payrun.salaryMonth === payrollData.salaryMonth &&
            payrun.salaryYear === payrollData.salaryYear
        );

        if (existingPayrunIndex !== -1) {
          console.log(
            `Updating existing payrun for ${payrollData.salaryMonth}/${payrollData.salaryYear}`
          );
          // Update existing payrun
          payrollRecord.payrunHistory[existingPayrunIndex] = payrollData;
        } else {
          console.log(
            `Adding new payrun for ${payrollData.salaryMonth}/${payrollData.salaryYear}`
          );
          // Add new payrun to history
          payrollRecord.payrunHistory.push(payrollData);
        }

        await payrollRecord.save();
        console.log(`Payroll record updated for employee ${employeeId}`);
      } else {
        console.log(`Creating new payroll record for employee ${employeeId}`);
        // Create new payroll record
        payrollRecord = new Payroll({
          employeeId,
          payrunHistory: [payrollData],
        });

        await payrollRecord.save();
        console.log(`New payroll record created for employee ${employeeId}`);
      }

      return payrollRecord;
    } catch (error) {
      console.error(
        `Error creating/updating payroll from attendance for employee ${attendanceRecord?.employeeId}:`,
        error
      );
      // Return a default payroll record with error information instead of throwing
      return {
        error: true,
        message: error.message,
        employeeId: attendanceRecord?.employeeId || "unknown",
        details: `Failed to process payroll for employee ${attendanceRecord?.employeeId}. ${error.message}`,
      };
    }
  }

  /**
   * Process payroll for all attendance records in a period
   * @param {string} periodFrom - Start date of period
   * @param {string} periodTo - End date of period
   * @returns {Array} Processed payroll records
   */
  async processPayrollForPeriod(periodFrom, periodTo) {
    try {
      console.log(`Processing payroll for period ${periodFrom} to ${periodTo}`);

      // Get all attendance records for the period
      const attendanceRecords = await AttendanceRecord.find({
        reportPeriodFrom: periodFrom,
        reportPeriodTo: periodTo,
      });

      console.log(
        `Found ${attendanceRecords.length} attendance records for the period`
      );

      if (!attendanceRecords || attendanceRecords.length === 0) {
        throw new Error(
          `No attendance records found for period ${periodFrom} to ${periodTo}`
        );
      }

      // Process payroll for each attendance record
      const processedPayrolls = [];
      const errors = [];

      for (const record of attendanceRecords) {
        try {
          console.log(`Processing payroll for employee ${record.employeeId}`);
          const payroll = await this.createOrUpdatePayrollFromAttendance(
            record
          );

          if (payroll.error) {
            console.log(
              `Error processing payroll for employee ${record.employeeId}: ${payroll.message}`
            );
            errors.push({
              employeeId: record.employeeId,
              error: payroll.message,
            });
          } else {
            processedPayrolls.push(payroll);
          }
        } catch (recordError) {
          console.error(
            `Error processing payroll for employee ${record.employeeId}:`,
            recordError
          );
          errors.push({
            employeeId: record.employeeId,
            error: recordError.message,
          });
        }
      }

      console.log(
        `Successfully processed ${processedPayrolls.length} payroll records`
      );
      if (errors.length > 0) {
        console.log(`Failed to process ${errors.length} payroll records`);
      }

      return {
        success: processedPayrolls.length > 0,
        processedCount: processedPayrolls.length,
        errorCount: errors.length,
        payrolls: processedPayrolls,
        errors: errors,
      };
    } catch (error) {
      console.error("Error processing payroll for period:", error);
      return {
        success: false,
        message: error.message,
        processedCount: 0,
        errorCount: 0,
        payrolls: [],
        errors: [
          {
            error: error.message,
          },
        ],
      };
    }
  }

  /**
   * Get all payroll records
   * @returns {Array} All payroll records
   */
  async getAllPayrolls() {
    try {
      return await Payroll.find();
    } catch (error) {
      console.error("Error getting all payrolls:", error);
      throw error;
    }
  }

  /**
   * Get payroll record by employee ID
   * @param {string} employeeId - Employee ID
   * @returns {Object} Payroll record
   */
  async getPayrollByEmployeeId(employeeId) {
    try {
      return await Payroll.findOne({ employeeId });
    } catch (error) {
      console.error(`Error getting payroll for employee ${employeeId}:`, error);
      throw error;
    }
  }

  /**
   * Get payroll records filtered by month and year
   * @param {string} month - Month (MM format)
   * @param {string} year - Year (YYYY format)
   * @returns {Array} Payroll records for the specified month
   */
  async getPayrollByMonth(month, year) {
    try {
      const payrolls = await Payroll.find({
        "payrunHistory.salaryMonth": month,
        "payrunHistory.salaryYear": year,
      });

      // Filter to return only the relevant payrun data for the specified month
      const filteredPayrolls = payrolls
        .map((payroll) => {
          const relevantPayruns = payroll.payrunHistory.filter(
            (payrun) =>
              payrun.salaryMonth === month && payrun.salaryYear === year
          );

          return {
            ...payroll.toObject(),
            payrunHistory: relevantPayruns,
          };
        })
        .filter((payroll) => payroll.payrunHistory.length > 0);

      return filteredPayrolls;
    } catch (error) {
      console.error(`Error getting payroll for month ${month}/${year}:`, error);
      throw error;
    }
  }

  /**
   * Get all payroll records for a specific month with employee details
   * @param {string} month - Month (MM format)
   * @param {string} year - Year (YYYY format)
   * @returns {Array} Payroll records with employee details
   */
  async getPayrollWithEmployeeDetailsByMonth(month, year) {
    try {
      const payrolls = await this.getPayrollByMonth(month, year);

      // Populate employee details for each payroll
      const payrollsWithDetails = await Promise.all(
        payrolls.map(async (payroll) => {
          try {
            const employee = await Employee.findOne({
              employeeId: payroll.employeeId,
            });
            return {
              ...payroll,
              employeeDetails: employee || null,
            };
          } catch (error) {
            console.error(
              `Error fetching employee details for ${payroll.employeeId}:`,
              error
            );
            return {
              ...payroll,
              employeeDetails: null,
            };
          }
        })
      );

      return payrollsWithDetails;
    } catch (error) {
      console.error(
        `Error getting payroll with employee details for month ${month}/${year}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update payroll record by employee ID
   * @param {string} employeeId - Employee ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated payroll record
   */
  async updatePayrollByEmployeeId(employeeId, updateData) {
    try {
      const { payrunIndex, payrunData } = updateData;

      const payrollRecord = await Payroll.findOne({ employeeId });

      if (!payrollRecord) {
        throw new Error(`Payroll record not found for employee ${employeeId}`);
      }

      if (payrunIndex !== undefined && payrunData) {
        // Update specific payrun in history
        if (
          payrunIndex >= 0 &&
          payrunIndex < payrollRecord.payrunHistory.length
        ) {
          // Update only the fields provided in payrunData
          Object.keys(payrunData).forEach((key) => {
            payrollRecord.payrunHistory[payrunIndex][key] = payrunData[key];
          });
        } else {
          throw new Error(`Invalid payrun index: ${payrunIndex}`);
        }
      } else if (payrunData) {
        // Add new payrun to history
        payrollRecord.payrunHistory.push(payrunData);
      }

      return await payrollRecord.save();
    } catch (error) {
      console.error(
        `Error updating payroll for employee ${employeeId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete payroll record by employee ID
   * @param {string} employeeId - Employee ID
   * @returns {Object} Deleted payroll record
   */
  async deletePayrollByEmployeeId(employeeId) {
    try {
      return await Payroll.findOneAndDelete({ employeeId });
    } catch (error) {
      console.error(
        `Error deleting payroll for employee ${employeeId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Test function to demonstrate shift detection and calculations
   * @param {string} timeIn - Time in (format: HH:MM)
   * @param {string} timeOut - Time out (format: HH:MM)
   * @param {string} status - Attendance status
   * @returns {Object} Test results
   */
  testShiftCalculations(timeIn, timeOut, status = "P") {
    console.log(`\n=== Testing Shift Calculations ===`);
    console.log(`Time In: ${timeIn}, Time Out: ${timeOut}, Status: ${status}`);

    // Determine shift type
    const shiftConfig = this.determineShiftType(timeIn, timeOut);
    console.log(`Detected Shift: ${shiftConfig.description}`);

    // Calculate late hours
    const lateHours = this.calculateLateHours(timeIn, shiftConfig);
    console.log(`Late Hours: ${lateHours}h`);

    // Calculate worked hours
    const workedHours = this.calculateWorkedHours(timeIn, timeOut, "");
    console.log(`Worked Hours: ${workedHours}h`);

    // Calculate OT1 hours
    const ot1Hours = this.calculateOT1Hours(timeIn, timeOut, status, "");
    console.log(`OT1 Hours: ${ot1Hours}h`);

    // Calculate OT2 hours
    const ot2Hours = this.calculateOT2Hours(
      timeIn,
      timeOut,
      workedHours.toString(),
      status,
      ""
    );
    console.log(`OT2 Hours: ${ot2Hours}h`);

    // Calculate hourly rate and amounts (using sample salary)
    const sampleSalary = 30000;
    const hourlyRate = this.calculateHourlyRate(sampleSalary);
    const ot1Amount = this.calculateOT1Amount(ot1Hours, hourlyRate);
    const ot2Amount = this.calculateOT2Amount(ot2Hours, hourlyRate);

    console.log(`Hourly Rate (₹30,000 salary): ₹${hourlyRate}/hour`);
    console.log(`OT1 Amount: ₹${ot1Amount}`);
    console.log(`OT2 Amount: ₹${ot2Amount}`);
    console.log(`=================================\n`);

    return {
      shiftType: shiftConfig.type,
      shiftDescription: shiftConfig.description,
      lateHours,
      workedHours,
      ot1Hours,
      ot2Hours,
      hourlyRate,
      ot1Amount,
      ot2Amount,
    };
  }
}

  module.exports = new PayrollService();
