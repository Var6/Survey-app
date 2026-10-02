"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./client";
import { SETTLEMENTS } from "./questionnaire/settlements";

export interface SettlementOption {
  code: string;
  label: string;
  hhPrefix?: string;
  active?: boolean;
}

/**
 * The live community list for client-side pickers. Falls back to the seed
 * list if the request fails, so a form is never left with an empty dropdown.
 */
export function useSettlements(includeInactive = false): {
  settlements: SettlementOption[];
  loading: boolean;
} {
  const [settlements, setSettlements] = useState<SettlementOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiFetch<{ settlements: SettlementOption[] }>(
      `/api/settlements${includeInactive ? "?includeInactive=1" : ""}`
    )
      .then(({ settlements: rows }) => {
        if (alive) setSettlements(rows);
      })
      .catch(() => {
        if (alive) setSettlements(SETTLEMENTS.map((s) => ({ code: s.code, label: s.label })));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [includeInactive]);

  return { settlements, loading };
}
