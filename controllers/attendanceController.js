const attendanceService = require('../services/attendanceService');

// Upload attendance data from frontend
exports.uploadAttendanceData = async (request, reply) => {
  try {
    const { attendanceData, dateHeaders, reportPeriod } = request.body;

    if (!attendanceData || !dateHeaders || !reportPeriod) {
      return reply.status(400).send({
        success: false,
        message: "Attendance data, date headers, and report period are required"
      });
    }

    const result = await attendanceService.processAndSaveCSVExcelData(
      attendanceData,
      dateHeaders,
      reportPeriod
    );

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        message: result.message || "Failed to process attendance data"
      });
    }

    reply.status(200).send({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error("Error uploading attendance data:", error);
    reply.status(500).send({
      success: false,
      message: "Error uploading attendance data",
      error: error.message
    });
  }
};

// Get attendance records for an employee
exports.getEmployeeAttendance = async (request, reply) => {
  try {
    const { employeeId } = request.params;
    const { periodFrom, periodTo } = request.query;

    const records = await attendanceService.getEmployeeAttendance(employeeId, periodFrom, periodTo);

    reply.status(200).send({
      success: true,
      data: records
    });
  } catch (error) {
    console.error("Error fetching employee attendance:", error);
    reply.status(500).send({
      success: false,
      message: "Error fetching employee attendance",
      error: error.message
    });
  }
};

// Get all attendance records
exports.getAllAttendance = async (request, reply) => {
  try {
    const { periodFrom, periodTo } = request.query;

    const records = await attendanceService.getAllEmployeesAttendance(periodFrom, periodTo);

    reply.status(200).send({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error("Error fetching all attendance:", error);
    reply.status(500).send({
      success: false,
      message: "Error fetching all attendance",
      error: error.message
    });
  }
};

// Get attendance summary
exports.getAttendanceSummary = async (request, reply) => {
  try {
    const { employeeId } = request.params;
    const { periodFrom, periodTo } = request.query;

    const summary = await attendanceService.getAttendanceSummary(employeeId, periodFrom, periodTo);

    reply.status(200).send({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error("Error fetching attendance summary:", error);
    reply.status(500).send({
      success: false,
      message: "Error fetching attendance summary",
      error: error.message
    });
  }
};

// Get attendance statistics
exports.getAttendanceStats = async (request, reply) => {
  try {
    const stats = await attendanceService.getAttendanceStats();

    reply.status(200).send({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error fetching attendance stats:", error);
    reply.status(500).send({
      success: false,
      message: "Error fetching attendance stats",
      error: error.message
    });
  }
};

// Delete attendance record
exports.deleteAttendanceRecord = async (request, reply) => {
  try {
    const { recordId } = request.params;

    const deletedRecord = await attendanceService.deleteAttendanceRecord(recordId);

    if (!deletedRecord) {
      return reply.status(404).send({
        success: false,
        message: "Attendance record not found"
      });
    }

    reply.status(200).send({
      success: true,
      message: "Attendance record deleted successfully",
      data: deletedRecord
    });
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    reply.status(500).send({
      success: false,
      message: "Error deleting attendance record",
      error: error.message
    });
  }
};