const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },
    payrunHistory: [
      {
        salaryMonth: { type: String, required: true },
        salaryYear: { type: String, required: true },
        present: { type: String, default: "0" }, // From AttendanceRecord
        absent: { type: String, default: "0" }, // From AttendanceRecord
        basic: { type: String, default: "0" }, // From Employee model (salary)
        houseRent: { type: String, default: "0" }, // Admin update
        EPF: { type: String, default: "0" }, // From Employee model
        ESIC: { type: String, default: "0" }, // From Employee model
        incentives: { type: String, default: "0" }, // Admin update
        allowances: { type: String, default: "0" }, // Admin update
        advance: { type: String, default: "0" }, // Admin update
        paymentLossDays: { type: String, default: "0" }, // Admin update
        paymentLossAmount: { type: String, default: "0" }, // Admin update
        OT1Hours: { type: String, default: "0" }, // Admin update
        OT1Amount: { type: String, default: "0" }, // Admin update
        OT2Hours: { type: String, default: "0" }, // Admin update
        OT2Amount: { type: String, default: "0" }, // Admin update
        totalLateHours: { type: String, default: "0" }, // Calculated from daily attendance
        holdOT: { type: String, default: "0" }, // Admin update
        totalBasicPayment: { type: String, default: "0" }, // Admin update
        totalOTPayment: { type: String, default: "0" }, // Admin update
        salary: { type: String, default: "0" }, // Admin update
        balance: { type: String, default: "0" }, // Admin update
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payroll", payrollSchema);