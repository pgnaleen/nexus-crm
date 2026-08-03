"use client";

import { useState } from "react";
import { PERMISSIONS } from "@orelia/common";
import { runBackup } from "@/lib/api/backups";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";

interface BackupsWidgetProps {
  permissions: string[];
}

export function BackupsWidget({ permissions }: BackupsWidgetProps) {
  const [isRunning, setIsRunning] = useState(false);
  const confirm = useConfirm();
  const { showError, showSuccess } = useAlert();

  const canRun = permissions.includes(PERMISSIONS.BACKUP_CREATE);

  async function handleRun() {
    const ok = await confirm({
      title: "Run Database Backup",
      message:
        "This dumps the entire database and uploads it to S3 immediately, separate from tonight's automatic backup. It may take a moment. Continue?",
      confirmLabel: "Run Backup",
    });
    if (!ok) return;

    setIsRunning(true);
    try {
      await runBackup();
      showSuccess("Backup completed and uploaded.");
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Backup failed");
    } finally {
      setIsRunning(false);
    }
  }

  if (!canRun) {
    return null;
  }

  return (
    <div className="flex flex-col max-w-4xl">
      {/* Informative Header Description Card */}
      <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200/60 rounded-2xl p-5 mb-6 shadow-sm flex items-start gap-4 hover:border-slate-300/80 transition-all duration-200">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="m-0 mb-1 text-[17px] font-bold text-crm-text">Storage & Backups Policy</h2>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)] leading-relaxed">
            The system database is backed up automatically every night at <span className="font-semibold text-slate-700">02:00 UTC</span> (2:00 AM) and stored in a secure AWS S3 bucket with 256-bit encryption. Redundant snapshots are held for 30 days.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left/Middle: Database Info details */}
        <div className="md:col-span-2 bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="m-0 text-[12.5px] font-bold text-slate-500 tracking-wide uppercase border-b border-slate-100 pb-2">
            System & Storage Details
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Status</div>
                <div className="text-[13px] font-bold text-slate-700">Active & Healthy</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage Target</div>
                <div className="text-[13px] font-bold text-slate-700">AWS S3 (Encrypted)</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Auto-Backup Frequency</div>
                <div className="text-[13px] font-bold text-slate-700">Daily at 02:00 UTC</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Retention Span</div>
                <div className="text-[13px] font-bold text-slate-700">30 Daily Versions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Manual Action Trigger Card */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="m-0 text-[12.5px] font-bold text-slate-500 tracking-wide uppercase border-b border-slate-100 pb-2">
              On-Demand Trigger
            </h3>
            <p className="text-[12.5px] text-[var(--color-text-muted)] leading-relaxed">
              Initiate an immediate, full snapshot of ORELIA's database records. The backup will be compiled and uploaded instantly.
            </p>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-50">
            <Button 
              type="button" 
              isLoading={isRunning} 
              onClick={handleRun} 
              className="w-full justify-center gap-2 py-2.5 font-bold shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Run Backup Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
