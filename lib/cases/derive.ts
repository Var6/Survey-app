import type { SurveyDoc } from "@/lib/models";
import {
  CaseModule,
  CasePriority,
  subcategoryLabel,
} from "./modules";

export interface CaseSeed {
  dedupeKey: string;
  module: CaseModule;
  subcategory: string;
  title: string;
  subjectName?: string;
  priority: CasePriority;
  dueDate?: string;
  meta?: Record<string, unknown>;
}

type Row = Record<string, unknown>;

/**
 * Apply the seven-module auto-population triggers to one survey and return the
 * case seeds it should generate. Deterministic — the same survey always yields
 * the same dedupeKeys, so re-running is idempotent.
 */
export function deriveCasesFromSurvey(survey: SurveyDoc): CaseSeed[] {
  const d = (survey.data || {}) as Row;
  const s = (k: string) => String(d[k] ?? "").trim();
  const arr = (k: string): string[] =>
    Array.isArray(d[k]) ? (d[k] as unknown[]).map(String) : [];
  const has = (k: string, v: string) => arr(k).includes(v);
  const inSet = (v: string, ...vals: string[]) => vals.includes(v);

  const head = s("head_name") || s("respondent_name") || "Household";
  const rawDue = s("next_followup_date");
  const due = /^\d{4}-\d{2}-\d{2}$/.test(rawDue) ? rawDue : undefined;
  const seeds: CaseSeed[] = [];

  const sid = String(survey._id);
  const key = (m: string, suffix = "") => `${sid}:${m}${suffix ? ":" + suffix : ""}`;
  const push = (
    module: CaseModule,
    subcategory: string,
    opts: { dedupe?: string; subject?: string; priority?: CasePriority; meta?: Row } = {}
  ) => {
    seeds.push({
      dedupeKey: key(module, opts.dedupe ?? ""),
      module,
      subcategory,
      title: subcategoryLabel(module, subcategory),
      subjectName: opts.subject ?? head,
      priority: opts.priority ?? "medium",
      dueDate: due,
      meta: opts.meta,
    });
  };

  /* 1 ── Health Referral & Treatment ─────────────────────────── */
  {
    const hrn = s("health_referral_need");
    const fire =
      inSet(hrn, "urgent", "routine") ||
      s("chronic_or_serious_illness") === "yes" ||
      has("followup_type", "health") ||
      has("next_action", "asha_anm");
    if (fire) {
      let sub = "other_health";
      let priority: CasePriority = "medium";
      if (hrn === "urgent") {
        sub = "urgent_referral";
        priority = "urgent";
      } else if (s("chronic_or_serious_illness") === "yes") {
        sub = "chronic_illness";
      } else if (hrn === "routine") {
        sub = "routine_referral";
      }
      if (sub === "other_health") {
        if (has("health_referral_details", "child_health")) sub = "child_health";
        else if (has("health_referral_details", "nutrition")) sub = "nutrition";
        else if (has("health_referral_details", "disability")) sub = "disability_health";
      }
      push("health", sub, {
        priority,
        meta: { health_referral_need: hrn, details: d.health_referral_details },
      });
    }
  }

  /* 2 ── Maternal Health & ICDS ──────────────────────────────── */
  if (s("has_pregnant_or_lactating") === "yes") {
    const reg = s("registered_with_asha_anm");
    const anc = s("anc_checkup_done");
    const icds = s("icds_linked");
    const del = s("delivery_plan_place");
    const mfr = s("maternal_followup_required");
    let sub = "postnatal";
    let priority: CasePriority = "medium";
    if (mfr === "urgent") {
      sub = "high_priority_referral";
      priority = "urgent";
    } else if (inSet(reg, "no", "dont_know")) {
      sub = "pregnancy_registration";
      priority = "high";
    } else if (inSet(anc, "no", "dont_know")) {
      sub = "anc_checkup";
      priority = "high";
    } else if (inSet(del, "home", "not_decided", "no_response")) {
      sub = "institutional_delivery";
      priority = "high";
    } else if (inSet(icds, "no", "irregular")) {
      sub = "icds_linkage";
    } else if (mfr === "routine") {
      sub = "postnatal";
    }
    push("maternal", sub, {
      subject: s("preg_lactating_name") || head,
      priority,
      meta: { registered: reg, anc, icds, delivery: del, followup: mfr },
    });
  }

  /* 3 ── Social Security & Entitlements (scheme-wise) ────────── */
  {
    const ent = (
      scheme: string,
      sub: string,
      priority: CasePriority,
      meta?: Row
    ) => push("entitlements", sub, { dedupe: scheme, priority, meta });

    const aadhaar = s("all_have_aadhaar");
    if (inSet(aadhaar, "some", "none", "correction"))
      ent("aadhaar", "aadhaar", aadhaar === "none" ? "high" : "medium", { status: aadhaar });

    const ration = s("has_ration_card");
    if (inSet(ration, "no", "applied", "not_received") || arr("ration_card_issue").length > 0)
      ent("ration", "ration_pds", ration === "no" ? "high" : "medium", {
        status: ration,
        issues: d.ration_card_issue,
      });

    const ayush = s("has_ayushman_card");
    if (inSet(ayush, "some", "none"))
      ent("ayushman", "ayushman", ayush === "none" ? "high" : "medium", { status: ayush });

    const birth = s("birth_cert_children");
    if (inSet(birth, "some", "none"))
      ent("birthcert", "birth_certificate", birth === "none" ? "high" : "medium", {
        status: birth,
      });

    if (has("pension_need", "old_age") || has("pension_need", "widow") || has("pension_need", "disability"))
      ent("pension", "pension", "medium", { needs: d.pension_need });

    if (inSet(s("maternity_benefit_status"), "yes", "dont_know"))
      ent("maternity", "maternity_benefit", "medium", { status: s("maternity_benefit_status") });

    if (s("has_bank_account") === "no") ent("bank", "bank_account", "medium");

    const memberNoCert = (survey.members || []).some(
      (m) => String((m as Row).member_disability) === "yes_no_cert"
    );
    if (memberNoCert || has("other_docs_needed", "disability_cert"))
      ent("disabilitycert", "disability_certificate", "high");

    const otherDocs = arr("other_docs_needed").filter(
      (x) => !["none", "disability_cert"].includes(x)
    );
    if (otherDocs.length > 0)
      ent("otherdocs", "other_documents", "medium", { docs: otherDocs });

    const hasEntitlementCase = seeds.some((x) => x.module === "entitlements");
    if (!hasEntitlementCase && inSet(s("entitlement_followup_required"), "yes", "maybe"))
      ent("general", "other_scheme", "medium");
  }

  /* 4 ── Education & Out-of-School Children (per child 4–12) ──── */
  (survey.children_4_12 || []).forEach((c, i) => {
    const st = String((c as Row).child_school_status || "");
    const map: Record<string, string> = {
      never_enrolled: "never_enrolled",
      dropped_out: "dropped_out",
      enrolled_not_attending: "not_attending",
      school_irregular: "irregular",
    };
    if (!map[st]) return;
    const priority: CasePriority =
      st === "never_enrolled" || st === "dropped_out" ? "high" : "medium";
    push("education", map[st], {
      dedupe: `c${i}`,
      subject: String((c as Row).child_name || "Child"),
      priority,
      meta: { age: (c as Row).child_age, status: st },
    });
  });

  /* 5 ── Early Childhood & Anganwadi (per child 0–3) ─────────── */
  (survey.children_0_3 || []).forEach((c, i) => {
    const r = c as Row;
    const bc = String(r.child_0_3_birth_certificate || "");
    const aw = String(r.child_0_3_anganwadi_linked || "");
    const im = String(r.child_0_3_immunisation_status || "");
    const gm = String(r.child_0_3_growth_monitoring || "");
    const support = Array.isArray(r.child_0_3_support_need)
      ? (r.child_0_3_support_need as unknown[]).map(String)
      : [];
    const fu = String(r.child_0_3_followup_required || "");
    const trigger =
      inSet(bc, "no", "applied") ||
      inSet(aw, "no", "irregular") ||
      inSet(im, "partial", "none", "dont_know") ||
      inSet(gm, "no", "dont_know") ||
      support.some((x) =>
        ["health_check", "immunisation", "anganwadi_linkage", "nutrition", "birth_certificate"].includes(x)
      ) ||
      inSet(fu, "yes", "maybe");
    if (!trigger) return;
    let sub = "caregiver_counselling";
    if (inSet(aw, "no", "irregular")) sub = "anganwadi_registration";
    else if (inSet(im, "partial", "none", "dont_know")) sub = "immunisation";
    else if (inSet(gm, "no", "dont_know")) sub = "growth_monitoring";
    else if (inSet(bc, "no", "applied")) sub = "birth_registration";
    else if (support.includes("nutrition")) sub = "nutrition";
    else if (support.includes("health_check")) sub = "child_health";
    push("early_childhood", sub, {
      dedupe: `c${i}`,
      subject: String(r.child_0_3_name || "Child"),
      meta: { birth_cert: bc, anganwadi: aw, immunisation: im, growth: gm, support },
    });
  });

  /* 6 ── Youth Group & Leadership (per youth 13–24) ──────────── */
  let youthSeeds = 0;
  (survey.youth_13_24 || []).forEach((y, i) => {
    const r = y as Row;
    const interest = String(r.youth_group_interest || "");
    const leader = String(r.potential_youth_leader || "");
    const fu = String(r.youth_followup_required || "");
    if (!(inSet(interest, "yes", "maybe") || leader === "yes" || inSet(fu, "yes", "maybe")))
      return;
    let sub = "interested";
    let priority: CasePriority = "low";
    if (leader === "yes") {
      sub = "potential_leader";
      priority = "medium";
    } else if (inSet(fu, "yes", "maybe")) {
      sub = "needs_followup";
    }
    youthSeeds++;
    push("youth", sub, {
      dedupe: `y${i}`,
      subject: String(r.youth_name || "Youth"),
      priority,
      meta: { interest, topics: r.youth_interest_topics, status: r.youth_status },
    });
  });
  if (youthSeeds === 0 && (has("followup_type", "youth") || has("next_action", "add_youth"))) {
    push("youth", "needs_followup", { dedupe: "hh", priority: "low" });
  }

  /* 7 ── Women & Adolescent Girls ────────────────────────────── */
  {
    const fire =
      inSet(s("women_session_interest"), "yes", "maybe") ||
      has("followup_type", "women_session") ||
      arr("women_topics_needed").length > 0;
    if (fire) {
      push("women", "interested_women", {
        subject: s("respondent_name") || head,
        priority: "low",
        meta: {
          topics: d.women_topics_needed,
          time: d.women_preferred_time,
          venue: d.safe_meeting_space,
        },
      });
    }
  }

  return seeds;
}
