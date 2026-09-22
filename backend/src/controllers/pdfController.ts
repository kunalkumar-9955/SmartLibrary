import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { Attendance } from '../models/Attendance';
import {
  getISTDateString,
  formatISTTime,
  formatISTDateTime,
  calculateDurationString,
} from '../utils/timeHelper';

interface ReportRow {
  date: string;
  studentId: string;
  name: string;
  phone: string;
  seat: string;
  entryTime: string;
  exitTime: string;
  duration: string;
  source: string;
}

export const exportAttendancePDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, startDate, endDate, studentId } = req.query;

    const query: any = {};
    const todayStr = getISTDateString();
    let filenameDateStr = '';
    let reportFilterSubtitle = '';

    if (date && String(date).trim() !== '') {
      const cleanDate = String(date).trim();
      query.attendanceDate = cleanDate;
      filenameDateStr = cleanDate;
      reportFilterSubtitle = `Date: ${cleanDate}`;
    } else if (startDate && endDate) {
      const cleanStart = String(startDate).trim();
      const cleanEnd = String(endDate).trim();
      query.attendanceDate = { $gte: cleanStart, $lte: cleanEnd };
      filenameDateStr = `${cleanStart}-to-${cleanEnd}`;
      reportFilterSubtitle = `Date Range: ${cleanStart} to ${cleanEnd}`;
    } else {
      filenameDateStr = `ALL-${todayStr}`;
      reportFilterSubtitle = `Complete Historical Database Export (Up to ${todayStr})`;
    }

    if (studentId) {
      query.studentId = studentId;
    }

    // Fetch attendance records sorted by entryTime descending
    const records = await Attendance.find(query)
      .populate('studentId', 'name studentIdNumber phone email')
      .sort({ entryTime: -1 });

    const rows: ReportRow[] = records.map((r: any) => {
      const student = r.studentId;
      const entryTimeStr = formatISTTime(r.entryTime);
      const exitTimeStr = r.exitTime ? formatISTTime(r.exitTime) : 'Still Inside';
      const durationStr = calculateDurationString(r.entryTime, r.exitTime, r.durationMinutes);
      const sourceStr = r.attendanceSource || (r.entryMethod === 'QR' ? 'LIVE_QR' : 'MANUAL');

      return {
        date: r.attendanceDate || getISTDateString(r.entryTime),
        studentId: student?.studentIdNumber || r.studentIdNumber || 'N/A',
        name: student?.name || r.studentName || 'N/A',
        phone: student?.phone || 'N/A',
        seat: r.seatNumber ? `Seat ${r.seatNumber}` : 'N/A',
        entryTime: entryTimeStr,
        exitTime: exitTimeStr,
        duration: durationStr,
        source: sourceStr,
      };
    });

    const filename = `Lakshya-Smart-Library-Attendance-Report-${filenameDateStr}.pdf`;

    // Response headers for mobile and desktop PDF viewing/downloading
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // A4 landscape dimensions: 841.89 x 595.28 pt
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
      bufferPages: true,
      info: {
        Title: 'Lakshya Smart Library - Attendance Report',
        Author: 'Lakshya Smart Library',
        Subject: 'Official Attendance Report',
      },
    });

    // Pipe PDF to HTTP response stream
    doc.pipe(res);

    const marginLeft = 30;
    const marginTop = 30;
    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const contentWidth = pageWidth - marginLeft * 2; // ~781.89 pt
    const bottomMargin = 40;

    // Table Column Budget (Sum = 780 pt)
    const columns = [
      { key: 'date', label: 'Date', width: 75, align: 'center' },
      { key: 'studentId', label: 'Student ID', width: 75, align: 'center' },
      { key: 'name', label: 'Student Name', width: 140, align: 'left' },
      { key: 'phone', label: 'Mobile', width: 85, align: 'center' },
      { key: 'seat', label: 'Seat', width: 60, align: 'center' },
      { key: 'entryTime', label: 'Entry Time', width: 85, align: 'center' },
      { key: 'exitTime', label: 'Exit Time', width: 85, align: 'center' },
      { key: 'duration', label: 'Duration', width: 85, align: 'center' },
      { key: 'source', label: 'Source', width: 90, align: 'center' },
    ] as const;

    const rowHeight = 20;
    const headerHeight = 24;

    // Helper: Draw page header
    const drawPageHeader = (pageNumber: number) => {
      let currentY = marginTop;

      // Title Banner
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#1E293B')
        .text('LAKSHYA SMART LIBRARY', marginLeft, currentY, {
          width: contentWidth,
          align: 'center',
        });

      currentY += 20;

      // Subtitle
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#4F46E5')
        .text('Attendance Report', marginLeft, currentY, {
          width: contentWidth,
          align: 'center',
        });

      currentY += 16;

      // Filter & Generation Metadata
      const exportedAtStr = formatISTDateTime(new Date());
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748B')
        .text(
          `${reportFilterSubtitle}  |  Exported on: ${exportedAtStr} (IST)  |  Total Records: ${rows.length}`,
          marginLeft,
          currentY,
          { width: contentWidth, align: 'center' }
        );

      currentY += 16;

      // Divider Line
      doc
        .strokeColor('#CBD5E1')
        .lineWidth(0.75)
        .moveTo(marginLeft, currentY)
        .lineTo(marginLeft + contentWidth, currentY)
        .stroke();

      currentY += 10;
      return currentY;
    };

    // Helper: Draw Table Header Row
    const drawTableHeader = (startY: number) => {
      // Header Background Fill
      doc
        .rect(marginLeft, startY, contentWidth, headerHeight)
        .fill('#4F46E5');

      let currentX = marginLeft;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');

      columns.forEach((col) => {
        doc.text(col.label, currentX + 3, startY + 7, {
          width: col.width - 6,
          align: col.align,
          ellipsis: true,
        });
        currentX += col.width;
      });

      return startY + headerHeight;
    };

    // Start First Page
    let currentY = drawPageHeader(1);
    currentY = drawTableHeader(currentY);

    if (rows.length === 0) {
      currentY += 20;
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748B')
        .text('No attendance records found for the selected criteria.', marginLeft, currentY, {
          width: contentWidth,
          align: 'center',
        });
    } else {
      // Draw Data Rows
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Check if page break is needed
        if (currentY + rowHeight > pageHeight - bottomMargin) {
          doc.addPage();
          currentY = drawPageHeader(doc.bufferedPageRange().count);
          currentY = drawTableHeader(currentY);
        }

        // Alternating row background
        const isEven = i % 2 === 0;
        doc
          .rect(marginLeft, currentY, contentWidth, rowHeight)
          .fill(isEven ? '#FFFFFF' : '#F8FAFC');

        // Row bottom border
        doc
          .strokeColor('#E2E8F0')
          .lineWidth(0.5)
          .moveTo(marginLeft, currentY + rowHeight)
          .lineTo(marginLeft + contentWidth, currentY + rowHeight)
          .stroke();

        let currentX = marginLeft;
        doc.font('Helvetica').fontSize(8).fillColor('#1E293B');

        columns.forEach((col) => {
          let cellText = (row as any)[col.key] || '--';

          // Visual badges for Seat or Exit Time
          if (col.key === 'exitTime' && cellText === 'Still Inside') {
            doc.font('Helvetica-Bold').fillColor('#059669'); // Emerald green for active inside
          } else if (col.key === 'source') {
            doc.font('Helvetica').fillColor('#6B7280');
          } else {
            doc.font('Helvetica').fillColor('#1E293B');
          }

          doc.text(String(cellText), currentX + 3, currentY + 5.5, {
            width: col.width - 6,
            align: col.align,
            ellipsis: true,
          });

          currentX += col.width;
        });

        currentY += rowHeight;
      }
    }

    // Add Page Numbers and Footer to all buffered pages
    const pageRange = doc.bufferedPageRange();
    const totalPages = pageRange.count;

    for (let p = 0; p < totalPages; p++) {
      doc.switchToPage(p);

      // Footer Divider
      const footerY = pageHeight - bottomMargin + 10;
      doc
        .strokeColor('#E2E8F0')
        .lineWidth(0.5)
        .moveTo(marginLeft, footerY)
        .lineTo(marginLeft + contentWidth, footerY)
        .stroke();

      // Footer Text
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#94A3B8')
        .text('Lakshya Smart Library System  •  Official Attendance Record', marginLeft, footerY + 5, {
          width: contentWidth / 2,
          align: 'left',
        });

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#94A3B8')
        .text(`Page ${p + 1} of ${totalPages}`, marginLeft + contentWidth / 2, footerY + 5, {
          width: contentWidth / 2,
          align: 'right',
        });
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};
