import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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

  // Print Individual Student Card
  const handlePrintCard = (student: StudentWithQr) => {
    setSelectedStudent(student);
    setIsCardModalOpen(true);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const activeStudents = students.filter((s) => s.hasActiveQr);

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

          <button
            onClick={() => setIsPrintSheetOpen(true)}
            disabled={summary.activeQrsCount === 0}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Print All A4 Sheets</span>
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
          MODAL 2: A4 SHEET PRINT PREVIEW (MULTI-CARD BATCH PRINTING)
         ========================================================================= */}
      <Modal
        isOpen={isPrintSheetOpen}
        onClose={() => setIsPrintSheetOpen(false)}
        title="A4 Printable Sheet (Bulk Table QR Cards)"
        maxWidth="lg"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900">
            <div>
              <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                Ready to Print {activeStudents.length} Active Cards
              </h4>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                Formatted in a 4-card grid per A4 page with dashed scissor cut guidelines.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Sheets Now</span>
            </button>
          </div>

          {/* Scrollable Preview Grid */}
          <div
            id="printable-a4-sheet"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800"
          >
            {activeStudents.map((student) => (
              <div
                key={student._id}
                className="bg-white text-slate-900 border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center relative shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <img src="/Logo.png" alt="Logo" className="w-5 h-5 object-contain" />
                  <span className="text-[11px] font-black tracking-tight text-slate-900">
                    LAKSHYA SMART LIBRARY
                  </span>
                </div>

                <div>
                  <h5 className="font-black text-sm text-slate-900 truncate">
                    {student.name}
                  </h5>
                  <p className="text-[10px] font-mono font-bold text-slate-500">
                    ID: {student.studentIdNumber || 'N/A'}
                  </p>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-600 text-white font-bold text-[10px] my-1">
                    Seat: {student.assignedSeatNumber || 'N/A'}
                  </div>
                </div>

                <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center my-2">
                  <QRCodeSVG
                    value={student.qr?.qrPayloadString || student.qr?.qrToken || ''}
                    size={128}
                    level="H"
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-slate-800">
                    Scan for Entry & Exit Attendance
                  </p>
                  <p className="text-[9px] text-slate-400">✂️ Cut along dashed border</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Global CSS for Clean Vector Printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-single-card,
          #printable-single-card *,
          #printable-a4-sheet,
          #printable-a4-sheet * {
            visibility: visible;
          }
          #printable-single-card {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 90mm;
            border: 2px dashed #94a3b8 !important;
            padding: 8mm !important;
          }
          #printable-a4-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12mm !important;
            background: white !important;
            padding: 8mm !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
};
