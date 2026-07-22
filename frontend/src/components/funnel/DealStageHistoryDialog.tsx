"use client";

import { Dialog } from "@/components/ui/Dialog";
import { DealStageHistoryRoadmap } from "./DealStageHistoryRoadmap";

interface DealStageHistoryDialogProps {
  dealId: string;
  onClose: () => void;
}

export function DealStageHistoryDialog({ dealId, onClose }: DealStageHistoryDialogProps) {
  return (
    <Dialog open title="Stage History" onClose={onClose} maxWidth="480px">
      <DealStageHistoryRoadmap dealId={dealId} />
    </Dialog>
  );
}
