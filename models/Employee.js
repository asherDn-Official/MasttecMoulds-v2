const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const employeeSchema = new mongoose.Schema(
  {
    employeeName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    employeePicture: { type: String, maxlength: 100 },

    employeeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },

    department: {
      type: String,
      maxlength: 50,
    },
    departmentCode: { type: String, trim: true, maxlength: 20 },

    designation: { type: String, trim: true, maxlength: 50 },
    qualification: { type: String, trim: true, maxlength: 100 },

    dateOfBirth: { type: Date },
    dateOfJoining: { type: Date },

    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },

    mobileNumber: {
      type: String,
      match: /^[6-9]\d{9}$/,
      unique: true,
      sparse: true,
    },
    mailId: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: /^\S+@\S+\.\S+$/,
    },

    address: { type: String, maxlength: 255 },

    bankDetails: {
      bankName: { type: String },
      bankBranch: { type: String },
      bankAccountNumber: { type: String, match: /^\d{9,18}$/ },
      bankIFSCCode: { type: String, match: /^[A-Z]{4}0[A-Z0-9]{6}$/ },
    },

    PANNumber: {
      type: String,
      match: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
      unique: true,
      sparse: true,
    },
    aadhaarNo: { type: String, match: /^\d{12}$/, unique: true, sparse: true },
    UANNo: { type: String, match: /^\d{12}$/ },
    esicId: { type: String },
    epfId: { type: String },

    documents: {
      addressProof: { type: String },
      educationCertificate: { type: String },
      passbookProof: { type: String },
      PANCardProof: { type: String },
    },

    salary: { type: Number, min: 0 },
    allowance: { type: Number, min: 0, default: 0 },
    hra: { type: Number, min: 0, default: 0 },
    esic: { type: Number, min: 0, default: 0 },

    password: { type: String, select: false },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

employeeSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10); 
  next();
});

employeeSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Employee", employeeSchema);
