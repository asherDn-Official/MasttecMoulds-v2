const mongoose = require('mongoose');

// Schema for individual daily attendance record
const DailyAttendanceSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PRE', 'ABS', 'PRE/ABS', 'ABS/PRE', 'OFF', 'H', 'W', ''],
        default: ''
    },
    shift: {
        type: String,
        enum: ['12HRS', 'SECOND', 'GEN', 'SPL', 'NIGHT', 'OFF', '8HRS', 'COOK', ''],
        default: ''
    },
    timeIn: {
        type: String,
        default: ''
    },
    timeOut: {
        type: String,
        default: ''
    },
    workedHrs: {
        type: String,
        default: ''
    },
    late: {
        type: String,
        default: ''
    },
    earlyOut: {
        type: String,
        default: ''
    },
    ot1: {
        type: String,
        default: ''
    },
    ot2: {
        type: String,
        default: ''
    }
});

// Schema for employee summary
const SummarySchema = new mongoose.Schema({
    presentDays: { type: String, default: '0' },
    paidLeaveDays: { type: String, default: '0' },
    lopDays: { type: String, default: '0' },
    weeklyOffDays: { type: String, default: '0' },
    holidays: { type: String, default: '0' },
    onDutyDays: { type: String, default: '0' },
    absentDays: { type: String, default: '0' },
    totalWorkedHrs: { type: String, default: '0:00' },
    totalLate: { type: String, default: '0:00' },
    totalEarlyOut: { type: String, default: '0:00' },
    totalOT1: { type: String, default: '0:00' },
    totalOT2: { type: String, default: '0:00' },
    totalOT3: { type: String, default: '0:00' }
});

// Main attendance record schema
const AttendanceRecordSchema = new mongoose.Schema({
    // Report Information
    reportOverallDate: {
        type: String,
        required: true
    },
    reportPeriodFrom: {
        type: String,
        required: true
    },
    reportPeriodTo: {
        type: String,
        required: true
    },
    
    // Employee Information
    employeeId: {
        type: String,
        required: true,
        index: true
    },
    employeeName: {
        type: String,
        required: true
    },
    department: {
        type: String,
        default: ''
    },
    designation: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        default: ''
    },
    branch: {
        type: String,
        default: ''
    },
    
    // Daily attendance records
    dailyAttendance: [DailyAttendanceSchema],
    
    // Monthly summary
    monthlySummary: SummarySchema,
    
    // Metadata
    extractedAt: {
        type: Date,
        default: Date.now
    },
    pdfFileName: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Create compound index for efficient queries
AttendanceRecordSchema.index({ employeeId: 1, reportPeriodFrom: 1, reportPeriodTo: 1 });

module.exports = mongoose.models.AttendanceRecord || mongoose.model('AttendanceRecord', AttendanceRecordSchema);