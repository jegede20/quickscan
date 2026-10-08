// Shared types for QuickScan.

/** Normalized symbology names: qr_code, ean_13, ean_8, upc_a, upc_e, code_128, code_39, itf, ... */
export type CodeFormat = string;

/** What a decoded value means. */
export type ResultType = "url" | "text" | "wifi" | "contact" | "product";

export type Point = { x: number; y: number };

/** A decoded code. `corners` are in the source pixel space (video frame or image). */
export type ScanResult = {
  value: string;
  format: CodeFormat;
  type: ResultType;
  corners: Point[] | null;
};

/** What the result sheet / history store: no geometry. */
export type ScanItem = {
  value: string;
  format: CodeFormat;
  type: ResultType;
};
