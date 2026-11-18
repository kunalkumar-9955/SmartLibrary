import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { personalQrService } from '../../services/api';
import { StudentWithQr, PersonalQrListResponse } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/Modal';
import { createZipBlob } from '../../utils/zipHelper';
import {
  Search,
  Filter,
  RefreshCw,
  Printer,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Users,
  Armchair,
  Scissors,
  FileArchive,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Trash2,
  FileText,
} from 'lucide-react';

export const AdminQRPage: React.FC = () => {
  const [students, setStudents] = useState<StudentWithQr[]>([]);
  const [summary, setSummary] = useState({ totalStudents: 0, activeQrsCount: 0, missingQrsCount: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'active' | 'missing'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState<boolean>(false);
  const [isBulkActivating, setIsBulkActivating] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Modals
  const [selectedStudent, setSelectedStudent] = useState<StudentWithQr | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [isPrintSheetOpen, setIsPrintSheetOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [gridLayout, setGridLayout] = useState<'3x2' | '2x3'>('3x2');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPrintingSheets, setIsPrintingSheets] = useState<boolean>(false);

  // Hidden container for offscreen rendering & canvas conversion
  const hiddenQrRef = useRef<HTMLDivElement>(null);

  const { success, error } = useToast();

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await personalQrService.getStudents({ search, filter });
      if (res.data.success) {
        const data = res.data.data as PersonalQrListResponse;
        setStudents(data.students || []);
        setSummary(data.summary || { totalStudents: 0, activeQrsCount: 0, missingQrsCount: 0 });
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load students list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [filter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // 1. Generate Individual QR
  const handleGenerateIndividual = async (studentId: string) => {
    try {
      setActionLoadingId(studentId);
      const res = await personalQrService.generate(studentId);
      if (res.data.success) {
        success('Personal QR code generated successfully!');
        await fetchStudents();
        // If preview modal is open for this student, update it
        if (selectedStudent && selectedStudent._id === studentId) {
          const updated = res.data.data.qr;
          setSelectedStudent((prev) =>
            prev ? { ...prev, hasActiveQr: true, qr: updated } : null
          );
        }
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to generate QR');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 2. Regenerate / Revoke QR
  const handleRegenerate = async (student: StudentWithQr) => {
    const confirmed = window.confirm(
      `Are you sure you want to REGENERATE the personal QR for ${student.name} (${student.studentIdNumber})?\n\nThe previously printed QR code will be PERMANENTLY REVOKED and will immediately stop working.`
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(student._id);
      const res = await personalQrService.regenerate(student._id);
      if (res.data.success) {
        success(`QR regenerated successfully for ${student.name}! Generation #${res.data.data.generationCount}`);
        await fetchStudents();
        if (selectedStudent && selectedStudent._id === student._id) {
          setSelectedStudent((prev) =>
            prev ? { ...prev, qr: res.data.data.qr } : null
          );
        }
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to regenerate QR');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. Bulk Generate Missing QRs
  const handleBulkGenerate = async () => {
    try {
      setIsBulkGenerating(true);
      const res = await personalQrService.generateBulk();
      if (res.data.success) {
        success(res.data.message || 'Bulk QR generation completed!');
        await fetchStudents();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Bulk QR generation failed');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  // 3b. Bulk Activate QRs
  const handleBulkActivate = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to BULK ACTIVATE personal QR codes for all active students?'
    );
    if (!confirmed) return;

    try {
      setIsBulkActivating(true);
      const res = await personalQrService.activateBulk();
      if (res.data.success) {
        success(res.data.message || 'Bulk QR activation completed!');
        await fetchStudents();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Bulk QR activation failed');
    } finally {
      setIsBulkActivating(false);
    }
  };

  // 3c. Reset All QRs to Initial "Not Generated" Starting Phase
  const handleResetAll = async () => {
    try {
      setIsResetting(true);
      const res = await personalQrService.resetAll();
      if (res.data.success) {
        success(res.data.message || 'All personal QR codes have been reset to starting phase (Not Generated)!');
        setIsResetModalOpen(false);
        await fetchStudents();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to reset QR codes');
    } finally {
      setIsResetting(false);
    }
  };

  // 4. Render High-Res PNG Card to Canvas and Return Data URL or Blob
  const renderStudentCardToCanvas = async (student: StudentWithQr): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    const width = 1000;
    const height = 1350;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Subtle Outer border with dashed scissor cut guides
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(30, 30, width - 60, height - 60);
    ctx.setLineDash([]); // reset

    // Card Inner Container
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(50, 50, width - 100, height - 100, 30);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top Header Banner
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(50, 50, width - 100, 150, [30, 30, 0, 0]);
    ctx.fill();

    // Header Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LAKSHYA SMART LIBRARY', width / 2, 115);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('STUDENT ATTENDANCE • PERSONAL TABLE QR', width / 2, 155);

    // Student Info Block
    ctx.fillStyle = '#1e293b';
    ctx.font = '900 42px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(student.name.toUpperCase(), width / 2, 265);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`STUDENT ID: ${student.studentIdNumber || 'N/A'}`, width / 2, 310);

    // Seat Badge Pill
    const seatText = `TABLE / SEAT: ${student.assignedSeatNumber || 'N/A'}`;
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 200, 345, 400, 60, 30);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(seatText, width / 2, 384);

    // QR Code Container Box
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 275, 440, 550, 550, 24);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw QR Code from SVG
    const token = student.qr?.qrToken || 'NO_TOKEN';
    const payloadStr = JSON.stringify({
      qrType: 'PERSONAL',
      token,
      lib: 'LAKSHYA_SMART_LIBRARY',
    });

    // Create an image from SVG string
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
      ${hiddenQrRef.current ? hiddenQrRef.current.innerHTML : ''}
    </svg>`;

    // Render using an offscreen canvas with QRCodeSVG data
    const tempSvgContainer = document.createElement('div');
    tempSvgContainer.style.position = 'fixed';
    tempSvgContainer.style.top = '-9999px';
    document.body.appendChild(tempSvgContainer);

    // Load QR as Image onto the main canvas
    await new Promise<void>((resolve) => {
      const qrCanvas = document.createElement('canvas');
      const qrImg = new Image();
      // Generate inline QR using SVG data URL
      const svgBlob = new Blob([
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
          <rect width="100%" height="100%" fill="#ffffff"/>
        </svg>`
      ], { type: 'image/svg+xml' });

      // We use the rendered SVG element inside the DOM
      const existingSvg = document.getElementById(`qr-svg-${student._id}`);
      if (existingSvg) {
        const xml = new XMLSerializer().serializeToString(existingSvg);
        const svg64 = btoa(unescape(encodeURIComponent(xml)));
        const b64Start = 'data:image/svg+xml;base64,';
        const image64 = b64Start + svg64;
        qrImg.onload = () => {
          ctx.drawImage(qrImg, width / 2 - 240, 475, 480, 480);
          resolve();
        };
        qrImg.onerror = () => resolve();
        qrImg.src = image64;
      } else {
        resolve();
      }
    });

    // Instructions Footer
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Scan with mobile to mark Entry & Exit attendance.', width / 2, 1055);

    ctx.fillStyle = '#64748b';
    ctx.font = '18px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('This QR code is permanently assigned to this seat.', width / 2, 1095);

    // Scissor footer guide
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✂️ Cut along the outer dashed guideline and paste/place on desk table.', width / 2, 1175);

    // Watermark / Brand info
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px monospace';
    ctx.fillText(`Lakshya Smart Library • Gen #${student.qr?.generationCount || 1} • System Token Verified`, width / 2, 1225);

    return canvas;
  };

  // Download Individual PNG
  const handleDownloadPng = async (student: StudentWithQr) => {
    try {
      const canvas = await renderStudentCardToCanvas(student);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${student.studentIdNumber || 'ST'}_${student.name.replace(/\s+/g, '_')}_Table_QR.png`;
      link.href = dataUrl;
      link.click();
      success(`Downloaded QR card for ${student.name}`);
    } catch (err) {
      error('Failed to download QR image');
    }
  };

  // Bulk Download All Active QRs as ZIP
  const handleDownloadAllZip = async () => {
    const activeStudents = students.filter((s) => s.hasActiveQr && s.qr);
    if (activeStudents.length === 0) {
      error('No active student QR codes available to download.');
      return;
    }

    try {
      setIsZipping(true);
      const files: { name: string; data: Uint8Array }[] = [];

      for (const student of activeStudents) {
        const canvas = await renderStudentCardToCanvas(student);
        const blob: Blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b!), 'image/png')
        );
        const arrayBuffer = await blob.arrayBuffer();
        const fileName = `${student.studentIdNumber || 'STUDENT'}_${student.name.replace(/\s+/g, '_')}_Table_QR.png`;
        files.push({
          name: fileName,
          data: new Uint8Array(arrayBuffer),
        });
      }

      const zipBlob = createZipBlob(files);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.download = `Lakshya_Smart_Library_Student_QRs_${new Date().toISOString().slice(0, 10)}.zip`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      success(`Downloaded ZIP containing ${files.length} student QR cards!`);
    } catch (err: any) {
      error('Failed to bundle QR cards into ZIP');
    } finally {
      setIsZipping(false);
    }
  };

  // Render A4 Grid Card for PDF (6 cards per A4 page, exact 2 rows x 3 columns)
  const renderA4GridCardToCanvas = async (student: StudentWithQr): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    const width = 800;
    const height = 840;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Dashed Scissor Guide Border
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(16, 16, width - 32, height - 32);
    ctx.setLineDash([]);

    // Corner Cut Icon / Indicator
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✂️ Cut here', 26, 38);

    // Library Header
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('LAKSHYA SMART LIBRARY', width / 2, 74);

    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('STUDENT ATTENDANCE DESK CARD', width / 2, 98);

    // Student Name
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const cleanName = student.name.length > 22 ? student.name.slice(0, 20) + '…' : student.name;
    ctx.fillText(cleanName.toUpperCase(), width / 2, 145);

    // Seat Badge & Student ID
    const seatNumber = student.assignedSeatNumber || 'N/A';
    const studentId = student.studentIdNumber || 'N/A';

    // Seat pill
    const seatPillText = `SEAT: ${seatNumber}`;
    ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const seatMetrics = ctx.measureText(seatPillText);
    const pillW = seatMetrics.width + 24;
    const pillH = 34;
    const pillX = width / 2 - pillW / 2 - 55;
    const pillY = 168;

    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(seatPillText, pillX + pillW / 2, pillY + 24);

    // ID next to seat
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`ID: ${studentId}`, width / 2 + 30, pillY + 24);

    // QR Code Container Box
    const qrBoxSize = 420;
    const qrBoxX = width / 2 - qrBoxSize / 2;
    const qrBoxY = 224;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Render SVG QR code to Canvas
    const existingSvg = document.getElementById(`qr-svg-${student._id}`);
    if (existingSvg) {
      const xml = new XMLSerializer().serializeToString(existingSvg);
      const svg64 = btoa(unescape(encodeURIComponent(xml)));
      const image64 = 'data:image/svg+xml;base64,' + svg64;

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, qrBoxX + 15, qrBoxY + 15, qrBoxSize - 30, qrBoxSize - 30);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = image64;
      });
    }

    // Footer Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Scan for Entry & Exit Attendance', width / 2, 690);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✂️ Cut along dashed border & place on desk', width / 2, 725);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText(`Lakshya Smart Library • Gen #${student.qr?.generationCount || 1}`, width / 2, 770);

    return canvas;
  };

  // Download Multi-Page Print-Ready A4 PDF (2 Rows × 3 Columns per page)
  const handleDownloadA4Pdf = async () => {
    const activeOnes = students.filter((s) => s.hasActiveQr);
    if (activeOnes.length === 0) {
      error('No active student QR codes available to export.');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      const isLandscape = gridLayout === '3x2';
      const doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const cardsPerPage = 6;
      const chunks: StudentWithQr[][] = [];
      for (let i = 0; i < activeOnes.length; i += cardsPerPage) {
        chunks.push(activeOnes.slice(i, i + cardsPerPage));
      }

      for (let p = 0; p < chunks.length; p++) {
        if (p > 0) {
          doc.addPage('a4', isLandscape ? 'landscape' : 'portrait');
        }

        const chunk = chunks[p];
        for (let i = 0; i < chunk.length; i++) {
          const student = chunk[i];
          const canvas = await renderA4GridCardToCanvas(student);
          const imgData = canvas.toDataURL('image/jpeg', 0.95);

          if (isLandscape) {
            // 2 rows × 3 columns on A4 Landscape (297mm × 210mm)
            const cardW = 89;
            const cardH = 93.5;
            const col = i % 3;
            const row = Math.floor(i / 3);
            const x = 7 + col * (cardW + 4.5);
            const y = 7 + row * (cardH + 4.5);
            doc.addImage(imgData, 'JPEG', x, y, cardW, cardH);
          } else {
            // 3 rows × 2 columns on A4 Portrait (210mm × 297mm)
            const cardW = 92;
            const cardH = 89;
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 7 + col * (cardW + 6);
            const y = 8 + row * (cardH + 4.5);
            doc.addImage(imgData, 'JPEG', x, y, cardW, cardH);
          }
        }
      }

      doc.save(`Lakshya_Attendance_QR_Cards_A4_${new Date().toISOString().slice(0, 10)}.pdf`);
      success(`Downloaded A4 PDF with ${activeOnes.length} student QR cards (${chunks.length} pages)!`);
    } catch (err: any) {
      console.error('PDF export error:', err);
      error('Failed to generate A4 PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Clean Dedicated Print Function via isolated iframe (zero modal cutoff)
  const handlePrintA4Sheets = () => {
    const activeOnes = students.filter((s) => s.hasActiveQr);
    if (activeOnes.length === 0) {
      error('No active student QR codes available to print.');
      return;
    }

    try {
      setIsPrintingSheets(true);
      const isLandscape = gridLayout === '3x2';
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        setIsPrintingSheets(false);
        return;
      }

      const cardsPerPage = 6;
      const chunks: StudentWithQr[][] = [];
      for (let i = 0; i < activeOnes.length; i += cardsPerPage) {
        chunks.push(activeOnes.slice(i, i + cardsPerPage));
      }

      let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lakshya Smart Library - Attendance QR Cards</title>
  <style>
    @page {
      size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
      margin: 6mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: ${isLandscape ? '285mm' : '198mm'};
      height: ${isLandscape ? '196mm' : '283mm'};
      max-height: ${isLandscape ? '196mm' : '283mm'};
      display: grid;
      grid-template-columns: ${isLandscape ? 'repeat(3, 89mm)' : 'repeat(2, 92mm)'};
      grid-template-rows: ${isLandscape ? 'repeat(2, 93.5mm)' : 'repeat(3, 89mm)'};
      gap: ${isLandscape ? '4.5mm' : '5mm'};
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
    }
    .sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .card {
      border: 1.5px dashed #475569;
      border-radius: 10px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      height: 100%;
      max-height: 100%;
      background: #ffffff;
      box-sizing: border-box;
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      width: 100%;
    }
    .logo {
      width: 14px;
      height: 14px;
      object-fit: contain;
    }
    .title {
      font-size: 8.5px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .name {
      font-size: 12px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .badge-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin-top: 1px;
    }
    .seat-badge {
      background: #4f46e5;
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid #4338ca;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .id-badge {
      font-size: 8.5px;
      font-family: monospace;
      font-weight: 700;
      color: #334155;
    }
    .qr-box {
      width: 102px;
      height: 102px;
      margin: 1px auto;
      padding: 3px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-box svg {
      width: 94px;
      height: 94px;
    }
    .footer-text {
      font-size: 8px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
    }
    .cut-text {
      font-size: 7.5px;
      color: #64748b;
      margin-top: 1px;
    }
  </style>
</head>
<body>`;

      for (const chunk of chunks) {
        html += `<div class="sheet">`;
        for (const student of chunk) {
          const svgElem = document.getElementById(`qr-svg-${student._id}`);
          const svgHtml = svgElem ? new XMLSerializer().serializeToString(svgElem) : '';

          html += `
          <div class="card">
            <div class="header">
              <img src="/Logo.png" class="logo" />
              <span class="title">Lakshya Smart Library</span>
            </div>
            <div>
              <div class="name">${student.name}</div>
              <div class="badge-row">
                <span class="seat-badge">Seat ${student.assignedSeatNumber || 'N/A'}</span>
                <span class="id-badge">ID: ${student.studentIdNumber || 'N/A'}</span>
              </div>
            </div>
            <div class="qr-box">
              ${svgHtml}
            </div>
            <div>
              <div class="footer-text">Scan for Entry & Exit Attendance</div>
              <div class="cut-text">✂️ Cut along dashed border</div>
            </div>
          </div>`;
        }
        html += `</div>`;
      }

      html += `</body></html>`;

      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          setIsPrintingSheets(false);
        }, 3000);
      }, 500);
    } catch (err: any) {
      console.error('Print iframe error:', err);
      window.print();
      setIsPrintingSheets(false);
    }
  };

  // Print Individual Student Card
  const handlePrintCard = (student: StudentWithQr) => {
    setSelectedStudent(student);
    setIsCardModalOpen(true);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const activeStudents = students.filter((s) => s.hasActiveQr);
  const cardsPerPage = 6;
  const sheetChunks: StudentWithQr[][] = [];
  for (let i = 0; i < activeStudents.length; i += cardsPerPage) {
    sheetChunks.push(activeStudents.slice(i, i + cardsPerPage));
  }

  return (
    <div className="space-y-6 font-sans pb-16">
      {/* Hidden SVGs for Canvas export */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        {students.map((s) => (
          <div key={s._id} id={`qr-svg-container-${s._id}`}>
            <QRCodeSVG
              id={`qr-svg-${s._id}`}
              value={s.qr?.qrPayloadString || s.qr?.qrToken || `LAKSHYA_STUDENT_${s._id}`}
              size={360}
              level="H"
              includeMargin={true}
            />
          </div>
        ))}
      </div>

      {/* Screen Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <QrCode className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Student Personal QR Management
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Permanent individual QR codes printed and placed on each student's library desk for instant Entry & Exit.
          </p>
        </div>

        {/* Stats Summary Pills */}
        <div className="flex items-center gap-2 text-xs font-bold">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Students: {summary.totalStudents}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Active QRs: {summary.activeQrsCount}</span>
          </div>
          {summary.missingQrsCount > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center gap-1.5 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Missing: {summary.missingQrsCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Action & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search student by name, ID (e.g. LSL-01), email, or seat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start lg:self-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({summary.totalStudents})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filter === 'active'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 hover:text-emerald-600'
            }`}
          >
            Active ({summary.activeQrsCount})
          </button>
          <button
            onClick={() => setFilter('missing')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filter === 'missing'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-500 hover:text-amber-600'
            }`}
          >
            Missing ({summary.missingQrsCount})
          </button>
        </div>

        {/* Global Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {summary.missingQrsCount > 0 && (
            <button
              onClick={handleBulkGenerate}
              disabled={isBulkGenerating}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isBulkGenerating ? 'Generating...' : `Generate All Missing (${summary.missingQrsCount})`}</span>
            </button>
          )}

          <button
            onClick={handleBulkActivate}
            disabled={isBulkActivating}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isBulkActivating ? 'Activating...' : 'Bulk Activate QRs'}</span>
          </button>

          {summary.activeQrsCount > 0 && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-rose-600/30 cursor-pointer"
              title="Reset all generated QRs back to starting phase (Not generated)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset QRs to Starting Phase</span>
            </button>
          )}

          <button
            onClick={() => setIsPrintSheetOpen(true)}
            disabled={summary.activeQrsCount === 0}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Print All A4 Sheets</span>
          </button>

          <button
            onClick={handleDownloadA4Pdf}
            disabled={isGeneratingPdf || summary.activeQrsCount === 0}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Download multi-page print-ready A4 PDF (2 rows x 3 columns per page)"
          >
            <FileText className={`w-3.5 h-3.5 ${isGeneratingPdf ? 'animate-spin' : ''}`} />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download A4 PDF'}</span>
          </button>

          <button
            onClick={handleDownloadAllZip}
            disabled={isZipping || summary.activeQrsCount === 0}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
          >
            <FileArchive className="w-3.5 h-3.5 text-amber-500" />
            <span>{isZipping ? 'Bundling ZIP...' : 'Download ZIP'}</span>
          </button>
        </div>
      </div>

      {/* Students List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-semibold">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Loading student QR directory...
          </div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            No registered students matched your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Assigned Table / Seat</th>
                  <th className="py-3 px-4">QR Status</th>
                  <th className="py-3 px-4">Card Preview</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => {
                  const hasQr = Boolean(student.hasActiveQr && student.qr);
                  const isActionLoading = actionLoadingId === student._id;

                  return (
                    <tr
                      key={student._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Student Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {student.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {student.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Student ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {student.studentIdNumber || 'N/A'}
                      </td>

                      {/* Assigned Seat */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                          <Armchair className="w-3 h-3 text-indigo-500" />
                          Seat {student.assignedSeatNumber || 'N/A'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {hasQr ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Active (Gen #{student.qr?.generationCount || 1})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            Missing QR
                          </span>
                        )}
                      </td>

                      {/* Thumbnail QR Preview */}
                      <td className="py-3.5 px-4">
                        {hasQr ? (
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsCardModalOpen(true);
                            }}
                            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-semibold text-xs group cursor-pointer"
                          >
                            <div className="w-9 h-9 p-0.5 bg-white rounded-lg border border-slate-200 shadow-2xs group-hover:border-indigo-400 transition flex items-center justify-center">
                              <QRCodeSVG
                                value={student.qr?.qrPayloadString || student.qr?.qrToken || ''}
                                size={32}
                                level="M"
                              />
                            </div>
                            <span className="text-[11px] group-hover:underline">View Card</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Not generated</span>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasQr ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setIsCardModalOpen(true);
                                }}
                                title="View & Print Card"
                                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDownloadPng(student)}
                                title="Download High-Res PNG"
                                className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleRegenerate(student)}
                                disabled={isActionLoading}
                                title="Regenerate / Revoke Token"
                                className="p-2 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={`w-4 h-4 ${isActionLoading ? 'animate-spin' : ''}`} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleGenerateIndividual(student._id)}
                              disabled={isActionLoading}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>{isActionLoading ? 'Generating...' : 'Generate QR'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL 1: PREVIEW & PRINT SINGLE STUDENT TABLE CARD
         ========================================================================= */}
      {selectedStudent && (
        <Modal
          isOpen={isCardModalOpen}
          onClose={() => setIsCardModalOpen(false)}
          title="Personal Attendance Desk QR Card"
          maxWidth="md"
        >
          <div className="p-6 space-y-6">
            {/* Printable Card Container */}
            <div
              id="printable-single-card"
              className="bg-white text-slate-900 border-2 border-dashed border-slate-300 rounded-3xl p-6 text-center max-w-sm mx-auto shadow-md relative"
            >
              {/* Corner Scissor Guides */}
              <div className="absolute -top-3 left-6 text-slate-400 text-[10px] font-bold flex items-center gap-1 bg-white px-2">
                <Scissors className="w-3 h-3" /> Cut here
              </div>

              {/* Header */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <img src="/Logo.png" alt="Logo" className="w-7 h-7 object-contain" />
                <h3 className="text-sm font-black tracking-tight text-slate-900">
                  LAKSHYA SMART LIBRARY
                </h3>
              </div>

              {/* Badge */}
              <div className="inline-block px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider mb-4">
                Personal Table QR Card
              </div>

              {/* Student Name & ID */}
              <h4 className="text-xl font-black text-slate-900 mb-0.5">
                {selectedStudent.name}
              </h4>
              <p className="text-xs font-mono font-bold text-slate-500 mb-3">
                STUDENT ID: {selectedStudent.studentIdNumber || 'N/A'}
              </p>

              {/* Table / Seat Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-xs mb-5 shadow-sm">
                <Armchair className="w-3.5 h-3.5" />
                <span>TABLE / SEAT: {selectedStudent.assignedSeatNumber || 'N/A'}</span>
              </div>

              {/* High-Resolution QR */}
              <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl border-2 border-slate-200 shadow-xs flex items-center justify-center mb-4">
                <QRCodeSVG
                  value={selectedStudent.qr?.qrPayloadString || selectedStudent.qr?.qrToken || ''}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Instructions */}
              <p className="text-xs font-bold text-slate-800 mb-1">
                Scan this QR with your mobile for Entry & Exit attendance.
              </p>
              <p className="text-[10px] text-slate-400">
                Permanently assigned to your library table • Gen #{selectedStudent.qr?.generationCount || 1}
              </p>
            </div>

            {/* Actions Toolbar */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => window.print()}
                className="py-3 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                <span>Print Card</span>
              </button>

              <button
                onClick={() => handleDownloadPng(selectedStudent)}
                className="py-3 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/30"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </button>

              <button
                onClick={() => handleRegenerate(selectedStudent)}
                className="py-3 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <RefreshCw className="w-4 h-4 text-rose-500" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 2: A4 SHEET PRINT PREVIEW (2 ROWS × 3 COLUMNS BATCH PRINTING)
         ========================================================================= */}
      <Modal
        isOpen={isPrintSheetOpen}
        onClose={() => setIsPrintSheetOpen(false)}
        title="A4 Printable Sheet (Desk Attendance QR Cards)"
        maxWidth="2xl"
      >
        <div className="p-6 space-y-4 font-sans">
          {/* Header Controls Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-indigo-600 text-white font-bold text-xs">A4</span>
                <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-100 uppercase tracking-wide">
                  Ready to Print {activeStudents.length} Active Cards ({sheetChunks.length} Sheet{sheetChunks.length === 1 ? '' : 's'})
                </h4>
              </div>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">
                Standard <strong>2 Rows × 3 Columns (6 Cards per Sheet)</strong> with scissors cut lines and high-contrast scannable QR.
              </p>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
              {/* Layout Switcher */}
              <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setGridLayout('3x2')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    gridLayout === '3x2'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                  }`}
                  title="2 Rows × 3 Columns on Landscape A4"
                >
                  2 Rows × 3 Cols (Landscape)
                </button>
                <button
                  type="button"
                  onClick={() => setGridLayout('2x3')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    gridLayout === '2x3'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                  }`}
                  title="3 Rows × 2 Columns on Portrait A4"
                >
                  3 Rows × 2 Cols (Portrait)
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadA4Pdf}
                disabled={isGeneratingPdf}
                className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                <FileText className={`w-3.5 h-3.5 ${isGeneratingPdf ? 'animate-spin' : ''}`} />
                <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download A4 PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintA4Sheets}
                disabled={isPrintingSheets}
                className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
              >
                <Printer className={`w-3.5 h-3.5 ${isPrintingSheets ? 'animate-spin' : ''}`} />
                <span>{isPrintingSheets ? 'Opening Print...' : 'Print A4 Sheets'}</span>
              </button>
            </div>
          </div>

          {/* Printable Container / Screen Preview */}
          <div
            id="printable-a4-container"
            className="space-y-6 max-h-[65vh] overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800"
          >
            {sheetChunks.map((chunk, pageIndex) => (
              <div key={pageIndex} className="space-y-2">
                {/* Screen Preview Sheet Header (hidden on print) */}
                <div className="print-no-show flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    A4 Sheet {pageIndex + 1} of {sheetChunks.length} ({chunk.length} Cards)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {gridLayout === '3x2' ? '2 Rows × 3 Columns (Landscape)' : '3 Rows × 2 Columns (Portrait)'}
                  </span>
                </div>

                {/* The Actual A4 Sheet Grid */}
                <div
                  className={`a4-page-sheet bg-white p-3 sm:p-4 rounded-xl border border-slate-300 shadow-sm ${
                    gridLayout === '3x2'
                      ? 'grid grid-cols-1 sm:grid-cols-3 gap-3'
                      : 'grid grid-cols-1 sm:grid-cols-2 gap-3'
                  }`}
                >
                  {chunk.map((student) => (
                    <div
                      key={student._id}
                      className="qr-desk-card bg-white text-slate-900 border-2 border-dashed border-slate-300 rounded-xl p-2.5 text-center relative shadow-xs flex flex-col justify-between"
                    >
                      {/* Top: Branding */}
                      <div className="flex items-center justify-center gap-1.5 pt-0.5">
                        <img src="/Logo.png" alt="Logo" className="w-4 h-4 object-contain" />
                        <span className="text-[10px] font-black tracking-wider text-slate-900 uppercase">
                          LAKSHYA SMART LIBRARY
                        </span>
                      </div>

                      {/* Student Name & Details */}
                      <div className="my-1">
                        <h5 className="font-black text-xs text-slate-900 truncate" title={student.name}>
                          {student.name}
                        </h5>
                        <div className="flex items-center justify-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold text-[9px]">
                            Seat {student.assignedSeatNumber || 'N/A'}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-slate-600">
                            ID: {student.studentIdNumber || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* QR Code Container (Full Visibility & Crisp SVG) */}
                      <div className="w-[104px] h-[104px] mx-auto bg-white p-1 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center my-1 shrink-0">
                        <QRCodeSVG
                          value={student.qr?.qrPayloadString || student.qr?.qrToken || ''}
                          size={96}
                          level="H"
                          includeMargin={false}
                        />
                      </div>

                      {/* Bottom: Instructions & Cut Line */}
                      <div className="pb-0.5">
                        <p className="text-[9px] font-bold text-slate-800 leading-tight">
                          Scan for Entry &amp; Exit Attendance
                        </p>
                        <p className="text-[8px] text-slate-400 mt-0.5">✂️ Cut along dashed border</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Reset All QRs Confirmation Modal */}
      {isResetModalOpen && (
        <Modal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          title="Reset All QRs to Starting Phase"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-100 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-sm">Reset All Student QRs to Initial "Not Generated" State?</p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                  This will remove all existing test QR codes (such as Gen #5 and Gen #1) and return all {summary.totalStudents} students back to the initial <strong>Missing QR (Not generated)</strong> starting phase.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-slate-700 dark:text-slate-300 text-[11px]">
              <p className="font-bold text-slate-900 dark:text-white">Safety Protections:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                <li>A complete recoverable backup snapshot (<span className="font-mono font-bold">MaintenanceSnapshot</span>) is automatically saved.</li>
                <li>Student accounts, registered IDs, login passwords, attendance logs, and table seat assignments remain <strong>100% intact</strong>.</li>
                <li>After resetting, you can click <strong>"Generate All Missing ({summary.totalStudents})"</strong> and <strong>"Bulk Activate QRs"</strong> whenever you are ready to issue fresh Gen #1 QR codes for production.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetAll}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isResetting ? 'Resetting QRs...' : 'Confirm & Reset to Starting Phase'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Global CSS for Clean Vector Printing */}
      <style>{`
        @media print {
          @page {
            size: ${gridLayout === '3x2' ? 'A4 landscape' : 'A4 portrait'};
            margin: 6mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            width: 100% !important;
            height: auto !important;
          }
          body * {
            visibility: hidden;
          }
          ${
            isCardModalOpen
              ? `
              #printable-single-card,
              #printable-single-card * {
                visibility: visible;
              }
              #printable-single-card {
                position: fixed;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                width: 90mm;
                border: 2px dashed #64748b !important;
                padding: 6mm !important;
                background: white !important;
                border-radius: 16px !important;
              }
              `
              : `
              #printable-a4-container,
              #printable-a4-container * {
                visibility: visible;
              }
              #printable-a4-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
                max-height: none !important;
                overflow: visible !important;
              }
              .a4-page-sheet {
                width: 100% !important;
                height: ${gridLayout === '3x2' ? '194mm' : '280mm'} !important;
                max-height: ${gridLayout === '3x2' ? '194mm' : '280mm'} !important;
                display: grid !important;
                grid-template-columns: ${gridLayout === '3x2' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'} !important;
                grid-template-rows: ${gridLayout === '3x2' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'} !important;
                gap: 5mm !important;
                padding: 2mm !important;
                box-sizing: border-box !important;
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
              }
              .a4-page-sheet:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              .qr-desk-card {
                box-sizing: border-box !important;
                border: 2px dashed #94a3b8 !important;
                border-radius: 12px !important;
                padding: 6px 8px !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                align-items: center !important;
                text-align: center !important;
                height: 100% !important;
                max-height: 100% !important;
                overflow: hidden !important;
                background: white !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .print-no-show {
                display: none !important;
              }
              `
          }
        }
      `}</style>
    </div>
  );
};
