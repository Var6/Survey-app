/** The 12 informal settlements, with backend code, display label and HH-ID prefix. */
export interface Settlement {
  code: string; // backend choice code
  label: string; // display label
  hhPrefix: string; // household-id prefix
}

export const SETTLEMENTS: Settlement[] = [
  { code: "refugee_colony", label: "Basgama/Refuge Colony", hhPrefix: "REF" },
  { code: "loot_mohalla", label: "Loot Mohalla", hhPrefix: "LOO" },
  { code: "singhia_tola", label: "Kalijaan 2/Singhia Tola", hhPrefix: "SIN" },
  { code: "buxa_ghat", label: "Buxa Ghat", hhPrefix: "BUX" },
  { code: "maha_dalit_tola", label: "Rajendar Nagar/Mahadalit Tola", hhPrefix: "MHD" },
  { code: "kalijaan_naya_tola", label: "Kalijaan Naya Tola", hhPrefix: "KAL" },
  { code: "khatal_patti", label: "Sriram Tola", hhPrefix: "SRI" },
  { code: "dhangar_tola", label: "Anoop Nagar/Dhangar Tola", hhPrefix: "DHA" },
  { code: "ambedkar_nagar", label: "Raja Tola/Ambedkar Nagar", hhPrefix: "AMB" },
  { code: "damka_tola", label: "Hazirganj/Damka Tola", hhPrefix: "DAM" },
  { code: "shanti_kabra", label: "Shanti Kabra", hhPrefix: "SHA" },
  { code: "kheruganj", label: "Kheruganj", hhPrefix: "KHE" },
];

export const SETTLEMENT_BY_CODE: Record<string, Settlement> = Object.fromEntries(
  SETTLEMENTS.map((s) => [s.code, s])
);

/** Mobiliser codes used in household IDs. */
export const MOBILISER_CODES = ["M01", "M02", "M03", "M04", "M05", "M06"] as const;
