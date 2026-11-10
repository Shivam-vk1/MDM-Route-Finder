import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { School } from '../types';
import { UploadCloud, FileSpreadsheet, AlertTriangle, Check, RefreshCw, X, Download } from 'lucide-react';

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (schools: School[]) => void;
  currentCount: number;
  theme?: 'dark' | 'light';
}

export const ExcelUploadModal: React.FC<ExcelUploadModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  currentCount,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewSchools, setPreviewSchools] = useState<School[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Helper to safely extract cell as trimmed, sanitized string (strips formula injection & tags)
  const cleanStr = (val: any, maxLen = 350): string => {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    // Formula Injection Guard: strip leading =, +, -, @, tab or return chars that Excel/calc could execute
    if (/^[=+\-@\t\r]/.test(str)) {
      str = str.replace(/^[=+\-@\t\r]+/, '');
    }
    return str
      .replace(/<[^>]*>?/gm, '') // Strip HTML tags
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, maxLen);
  };

  // Helper to extract numeric lat/lon with strict geographic boundaries
  const parseNum = (val: any, minVal = -180, maxVal = 180): number => {
    if (typeof val === 'number') {
      if (isNaN(val)) return 0;
      return Math.min(Math.max(val, minVal), maxVal);
    }
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    if (isNaN(num)) return 0;
    return Math.min(Math.max(num, minVal), maxVal);
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB maximum file size
  const MAX_ROWS = 1000; // Maximum 1000 rows to prevent browser memory exhaustion

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);

    try {
      // 1. Strict File Size Validation (Pre-read guard)
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(
          `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of 5 MB.`
        );
      }

      const fileName = file.name.toLowerCase();

      // JSON parsing flow
      if (fileName.endsWith('.json')) {
        const text = await file.text();
        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error('Invalid JSON format. Please upload a valid JSON array of school objects.');
        }

        if (!Array.isArray(json)) {
          throw new Error('JSON file must contain an array of school objects.');
        }

        if (json.length > MAX_ROWS) {
          throw new Error(`The file contains ${json.length} records. Maximum allowed per upload is ${MAX_ROWS} schools.`);
        }

        const parsedSchools: School[] = json.map((item, idx) => ({
          id: typeof item.id === 'number' ? item.id : idx + 1,
          nodeGroup: cleanStr(item.nodeGroup || item.NODE_GROUP, 150),
          nodeGroupName: cleanStr(item.nodeGroupName || item['NODE GROUP NAME'], 200),
          schoolName: cleanStr(item.schoolName || item.SCHOOL_NAME || `School #${idx + 1}`, 200),
          udise: cleanStr(item.udise || item['UDISE-CODE'] || item.UDISE, 50),
          routeCode: cleanStr(item.routeCode || item['ROUTE CODE'], 50),
          nodeCode: cleanStr(item.nodeCode || item['NODE CODE'], 50),
          routeName: cleanStr(item.routeName || item['ROUTE NAME'] || 'General', 100),
          lat: parseNum(item.lat || item.latitude, -90, 90),
          lon: parseNum(item.lon || item.longitude, -180, 180),
          driverName: cleanStr(item.driverName || item['Driver Name'] || item['DRIVER_NAME'], 150),
          driverContact: cleanStr(item.driverContact || item['Driver Contact'] || item['DRIVER_CONTACT'], 40),
          routeExecutive: cleanStr(item.routeExecutive || item['Route Executive Name'] || item['ROUTE_EXECUTIVE'], 150),
          routeExecutiveContact: cleanStr(item.routeExecutiveContact || item['Route Executive Contact'], 40),
          address: cleanStr(item.address || item.Address || item.ADDRESS, 350),
          pincode: cleanStr(item.pincode || item.Pincode || item.PINCODE, 20),
          spocName: cleanStr(item.spocName || item['School SPOC name'] || item['SPOC_NAME'], 150),
          spocContact: cleanStr(item.spocContact || item['School SPOC number'] || item['spocContact'], 40),
          category: cleanStr(item.category || item['School Category'] || item.CATEGORY, 100)
        }));

        setPreviewSchools(parsedSchools);
        setSuccessMsg(`Successfully validated ${parsedSchools.length} schools from JSON!`);
        setIsProcessing(false);
        return;
      }

      // Excel parsing flow via xlsx
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { 
        type: 'array',
        cellDates: false,
        raw: false
      });

      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Workbook contains no readable sheets.');
      }

      if (workbook.SheetNames.length > 10) {
        throw new Error('Workbook contains more than 10 sheets. Please upload a standard workbook.');
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      if (!worksheet) {
        throw new Error('Could not access the first worksheet in this Excel workbook.');
      }

      // Convert to JSON with raw string format to preserve leading zeroes in phone numbers & codes
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('The selected Excel sheet contains no data rows.');
      }

      if (rawRows.length > MAX_ROWS) {
        throw new Error(`The sheet contains ${rawRows.length} rows. Maximum allowed per upload is ${MAX_ROWS} schools.`);
      }

      const parsed: School[] = rawRows.map((row, index) => {
        // Smart case-insensitive column finder
        const getCol = (...names: string[]): string => {
          for (const key of Object.keys(row)) {
            const normalizedKey = key.trim().toLowerCase().replace(/[-_\s]+/g, '');
            for (const name of names) {
              const normalizedTarget = name.trim().toLowerCase().replace(/[-_\s]+/g, '');
              if (normalizedKey === normalizedTarget) {
                return cleanStr(row[key]);
              }
            }
          }
          return '';
        };

        const latVal = parseNum(getCol('latitude', 'lat'), -90, 90);
        const lonVal = parseNum(getCol('longitude', 'lon', 'long'), -180, 180);

        return {
          id: index + 1,
          nodeGroup: getCol('NODE_GROUP', 'nodeGroup', 'NODE GROUP'),
          nodeGroupName: getCol('NODE GROUP NAME', 'nodeGroupName', 'NODE_GROUP_NAME'),
          schoolName: getCol('SCHOOL_NAME', 'schoolName', 'SCHOOL NAME') || `School ${index + 1}`,
          udise: getCol('UDISE-CODE', 'udise', 'UDISE', 'UDISE CODE'),
          routeCode: getCol('ROUTE CODE', 'routeCode', 'ROUTE_CODE'),
          nodeCode: getCol('NODE CODE', 'nodeCode', 'NODE_CODE'),
          routeName: getCol('ROUTE NAME', 'routeName', 'ROUTE_NAME', 'ROUTE') || 'General',
          lat: latVal,
          lon: lonVal,
          driverName: getCol('Driver Name', 'driverName', 'DRIVER NAME', 'DRIVER'),
          driverContact: getCol('Driver Contact', 'driverContact', 'DRIVER CONTACT', 'DRIVER MOBILE'),
          routeExecutive: getCol('Route Executive Name', 'routeExecutive', 'ROUTE EXECUTIVE'),
          routeExecutiveContact: getCol('Route Executive Contact', 'routeExecutiveContact'),
          address: getCol('Address', 'address', 'ADDRESS'),
          pincode: getCol('Pincode', 'pincode', 'PINCODE', 'PIN'),
          spocName: getCol('School SPOC name', 'spocName', 'SPOC NAME', 'SPOC'),
          spocContact: getCol('School SPOC number', 'spocContact', 'SPOC NUMBER', 'SPOC CONTACT', 'School Contact'),
          category: getCol('School Category', 'category', 'CATEGORY')
        };
      });

      // Filter out empty rows
      const validSchools = parsed.filter(s => s.schoolName && s.schoolName.trim().length > 1);

      if (validSchools.length === 0) {
        throw new Error('Could not identify valid school records. Please ensure column headers match expected format (e.g. SCHOOL_NAME, ROUTE NAME, latitude, longitude).');
      }

      setPreviewSchools(validSchools);
      setSuccessMsg(`Extracted and validated ${validSchools.length} schools from "${file.name}"!`);
    } catch (err: any) {
      console.warn('File upload parsing issue handled safely:', err);
      setErrorMsg(err?.message || 'Failed to process file. Please ensure it is a valid, uncorrupted Excel or JSON file under 5 MB.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyData = () => {
    if (!previewSchools) return;
    onDataLoaded(previewSchools);
    onClose();
  };

  const handleExportJson = () => {
    const raw = localStorage.getItem('mdm_route_schools_data_v1');
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(raw || "[]");
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mdm_schools_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: 6200,
        backgroundColor: isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(10, 18, 14, 0.85)',
        backdropFilter: 'blur(5px)'
      }}
    >
      <div 
        className={`relative w-full max-w-2xl border rounded-2xl shadow-2xl p-6 max-h-[90dvh] flex flex-col ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#1a2e24] border-[#2c4436] text-[#f2ede0]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between pb-4 border-b shrink-0 ${
            isLight ? 'border-slate-200' : 'border-[#2c4436]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isLight
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-[#7fb298]/20 text-[#7fb298] border-[#7fb298]/30'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2
                className={`text-xl font-heading font-semibold ${
                  isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                }`}
              >
                Import Schools Data (Excel / JSON)
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                Upload{' '}
                <span className={`font-mono ${isLight ? 'text-blue-600 font-semibold' : 'text-[#e8a33d]'}`}>
                  OS1_detail.xlsx
                </span>{' '}
                or your updated routes sheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight
                ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-[#21382b]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="mt-4 space-y-4 overflow-y-auto pr-1">
          {/* Current status */}
          <div
            className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-[#12211a] border-[#2c4436] text-slate-300'
            }`}
          >
            <span>
              Currently loaded:{' '}
              <strong className={`font-mono text-sm ${isLight ? 'text-blue-600' : 'text-[#e8a33d]'}`}>
                {currentCount}
              </strong>{' '}
              schools
            </span>
            <button
              onClick={handleExportJson}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors border font-medium ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-emerald-700 border-slate-200'
                  : 'bg-[#21382b] hover:bg-[#2c4436] text-[#7fb298] border-[#2c4436]'
              }`}
              title="Download backup JSON"
            >
              <Download className="w-3.5 h-3.5" />
              Download Backup
            </button>
          </div>

          {/* Upload Dropzone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all group ${
              isLight
                ? 'border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/40'
                : 'border-[#2c4436] hover:border-[#7fb298] bg-[#12211a]/40 hover:bg-[#21382b]/30'
            }`}
          >
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".xlsx,.xls,.csv,.json" 
              className="hidden" 
              onChange={handleFileUpload}
            />
            <div
              className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${
                isLight ? 'bg-blue-50 text-blue-600' : 'bg-[#7fb298]/10 text-[#7fb298]'
              }`}
            >
              <UploadCloud className="w-6 h-6" />
            </div>
            <p
              className={`mt-3 text-sm font-semibold ${
                isLight ? 'text-slate-900' : 'text-[#f2ede0]'
              }`}
            >
              Click or drag & drop your Excel file here
            </p>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
              Supports{' '}
              <span className={isLight ? 'text-blue-600 font-semibold' : 'text-[#e8a33d]'}>
                OS1_detail.xlsx
              </span>
              , .xls, .csv, and .json
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div
              className={`p-3 border rounded-xl text-xs flex items-start gap-2.5 ${
                isLight
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-red-950/60 border-red-800/80 text-red-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div
              className={`p-3 border rounded-xl text-xs flex items-start gap-2.5 ${
                isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
              }`}
            >
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Preview rows */}
          {previewSchools && previewSchools.length > 0 && (
            <div className="space-y-2">
              <div
                className={`flex items-center justify-between text-xs ${
                  isLight ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                <span className="font-semibold uppercase tracking-wider font-mono">
                  Sample Preview ({previewSchools.length} Total records)
                </span>
                <span
                  className={`font-mono ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
                >
                  18 Columns mapped successfully
                </span>
              </div>
              <div
                className={`max-h-48 overflow-y-auto border rounded-xl text-xs divide-y ${
                  isLight
                    ? 'border-slate-200 bg-slate-50 divide-slate-200'
                    : 'border-[#2c4436] bg-[#12211a] divide-[#2c4436]'
                }`}
              >
                {previewSchools.slice(0, 5).map((s, i) => (
                  <div
                    key={i}
                    className={`p-2.5 flex items-center justify-between ${
                      isLight ? 'hover:bg-white' : 'hover:bg-[#1a2e24]'
                    }`}
                  >
                    <div>
                      <p className={`font-medium ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                        {s.schoolName}
                      </p>
                      <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                        Route:{' '}
                        <span className={`font-mono ${isLight ? 'text-blue-600' : 'text-[#e8a33d]'}`}>
                          {s.routeName}
                        </span>{' '}
                        · UDISE: {s.udise || 'N/A'} · Lat/Lon: {s.lat.toFixed(4)}, {s.lon.toFixed(4)}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isLight
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-[#21382b] text-[#7fb298]'
                      }`}
                    >
                      {s.nodeCode || `#${i+1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expected Columns Guide */}
          <div
            className={`p-3 rounded-xl border text-[11px] ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-600'
                : 'bg-[#21382b]/40 border-[#2c4436] text-[#a4b3ab]'
            }`}
          >
            <p className={`font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
              Expected 18 Columns from Excel:
            </p>
            <p className="font-mono text-[10px] leading-relaxed">
              NODE_GROUP, NODE GROUP NAME, SCHOOL_NAME, UDISE-CODE, ROUTE CODE, NODE CODE, ROUTE NAME, latitude, longitude, Driver Name / Contact, Route Executive Name / Contact, Address, Pincode, School SPOC name / number, School Category.
            </p>
          </div>
        </div>

        {/* Footer buttons */}
        <div
          className={`mt-5 pt-4 border-t flex items-center justify-between shrink-0 ${
            isLight ? 'border-slate-200' : 'border-[#2c4436]'
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              isLight
                ? 'text-slate-500 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Cancel
          </button>

          {previewSchools ? (
            <button
              onClick={handleApplyData}
              className={`inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-xs rounded-xl shadow-lg transition-all ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                  : 'bg-[#e8a33d] hover:bg-[#d6932e] text-[#12211a] shadow-[#e8a33d]/20'
              }`}
            >
              <Check className="w-4 h-4" />
              Apply {previewSchools.length} Schools Now
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className={`inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-[#7fb298] hover:bg-[#6ea187] text-[#12211a]'
              }`}
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {isProcessing ? 'Processing File...' : 'Select File'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
