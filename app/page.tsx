"use client";

import { useCallback, useState } from "react";
import { Scanner } from "@/components/scanner";
import { ResultSheet } from "@/components/result-sheet";
import { confirmFeedback } from "@/lib/feedback";
import { analyzeLink } from "@/lib/parse";
import { toggleFavorite, upsertScan, useSettings, useHistory } from "@/lib/storage";
import type { ScanItem, ScanResult } from "@/lib/types";

export default function ScanPage() {
  const settings = useSettings();
  const history = useHistory();
  const [sheetItem, setSheetItem] = useState<ScanItem | null>(null);

  const record = useCallback((result: ScanResult) => {
    upsertScan({
      value: result.value,
      type: result.type,
      format: result.format,
    });
  }, []);

  const openSheet = useCallback((result: ScanResult) => {
    setSheetItem({
      value: result.value,
      format: result.format,
      type: result.type,
    });
  }, []);

  // Tapping a chip: URLs open in a new tab, everything else opens the sheet.
  const handleChipTap = useCallback(
    (result: ScanResult) => {
      record(result);
      confirmFeedback(settings);
      if (result.type === "url") {
        const link = analyzeLink(result.value);
        window.open(link.href, "_blank", "noopener,noreferrer");
        return;
      }
      openSheet(result);
    },
    [record, openSheet, settings]
  );

  // Auto-open links setting: open stable URL detections without a tap.
  const handleAutoOpen = useCallback(
    (result: ScanResult) => {
      record(result);
      confirmFeedback(settings);
      const link = analyzeLink(result.value);
      window.open(link.href, "_blank", "noopener,noreferrer");
    },
    [record, settings]
  );

  // Scan-from-image: decode opens its result in the sheet.
  const handleImageResult = useCallback(
    (result: ScanResult | null) => {
      if (!result) return;
      record(result);
      confirmFeedback(settings);
      openSheet(result);
    },
    [record, openSheet, settings]
  );

  return (
    <>
      <Scanner
        onChipTap={handleChipTap}
        onAutoOpen={handleAutoOpen}
        onImageResult={handleImageResult}
        onSearch={handleImageResult}
        autoOpen={settings.autoOpen}
      />
      <ResultSheet
        item={sheetItem}
        onClose={() => setSheetItem(null)}
        isFavorite={
          sheetItem !== null &&
          history.some((i) => i.id === sheetItem.value && i.favorite)
        }
        onToggleFavorite={() => {
          if (sheetItem) toggleFavorite(sheetItem.value);
        }}
      />
    </>
  );
}
