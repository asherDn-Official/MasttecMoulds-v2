const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const attendanceService = require('../services/attendanceService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
}); 

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// POST /api/attendance/upload - Upload and process PDF
router.post('/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No PDF file uploaded'
            });
        }

        console.log(`Processing uploaded file: ${req.file.originalname}`);
        
        const result = await attendanceService.extractAndSaveAttendanceData(
            req.file.path, 
            req.file.originalname
        );

        // Clean up uploaded file after processing
        fs.unlinkSync(req.file.path);

        res.json(result);
    } catch (error) {
        console.error('Upload processing error:', error);
        
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: 'Error processing PDF file',
            error: error.message
        });
    }
});

// POST /api/attendance/process-local - Process local PDF file
router.post('/process-local', async (req, res) => {
    try {
        const { filePath } = req.body;
        
        if (!filePath) {
            return res.status(400).json({
                success: false,
                message: 'File path is required'
            });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found at specified path'
            });
        }

        const fileName = path.basename(filePath);
        const result = await attendanceService.extractAndSaveAttendanceData(filePath, fileName);

        res.json(result);
    } catch (error) {
        console.error('Local file processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing PDF file',
            error: error.message
        });
    }
});

// POST /api/attendance/upload-csv-excel - Process CSV/Excel data from frontend
router.post('/upload-csv-excel', async (req, res) => {
    try {
        const { attendanceData, dateHeaders, reportPeriod } = req.body;
        // console.log("Received attendanceData:", attendanceData);
        // console.log("Received dateHeaders:", dateHeaders);
        console.log("Received reportPeriod:", reportPeriod);

        if (!attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No attendance data provided'
            });
        }

        if (!dateHeaders || !Array.isArray(dateHeaders)) {
            return res.status(400).json({
                success: false,
                message: 'Date headers are required'
            });
        }

        if (!reportPeriod || !reportPeriod.from || !reportPeriod.to) {
            return res.status(400).json({
                success: false,
                message: 'Report period (from and to dates) is required'
            });
        }

        console.log(`Processing CSV/Excel data for ${attendanceData.length} employees`);
        
        const result = await attendanceService.processAndSaveCSVExcelData(
            attendanceData,
            dateHeaders,
            reportPeriod
        );

        res.json(result);
    } catch (error) {
        console.error('CSV/Excel processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing CSV/Excel data',
            error: error.message
        });
    }
});

// GET /api/attendance/employee/:employeeId - Get specific employee attendance
router.get('/employee/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { periodFrom, periodTo } = req.query;

        const records = await attendanceService.getEmployeeAttendance(employeeId, periodFrom, periodTo);

        res.json({
            success: true,
            data: records
        });
    } catch (error) {
        console.error('Error fetching employee attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching employee attendance',
            error: error.message
        });
    }
});

// GET /api/attendance/all - Get all employees attendance
router.get('/all', async (req, res) => {
    try {
        const { periodFrom, periodTo, page = 1, limit = 50 } = req.query;

        const records = await attendanceService.getAllEmployeesAttendance(periodFrom, periodTo);

        // Implement pagination
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedRecords = records.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: paginatedRecords,
            pagination: {
                currentPage: parseInt(page),
                totalRecords: records.length,
                totalPages: Math.ceil(records.length / limit),
                hasNext: endIndex < records.length,
                hasPrev: startIndex > 0
            }
        });
    } catch (error) {
        console.error('Error fetching all attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance records',
            error: error.message
        });
    }
});

// GET /api/attendance/daily/:date - Get all employees attendance for a specific date
router.get('/daily/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { employeeId } = req.query;

        const records = await attendanceService.getEmployeeDailyAttendance(employeeId, date);

        res.json({
            success: true,
            data: records
        });
    } catch (error) {
        console.error('Error fetching daily attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching daily attendance',
            error: error.message
        });
    }
});

// GET /api/attendance/summary - Get attendance summary
router.get('/summary', async (req, res) => {
    try {
        const { employeeId, periodFrom, periodTo } = req.query;

        const summaries = await attendanceService.getAttendanceSummary(employeeId, periodFrom, periodTo);

        res.json({
            success: true,
            data: summaries
        });
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance summary',
            error: error.message
        });
    }
});

// GET /api/attendance/stats - Get attendance statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await attendanceService.getAttendanceStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching attendance stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance statistics',
            error: error.message
        });
    }
});

// DELETE /api/attendance/:recordId - Delete attendance record
router.delete('/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;

        const deletedRecord = await attendanceService.deleteAttendanceRecord(recordId);

        if (!deletedRecord) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        res.json({
            success: true,
            message: 'Attendance record deleted successfully',
            data: deletedRecord
        });
    } catch (error) {
        console.error('Error deleting attendance record:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting attendance record',
            error: error.message
        });
    }
});

// GET /api/attendance/date-range - Get attendance by date range
router.get('/date-range', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        const records = await attendanceService.getAttendanceByDateRange(startDate, endDate);

        res.json({
            success: true,
            data: records
        });
    } catch (error) {
        console.error('Error fetching attendance by date range:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance by date range',
            error: error.message
        });
    }
});

module.exports = router;