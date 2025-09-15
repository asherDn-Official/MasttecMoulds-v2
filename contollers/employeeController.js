const Employee = require("../models/Employee");
const fs = require("node:fs");
const util = require("node:util");
const { pipeline } = require("node:stream");
const path = require("node:path");

const pump = util.promisify(pipeline);

exports.create = async (req, reply) => {
  try {
    const parts = req.parts();
    const body = {};
    const filePaths = {};

    for await (const part of parts) {
      if (part.file) {
      
        const uniqueFilename = `${Date.now()}-${part.filename.replace(/\s/g, '_')}`;
        const uploadPath = path.join(__dirname, '..', 'uploads', uniqueFilename);
        
       
        const writeStream = fs.createWriteStream(uploadPath);
        await pump(part.file, writeStream);


        filePaths[part.fieldname] = `/uploads/${uniqueFilename}`;
      } else {
      
        if (part.fieldname.startsWith('bankDetails') || part.fieldname.startsWith('documents')) {
       
            const keys = part.fieldname.replace(/\]/g, '').split('[');
            let current = body;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = current[keys[i]] || {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = part.value;
        } else {
            body[part.fieldname] = part.value;
        }
      }
    }

    
    const employeeData = {
      ...body,
      employeePicture: filePaths.employeePicture || null,
      documents: {
        addressProof: filePaths.addressProof || null,
        educationCertificate: filePaths.educationCertificate || null,
        passbookProof: filePaths.passbookProof || null,
        PANCardProof: filePaths.PANCardProof || null,
      },
    };


    if (body.employeeName && !body.employeeFirstName) {
        const nameParts = body.employeeName.split(' ');
        employeeData.employeeFirstName = nameParts[0];
        employeeData.employeeLastName = nameParts.slice(1).join(' ');
    }

    const newEmployee = new Employee(employeeData);
    await newEmployee.save();

    reply.code(201).send({ message: "Employee created successfully", employee: newEmployee });
  } catch (error) {
    req.log.error(error);
    reply.code(500).send({ message: "Server error" });
  }
};
