"use client";

import { useState } from "react";
import { TripEvent } from "@/types/trip";

interface ChangeModalProps {
  event: TripEvent;
  onSubmit: (reason: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

const REASON_PRESETS = [
  "フライトキャンセル",
  "天候不良",
  "体調不良",
  "施設が休業",
  "予定が変更になった",
  "時間が足りない",
];

export default function ChangeModal({
  event,
  onSubmit,
  onClose,
  isLoading,
}: ChangeModalProps) {
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onSubmit(reason.trim());
  };

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-[20px] shadow-step border-2 border-ink/20 max-w-md w-full">
        <div className="p-5 border-b border-dashed border-ink/25">
          <h2 className="text-lg font-bold text-ink">変更リクエスト</h2>
          <p className="text-sm text-muted mt-1">
            AIが代替プランを提案します
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-paper rounded-[12px] p-3 border border-ink/10">
            <p className="text-xs text-muted">変更対象のイベント</p>
            <p className="font-semibold text-ink mt-1">{event.title}</p>
            <p className="text-xs text-muted">
              {event.date} {event.startTime} - {event.endTime} / {event.location}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              変更理由
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setReason(preset)}
                  className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                    reason === preset
                      ? "bg-ink text-surface border-ink"
                      : "bg-paper text-ink border-ink/25 hover:border-mapblue"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="変更理由を入力..."
              rows={2}
              className="w-full border-2 border-ink/30 rounded-[12px] bg-paper px-3 py-2 text-sm focus:outline-none focus:border-mapblue text-ink placeholder:text-muted/50"
            />
          </div>
        </div>

        <div className="p-5 border-t border-dashed border-ink/25 flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-muted hover:text-ink disabled:text-muted/40"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !reason.trim()}
            className="bg-ink text-surface px-4 py-2 rounded-full text-sm font-semibold hover:bg-ink/85 disabled:bg-muted/40 disabled:text-muted/60 transition-colors shadow-step"
          >
            {isLoading ? "AI提案中..." : "代替プランを提案"}
          </button>
        </div>
      </div>
    </div>
  );
}
