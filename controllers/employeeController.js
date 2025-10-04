const Employee = require("../models/Employee");
const fs = require("node:fs");
const util = require("node:util");
const { pipeline } = require("node:stream");
const path = require("node:path");

const pump = util.promisify(pipeline);

const saveFile = async (file) => {
  if (!file) return null;
  const uniqueFilename = `${Date.now()}-${file.filename.replace(/\s/g, "_")}`;
  const uploadPath = path.join(__dirname, "..", "uploads", uniqueFilename);
  await pump(file.file, fs.createWriteStream(uploadPath));
  return `/uploads/${uniqueFilename}`;
};

exports.create = async (req, reply) => {
  try {
    const { body } = req;

    // ✅ FIX: parse nested JSON strings safely
    if (body.bankDetails && typeof body.bankDetails.value === "string") {
      try {
        body.bankDetails.value = JSON.parse(body.bankDetails.value);
      } catch (err) {
        console.warn("⚠️ Invalid JSON in bankDetails.value:", err.message);
      }
    }

    // ✅ (Optional) — if you have other JSON-like nested fields later, do the same parsing for them here
    // Example: if you add `body.documents.value` as a JSON string later, parse similarly

    const employeeData = {
      employeeName: body.employeeName.value,
      employeeId: body.employeeId.value,
      password: body.password.value,
      department: body.department?.value,
      departmentCode: body.departmentCode?.value,
      designation: body.designation?.value,
      qualification: body.qualification?.value,
      dateOfBirth: body.dateOfBirth?.value,
      dateOfJoining: body.dateOfJoining?.value,
      bloodGroup: body.bloodGroup?.value,
      mobileNumber: body.mobileNumber?.value,
      mailId: body.mailId?.value,
      address: body.address?.value,
      // ✅ Now this will work — it's properly parsed as object
      bankDetails: body.bankDetails?.value,
      PANNumber: body.PANNumber?.value,
      aadhaarNo: body.aadhaarNo?.value,
      UANNo: body.UANNo?.value,
      esicId: body.esicId?.value,
      epfId: body.epfId?.value,
      salary: body.salary?.value,
      allowance: body.allowance?.value,
      hra: body.hra?.value,
      esic: body.esic?.value,
      status: body.status?.value,
      employeePicture: await saveFile(body.employeePicture),
      documents: {
        addressProof: await saveFile(body.documents?.addressProof),
        educationCertificate: await saveFile(body.documents?.educationCertificate),
        passbookProof: await saveFile(body.documents?.passbookProof),
        PANCardProof: await saveFile(body.documents?.PANCardProof),
      },
    };

    const existing = await Employee.findOne({
      $or: [
        { employeeId: employeeData.employeeId },
        { mobileNumber: employeeData.mobileNumber },
        { mailId: employeeData.mailId },
        { PANNumber: employeeData.PANNumber },
        { aadhaarNo: employeeData.aadhaarNo },
      ],
    });

    if (existing) {
      return reply.code(409).send({
        message:
          "Employee with this ID, mobile, email, PAN, or Aadhaar already exists",
      });
    }

    const newEmployee = new Employee(employeeData);
    await newEmployee.save();

    reply.code(201).send({
      message: "Employee created successfully",
      employee: newEmployee,
    });
  } catch (error) {
    req.log.error(error);

    if (error.code === 11000) {
      return reply.code(409).send({
        message: "Employee with this ID or unique field already exists.",
        error: error.message,
      });
    }

    reply.code(500).send({ message: "Server error", error: error.message });
  }
};

exports.getAll = async (req, reply) => {
  try {
    const {
      search,
      department,
      designation,
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (department) filter.department = department;
    if (designation) filter.designation = designation;
    if (status !== undefined) filter.status = status === "true";

    if (search) {
      const escapedSearch = search.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
      filter.$or = [
        { employeeName: { $regex: searchRegex } },
        { employeeId: { $regex: searchRegex } },
        { mobileNumber: { $regex: searchRegex } },
        { mailId: { $regex: searchRegex } },
        { PANNumber: { $regex: searchRegex } },
        { aadhaarNo: { $regex: searchRegex } },
      ];
    }

    const [employees, totalEmployees] = await Promise.all([
      Employee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Employee.countDocuments(filter),
    ]);

    reply.code(200).send({
      status: "success",
      pagination: {
        totalItems: totalEmployees,
        totalPages: Math.ceil(totalEmployees / limitNum),
        currentPage: pageNum,
      },
      data: employees,
    });
  } catch (error) {
    req.log.error(error);
    reply.code(500).send({ message: "Server error", error: error.message });
  }
};

exports.getById = async (req, reply) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);

    if (!employee) {
      return reply.code(404).send({ message: "Employee not found" });
    }

    reply.code(200).send(employee);
  } catch (error) {
    req.log.error(error);

    if (error.name === "CastError") {
      return reply.code(400).send({ message: "Invalid employee ID format" });
    }
    reply.code(500).send({ message: "Server error", error: error.message });
  }
};

exports.update = async (req, reply) => {
  try {
    const { id } = req.params;
    const { body } = req;

    const employee = await Employee.findById(id);
    if (!employee) {
      return reply.code(404).send({ message: "Employee not found" });
    }

    for (const key in body) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        const part = body[key];
        if (part.file) {
          const filePath = await saveFile(part);
          if (key.startsWith("documents.")) {
            const docKey = key.split(".")[1];
            employee.documents[docKey] = filePath;
          } else {
            employee[key] = filePath;
          }
        } else if (part.value !== undefined) {
          if (key.includes(".")) {
            const [parent, child] = key.split(".");
            if (!employee[parent]) employee[parent] = {};
            employee[parent][child] = part.value;
          } else {
            employee[key] = part.value;
          }
        }
      }
    }

    const updatedEmployee = await employee.save();

    reply
      .code(200)
      .send({
        message: "Employee updated successfully",
        employee: updatedEmployee,
      });
  } catch (error) {
    req.log.error(error);
    reply.code(500).send({ message: "Server error", error: error.message });
  }
};

exports.deleteById = async (req, reply) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndDelete(id);

    if (!employee) {
      return reply.code(404).send({ message: "Employee not found" });
    }

    reply.code(200).send({ message: "Employee deleted successfully" });
  } catch (error) {
    req.log.error(error);
    reply.code(500).send({ message: "Server error", error: error.message });
  }
};
