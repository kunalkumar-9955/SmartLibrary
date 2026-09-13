import { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { Attendance } from '../models/Attendance';
import { User } from '../models/User';
import { sendError } from '../utils/response';

export const exportAttendanceExcel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, startDate, endDate, studentId } = req.query;

    const query: any = {};

    let filenameDateStr = '';
    const todayStr = new Date().toISOString().split('T')[0];

    if (date) {
      query.attendanceDate = date;
      filenameDateStr = date as string;
    } else if (startDate && endDate) {
      query.attendanceDate = { $gte: startDate, $lte: endDate };
      filenameDateStr = `${startDate}_to_${endDate}`;
    } else {
      query.attendanceDate = todayStr;
      filenameDateStr = todayStr;
    }

    if (studentId) {
      query.studentId = studentId;
    }

    // Fetch attendance records
    const records = await Attendance.find(query)
      .populate('studentId', 'name studentIdNumber phone email')
      .sort({ entryTime: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Library System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Attendance Logs');

    // Header styling
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Student ID', key: 'studentId', width: 14 },
      { header: 'Student Name', key: 'name', width: 22 },
      { header: 'Mobile', key: 'phone', width: 16 },
      { header: 'Seat', key: 'seat', width: 10 },
      { header: 'Entry Time', key: 'entryTime', width: 14 },
      { header: 'Exit Time', key: 'exitTime', width: 14 },
      { header: 'Duration', key: 'duration', width: 14 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Indigo-600
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    // Add data rows
    records.forEach((r: any) => {
      const student = r.studentId;
      const entryTimeStr = new Date(r.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const exitTimeStr = r.exitTime
        ? new Date(r.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Still Inside';

      const durationStr = r.durationMinutes
        ? `${Math.floor(r.durationMinutes / 60)}h ${r.durationMinutes % 60}m`
        : '--';

      const row = worksheet.addRow({
        date: r.attendanceDate,
        studentId: student?.studentIdNumber || r.studentIdNumber || 'N/A',
        name: student?.name || r.studentName,
        phone: student?.phone || 'N/A',
        seat: r.seatNumber ? `Seat ${r.seatNumber}` : 'N/A',
        entryTime: entryTimeStr,
        exitTime: exitTimeStr,
        duration: durationStr,
      });

      row.alignment = { vertical: 'middle', horizontal: 'center' };
      row.height = 20;
    });

    const filename = `Library_Attendance_${filenameDateStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};
