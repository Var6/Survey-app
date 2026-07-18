import type { Section, Option, Field } from "@/lib/questionnaire";
import { SETTLEMENTS } from "@/lib/questionnaire/settlements";

/**
 * Community Mobiliser daily field report — dynamic schema (Hindi-first).
 * Adapted from the Programme Manager weekly module to a mobiliser's day.
 * Reuses the questionnaire field types + helpers (evalCondition/validateField).
 */

const o = (code: string, en: string, hi: string): Option => ({ code, en, hi });
const yesno = (): Option[] => [o("yes", "Yes", "हाँ"), o("no", "No", "नहीं")];
const settlementOpts: Option[] = SETTLEMENTS.map((s) => o(s.code, s.label, s.label));
const num = (name: string, en: string, hi: string): Field => ({
  qid: name,
  name,
  label: { en, hi },
  type: "integer",
  validation: { min: 0, max: 999 },
});

export const REPORT_SECTIONS: Section[] = [
  {
    id: "A",
    title: { en: "Day summary", hi: "दिन की जानकारी" },
    items: [
      {
        qid: "report_date",
        name: "report_date",
        label: { en: "Report date", hi: "रिपोर्ट की तारीख़" },
        type: "date",
        required: true,
      },
      {
        qid: "settlements_worked",
        name: "settlements_worked",
        label: { en: "Settlements worked in today", hi: "आज किन बस्तियों में काम किया?" },
        type: "multiselect",
        options: settlementOpts,
        required: true,
      },
      {
        qid: "field_status",
        name: "field_status",
        label: { en: "Today's field status", hi: "आज का फील्ड स्टेटस" },
        type: "select",
        options: [
          o("full_day", "Full day", "पूरा दिन"),
          o("half_day", "Half day", "आधा दिन"),
          o("office", "Office", "ऑफिस"),
          o("leave", "Leave", "छुट्टी"),
        ],
        required: true,
      },
      {
        qid: "overall_status",
        name: "overall_status",
        label: { en: "Overall status today", hi: "आज का समग्र हाल" },
        type: "select",
        options: [
          o("on_track", "On track", "ठीक चल रहा है"),
          o("minor", "Minor concerns", "मामूली दिक्कतें"),
          o("significant", "Significant concerns", "बड़ी दिक्कतें"),
        ],
        required: true,
      },
    ],
  },
  {
    id: "B",
    title: { en: "Survey work", hi: "सर्वे कार्य" },
    items: [
      num("surveys_completed", "Surveys completed", "आज कितने सर्वे पूरे किए?"),
      num("surveys_partial", "Partial surveys", "कितने अधूरे रहे?"),
      num("refusals", "Refusals", "कितनों ने मना किया?"),
      num("revisits_needed", "Revisits needed", "कितने घरों में दोबारा जाना है?"),
    ],
  },
  {
    id: "C",
    title: { en: "Follow-ups & cases", hi: "फॉलो-अप और केस" },
    items: [
      num("households_followed_up", "Households followed up", "कितने घरों का फॉलो-अप किया?"),
      num("urgent_health_cases", "Urgent health cases found", "कितने तुरंत स्वास्थ्य केस मिले?"),
      num("entitlement_cases", "Entitlement / document cases", "कितने दस्तावेज़/योजना केस मिले?"),
      {
        qid: "referrals_made",
        name: "referrals_made",
        label: { en: "Referrals made today", hi: "आज कहाँ-कहाँ रेफर किया?" },
        type: "multiselect",
        options: [
          o("asha_anm", "ASHA / ANM", "ASHA/ANM"),
          o("aww", "Anganwadi", "आंगनवाड़ी"),
          o("hospital", "Hospital / PHC", "अस्पताल/PHC"),
          o("school", "School", "स्कूल"),
          o("pds", "Ration / PDS", "राशन/PDS"),
          o("bank", "Bank", "बैंक"),
          o("aadhaar", "Aadhaar centre", "आधार केंद्र"),
          o("other", "Other", "अन्य"),
        ],
      },
    ],
  },
  {
    id: "D",
    title: { en: "Activities & meetings", hi: "गतिविधियाँ और मीटिंग" },
    items: [
      {
        qid: "youth_meeting_held",
        name: "youth_meeting_held",
        label: { en: "Youth meeting held?", hi: "क्या युवा मीटिंग हुई?" },
        type: "select",
        options: yesno(),
      },
      {
        ...num("youth_meeting_attendance", "Youth meeting attendance", "युवा मीटिंग में कितने आए?"),
        showWhen: { field: "youth_meeting_held", eq: "yes" },
      },
      {
        qid: "women_session_held",
        name: "women_session_held",
        label: { en: "Women / girls session held?", hi: "क्या महिला/किशोरी सत्र हुआ?" },
        type: "select",
        options: yesno(),
      },
      {
        ...num("women_session_attendance", "Session attendance", "सत्र में कितनी आईं?"),
        showWhen: { field: "women_session_held", eq: "yes" },
      },
      {
        qid: "children_activity_held",
        name: "children_activity_held",
        label: { en: "Children's activity held?", hi: "क्या बच्चों की गतिविधि हुई?" },
        type: "select",
        options: yesno(),
      },
      {
        ...num("children_activity_attendance", "Children attendance", "गतिविधि में कितने बच्चे आए?"),
        showWhen: { field: "children_activity_held", eq: "yes" },
      },
    ],
  },
  {
    id: "E",
    title: { en: "Vulnerable cases identified", hi: "चिन्हित कमज़ोर केस" },
    items: [
      num("pregnant_identified", "Pregnant / new mothers identified", "आज कितनी गर्भवती/नई माँ चिन्हित कीं?"),
      num("oos_children_identified", "Out-of-school children identified", "कितने स्कूल-बाहर बच्चे चिन्हित किए?"),
      num("pwd_identified", "Persons with disability identified", "कितने दिव्यांग व्यक्ति चिन्हित किए?"),
      num("elderly_pension_identified", "Elderly needing pension identified", "पेंशन ज़रूरत वाले कितने बुज़ुर्ग चिन्हित किए?"),
    ],
  },
  {
    id: "F",
    title: { en: "Stakeholder coordination", hi: "सरकारी/हितधारक समन्वय" },
    items: [
      {
        qid: "met_stakeholder",
        name: "met_stakeholder",
        label: { en: "Met any govt / stakeholder?", hi: "क्या किसी सरकारी/हितधारक से मिले?" },
        type: "select",
        options: yesno(),
      },
      {
        qid: "stakeholder_type",
        name: "stakeholder_type",
        label: { en: "Whom did you meet?", hi: "किससे मिले?" },
        type: "multiselect",
        options: [
          o("school", "School", "स्कूल"),
          o("beo", "BEO", "BEO"),
          o("asha", "ASHA", "ASHA"),
          o("anm", "ANM", "ANM"),
          o("aww", "Anganwadi worker", "आंगनवाड़ी"),
          o("hospital", "Hospital / PHC", "अस्पताल/PHC"),
          o("municipal", "Municipal body", "नगर निगम"),
          o("social_welfare", "Social welfare", "समाज कल्याण"),
          o("pds", "PDS", "PDS"),
          o("aadhaar", "Aadhaar centre", "आधार केंद्र"),
          o("bank", "Bank", "बैंक"),
          o("ward_rep", "Ward representative", "वार्ड प्रतिनिधि"),
          o("community_leader", "Community leader", "समुदाय नेता"),
          o("ngo", "NGO", "NGO"),
          o("other", "Other", "अन्य"),
        ],
        showWhen: { field: "met_stakeholder", eq: "yes" },
      },
      {
        qid: "stakeholder_notes",
        name: "stakeholder_notes",
        label: { en: "What was discussed / outcome?", hi: "क्या बात हुई / नतीजा?" },
        type: "textarea",
        showWhen: { field: "met_stakeholder", eq: "yes" },
      },
    ],
  },
  {
    id: "G",
    title: { en: "Issues & risks", hi: "समस्याएँ और जोखिम" },
    items: [
      {
        qid: "any_risk",
        name: "any_risk",
        label: { en: "Any risk / incident today?", hi: "क्या कोई जोखिम/घटना हुई?" },
        type: "select",
        options: yesno(),
      },
      {
        qid: "risk_category",
        name: "risk_category",
        label: { en: "Type of risk", hi: "किस तरह का जोखिम?" },
        type: "multiselect",
        options: [
          o("safeguarding", "Safeguarding (child/women safety)", "बाल/महिला सुरक्षा"),
          o("health_emergency", "Health emergency", "स्वास्थ्य आपातकाल"),
          o("community", "Community / access", "समुदाय/पहुँच"),
          o("staff", "Staff", "स्टाफ"),
          o("data", "Data / privacy", "डेटा/निजता"),
          o("other", "Other", "अन्य"),
        ],
        showWhen: { field: "any_risk", eq: "yes" },
      },
      {
        qid: "risk_details",
        name: "risk_details",
        label: { en: "Risk details", hi: "जोखिम का विवरण" },
        type: "textarea",
        showWhen: { field: "any_risk", eq: "yes" },
      },
      {
        qid: "risk_informed_manager",
        name: "risk_informed_manager",
        label: { en: "Informed manager / director?", hi: "क्या मैनेजर/डायरेक्टर को बताया?" },
        type: "select",
        options: yesno(),
        showWhen: { field: "any_risk", eq: "yes" },
      },
      {
        qid: "app_issue",
        name: "app_issue",
        label: { en: "Any app / data issue? (for developer / director)", hi: "कोई ऐप/डेटा दिक्कत? (डेवलपर/डायरेक्टर के लिए)" },
        type: "textarea",
      },
    ],
  },
  {
    id: "H",
    title: { en: "Plan for tomorrow", hi: "कल की योजना" },
    items: [
      {
        qid: "tomorrow_settlements",
        name: "tomorrow_settlements",
        label: { en: "Settlements planned tomorrow", hi: "कल किन बस्तियों में जाएँगे?" },
        type: "multiselect",
        options: settlementOpts,
      },
      {
        qid: "tomorrow_priorities",
        name: "tomorrow_priorities",
        label: { en: "Main priorities for tomorrow", hi: "कल की मुख्य प्राथमिकताएँ" },
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "I",
    title: { en: "Notes", hi: "टिप्पणी" },
    items: [
      {
        qid: "notes",
        name: "notes",
        label: { en: "Other notes", hi: "अन्य टिप्पणी" },
        type: "textarea",
      },
    ],
  },
];
