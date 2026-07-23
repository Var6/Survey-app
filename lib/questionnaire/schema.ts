import type { Condition, Field, Option, RepeatGroup, Section } from "./types";
import { SETTLEMENTS, MOBILISER_CODES } from "./settlements";

/**
 * Janman Purnea Household Baseline Tool — full questionnaire (Sections A–O).
 *
 * Field-facing language is Hindi (`hi`). English (`en`) is kept as a fallback
 * and for exports. The UI shows `hi` when present.
 */

export const FORM_VERSION = "V1.0";

const o = (code: string, en: string, hi: string): Option => ({ code, en, hi });
const consentYes: Condition = { field: "consent_given", eq: "yes" };
const gated = (trigger?: Condition): Condition =>
  trigger ? { all: [consentYes, trigger] } : consentYes;

// Reusable option sets
const YES_NO = () => [o("yes", "Yes", "हाँ"), o("no", "No", "नहीं")];
const YN_DK_NR = () => [
  o("yes", "Yes", "हाँ"),
  o("no", "No", "नहीं"),
  o("dont_know", "Don't know", "पता नहीं"),
  o("no_response", "No response", "बताना नहीं चाहते"),
];
const YN_NR = () => [
  o("yes", "Yes", "हाँ"),
  o("no", "No", "नहीं"),
  o("no_response", "No response", "बताना नहीं चाहते"),
];
const YES_NO_MAYBE = () => [
  o("yes", "Yes", "हाँ"),
  o("no", "No", "नहीं"),
  o("maybe", "Maybe", "शायद"),
];
const GENDER = () => [
  o("female", "Female", "महिला"),
  o("male", "Male", "पुरुष"),
  o("other", "Other", "अन्य"),
  o("no_response", "No response", "बताना नहीं चाहते"),
];

/* ─── Section A: Survey details ─────────────────────────────── */
const sectionA: Section = {
  id: "A",
  title: { en: "Survey details", hi: "सर्वे की जानकारी" },
  items: [
    {
      qid: "A2",
      name: "survey_date",
      label: { en: "Survey date", hi: "सर्वे की तारीख़" },
      type: "date",
      required: true,
    },
    {
      qid: "A3",
      name: "mobiliser_name",
      label: { en: "Mobiliser / surveyor name", hi: "सर्वे करने वाले का नाम" },
      type: "select",
      options: [],
      required: true,
    },
    {
      qid: "A4",
      name: "mobiliser_code",
      label: { en: "Mobiliser code", hi: "मोबिलाइज़र कोड" },
      type: "select",
      options: MOBILISER_CODES.map((c) => o(c, c, c)),
      required: true,
    },
    {
      qid: "A5",
      name: "settlement_name",
      label: { en: "Settlement / area", hi: "बस्ती / मोहल्ला" },
      type: "select",
      options: SETTLEMENTS.map((s) => o(s.code, s.label, s.label)),
      required: true,
    },
    {
      qid: "A7",
      name: "gps_location",
      label: { en: "Location / GPS", hi: "लोकेशन / GPS" },
      type: "geopoint",
      required: true,
      note: "Collected only for project mapping.",
    },
    {
      qid: "A8",
      name: "household_landmark",
      label: { en: "Household landmark", hi: "घर की पहचान (लैंडमार्क)" },
      type: "text",
      required: false,
    },
    {
      qid: "A9",
      name: "respondent_name",
      label: { en: "Respondent name", hi: "जवाब देने वाले का नाम" },
      type: "text",
      required: true,
    },
    {
      qid: "A10",
      name: "respondent_relation",
      label: { en: "Respondent's relation to head", hi: "मुखिया से रिश्ता" },
      type: "select",
      options: [
        o("head", "Head", "मुखिया"),
        o("spouse", "Spouse", "पति/पत्नी"),
        o("parent", "Parent", "माता/पिता"),
        o("son_daughter", "Son / Daughter", "बेटा/बेटी"),
        o("other_relative", "Other relative", "अन्य रिश्तेदार"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "A11",
      name: "respondent_phone",
      label: { en: "Respondent phone", hi: "फ़ोन नंबर" },
      type: "phone",
      required: true,
      validation: { digits: 10 },
    },
  ],
};

/* ─── Section B: Consent ────────────────────────────────────── */
const sectionB: Section = {
  id: "B",
  title: { en: "Consent", hi: "सहमति" },
  items: [
    {
      qid: "B1",
      name: "consent_text",
      label: {
        en: "Consent script (read aloud)",
        hi: "नमस्ते, हम जनमन संस्था से हैं। हम इस बस्ती के परिवारों की जानकारी इकट्ठा कर रहे हैं ताकि स्वास्थ्य, शिक्षा, दस्तावेज़ और सरकारी योजनाओं में मदद की जा सके। यह सर्वे हर स्वतंत्र परिवार (household) का अलग-अलग किया जाता है — एक ही मकान में रहने वाले अलग-अलग परिवारों का सर्वे अलग से होगा। आपकी जानकारी गोपनीय रखी जाएगी। क्या आप कुछ सवालों के जवाब देने के लिए तैयार हैं?",
      },
      type: "note",
      required: true,
    },
    {
      qid: "B2",
      name: "consent_given",
      label: {
        en: "Did the respondent give consent?",
        hi: "क्या परिवार सर्वे के लिए राज़ी है?",
      },
      type: "select",
      options: YES_NO(),
      required: true,
      note: "If No, end the form.",
    },
  ],
};

/* ─── Section C: Basic household details ────────────────────── */
const sectionC: Section = {
  id: "C",
  title: { en: "Basic household details", hi: "घर की बुनियादी जानकारी" },
  showWhen: gated(),
  items: [
    {
      qid: "C1",
      name: "head_name",
      label: { en: "Household head's name", hi: "घर के मुखिया का नाम" },
      type: "text",
      required: true,
    },
    {
      qid: "C2",
      name: "hh_total_members",
      label: {
        en: "How many members live in this household?",
        hi: "घर में कुल कितने सदस्य रहते हैं?",
      },
      type: "integer",
      required: true,
      validation: { min: 1, max: 25 },
    },
    {
      qid: "C3",
      name: "hh_type",
      label: { en: "Household type", hi: "परिवार का प्रकार" },
      type: "select",
      options: [
        o("nuclear", "Nuclear family", "एकल परिवार"),
        o("joint", "Joint family", "संयुक्त परिवार"),
        o("single", "Single-person household", "अकेला व्यक्ति"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "C4",
      name: "years_in_settlement",
      label: {
        en: "How many years has the family lived in this settlement?",
        hi: "परिवार इस बस्ती में कितने सालों से रह रहा है?",
      },
      type: "select",
      options: [
        o("y1_5", "1–5 years", "1-5 साल"),
        o("y5_10", "5–10 years", "5-10 साल"),
        o("more_10", "More than 10 years", "10 साल से ज़्यादा"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "C5",
      name: "migration_status",
      label: {
        en: "Do members go outside the district for work?",
        hi: "क्या घर के लोग काम के लिए ज़िला से बाहर जाते हैं?",
      },
      type: "select",
      options: [
        o("no", "No", "नहीं"),
        o("seasonal", "Seasonally", "मौसम के हिसाब से"),
        o("one_or_more", "One or more members go outside", "एक या ज़्यादा लोग बाहर जाते हैं"),
        o("whole_family_moves", "Whole family moves", "पूरा परिवार बाहर जाता है"),
      ],
      required: true,
    },
    {
      qid: "C6",
      name: "main_livelihood",
      label: {
        en: "Main source of livelihood",
        hi: "घर की आमदनी का मुख्य ज़रिया",
      },
      type: "select",
      options: [
        o("daily_wage", "Daily wage labour", "दिहाड़ी मज़दूरी"),
        o("informal_work", "Informal / odd work", "छोटा-मोटा काम"),
        o("rickshaw_driver", "Rickshaw / auto / e-rickshaw", "रिक्शा/ऑटो/ई-रिक्शा"),
        o("domestic_work", "Work in others’ homes", "दूसरे के घर में काम"),
        o("small_business", "Small business / shop", "छोटा व्यापार/दुकान"),
        o("salaried", "Salaried", "नौकरी"),
        o("rag_picking", "Rag / scrap picking", "कबाड़/कचरा बीनना"),
        o("no_regular_income", "No regular income", "कोई पक्की आमदनी नहीं"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "C7",
      name: "monthly_income_range",
      label: {
        en: "Approx. monthly household income",
        hi: "घर की महीने की अनुमानित आमदनी",
      },
      type: "select",
      options: [
        o("less_5000", "Below ₹5,000", "₹5,000 से कम"),
        o("5000_10000", "₹5,000–₹10,000", "₹5,000-₹10,000"),
        o("10001_15000", "₹10,001–₹15,000", "₹10,001-₹15,000"),
        o("15001_25000", "₹15,001–₹25,000", "₹15,001-₹25,000"),
        o("more_25000", "Above ₹25,000", "₹25,000 से ज़्यादा"),
        o("irregular", "Irregular", "अनियमित"),
        o("refused", "Refused to answer", "बताना नहीं चाहते"),
      ],
      required: false,
    },
    {
      qid: "C8",
      name: "housing_type",
      label: { en: "Type of house", hi: "घर किस तरह का है?" },
      type: "select",
      options: [
        o("kaccha", "Kaccha", "कच्चा"),
        o("semi_pucca", "Semi-pucca", "अर्ध-पक्का"),
        o("pucca", "Pucca", "पक्का"),
        o("temporary", "Temporary / shelter", "अस्थायी / झोपड़ी"),
        o("rented", "Rented", "किराये का"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "C9",
      name: "social_group",
      label: {
        en: "Social group",
        hi: "सामाजिक वर्ग",
      },
      type: "select",
      options: [
        o("sc", "SC", "अनुसूचित जाति (SC)"),
        o("st", "ST", "अनुसूचित जनजाति (ST)"),
        o("obc", "OBC", "पिछड़ा वर्ग (OBC)"),
        o("ebc", "EBC", "अत्यंत पिछड़ा वर्ग / EBC"),
        o("minority", "Minority", "अल्पसंख्यक"),
        o("general", "General", "जनरल / सामान्य"),
        o("other", "Other", "अन्य"),
        o("no_response", "No response", "बताना नहीं चाहते"),
      ],
      required: true,
    },
  ],
};

/* ─── Section D: Household member roster (repeat) ───────────── */
/** Member age helpers for the age-based education block. */
const mAge = (v: Record<string, unknown>): number | null => {
  const n = Number(v.member_age);
  return Number.isFinite(n) && String(v.member_age).length > 0 ? n : null;
};
const inAge = (v: Record<string, unknown>, lo: number, hi: number): boolean => {
  const a = mAge(v);
  return a !== null && a >= lo && a <= hi;
};
const rosterMember: RepeatGroup = {
  kind: "repeat",
  qid: "D0",
  name: "household_members",
  label: { en: "Household members", hi: "घर के सदस्य" },
  countFrom: "hh_total_members",
  showWhen: consentYes,
  fields: [
    {
      qid: "D1",
      name: "member_name",
      label: { en: "Member name", hi: "सदस्य का नाम" },
      type: "text",
      required: true,
    },
    {
      qid: "D2",
      name: "member_age",
      label: { en: "Age", hi: "उम्र (साल)" },
      type: "integer",
      required: true,
      validation: { min: 0, max: 110 },
    },
    {
      qid: "D3",
      name: "member_gender",
      label: { en: "Gender", hi: "लिंग" },
      type: "select",
      options: GENDER(),
      required: true,
    },
    {
      qid: "D4",
      name: "member_relation",
      label: { en: "Relation to head", hi: "मुखिया से रिश्ता" },
      type: "select",
      options: [
        o("head", "Head", "मुखिया"),
        o("spouse", "Spouse", "पति/पत्नी"),
        o("son", "Son", "बेटा"),
        o("daughter", "Daughter", "बेटी"),
        o("parent", "Parent", "माता/पिता"),
        o("sibling", "Sibling", "भाई/बहन"),
        o("grandchild", "Grandchild", "पोता/पोती/नाती/नातिन"),
        o("daughter_in_law", "Daughter-in-law", "बहू"),
        o("son_in_law", "Son-in-law", "दामाद"),
        o("other_relative", "Other relative", "अन्य रिश्तेदार"),
        o("non_relative", "Non-relative", "गैर-रिश्तेदार"),
      ],
      required: true,
    },
    {
      qid: "D5",
      name: "member_marital_status",
      label: { en: "Marital status", hi: "वैवाहिक स्थिति" },
      type: "select",
      options: [
        o("unmarried", "Unmarried", "अविवाहित"),
        o("married", "Married", "विवाहित"),
        o("widow", "Widow / widower", "विधवा/विधुर"),
        o("separated", "Separated", "अलग रहते हैं"),
        o("divorced", "Divorced", "तलाकशुदा"),
      ],
      requiredWhen: { field: "member_age", gte: 15 },
    },
    /* ── Education status: age-based (D6 series) ── */
    {
      qid: "D6a",
      name: "member_edu_under3",
      label: { en: "Education status (under 3)", hi: "शैक्षणिक स्थिति" },
      type: "select",
      options: [
        o("not_school_age", "Not yet of school/anganwadi age", "अभी स्कूल/आंगनवाड़ी जाने की आयु नहीं है"),
      ],
      showWhen: { expr: (v) => mAge(v) !== null && mAge(v)! < 3 },
      required: true,
    },
    {
      qid: "D6b",
      name: "member_preschool_status",
      label: {
        en: "Does the child attend a pre-school / anganwadi / play school?",
        hi: "क्या बच्चा किसी प्री-स्कूल/आंगनवाड़ी/प्ले स्कूल में जाता है?",
      },
      type: "select",
      options: [
        o("yes_awc", "Yes — Anganwadi", "हाँ – आंगनवाड़ी"),
        o("yes_private_play", "Yes — private play school", "हाँ – निजी प्ले स्कूल"),
        o("yes_govt_pre", "Yes — government pre-school", "हाँ – सरकारी प्री-स्कूल"),
        o("no", "No", "नहीं"),
      ],
      showWhen: { expr: (v) => inAge(v, 3, 5) },
      required: true,
    },
    {
      qid: "D6b1",
      name: "member_preschool_no_reason",
      label: { en: "Why not?", hi: "कारण" },
      type: "select",
      options: [
        o("not_started", "Not started yet", "अभी शुरू नहीं किया"),
        o("family_not_sending", "Family does not send", "घर वाले नहीं भेजते"),
        o("no_facility", "No facility available", "सुविधा उपलब्ध नहीं"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { expr: (v) => inAge(v, 3, 5) && v.member_preschool_status === "no" },
      required: true,
    },
    {
      qid: "D6c",
      name: "member_school_status_6_18",
      label: { en: "Current education status", hi: "वर्तमान शैक्षणिक स्थिति" },
      type: "select",
      options: [
        o("in_school", "Currently studying in school", "वर्तमान में विद्यालय में पढ़ रहे हैं"),
        o("dropout", "Dropped out of school", "विद्यालय से ड्रॉपआउट"),
        o("never_enrolled", "Never went to school", "कभी विद्यालय नहीं गए"),
        o("open_school", "Open school", "ओपन स्कूल"),
        o("madarsa", "Madarsa", "मदरसा"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { expr: (v) => inAge(v, 6, 18) },
      required: true,
    },
    {
      qid: "D6c1",
      name: "member_current_class",
      label: { en: "Which class currently?", hi: "वर्तमान में किस कक्षा में पढ़ते हैं?" },
      type: "select",
      options: [
        o("class1", "Class 1", "कक्षा 1"), o("class2", "Class 2", "कक्षा 2"), o("class3", "Class 3", "कक्षा 3"), o("class4", "Class 4", "कक्षा 4"), o("class5", "Class 5", "कक्षा 5"), o("class6", "Class 6", "कक्षा 6"), o("class7", "Class 7", "कक्षा 7"), o("class8", "Class 8", "कक्षा 8"), o("class9", "Class 9", "कक्षा 9"), o("class10", "Class 10", "कक्षा 10"), o("class11", "Class 11", "कक्षा 11"), o("class12", "Class 12", "कक्षा 12"),
        o("iti", "ITI", "आईटीआई"),
        o("polytechnic", "Polytechnic", "पॉलिटेक्निक"),
        o("diploma", "Diploma", "डिप्लोमा"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { expr: (v) => inAge(v, 6, 18) && v.member_school_status_6_18 === "in_school" },
      required: true,
    },
    {
      qid: "D6c2",
      name: "member_school_type",
      label: { en: "Type of school", hi: "विद्यालय का प्रकार" },
      type: "select",
      options: [
        o("govt", "Government", "सरकारी"),
        o("private", "Private", "निजी"),
        o("madarsa", "Madarsa", "मदरसा"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { expr: (v) => inAge(v, 6, 18) && v.member_school_status_6_18 === "in_school" },
      required: true,
    },
    {
      qid: "D6c3",
      name: "member_dropout_last_class",
      label: { en: "Last class studied?", hi: "अंतिम बार किस कक्षा तक पढ़ाई की?" },
      type: "select",
      options: [
        o("class1", "Class 1", "कक्षा 1"), o("class2", "Class 2", "कक्षा 2"), o("class3", "Class 3", "कक्षा 3"), o("class4", "Class 4", "कक्षा 4"), o("class5", "Class 5", "कक्षा 5"), o("class6", "Class 6", "कक्षा 6"), o("class7", "Class 7", "कक्षा 7"), o("class8", "Class 8", "कक्षा 8"), o("class9", "Class 9", "कक्षा 9"), o("class10", "Class 10", "कक्षा 10"), o("class11", "Class 11", "कक्षा 11"), o("class12", "Class 12", "कक्षा 12"),
      ],
      showWhen: { expr: (v) => inAge(v, 6, 18) && v.member_school_status_6_18 === "dropout" },
      required: true,
    },
    {
      qid: "D6c4",
      name: "member_dropout_reason",
      label: { en: "Main reason for dropout", hi: "ड्रॉपआउट का प्रमुख कारण" },
      type: "select",
      options: [
        o("documents", "Lack of documents", "दस्तावेजों की कमी"),
        o("financial", "Financial reasons", "आर्थिक कारण"),
        o("family_responsibility", "Family responsibility", "परिवार की जिम्मेदारी"),
        o("marriage", "Marriage", "शादी"),
        o("housework", "Housework", "घर का काम"),
        o("not_interested", "Not interested in studies", "पढ़ाई में रुचि नहीं"),
        o("repeated_failure", "Repeated failure", "बार-बार फेल होना"),
        o("school_far", "School is far", "स्कूल दूर है"),
        o("illness", "Illness", "बीमारी"),
        o("disability", "Disability", "दिव्यांगता"),
        o("parents_stopped", "Parents stopped", "माता-पिता ने रोक दिया"),
        o("migration", "Migration", "प्रवास"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { expr: (v) => inAge(v, 6, 18) && v.member_school_status_6_18 === "dropout" },
      required: true,
    },
    {
      qid: "D6c5",
      name: "member_never_school_reason",
      label: { en: "Reason never enrolled", hi: "कारण" },
      type: "select",
      options: [
        o("underage", "Not old enough yet", "आयु पूरी नहीं हुई"),
        o("financial", "Financial reasons", "आर्थिक कारण"),
        o("parents_not_sending", "Guardians do not send", "अभिभावक नहीं भेजते"),
        o("disability", "Disability", "दिव्यांगता"),
        o("no_documents", "No documents", "दस्तावेज नहीं"),
        o("migrant_family", "Migrant family", "प्रवासी परिवार"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { expr: (v) => inAge(v, 6, 18) && v.member_school_status_6_18 === "never_enrolled" },
      required: true,
    },
    {
      qid: "D6d",
      name: "member_highest_qual_19_24",
      label: { en: "Highest educational qualification", hi: "सर्वोच्च शैक्षणिक योग्यता" },
      type: "select",
      options: [
        o("illiterate", "Illiterate", "निरक्षर"),
        o("can_sign", "Can sign", "हस्ताक्षर कर लेते हैं"),
        o("primary", "Primary (class 1–5)", "प्राथमिक (कक्षा 1-5)"),
        o("middle", "Middle (6–8)", "मध्य (6-8)"),
        o("secondary", "Secondary (10th)", "माध्यमिक (10वीं)"),
        o("higher_secondary", "Higher secondary (12th)", "उच्च माध्यमिक (12वीं)"),
        o("iti_diploma", "ITI / Diploma", "आईटीआई / डिप्लोमा"),
        o("graduate", "Graduate", "स्नातक"),
        o("postgraduate", "Postgraduate", "स्नातकोत्तर"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { expr: (v) => inAge(v, 19, 24) },
      required: true,
    },
    {
      qid: "D6d1",
      name: "member_studying_now",
      label: { en: "Currently studying?", hi: "क्या वर्तमान में पढ़ाई कर रहे हैं?" },
      type: "select",
      options: [o("yes", "Yes", "हाँ"), o("no", "No", "नहीं")],
      showWhen: { expr: (v) => inAge(v, 19, 24) },
      required: true,
    },
    {
      qid: "D6d2",
      name: "member_current_course",
      label: { en: "Current course", hi: "वर्तमान कोर्स" },
      type: "select",
      options: [
        o("graduation", "Graduation", "Graduation"),
        o("pg", "PG", "PG"),
        o("iti", "ITI", "ITI"),
        o("skill_course", "Skill Course", "Skill Course"),
        o("competitive_exam", "Competitive Exam", "Competitive Exam"),
        o("other", "Other", "Other"),
      ],
      showWhen: { expr: (v) => inAge(v, 19, 24) && v.member_studying_now === "yes" },
      required: true,
    },
    {
      qid: "D6e",
      name: "member_highest_qual_25",
      label: { en: "Highest educational qualification", hi: "सर्वोच्च शैक्षणिक योग्यता" },
      type: "select",
      options: [
        o("never_school", "Never went to school", "कभी स्कूल नहीं गए"),
        o("can_sign", "Can only sign", "केवल हस्ताक्षर कर लेते हैं"),
        o("primary", "Primary", "प्राथमिक"),
        o("middle", "Middle", "मध्य"),
        o("matric", "Matric", "मैट्रिक"),
        o("inter", "Inter", "इंटर"),
        o("iti", "ITI", "आईटीआई"),
        o("diploma", "Diploma", "डिप्लोमा"),
        o("graduate", "Graduate", "स्नातक"),
        o("postgraduate", "Postgraduate", "स्नातकोत्तर"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { expr: (v) => mAge(v) !== null && mAge(v)! >= 25 },
      required: true,
    },
    {
      qid: "D7",
      name: "member_work_status",
      label: { en: "Work / activity status", hi: "काम / गतिविधि" },
      type: "select",
      options: [
        o("student", "Student / studying", "विद्यार्थी / पढाई"),
        o("employed", "Has employment", "कोई रोजगार है"),
        o("migrates_for_work", "Goes outside the district for work", "रोजगार के लिए ज़िले से बाहर जाते हैं"),
        o("unemployed", "Unemployed", "बेरोजगार"),
        o("unable_work", "Unable to work", "काम करने में असमर्थ"),
        o("elderly", "Elderly", "बुज़ुर्ग"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "D8",
      name: "member_disability",
      label: { en: "Any disability?", hi: "कोई दिव्यांगता?" },
      type: "select",
      options: [
        o("no", "No", "नहीं"),
        o("yes_cert", "Yes — with certificate", "हाँ - प्रमाणपत्र के साथ"),
        o("yes_no_cert", "Yes — without certificate", "हाँ - बिना प्रमाणपत्र"),
        o("dont_know", "Don't know", "पता नहीं"),
        o("no_response", "No response", "बताना नहीं चाहते"),
      ],
      required: true,
    },
    {
      qid: "D9",
      name: "member_phone",
      label: { en: "Phone (optional)", hi: "फ़ोन (वैकल्पिक)" },
      type: "phone",
      required: false,
      validation: { digits: 10 },
    },
  ],
};

const sectionD: Section = {
  id: "D",
  title: { en: "Household member roster", hi: "घर के सदस्य" },
  showWhen: gated(),
  items: [rosterMember],
};

/* ─── Section E: Target group counts ────────────────────────── */
const intCount = (qid: string, name: string, en: string, hi: string): Field => ({
  qid,
  name,
  label: { en, hi },
  type: "integer",
  required: true,
  // Can't be more people than the whole household.
  validation: { min: 0, max: 25, maxFrom: "hh_total_members" },
});

const sectionE: Section = {
  id: "E",
  title: { en: "Target group counts", hi: "समूह गिनती" },
  showWhen: gated(),
  items: [
    intCount("E1", "num_children_0_3", "Number of children aged 0–3", "0-3 साल के कितने बच्चे हैं?"),
    intCount("E2", "num_children_4_12", "Number of children aged 4–12", "4-12 साल के कितने बच्चे हैं?"),
    intCount("E3", "num_youth_13_24", "Number of youth aged 13–24", "13-24 साल के कितने युवा हैं?"),
    intCount("E4", "num_women_15_49", "Number of women aged 15–49", "15-49 साल की कितनी महिलाएँ हैं?"),
    {
      qid: "E5",
      name: "has_pregnant_or_lactating",
      label: {
        en: "Any pregnant or lactating woman (last 6 months)?",
        hi: "क्या घर में कोई गर्भवती महिला या धात्री माँ (पिछले 6 महीने में) है?",
      },
      type: "select",
      options: YN_DK_NR(),
      required: true,
    },
    intCount("E6", "num_elderly_60plus", "Number of elderly (60+)", "60 साल से ऊपर के कितने बुज़ुर्ग हैं?"),
    {
      qid: "E7",
      name: "has_widow_single_woman",
      label: {
        en: "Any widow / single woman?",
        hi: "क्या कोई विधवा/अकेली महिला है?",
      },
      type: "select",
      options: YN_NR(),
      required: false,
    },
    {
      qid: "E8",
      name: "has_pwd_member",
      label: {
        en: "Any person with disability?",
        hi: "क्या घर में कोई दिव्यांग व्यक्ति है?",
      },
      type: "select",
      options: YN_NR(),
      required: true,
    },
  ],
};

/* ─── Section F: Documents and entitlements ─────────────────── */
const sectionF: Section = {
  id: "F",
  title: { en: "Documents and entitlements", hi: "दस्तावेज़ और योजनाएँ" },
  showWhen: gated(),
  items: [
    {
      qid: "F1",
      name: "all_have_aadhaar",
      label: {
        en: "Do all members have Aadhaar?",
        hi: "क्या घर के सभी सदस्यों के पास आधार है?",
      },
      type: "select",
      options: [
        o("all", "All", "सबके पास"),
        o("some", "Some", "कुछ के पास"),
        o("none", "None", "किसी के पास नहीं"),
        o("correction", "Some need correction / update", "कुछ में सुधार/अपडेट चाहिए"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "F2",
      name: "has_ration_card",
      label: {
        en: "Does the household have a ration / PDS card?",
        hi: "क्या घर के पास राशन/PDS कार्ड है?",
      },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("no", "No", "नहीं"),
        o("applied", "Applied", "आवेदन किया है"),
        o("not_received", "Applied / not received", "आवेदन किया, नहीं मिला"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "F3",
      name: "ration_card_issue",
      label: {
        en: "What issue is there with the ration card?",
        hi: "राशन कार्ड में क्या दिक्कत है?",
      },
      type: "multiselect",
      options: [
        o("no_card", "No card", "कार्ड नहीं है"),
        o("names_missing", "Names missing", "नाम छूटे हुए हैं"),
        o("wrong_details", "Wrong details", "गलत जानकारी"),
        o("not_getting_ration", "Not getting ration", "राशन नहीं मिल रहा"),
        o("migrated_issue", "Migration-related issue", "प्रवास से जुड़ी दिक्कत"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { field: "has_ration_card", ne: "yes" },
      required: false,
    },
    {
      qid: "F4",
      name: "has_ayushman_card",
      label: {
        en: "Does the household have an Ayushman card?",
        hi: "क्या घर के पास आयुष्मान कार्ड है?",
      },
      type: "select",
      options: [
        o("all", "All eligible members have it", "सभी योग्य सदस्यों के पास"),
        o("some", "Some", "कुछ के पास"),
        o("none", "None", "किसी के पास नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "F5",
      name: "has_bank_account",
      label: {
        en: "Does anyone have a bank account?",
        hi: "क्या किसी का बैंक में खाता है?",
      },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("no", "No", "नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "F6",
      name: "birth_cert_children",
      label: {
        en: "Do children have birth certificates?",
        hi: "क्या बच्चों के जन्म प्रमाणपत्र हैं?",
      },
      type: "select",
      options: [
        o("all", "All have it", "सबके पास"),
        o("some", "Some", "कुछ के पास"),
        o("none", "None", "किसी के पास नहीं"),
        o("no_children", "No children", "कोई बच्चा नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      showWhen: {
        expr: (v) =>
          Number(v.num_children_0_3 || 0) + Number(v.num_children_4_12 || 0) > 0,
      },
    },
    {
      qid: "F7",
      name: "pension_need",
      label: { en: "Is any pension needed?", hi: "क्या घर में किसी पेंशन की ज़रूरत है?" },
      type: "multiselect",
      options: [
        o("old_age", "Old-age pension", "वृद्धावस्था पेंशन"),
        o("widow", "Widow pension", "विधवा पेंशन"),
        o("disability", "Disability pension", "दिव्यांग पेंशन"),
        o("none", "None", "कोई नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "F8",
      name: "maternity_benefit_status",
      label: {
        en: "Maternity benefit (PMMVY / JSY) status",
        hi: "मातृत्व लाभ (PMMVY/JSY) की स्थिति",
      },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("no", "No", "नहीं"),
        o("already_getting", "Already getting it", "पहले से मिल रहा है"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      showWhen: { field: "has_pregnant_or_lactating", eq: "yes" },
    },
    {
      qid: "F9",
      name: "other_docs_needed",
      label: {
        en: "Any other documents needed?",
        hi: "और कौन से दस्तावेज़/प्रमाणपत्र चाहिए?",
      },
      type: "multiselect",
      options: [
        o("voter_id", "Voter ID", "वोटर आईडी"),
        o("caste_cert", "Caste certificate", "जाति प्रमाणपत्र"),
        o("income_cert", "Income certificate", "आय प्रमाणपत्र"),
        o("residence_cert", "Residence certificate", "निवास प्रमाणपत्र"),
        o("disability_cert", "Disability certificate", "दिव्यांगता प्रमाणपत्र"),
        o("school_docs", "School documents", "स्कूल के कागज़"),
        o("other", "Other", "अन्य"),
        o("none", "None", "कोई नहीं"),
      ],
      required: false,
    },
    {
      qid: "F10",
      name: "entitlement_followup_required",
      label: {
        en: "Is entitlement follow-up required?",
        hi: "क्या दस्तावेज़/योजना के लिए फॉलो-अप चाहिए?",
      },
      type: "select",
      options: YES_NO_MAYBE(),
      required: true,
    },
    {
      qid: "F10a",
      name: "entitlement_followup_details",
      label: {
        en: "Follow-up details",
        hi: "किस दस्तावेज़/योजना के लिए मदद चाहिए? विवरण लिखें",
      },
      type: "textarea",
      showWhen: { field: "entitlement_followup_required", eq: "yes" },
      required: true,
    },
  ],
};

/* ─── Section G: Health access ──────────────────────────────── */
const sectionG: Section = {
  id: "G",
  title: { en: "Health access", hi: "स्वास्थ्य सेवा" },
  showWhen: gated(),
  items: [
    {
      qid: "G1",
      name: "usual_health_place",
      label: {
        en: "Where does the household usually go when unwell?",
        hi: "बीमार होने पर घर के लोग आमतौर पर कहाँ जाते हैं?",
      },
      type: "select",
      options: [
        o("govt_hospital", "Government hospital", "सरकारी अस्पताल"),
        o("govt_phc", "Government PHC / clinic", "सरकारी PHC/क्लिनिक"),
        o("private_clinic", "Private clinic / hospital", "प्राइवेट क्लिनिक/अस्पताल"),
        o("local_provider", "Local / informal provider", "स्थानीय/झोलाछाप डॉक्टर"),
        o("pharmacy", "Pharmacy", "दवा दुकान"),
        o("no_fixed", "No fixed place", "कोई तय जगह नहीं"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "G2",
      name: "uses_govt_health",
      label: {
        en: "How often are govt. health facilities used?",
        hi: "सरकारी स्वास्थ्य केंद्र का कितनी बार इस्तेमाल करते हैं?",
      },
      type: "select",
      options: [
        o("often", "Often", "अक्सर"),
        o("sometimes", "Sometimes", "कभी-कभी"),
        o("rarely", "Rarely", "कम"),
        o("never", "Never", "कभी नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "G3",
      name: "health_barriers",
      label: {
        en: "Main problems reaching health facilities",
        hi: "स्वास्थ्य केंद्र तक पहुँचने में मुख्य दिक्कतें",
      },
      type: "multiselect",
      options: [
        o("distance", "Distance", "दूरी"),
        o("cost", "Cost", "खर्च"),
        o("documents", "Documents", "दस्तावेज़"),
        o("behaviour", "Staff behaviour", "स्टाफ का व्यवहार"),
        o("long_wait", "Long wait", "लंबा इंतज़ार"),
        o("dont_know_where", "Don't know where to go", "कहाँ जाएँ पता नहीं"),
        o("no_problem", "No problem", "कोई दिक्कत नहीं"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "G4",
      name: "knows_asha_anm_aww",
      label: {
        en: "Does the household know the ASHA / ANM / AWW?",
        hi: "क्या घर के लोग ASHA/ANM/आंगनवाड़ी कार्यकर्ता को जानते हैं?",
      },
      type: "select",
      options: [
        o("all", "Knows all / most", "सबको/ज़्यादातर को जानते हैं"),
        o("some", "Knows some", "कुछ को जानते हैं"),
        o("none", "Knows none", "किसी को नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "G5",
      name: "chronic_or_serious_illness",
      label: {
        en: "Anyone with a chronic/serious illness?",
        hi: "क्या किसी को लंबी या गंभीर बीमारी है?",
      },
      type: "select",
      options: YN_NR(),
      required: false,
    },
    {
      qid: "G5a",
      name: "chronic_illness_details",
      label: { en: "Illness details", hi: "बीमारी का विवरण लिखें" },
      type: "textarea",
      showWhen: { field: "chronic_or_serious_illness", eq: "yes" },
      required: true,
    },
    {
      qid: "G6",
      name: "health_referral_need",
      label: {
        en: "Any health referral need?",
        hi: "क्या घर के लिए कोई स्वास्थ्य रेफ़रल चाहिए?",
      },
      type: "select",
      options: [
        o("urgent", "Urgent", "तुरंत"),
        o("routine", "Routine follow-up", "सामान्य फॉलो-अप"),
        o("no", "No", "नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "G7",
      name: "health_referral_details",
      label: {
        en: "What kind of health follow-up is needed?",
        hi: "किस तरह का स्वास्थ्य फॉलो-अप चाहिए?",
      },
      type: "multiselect",
      options: [
        o("pregnant_woman", "Pregnant woman", "गर्भवती महिला"),
        o("child_health", "Child health / immunisation", "बच्चे का स्वास्थ्य/टीका"),
        o("disability", "Disability", "दिव्यांगता"),
        o("emergency", "Urgent emergency", "आपातकाल"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { field: "health_referral_need", in: ["urgent", "routine"] },
    },
  ],
};

/* ─── Section H: Maternal health ────────────────────────────── */
const hasPreg: Condition = { field: "has_pregnant_or_lactating", eq: "yes" };
const sectionH: Section = {
  id: "H",
  title: { en: "Maternal health, pregnancy and ICDS", hi: "गर्भवती / नई माँ और ICDS" },
  showWhen: gated(hasPreg),
  items: [
    {
      qid: "H1",
      name: "preg_lactating_name",
      label: { en: "Name of pregnant woman / new mother", hi: "गर्भवती महिला/नई माँ का नाम" },
      type: "text",
      required: true,
    },
    {
      qid: "H2",
      name: "pregnancy_month",
      label: { en: "If pregnant, which month?", hi: "अगर गर्भवती हैं, तो कौन सा महीना?" },
      type: "select",
      options: [
        o("m1_3", "1–3 months", "1-3 महीने"),
        o("m4_6", "4–6 months", "4-6 महीने"),
        o("m7_9", "7–9 months", "7-9 महीने"),
        o("delivered_recently", "Delivered recently", "हाल ही में प्रसव हुआ"),
        o("dont_know", "Don't know", "पता नहीं"),
        o("no_response", "No response", "बताना नहीं चाहते"),
      ],
    },
    {
      qid: "H3",
      name: "registered_with_asha_anm",
      label: {
        en: "Registered with ASHA / ANM?",
        hi: "क्या ASHA/ANM के पास पंजीकरण हुआ है?",
      },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("no", "No", "नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
    },
    {
      qid: "H4",
      name: "anc_checkup_done",
      label: { en: "Any ANC / check-up done?", hi: "क्या ANC/जाँच हुई है?" },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("no", "No", "नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
        o("not_applicable", "Not applicable", "लागू नहीं"),
      ],
      showWhen: { field: "pregnancy_month", ne: "delivered_recently" },
    },
    {
      qid: "H5",
      name: "number_anc",
      label: { en: "How many check-ups so far?", hi: "अब तक कितनी जाँच हुई हैं?" },
      type: "integer",
      validation: { min: 0, max: 20 },
      showWhen: { field: "anc_checkup_done", eq: "yes" },
    },
    {
      qid: "H6",
      name: "icds_linked",
      label: {
        en: "Getting Anganwadi / ICDS / THR services?",
        hi: "क्या आंगनवाड़ी/ICDS/THR सेवाएँ मिल रही हैं?",
      },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("no", "No", "नहीं"),
        o("irregular", "Irregular", "अनियमित"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
    },
    {
      qid: "H7",
      name: "delivery_plan_place",
      label: { en: "Where is delivery planned?", hi: "प्रसव कहाँ कराने की योजना है?" },
      type: "select",
      options: [
        o("govt_hospital", "Government hospital", "सरकारी अस्पताल"),
        o("private", "Private hospital / clinic", "प्राइवेट अस्पताल/क्लिनिक"),
        o("home", "Home", "घर पर"),
        o("not_decided", "Not decided", "तय नहीं"),
        o("no_response", "No response", "बताना नहीं चाहते"),
      ],
      showWhen: { field: "pregnancy_month", in: ["m4_6", "m7_9"] },
    },
    {
      qid: "H8",
      name: "pregnancy_warning_reported",
      label: {
        en: "Any warning sign reported to ASHA / ANM?",
        hi: "क्या ख़तरे का कोई लक्षण ASHA/ANM को बताया गया?",
      },
      type: "select",
      options: YN_DK_NR(),
    },
    {
      qid: "H9",
      name: "maternal_followup_required",
      label: { en: "Maternal health follow-up needed?", hi: "क्या मातृ स्वास्थ्य फॉलो-अप चाहिए?" },
      type: "select",
      options: [
        o("urgent", "Urgent", "तुरंत"),
        o("routine", "Routine follow-up", "सामान्य फॉलो-अप"),
        o("no", "No", "नहीं"),
      ],
      required: true,
    },
  ],
};

/* ─── Section I: Children aged 0–3 (repeat) ─────────────────── */
const child03: RepeatGroup = {
  kind: "repeat",
  qid: "I0",
  name: "children_0_3",
  label: { en: "Children aged 0–3", hi: "0-3 साल के बच्चे" },
  countFrom: "num_children_0_3",
  showWhen: gated({ field: "num_children_0_3", gt: 0 }),
  fields: [
    {
      qid: "I1",
      name: "child_0_3_name",
      label: { en: "Child's name", hi: "बच्चे का नाम" },
      type: "text",
      required: true,
    },
    {
      qid: "I2",
      name: "child_0_3_age_months",
      label: { en: "Age in completed months", hi: "उम्र (पूरे महीनों में)" },
      type: "integer",
      required: true,
      validation: { min: 0, max: 47 },
    },
    {
      qid: "I3",
      name: "child_0_3_gender",
      label: { en: "Gender", hi: "लिंग" },
      type: "select",
      options: [
        o("female", "Female", "लड़की"),
        o("male", "Male", "लड़का"),
        o("other", "Other", "अन्य"),
        o("no_response", "No response", "बताना नहीं चाहते"),
      ],
      required: true,
    },
    {
      qid: "I4",
      name: "child_0_3_birth_certificate",
      label: { en: "Does the child have a birth certificate?", hi: "क्या बच्चे का जन्म प्रमाणपत्र है?" },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("no", "No", "नहीं"),
        o("applied", "Applied", "आवेदन किया है"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "I5",
      name: "child_0_3_anganwadi_linked",
      label: { en: "Linked with Anganwadi?", hi: "क्या आंगनवाड़ी से जुड़ा है?" },
      type: "select",
      options: [
        o("regular", "Yes, regularly", "हाँ, नियमित"),
        o("irregular", "Sometimes / irregular", "कभी-कभी"),
        o("no", "No", "नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "I5a",
      name: "child_0_3_awc_no_reason",
      label: { en: "Why not linked?", hi: "आंगनवाड़ी से क्यों नहीं जुड़ा? कारण लिखें" },
      type: "textarea",
      showWhen: { field: "child_0_3_anganwadi_linked", eq: "no" },
      required: true,
    },
    {
      qid: "I6",
      name: "child_0_3_immunisation_status",
      label: { en: "Immunisation status", hi: "टीकाकरण की स्थिति" },
      type: "select",
      options: [
        o("up_to_date", "Up to date", "पूरा / समय पर"),
        o("partial", "Partial", "आंशिक"),
        o("none", "None", "कोई नहीं"),
        o("dont_know", "Don't know / no card", "पता नहीं / कार्ड नहीं"),
      ],
      required: true,
    },
    {
      qid: "I7",
      name: "child_0_3_growth_monitoring",
      label: { en: "Weighed / growth monitored recently?", hi: "क्या हाल में वज़न/ग्रोथ जाँच हुई?" },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("no", "No", "नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "I8",
      name: "child_0_3_support_need",
      label: { en: "What do you think the child needs?", hi: "आपके अनुसार बच्चों को किस चीज़ की ज़रूरत है?" },
      type: "multiselect",
      options: [
        o("health_check", "Health check", "स्वास्थ्य जाँच"),
        o("immunisation", "Immunisation", "टीकाकरण"),
        o("anganwadi_linkage", "Anganwadi linkage", "आंगनवाड़ी से जुड़ाव"),
        o("nutrition", "Nutrition", "पोषण"),
        o("birth_certificate", "Birth certificate", "जन्म प्रमाणपत्र"),
        o("sports_play", "Sports / play", "खेल कूद"),
        o("none", "No support needed", "कोई मदद नहीं चाहिए"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "I9",
      name: "child_0_3_remarks",
      label: { en: "Remarks", hi: "Remarks / टिप्पणी" },
      type: "textarea",
      required: false,
    },
  ],
};

const sectionI: Section = {
  id: "I",
  title: { en: "Children aged 0–3", hi: "0-3 साल के बच्चे" },
  showWhen: gated({ field: "num_children_0_3", gt: 0 }),
  items: [child03],
};

/* ─── Section J: Children 4–12 and education (repeat) ───────── */
const child412: RepeatGroup = {
  kind: "repeat",
  qid: "J0",
  name: "children_4_12",
  label: { en: "Children aged 4–12", hi: "4-12 साल के बच्चे" },
  countFrom: "num_children_4_12",
  showWhen: gated({ field: "num_children_4_12", gt: 0 }),
  fields: [
    {
      qid: "J1",
      name: "child_name",
      label: { en: "Child's name", hi: "बच्चे का नाम" },
      type: "text",
      required: true,
    },
    {
      qid: "J2",
      name: "child_age",
      label: { en: "Age", hi: "उम्र (साल)" },
      type: "integer",
      required: true,
      validation: { min: 4, max: 12 },
    },
    {
      qid: "J3",
      name: "child_gender",
      label: { en: "Gender", hi: "लिंग" },
      type: "select",
      options: [
        o("girl", "Girl", "लड़की"),
        o("boy", "Boy", "लड़का"),
        o("other", "Other", "अन्य"),
        o("no_response", "No response", "बताना नहीं चाहते"),
      ],
      required: true,
    },
    {
      qid: "J4",
      name: "child_school_status",
      label: { en: "School status", hi: "स्कूल की स्थिति" },
      type: "select",
      options: [
        o("school_regular", "In school — regular", "स्कूल जाता/जाती है - नियमित"),
        o("school_irregular", "In school — irregular", "स्कूल जाता है - अनियमित"),
        o("enrolled_not_attending", "Enrolled but not attending", "नाम है पर नहीं जाता"),
        o("never_enrolled", "Never enrolled", "कभी स्कूल नहीं गया"),
        o("dropped_out", "Dropped out", "छोड़ दिया"),
        o("awc_only", "Anganwadi only", "सिर्फ़ आंगनवाड़ी"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "J5",
      name: "school_name",
      label: { en: "School / Anganwadi name", hi: "स्कूल/आंगनवाड़ी का नाम" },
      type: "text",
      showWhen: {
        field: "child_school_status",
        in: ["school_regular", "school_irregular", "enrolled_not_attending", "awc_only"],
      },
    },
    {
      qid: "J6",
      name: "child_class",
      label: { en: "Class", hi: "कक्षा" },
      type: "select",
      options: [
        o("awc", "Anganwadi", "आंगनवाड़ी"),
        o("class1", "Class 1", "कक्षा 1"),
        o("class2", "Class 2", "कक्षा 2"),
        o("class3", "Class 3", "कक्षा 3"),
        o("class4", "Class 4", "कक्षा 4"),
        o("class5", "Class 5", "कक्षा 5"),
        o("class6plus", "Class 6 or above", "कक्षा 6 या ऊपर"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      showWhen: {
        field: "child_school_status",
        in: ["school_regular", "school_irregular", "enrolled_not_attending"],
      },
    },
    {
      qid: "J7",
      name: "reason_not_in_school",
      label: { en: "Why not in school regularly?", hi: "बच्चा नियमित स्कूल क्यों नहीं जाता?" },
      type: "multiselect",
      options: [
        o("documents", "Documents", "दस्तावेज़"),
        o("cost", "Cost / fees / expenses", "खर्च/फ़ीस"),
        o("distance", "Distance", "दूरी"),
        o("work_care", "Work / caregiving at home", "काम/घर की देखभाल"),
        o("migration", "Migration", "प्रवास"),
        o("disability_health", "Disability / health", "दिव्यांगता/स्वास्थ्य"),
        o("not_interested", "Not interested", "रुचि नहीं"),
        o("parents_not_ready", "Parents not ready", "माता-पिता तैयार नहीं"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { field: "child_school_status", ne: "school_regular" },
    },
    {
      qid: "J9",
      name: "child_education_followup",
      label: { en: "School / enrolment follow-up needed?", hi: "क्या स्कूल/नामांकन फॉलो-अप चाहिए?" },
      type: "select",
      options: YES_NO_MAYBE(),
      required: true,
    },
  ],
};

const sectionJ: Section = {
  id: "J",
  title: { en: "Children 4–12 and education", hi: "4-12 साल के बच्चे और पढ़ाई" },
  showWhen: gated({ field: "num_children_4_12", gt: 0 }),
  items: [child412],
};

/* ─── Section K: Youth 13–24 (repeat) ───────────────────────── */
const youth: RepeatGroup = {
  kind: "repeat",
  qid: "K0",
  name: "youth_13_24",
  label: { en: "Youth aged 13–24", hi: "13-24 साल के युवा" },
  countFrom: "num_youth_13_24",
  showWhen: gated({ field: "num_youth_13_24", gt: 0 }),
  fields: [
    {
      qid: "K1",
      name: "youth_name",
      label: { en: "Youth name", hi: "युवा का नाम" },
      type: "text",
      required: true,
    },
    {
      qid: "K2",
      name: "youth_age",
      label: { en: "Age", hi: "उम्र (साल)" },
      type: "integer",
      required: true,
      validation: { min: 13, max: 24 },
    },
    {
      qid: "K3",
      name: "youth_gender",
      label: { en: "Gender", hi: "लिंग" },
      type: "select",
      options: [
        o("female", "Female", "युवती"),
        o("male", "Male", "युवक"),
        o("other", "Other", "अन्य"),
        o("no_response", "No response", "बताना नहीं चाहते"),
      ],
      required: true,
    },
    {
      qid: "K4",
      name: "youth_status",
      label: { en: "Current status", hi: "अभी क्या करते हैं?" },
      type: "select",
      options: [
        o("school", "School", "स्कूल"),
        o("college", "College", "कॉलेज"),
        o("work", "Working", "काम"),
        o("home", "At home", "घर पर"),
        o("seeking_work", "Seeking work", "काम की तलाश में"),
        o("dropped_out", "Dropped out", "पढ़ाई छोड़ दी"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "K5",
      name: "youth_group_interest",
      label: { en: "Interested in a youth group / meeting?", hi: "क्या युवा समूह/मीटिंग में रुचि है?" },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("maybe", "Maybe", "शायद"),
        o("no", "No", "नहीं"),
        o("not_asked", "Not asked", "नहीं पूछा"),
      ],
      required: true,
    },
    {
      qid: "K6",
      name: "youth_interest_topics",
      label: { en: "Which topics interest the youth?", hi: "किन विषयों में रुचि है?" },
      type: "multiselect",
      options: [
        o("health", "Health", "स्वास्थ्य"),
        o("nutrition", "Nutrition", "पोषण"),
        o("education", "Education", "शिक्षा"),
        o("career", "Career / jobs", "करियर/नौकरी"),
        o("gender", "Gender", "जेंडर"),
        o("rights", "Rights", "अधिकार"),
        o("sports", "Sports", "खेल"),
        o("life_skills", "Life skills", "जीवन कौशल"),
        o("marriage", "Marriage / age of marriage", "शादी/विवाह की उम्र"),
        o("community_action", "Social work", "समाज कार्य"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { field: "youth_group_interest", in: ["yes", "maybe"] },
    },
    {
      qid: "K7",
      name: "youth_preferred_time",
      label: { en: "Preferred meeting time", hi: "मीटिंग का पसंदीदा समय" },
      type: "select",
      options: [
        o("morning", "Morning", "सुबह"),
        o("afternoon", "Afternoon", "दोपहर"),
        o("evening", "Evening", "शाम"),
        o("sunday", "Sunday / holiday", "रविवार/छुट्टी"),
        o("depends", "Depends", "निर्भर करता है"),
      ],
      showWhen: { field: "youth_group_interest", in: ["yes", "maybe"] },
    },
    {
      qid: "K8",
      name: "potential_youth_leader",
      label: { en: "Potential group leader / volunteer?", hi: "संभावित समूह लीडर/सक्रिय वॉलंटियर?" },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("maybe", "Maybe", "शायद"),
        o("no", "No", "नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
  ],
};

const sectionK: Section = {
  id: "K",
  title: { en: "Youth 13–24", hi: "13-24 साल के युवा" },
  showWhen: gated({ field: "num_youth_13_24", gt: 0 }),
  items: [youth],
};

/* ─── Section L: Women and adolescent girls ─────────────────── */
const womenInterest: Condition = {
  field: "women_session_interest",
  in: ["yes", "maybe"],
};
const sectionL: Section = {
  id: "L",
  title: { en: "Women and adolescent girls", hi: "महिलाएँ और किशोरियाँ" },
  showWhen: gated(),
  items: [
    {
      qid: "L1",
      name: "women_session_interest",
      label: {
        en: "Interest in women / adolescent-girl sessions?",
        hi: "क्या महिलाओं/किशोरियों के सत्र (स्वास्थ्य, अधिकार आदि) में रुचि है?",
      },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("maybe", "Maybe", "शायद"),
        o("no", "No", "नहीं"),
        o("not_applicable", "Not applicable", "लागू नहीं"),
      ],
      required: true,
    },
    {
      qid: "L2",
      name: "women_preferred_time",
      label: { en: "Preferred meeting time", hi: "पसंदीदा समय" },
      type: "select",
      options: [
        o("morning", "Morning", "सुबह"),
        o("afternoon", "Afternoon", "दोपहर"),
        o("evening", "Evening", "शाम"),
        o("depends", "Depends", "निर्भर करता है"),
      ],
      showWhen: womenInterest,
    },
    {
      qid: "L3",
      name: "women_topics_needed",
      label: { en: "Which topics are needed?", hi: "किन विषयों की ज़रूरत है?" },
      type: "multiselect",
      options: [
        o("health", "Health", "स्वास्थ्य"),
        o("nutrition", "Nutrition", "पोषण"),
        o("periods", "Periods / menstruation", "माहवारी"),
        o("pregnancy", "Pregnancy", "गर्भावस्था"),
        o("icds", "Anganwadi / ICDS", "आंगनवाड़ी/ICDS"),
        o("schemes", "Government schemes", "सरकारी योजनाएँ"),
        o("gender", "Gender", "जेंडर"),
        o("violence_safety", "Violence / safety", "हिंसा/सुरक्षा"),
        o("education", "Education", "शिक्षा"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: womenInterest,
    },
    {
      qid: "L4",
      name: "safe_meeting_space",
      label: { en: "Safe / preferred meeting space", hi: "सुरक्षित/पसंदीदा मीटिंग जगह" },
      type: "select",
      options: [
        o("community_space", "Community space", "सामुदायिक जगह"),
        o("awc", "Anganwadi", "आंगनवाड़ी"),
        o("school", "School", "स्कूल"),
        o("someone_home", "Someone's home", "किसी के घर"),
        o("open_space", "Open space", "खुली जगह"),
        o("not_sure", "Not sure", "पक्का नहीं"),
      ],
      required: false,
    },
  ],
};

/* ─── Section M: Community issues and basic amenities ───────── */
const sectionM: Section = {
  id: "M",
  title: { en: "Community issues and basic amenities", hi: "बस्ती की समस्याएँ और सुविधाएँ" },
  showWhen: gated(),
  items: [
    {
      qid: "M1",
      name: "water_issue",
      label: { en: "Problem getting clean drinking water?", hi: "क्या साफ़ पीने का पानी मिलने में दिक्कत है?" },
      type: "select",
      options: [
        o("no_issue", "No issue", "कोई दिक्कत नहीं"),
        o("irregular", "Irregular supply", "अनियमित सप्लाई"),
        o("far", "Source is far", "स्रोत दूर है"),
        o("unsafe", "Water is unsafe", "पानी सुरक्षित नहीं"),
        o("no_source", "No source / buy water", "कोई स्रोत नहीं / पानी खरीदते हैं"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "M2",
      name: "toilet_access",
      label: { en: "Toilet access", hi: "शौचालय की सुविधा" },
      type: "select",
      options: [
        o("own", "Own", "अपना"),
        o("shared", "Shared / community", "साझा / सामुदायिक"),
        o("open", "Open defecation", "खुले में"),
        o("paid", "Paid toilet", "पैसे वाला शौचालय"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "M3",
      name: "drainage_issue",
      label: { en: "Drainage / water-logging problem?", hi: "नाली/जलभराव की दिक्कत?" },
      type: "select",
      options: [
        o("severe", "Severe", "गंभीर"),
        o("sometimes", "Sometimes", "कभी-कभी"),
        o("no", "No", "नहीं"),
        o("dont_know", "Don't know", "पता नहीं"),
      ],
      required: true,
    },
    {
      qid: "M4",
      name: "electricity_access",
      label: { en: "Electricity access", hi: "बिजली की सुविधा" },
      type: "select",
      options: [
        o("regular", "Regular", "नियमित"),
        o("irregular", "Irregular", "अनियमित"),
        o("no", "No", "नहीं"),
        o("shared", "Shared / temporary", "साझा / अस्थायी"),
        o("other", "Other", "अन्य"),
      ],
      required: false,
    },
    {
      qid: "M5",
      name: "waste_issue",
      label: {
        en: "Does the municipal vehicle come to collect household waste?",
        hi: "घरेलु कचरा उठाने के लिए निगम की गाड़ी आती है?",
      },
      type: "select",
      options: [
        o("yes", "Yes", "हाँ"),
        o("no", "No", "नहीं"),
        o("sometimes", "Comes sometimes", "कभी कभी आती है"),
      ],
      required: false,
    },
    {
      qid: "M6",
      name: "safety_concern",
      label: { en: "Any safety-related concern in the settlement?", hi: "बस्ती में कोई सुरक्षा सम्बंधित चिंता?" },
      type: "select",
      options: YN_NR(),
      required: false,
    },
    {
      qid: "M6a",
      name: "safety_concern_details",
      label: { en: "Safety concern details", hi: "सुरक्षा चिंता का विवरण लिखें" },
      type: "textarea",
      showWhen: { field: "safety_concern", eq: "yes" },
      required: true,
    },
  ],
};

/* ─── Section N: Follow-up and priority tagging ─────────────── */
const followupYesMaybe: Condition = {
  field: "followup_required",
  in: ["yes", "maybe"],
};
const sectionN: Section = {
  id: "N",
  title: { en: "Follow-up and priority tagging", hi: "फॉलो-अप और प्राथमिकता" },
  showWhen: gated(),
  items: [
    {
      qid: "N1",
      name: "followup_required",
      label: { en: "Does this household need project follow-up?", hi: "क्या इस घर को प्रोजेक्ट फॉलो-अप चाहिए?" },
      type: "select",
      options: YES_NO_MAYBE(),
      required: true,
    },
    {
      qid: "N2",
      name: "followup_type",
      label: { en: "What kind of follow-up?", hi: "किस तरह का फॉलो-अप?" },
      type: "multiselect",
      options: [
        o("entitlement", "Entitlement / document", "दस्तावेज़/योजना"),
        o("health", "Health referral", "स्वास्थ्य रेफ़रल"),
        o("maternal", "Maternal / pregnancy / ANC", "मातृ/गर्भावस्था/ANC"),
        o("icds", "Anganwadi / ICDS", "आंगनवाड़ी/ICDS"),
        o("child_school", "Child school / enrolment", "बच्चे का स्कूल/नामांकन"),
        o("youth", "Youth group", "युवा समूह"),
        o("women_session", "Women / girls' session", "महिला/किशोरी सत्र"),
        o("pension", "Pension", "पेंशन"),
        o("disability", "Disability support", "दिव्यांग सहायता"),
        o("urgent", "Urgent vulnerability", "तुरंत ज़रूरत"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: followupYesMaybe,
      required: true,
    },
    {
      qid: "N3",
      name: "priority_level",
      label: { en: "Follow-up priority level", hi: "प्राथमिकता स्तर" },
      type: "select",
      options: [
        o("high", "High — urgent follow-up", "ज़्यादा - तुरंत फॉलो-अप"),
        o("medium", "Medium", "मध्यम"),
        o("low", "Low", "कम"),
      ],
      showWhen: followupYesMaybe,
      required: true,
    },
    {
      qid: "N4",
      name: "next_action",
      label: { en: "Next action(s)", hi: "अगला कदम" },
      type: "multiselect",
      options: [
        o("revisit", "Revisit the household", "दोबारा जाना"),
        o("collect_docs", "Check / collect documents", "दस्तावेज़ जाँचना/लेना"),
        o("asha_anm", "Connect with ASHA / ANM", "ASHA/ANM से जोड़ना"),
        o("awc", "Send to Anganwadi", "आंगनवाड़ी भेजना"),
        o("school", "Send to school", "स्कूल भेजना"),
        o("add_youth", "Add to youth group list", "युवा समूह सूची में जोड़ना"),
        o("add_child", "Add to child enrolment list", "बाल नामांकन सूची में जोड़ना"),
        o("entitlement_tracker", "Add to entitlement tracker", "एन्टाइटलमेंट ट्रैकर में जोड़ना"),
        o("discuss_pm", "Discuss with PM", "PM से चर्चा"),
        o("escalate", "Escalate to Director / PM", "डायरेक्टर/PM को बताना"),
        o("no_action", "No action needed", "कोई कदम नहीं"),
        o("other", "Other", "अन्य"),
      ],
      required: true,
    },
    {
      qid: "N5",
      name: "next_followup_date",
      label: { en: "Next follow-up date", hi: "अगली फॉलो-अप तारीख़" },
      type: "date",
      showWhen: followupYesMaybe,
    },
    {
      qid: "N6",
      name: "mobiliser_observation",
      label: { en: "Mobiliser's observation", hi: "मोबिलाइज़र की टिप्पणी" },
      type: "textarea",
      required: true,
    },
    {
      qid: "N7",
      name: "case_story_potential",
      label: {
        en: "Could this household become a future case study?",
        hi: "क्या इस घर के साथ काम करते हुए आगे कोई केस स्टडी बनने की उम्मीद है?",
      },
      type: "select",
      options: YES_NO_MAYBE(),
      required: false,
    },
  ],
};

/* ─── Section O: Closing ────────────────────────────────────── */
const sectionO: Section = {
  id: "O",
  title: { en: "Closing", hi: "समापन" },
  showWhen: gated(),
  items: [
    {
      qid: "O1",
      name: "closing_note",
      label: {
        en: "Closing script (read aloud)",
        hi: "आपके समय के लिए धन्यवाद। हम किसी लाभ की गारंटी नहीं देते, लेकिन ज़रूरत के अनुसार जानकारी, लिंकेज और फॉलो-अप में मदद करेंगे।",
      },
      type: "note",
      required: true,
    },
    {
      qid: "O2",
      name: "respondent_questions",
      label: { en: "Any questions or expectations?", hi: "परिवार का कोई सवाल या उम्मीद?" },
      type: "textarea",
      required: true,
    },
    {
      qid: "O5",
      name: "form_complete_status",
      label: { en: "Form completion status", hi: "फॉर्म की स्थिति" },
      type: "select",
      options: [
        o("complete", "Complete", "पूरा"),
        o("partial", "Partial", "अधूरा"),
        o("refused_midway", "Refused midway", "बीच में मना कर दिया"),
      ],
      required: true,
    },
    {
      qid: "O6",
      name: "reason_incomplete",
      label: { en: "Reason form is incomplete", hi: "फॉर्म अधूरा क्यों?" },
      type: "select",
      options: [
        o("respondent_busy", "Respondent busy", "व्यस्त थे"),
        o("refused", "Refused", "मना किया"),
        o("technical", "Technical issue", "तकनीकी दिक्कत"),
        o("sensitive", "Sensitive topic", "संवेदनशील विषय"),
        o("other", "Other", "अन्य"),
      ],
      showWhen: { field: "form_complete_status", ne: "complete" },
    },
  ],
};

export const QUESTIONNAIRE: Section[] = [
  sectionA,
  sectionB,
  sectionC,
  sectionD,
  sectionE,
  sectionF,
  sectionG,
  sectionH,
  sectionI,
  sectionJ,
  sectionK,
  sectionL,
  sectionM,
  sectionN,
  sectionO,
];
