const mongoose = require("mongoose");

const payrollEmailResponseSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  emailId: {
    type: String,
    required: true
  },
  salaryMonth: {
    type: String,
    required: true
  },
  salaryYear: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'PENDING'],
    default: 'PENDING'
  },
  responseMessage: {
    type: String,
    default: ''
  },
  errorDetails: {
    type: String,
    default: ''
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  nextRetryAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
payrollEmailResponseSchema.index({ employeeId: 1, salaryMonth: 1, salaryYear: 1 });
payrollEmailResponseSchema.index({ status: 1, nextRetryAt: 1 });

module.exports = mongoose.model("PayrollEmailResponse", payrollEmailResponseSchema);