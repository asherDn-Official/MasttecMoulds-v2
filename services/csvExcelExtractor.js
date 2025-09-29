class CSVExcelExtractor {
    processAttendanceData(attendanceData, dateHeaders, reportPeriod) {
        try {
            console.log('Raw attendance data sample:', JSON.stringify(attendanceData[0], null, 2));
            console.log(`Processing ${attendanceData.length} employees with ${dateHeaders.length} date columns`);

            const processedEmployees = [];

            for (const employee of attendanceData) {
                const processedEmployee = this.processEmployeeData(employee, dateHeaders, reportPeriod);
                if (processedEmployee) {
                    processedEmployees.push(processedEmployee);
                }
            }

            return {
                reportOverallDate: new Date().toISOString().split('T')[0],
                reportPeriodFrom: reportPeriod.from,
                reportPeriodTo: reportPeriod.to,
                employees: processedEmployees
            };

        } catch (error) {
            console.error('Error in processAttendanceData:', error);
            throw error;
        }
    }

    processEmployeeData(employee, dateHeaders, reportPeriod) {
        try {
            const employeeId = employee.number || employee.employeeId || employee.id;
            const employeeName = employee.name || employee.employeeName;

            console.log(`Processing employee ${employeeId}: ${employeeName}`);
            console.log('Employee details structure:', employee.details ? `Array of ${employee.details.length} items` : 'No details');
            console.log('Employee summary:', employee.summary);

            // Process daily attendance from details array
            const dailyAttendance = [];
            const details = employee.details || [];

            // Debug: Log first few details to understand structure
            if (details.length > 0) {
                console.log('First 3 details samples:');
                for (let i = 0; i < Math.min(3, details.length); i++) {
                    console.log(`Detail ${i}:`, details[i]);
                }
            }

            // Map details to dates - FIXED: Better alignment logic
            for (let i = 0; i < dateHeaders.length; i++) {
                const date = dateHeaders[i];
                let detail = null;

                // Try different ways to find the matching detail
                if (i < details.length) {
                    detail = details[i]; // Direct index mapping
                } else {
                    // Look for detail with matching date
                    detail = details.find(d => {
                        if (d && typeof d === 'object') {
                            return d.date === date || 
                                   d.Date === date || 
                                   (d.day && d.day.toString() === new Date(date).getDate().toString());
                        }
                        return false;
                    });
                }

                // Parse the detail object to extract attendance information
                const attendanceRecord = this.parseAttendanceDetail(detail, date);
                dailyAttendance.push(attendanceRecord);
            }

            // Calculate monthly summary from the provided summary object
            const monthlySummary = this.processMonthlySummary(employee.summary);

            const result = {
                id: employeeId,
                name: employeeName,
                department: employee.department || '',
                designation: employee.designation || '',
                category: employee.category || '',
                branch: employee.branch || '',
                attendance: dailyAttendance,
                summary: monthlySummary
            };

            console.log(`Processed employee ${employeeId}:`, {
                dailyAttendanceCount: result.attendance.length,
                summary: result.summary
            });

            return result;

        } catch (error) {
            console.error(`Error processing employee ${employee.number}:`, error);
            return null;
        }
    }

    parseAttendanceDetail(detail, date) {
        // Default values
        let status = '';
        let shift = '';
        let timeIn = '';
        let timeOut = '';
        let workedHrs = '';
        let late = '';
        let earlyOut = '';
        let ot1 = '';
        let ot2 = '';

        if (detail && typeof detail === 'object') {
            console.log('Parsing detail object:', detail);
            
            // Extract values with multiple possible field names
            status = detail.status || detail.Status || detail.STATUS || '';
            shift = detail.shift || detail.Shift || detail.SHIFT || '';
            timeIn = detail.timeIn || detail.TimeIn || detail['Time In'] || detail['TIME IN'] || '';
            timeOut = detail.timeOut || detail.TimeOut || detail['Time Out'] || detail['TIME OUT'] || '';
            workedHrs = detail.workedHrs || detail.WorkedHrs || detail['Worked Hrs'] || detail['WORKED HRS'] || '';
            late = detail.late || detail.Late || detail.LATE || '';
            earlyOut = detail.earlyOut || detail.EarlyOut || detail['Early Out'] || detail['EARLY OUT'] || '';
            ot1 = detail.ot1 || detail.Ot1 || detail.OT1 || detail.ot || detail.Ot || detail.OT || '';
            ot2 = detail.ot2 || detail.Ot2 || detail.OT2 || '';

            // Map status abbreviations to consistent format
            if (status) {
                status = status.toUpperCase();
                if (status === 'P' || status === 'PRESENT') status = 'PRE';
                else if (status === 'A' || status === 'ABSENT') status = 'ABS';
                else if (status === 'WO' || status === 'OFF' || status === 'WEEKLY OFF') status = 'OFF';
                else if (status === 'H' || status === 'HOLIDAY') status = 'HOLIDAY';
                else if (status === 'L' || status === 'LEAVE') status = 'ABS';
                // Keep ABS/PRE as is
            }

            // Format time values if needed
            if (timeIn && !timeIn.includes(':')) {
                timeIn = this.formatTime(timeIn);
            }
            if (timeOut && !timeOut.includes(':')) {
                timeOut = this.formatTime(timeOut);
            }

        } else if (detail && typeof detail === 'string') {
            // Fallback for string-based parsing
            const detailUpper = detail.toUpperCase();
            if (detailUpper.includes('PRESENT') || detailUpper === 'P') {
                status = 'PRE';
            } else if (detailUpper.includes('ABSENT') || detailUpper === 'A') {
                status = 'ABS';
            } else if (detailUpper.includes('OFF') || detailUpper === 'WO') {
                status = 'OFF';
            } else if (detailUpper.includes('HOLIDAY') || detailUpper === 'H') {
                status = 'HOLIDAY';
            } else if (detailUpper.includes('LEAVE') || detailUpper === 'L') {
                status = 'ABS';
            }
        }

        const result = {
            date: date, // Always use the date from headers
            status,
            shift,
            timeIn,
            timeOut,
            workedHrs,
            late,
            earlyOut,
            ot1,
            ot2
        };

        console.log(`Parsed attendance for ${date}:`, result);
        return result;
    }

    formatTime(timeStr) {
        // Convert "1330" to "13:30" or "930" to "09:30"
        if (!timeStr) return '';
        
        const str = timeStr.toString().replace(/\D/g, '');
        if (str.length === 3) {
            return `0${str.slice(0, 1)}:${str.slice(1)}`;
        } else if (str.length === 4) {
            return `${str.slice(0, 2)}:${str.slice(2)}`;
        }
        return timeStr;
    }

    processMonthlySummary(summary) {
        if (!summary) {
            return {
                presentDays: '0',
                paidLeaveDays: '0',
                lopDays: '0',
                weeklyOffDays: '0',
                holidays: '0',
                onDutyDays: '0',
                absentDays: '0',
                totalWorkedHrs: '0:00',
                totalLate: '0:00',
                totalEarlyOut: '0:00',
                totalOT1: '0:00',
                totalOT2: '0:00',
                totalOT3: '0:00'
            };
        }

        console.log('Processing summary:', summary);

        // Map the summary object to our expected format with multiple possible field names
        return {
            presentDays: summary.Present || summary.presentDays || summary.PRESENT || summary.present || '0',
            paidLeaveDays: summary['Paid Leave'] || summary.paidLeaveDays || summary['PAID LEAVE'] || summary.paidLeave || '0',
            lopDays: summary['L.O.P.'] || summary.lopDays || summary.LOP || summary.lop || '0',
            weeklyOffDays: summary['Weekly OFF'] || summary.weeklyOffDays || summary['WEEKLY OFF'] || summary.weeklyOff || '0',
            holidays: summary.Holiday || summary.holidays || summary.HOLIDAY || summary.holiday || '0',
            onDutyDays: summary['On Duty'] || summary.onDutyDays || summary['ON DUTY'] || summary.onDuty || '0',
            absentDays: summary.Absent || summary.absentDays || summary.ABSENT || summary.absent || '0',
            totalWorkedHrs: summary['Worked Hrs.'] || summary.totalWorkedHrs || summary['WORKED HRS'] || summary.workedHrs || '0:00',
            totalLate: summary.Late || summary.totalLate || summary.LATE || summary.late || '0:00',
            totalEarlyOut: summary['Early Out'] || summary.totalEarlyOut || summary['EARLY OUT'] || summary.earlyOut || '0:00',
            totalOT1: summary['OT 1'] || summary.totalOT1 || summary.OT1 || summary.ot1 || '0:00',
            totalOT2: summary['OT 2'] || summary.totalOT2 || summary.OT2 || summary.ot2 || '0:00',
            totalOT3: summary['OT 3'] || summary.totalOT3 || summary.OT3 || summary.ot3 || '0:00'
        };
    }
}

module.exports = new CSVExcelExtractor();