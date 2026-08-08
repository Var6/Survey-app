import type { Section, Option, Field } from "@/lib/questionnaire";
import { SETTLEMENTS } from "@/lib/questionnaire/settlements";

/**
 * Community Mobiliser monthly report (CMM module) — Hindi-first, per the
 * "कम्युनिटी मोबिलाइज़र मासिक रिपोर्ट" developer specification.
 *
 * Rule from the spec: numbers already captured by the survey, case, activity
 * and daily-report modules are NOT asked again — they come from the auto
 * dashboard at the top of the form. Only verification, explanation and next
 * steps are typed by the mobiliser.
 *
 * Submitted to the Programme Manager by the 3rd of every month.
 */

const o = (code: string, en: string, hi: string): Option => ({ code, en, hi });
const settlementOpts: Option[] = SETTLEMENTS.map((s) => o(s.code, s.label, s.label));

const text = (qid: string, name: string, en: string, hi: string, required = false): Field => ({
  qid,
  name,
  label: { en, hi },
  type: "textarea",
  required,
});
const num = (qid: string, name: string, en: string, hi: string): Field => ({
  qid,
  name,
  label: { en, hi },
  type: "integer",
  validation: { min: 0, max: 9999 },
});

export const CM_MONTHLY_SECTIONS: Section[] = [
  {
    id: "A",
    title: { en: "Monthly work summary", hi: "मासिक कार्य सारांश" },
    items: [
      text(
        "CMM-A01",
        "achievements",
        "Your three most important pieces of work / achievements this month",
        "इस महीने आपके तीन सबसे महत्वपूर्ण काम/उपलब्धियाँ क्या रहीं? (अधिकतम 3)",
        true
      ),
      text(
        "CMM-A02",
        "not_as_planned",
        "Which work was not completed as planned, and why?",
        "कौन-सा काम योजना के अनुसार पूरा नहीं हुआ और क्यों?",
        true
      ),
    ],
  },
  {
    id: "B",
    title: { en: "Settlement & field presence", hi: "बस्ती और फील्ड उपस्थिति" },
    items: [
      {
        qid: "CMM-B01a",
        name: "weak_settlements",
        label: {
          en: "In which settlement was less work possible this month?",
          hi: "किस बस्ती में इस महीने कम काम हो पाया?",
        },
        type: "multiselect",
        options: settlementOpts,
      },
      text(
        "CMM-B01b",
        "weak_settlement_reason",
        "Reason for lower coverage there",
        "वहाँ कम काम होने का कारण लिखें।"
      ),
      text(
        "CMM-B02",
        "support_needed_pm",
        "What kind of support do you need from the Programme Manager?",
        "Programme Manager से किस तरह की सहायता चाहिए?"
      ),
    ],
  },
  {
    id: "C",
    title: { en: "Youth group work", hi: "युवा समूह कार्य" },
    items: [
      text(
        "CMM-C10",
        "youth_groups",
        "Youth groups managed (name / settlement) — minimum 3 per community",
        "आपके द्वारा संचालित युवा समूह (नाम/बस्ती) — हर बस्ती में कम से कम 3"
      ),
      num(
        "CMM-C11",
        "youth_meetings_boys",
        "Boys' group meetings held this month (target 2)",
        "इस महीने लड़कों के समूह की कितनी बैठकें हुईं? (लक्ष्य 2)"
      ),
      num(
        "CMM-C12",
        "youth_meetings_girls",
        "Girls' group meetings held this month (target 2)",
        "इस महीने लड़कियों के समूह की कितनी बैठकें हुईं? (लक्ष्य 2)"
      ),
      text(
        "CMM-C13",
        "youth_topics",
        "Topics discussed and average attendance per meeting",
        "बैठकों में क्या विषय रहे और औसत उपस्थिति कितनी रही?"
      ),
      text(
        "CMM-C14",
        "youth_leaders",
        "Potential youth leaders identified",
        "कौन-से संभावित युवा नेता चिन्हित हुए?"
      ),
    ],
  },
  {
    id: "D",
    title: { en: "Children & school enrolment", hi: "बच्चे और स्कूल नामांकन" },
    items: [
      text(
        "CMM-D10",
        "children_activities",
        "Children's activities conducted (date, settlement, topic) — target once every 15 days",
        "बच्चों की गतिविधियाँ (तारीख, बस्ती, विषय) — लक्ष्य: हर 15 दिन में एक बार"
      ),
      num(
        "CMM-D11",
        "oos_identified",
        "Out-of-school children identified this month",
        "इस महीने कितने स्कूल-बाहर बच्चे चिन्हित किए?"
      ),
      num(
        "CMM-D12",
        "enrolment_supported",
        "Children supported for enrolment this month",
        "इस महीने कितने बच्चों का नामांकन कराया/करवाने में मदद की?"
      ),
      text(
        "CMM-D13",
        "retention_followup",
        "Retention follow-up done (children who stopped attending)",
        "पढ़ाई छोड़ने वाले बच्चों पर क्या फॉलो-अप किया?"
      ),
    ],
  },
  {
    id: "E",
    title: {
      en: "Women & adolescent health sessions",
      hi: "महिला और किशोरी स्वास्थ्य सत्र",
    },
    items: [
      num(
        "CMM-E10",
        "women_sessions",
        "Sessions conducted this month (target 2 per community)",
        "इस महीने कितने सत्र हुए? (लक्ष्य: हर बस्ती में 2)"
      ),
      text(
        "CMM-E11",
        "women_topics",
        "Attendance and key topics covered",
        "उपस्थिति और मुख्य विषय क्या रहे?"
      ),
      text(
        "CMM-E12",
        "anc_cases",
        "Health / nutrition / ANC cases followed up",
        "स्वास्थ्य/पोषण/ANC के किन मामलों पर फॉलो-अप किया?"
      ),
      text(
        "CMM-E13",
        "frontline_coordination",
        "Coordination with ASHA / ANM / Anganwadi worker",
        "ASHA/ANM/आंगनवाड़ी कार्यकर्ता के साथ क्या समन्वय हुआ?"
      ),
    ],
  },
  {
    id: "F",
    title: { en: "Government scheme linkages", hi: "सरकारी योजना से जुड़ाव" },
    items: [
      num(
        "CMM-F10",
        "scheme_eligible",
        "Eligible families identified for schemes this month",
        "इस महीने कितने पात्र परिवार चिन्हित किए?"
      ),
      text(
        "CMM-F11",
        "applications_supported",
        "Applications supported (ration card, Ayushman, pension, maternity benefit…)",
        "किन आवेदनों में मदद की? (राशन कार्ड, आयुष्मान, पेंशन, मातृत्व लाभ…)"
      ),
      text(
        "CMM-F12",
        "camps",
        "Camps attended / organised this month",
        "इस महीने कौन-से कैंप में गए या आयोजित किए?"
      ),
      text(
        "CMM-F13",
        "pending_applications",
        "Follow-up on pending applications",
        "लंबित आवेदनों पर क्या फॉलो-अप किया?"
      ),
    ],
  },
  {
    id: "G",
    title: { en: "Public health referrals", hi: "सार्वजनिक स्वास्थ्य रेफरल" },
    items: [
      num(
        "CMM-G10",
        "referrals_made",
        "Referrals to public hospital / clinic this month",
        "इस महीने कितने लोगों को अस्पताल/क्लिनिक भेजा?"
      ),
      num(
        "CMM-G11",
        "institutional_deliveries",
        "Institutional deliveries facilitated",
        "कितने संस्थागत प्रसव करवाने में मदद की?"
      ),
      text(
        "CMM-G12",
        "referral_outcomes",
        "Case outcomes",
        "इन मामलों का क्या नतीजा रहा?"
      ),
    ],
  },
  {
    id: "H",
    title: { en: "Meetings & community activities", hi: "बैठकें और सामुदायिक गतिविधियाँ" },
    items: [
      text(
        "CMM-C01",
        "community_issue",
        "The most important community issue raised in meetings (up to 3)",
        "बैठकों में समुदाय की सबसे महत्वपूर्ण बात/मुद्दा क्या सामने आया? (अधिकतम 3)"
      ),
      text(
        "CMM-C02",
        "missed_meetings",
        "Which meeting could not be held, and why?",
        "कौन-सी बैठक नहीं हो सकी और क्यों?"
      ),
    ],
  },
  {
    id: "I",
    title: { en: "Case & follow-up progress", hi: "केस और फॉलो-अप प्रगति" },
    items: [
      text(
        "CMM-D01",
        "overdue_cases",
        "Which urgent or overdue cases are still not completed?",
        "कौन-से जरूरी या overdue केस अभी तक पूरे नहीं हुए?",
        true
      ),
      text(
        "CMM-D02",
        "case_action_next",
        "What action did you take on these, and what is the next step?",
        "इन मामलों में आपने क्या कार्रवाई की और अब अगला कदम क्या है?",
        true
      ),
      text(
        "CMM-D03",
        "cases_needing_pm",
        "Which case needs the Programme Manager's intervention, and what support is required?",
        "कौन-सा केस Programme Manager के हस्तक्षेप की माँग करता है? क्या सहायता चाहिए?"
      ),
    ],
  },
  {
    id: "J",
    title: { en: "Data & documentation quality", hi: "डेटा और दस्तावेज़ गुणवत्ता" },
    items: [
      text(
        "CMM-E01",
        "data_gaps",
        "What was missing in data or documentation this month? (up to 3)",
        "इस महीने डेटा या दस्तावेज़ में क्या कमी रही? (अधिकतम 3)"
      ),
      {
        qid: "CMM-E02a",
        name: "data_fix_by",
        label: { en: "By when will it be corrected?", hi: "कमी कब तक ठीक करेंगे?" },
        type: "date",
      },
      text(
        "CMM-E02b",
        "data_fix_action",
        "What corrective action will you take?",
        "इसके लिए क्या कार्रवाई करेंगे?"
      ),
    ],
  },
  {
    id: "K",
    title: { en: "Challenges & support", hi: "चुनौतियाँ और सहायता" },
    items: [
      {
        qid: "CMM-F02",
        name: "challenge_type",
        label: {
          en: "Biggest field challenge this month",
          hi: "इस महीने सबसे बड़ी फील्ड चुनौती क्या रही?",
        },
        type: "select",
        options: [
          o("family_unavailable", "Families not available", "परिवार उपलब्ध नहीं"),
          o("documents_incomplete", "Documents incomplete", "दस्तावेज़ अधूरे"),
          o("department_delay", "Departmental delay", "विभागीय देरी"),
          o("community_resistance", "Community resistance", "समुदाय का विरोध"),
          o("safety", "Safety", "सुरक्षा"),
          o("staff_logistics", "Staff / logistics", "स्टाफ/लॉजिस्टिक"),
          o("app_data", "App / data", "ऐप-डेटा"),
          o("other", "Other", "अन्य"),
        ],
        required: true,
      },
      text(
        "CMM-F01",
        "challenge_detail",
        "Describe the challenge briefly",
        "चुनौती का संक्षिप्त विवरण लिखें।"
      ),
      text(
        "CMM-F03",
        "challenge_action",
        "What did you do to resolve this challenge?",
        "इस चुनौती को हल करने के लिए आपने क्या किया?"
      ),
      text(
        "CMM-F04",
        "challenge_support",
        "What support do you need from the Programme Manager?",
        "Programme Manager से क्या सहायता चाहिए?"
      ),
      {
        qid: "CMM-F04b",
        name: "support_expected_date",
        label: { en: "Support needed by", hi: "सहायता कब तक चाहिए?" },
        type: "date",
      },
    ],
  },
  {
    id: "L",
    title: { en: "Next month's plan", hi: "अगले महीने की योजना" },
    items: [
      text(
        "CMM-G01",
        "next_month_priorities",
        "3–5 priorities for next month — with settlement, target and date for each",
        "अगले महीने की 3-5 प्राथमिकताएँ — हर एक के साथ बस्ती, लक्ष्य और तारीख लिखें।",
        true
      ),
      text(
        "CMM-G02",
        "next_month_followups",
        "Key follow-up families / cases carried into next month",
        "अगले महीने के मुख्य फॉलो-अप परिवार/केस कौन-से हैं?"
      ),
      text(
        "CMM-G03",
        "next_month_activities",
        "Meetings / activities planned",
        "कौन-सी बैठकें/गतिविधियाँ योजना में हैं?"
      ),
      text(
        "CMM-G04",
        "personal_goal",
        "One personal improvement goal for next month",
        "अगले महीने अपने काम में सुधार का एक लक्ष्य लिखें।"
      ),
    ],
  },
];

/** Mobiliser declaration — mandatory before submitting (spec section 10). */
export const CM_MONTHLY_CERTIFICATION: { key: string; label: string }[] = [
  {
    key: "cert_01",
    label:
      "मैं पुष्टि करता/करती हूँ कि यह रिपोर्ट मेरे वास्तविक फील्ड कार्य और ऐप में उपलब्ध रिकॉर्ड पर आधारित है। / I confirm this report is based on my actual field work and the records in the app.",
  },
];

/** Blocking checks before a mobiliser can submit (spec section 11). */
export const CM_MONTHLY_REQUIRED: { field: string; message: string }[] = [
  { field: "achievements", message: "इस महीने की मुख्य उपलब्धियाँ (खंड A) ज़रूरी हैं।" },
  { field: "not_as_planned", message: "जो काम पूरा नहीं हुआ उसका कारण (खंड A) ज़रूरी है।" },
  { field: "overdue_cases", message: "अधूरे/overdue केस की जानकारी (खंड I) ज़रूरी है।" },
  { field: "case_action_next", message: "हर अधूरे केस का अगला कदम (खंड I) ज़रूरी है।" },
  { field: "challenge_type", message: "इस महीने की सबसे बड़ी चुनौती (खंड K) चुनें।" },
  {
    field: "next_month_priorities",
    message: "अगले महीने की कम से कम 3 प्राथमिकताएँ (खंड L) दर्ज करें।",
  },
];
