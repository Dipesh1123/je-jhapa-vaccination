import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'ne'

const STORAGE_KEY = 'je-jhapa-lang'

// English is the first-preference language - the toggle is an opt-in to
// Nepali, not the other way round. Persisted so a visitor's choice survives
// a reload, but never assumed to exist (private windows, blocked storage).
function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ne') return saved
  } catch {
    // ignore - storage may be unavailable
  }
  return 'en'
}

const translations = {
  // Header / masthead
  govtLine: { en: 'Government of Nepal · Koshi Province Government, Ministry of Health', ne: 'नेपाल सरकार · कोशी प्रदेश सरकार, स्वास्थ्य मन्त्रालय' },
  officeTitle: { en: 'Health Office, Jhapa — JE Vaccination Campaign Progress', ne: 'स्वास्थ्य कार्यालय, झापा — जे.ई. खोप अभियान प्रगति' },
  campaignSubtitle: { en: 'Japanese Encephalitis Vaccination Campaign Dashboard', ne: 'जापानिज इन्सेफ्लाइटिस खोप अभियान ड्यासबोर्ड' },
  fiscalYear: { en: 'FY 2083/84', ne: 'आ.व. २०८३/८४' },
  campaignWindow: { en: '5–19 Oct 2026 campaign · Public dashboard', ne: '५–१९ असोज २०८३ अभियान · सार्वजनिक ड्यासबोर्ड' },
  publicData: { en: 'FY 2083/84 · Public data', ne: 'आ.व. २०८३/८४ · सार्वजनिक डेटा' },

  // Sidebar nav
  mainMenu: { en: 'Main menu', ne: 'मुख्य मेनु' },
  navDashboard: { en: 'Dashboard', ne: 'ड्यासबोर्ड' },
  navMap: { en: 'Map', ne: 'नक्सा' },
  navCommodity: { en: 'Stock', ne: 'सामग्री मौज्दात' },
  navDownloads: { en: 'Downloads', ne: 'डाउनलोड' },

  // Dashboard
  campaignTitle: { en: 'Japanese Encephalitis Vaccination Campaign — Jhapa', ne: 'जापानिज इन्सेफ्लाइटिस खोप अभियान — झापा' },
  dayOf: { en: 'Day {n} of {total}', ne: 'दिन {n} / {total}' },
  daysLeft: { en: ' · {n} days left', ne: ' · बाँकी {n} दिन' },
  kpiTarget: { en: 'Target population', ne: 'लक्ष्य जनसंख्या' },
  kpiVaccinated: { en: 'Vaccinated', ne: 'खोप लगाइएको' },
  kpiDailyAvg: { en: 'Daily average', ne: 'दैनिक औसत' },
  kpiDailyAvgSub: { en: 'doses/day', ne: 'मात्रा/दिन' },
  kpiOverall: { en: 'Overall progress', ne: 'समग्र प्रगति' },
  paceAhead: { en: 'Ahead of target pace', ne: 'निर्धारित लक्ष्यभन्दा अगाडि' },
  paceBehind: { en: 'Behind target pace', ne: 'निर्धारित लक्ष्यभन्दा पछाडि' },
  paceOnTrack: { en: 'On target pace', ne: 'निर्धारित लक्ष्य अनुरूप' },
  expected: { en: '(expected {n}%)', ne: '(अपेक्षित {n}%)' },

  // Charts
  coverageTrendTitle: { en: 'Cumulative progress by day (%)', ne: 'दिनअनुसार सञ्चयी प्रगति (%)' },
  ageSexTitle: { en: 'Vaccinations by age and sex', ne: 'उमेर र लिङ्ग अनुसार खोप' },
  seriesActual: { en: 'Actual progress', ne: 'वास्तविक प्रगति' },
  seriesPace: { en: 'Required pace', ne: 'आवश्यक गति' },
  ageBand3060: { en: '30–60 yrs', ne: '३०-६० वर्ष' },
  ageBand60plus: { en: '60+ yrs', ne: '६०+ वर्ष' },
  female: { en: 'Female', ne: 'महिला' },
  male: { en: 'Male', ne: 'पुरुष' },

  // Palika league table
  progressByLocalLevel: { en: 'Progress by local level', ne: 'स्थानीय तह अनुसार प्रगति' },
  colLocalLevel: { en: 'Local level', ne: 'स्थानीय तह' },
  colPopulation: { en: 'Population', ne: 'जनसंख्या' },
  colVaccinated: { en: 'Vaccinated', ne: 'खोप लगाइएको' },
  colProgress: { en: 'Progress', ne: 'प्रगति' },
  wardsReported: { en: '{a}/{b} wards reported', ne: '{a}/{b} वडा प्रतिवेदित' },

  // Palika detail page
  backToDashboard: { en: 'Back to dashboard', ne: 'ड्यासबोर्डमा फर्कनुहोस्' },
  progressByWard: { en: 'Progress by ward', ne: 'वडा अनुसार प्रगति' },
  colWardNo: { en: 'Ward no.', ne: 'वडा नं.' },
  colLastReport: { en: 'Last report', ne: 'अन्तिम प्रतिवेदन' },
  noReportYet: { en: 'No report yet', ne: 'प्रतिवेदन आएको छैन' },
  target: { en: 'target', ne: 'लक्ष्य' },

  // Ward detail page
  backToPalika: { en: 'Back to {name}', ne: '{name} मा फर्कनुहोस्' },
  wardProfileSubtitle: { en: 'Ward-level profile', ne: 'वडास्तरीय प्रोफाइल' },
  colReportsReceived: { en: 'Reports received', ne: 'प्राप्त प्रतिवेदन' },
  colAefiMinor: { en: 'AEFI — minor', ne: 'AEFI — सामान्य' },
  colAefiSerious: { en: 'AEFI — serious', ne: 'AEFI — गम्भीर' },

  // Map page
  mapTitle: { en: 'Map', ne: 'नक्सा' },
  mapSubtitle: { en: 'Local-level map and facility locations by progress %', ne: 'प्रगति % अनुसार स्थानीय तहको नक्सा र संस्था स्थानहरू' },
  layerLocalLevel: { en: 'Local level', ne: 'स्थानीय तह' },
  layerWard: { en: 'Ward', ne: 'वडा' },
  wardGeoUnavailable: { en: 'Ward boundary data not yet available', ne: 'वडा सीमाना डेटा अझै उपलब्ध छैन' },
  viewAsTable: { en: 'View as table', ne: 'तालिका रूपमा हेर्नुहोस्' },
  mapBackToDistrict: { en: '← All of Jhapa', ne: '← सम्पूर्ण झापा' },
  mapClickPalikaHint: { en: 'Click a local level to see its wards', ne: 'वडाहरू हेर्न स्थानीय तहमा क्लिक गर्नुहोस्' },
  mapClickWardHint: { en: 'Click a ward for its profile', ne: 'प्रोफाइलका लागि वडामा क्लिक गर्नुहोस्' },
  legendProgress: { en: 'Progress %', ne: 'प्रगति %' },
  wardFallbackMsg: { en: 'Official ward boundary data is not yet available. See progress by local level below, or the ward table for each local level on the ', ne: 'वडा सीमानाको आधिकारिक डेटा अझै प्राप्त भएको छैन। तल स्थानीय तह अनुसार प्रगति हेर्नुहोस्, वा प्रत्येक स्थानीय तहको वडागत तालिकाका लागि ' },
  wardFallbackLink: { en: 'dashboard table', ne: 'ड्यासबोर्डको तालिका' },
  wardFallbackCount: { en: '({n} local levels available)', ne: '({n} स्थानीय तह उपलब्ध)' },
  popupProgress: { en: 'Progress', ne: 'प्रगति' },
  popupVaccinated: { en: 'Vaccinated', ne: 'खोप लगाइएको' },
  popupDoses: { en: 'Doses', ne: 'खोप' },
  unnamedFacility: { en: 'Unnamed facility', ne: 'नामविहीन संस्था' },

  // Commodity page
  commodityTitle: { en: 'Stock & Wastage', ne: 'सामग्री मौज्दात र खेर' },
  commoditySubtitle: { en: 'Ward-wise stock as of last report — {n} wards reported', ne: 'अन्तिम प्रतिवेदन अनुसार वडागत मौज्दात — {n} वडाले प्रतिवेदन गरेको' },
  noReportsYet: { en: 'No reports received yet', ne: 'अझै कुनै प्रतिवेदन प्राप्त भएको छैन' },
  colLocalLevelWard: { en: 'Local level / Ward', ne: 'स्थानीय तह / वडा' },
  colVaccineStock: { en: 'Vaccine stock', ne: 'खोप मौज्दात' },
  colDiluent: { en: 'Diluent', ne: 'डाइलुएन्ट' },
  colSyringe: { en: 'Syringe (AD)', ne: 'सिरिन्ज (AD)' },
  colSafetyBox: { en: 'Safety box', ne: 'सेफ्टी बक्स' },
  colWastageRate: { en: 'Wastage rate', ne: 'खेर दर' },
  colStatus: { en: 'Status', ne: 'अवस्था' },
  colDate: { en: 'Date', ne: 'मिति' },
  wardLabel: { en: '· Ward {n}', ne: '· वडा {n}' },
  statusOutOfStock: { en: 'Out of stock', ne: 'स्टक सकियो' },
  statusHighWastage: { en: 'High wastage (>20%)', ne: 'उच्च खेर (>२०%)' },
  statusNormal: { en: 'Normal', ne: 'सामान्य' },

  // Downloads page
  downloadsTitle: { en: 'Downloads', ne: 'डाउनलोड' },
  downloadsSubtitle: { en: 'All data is public — no login required', ne: 'सबै डाटा सार्वजनिक छ — कुनै लगइन आवश्यक पर्दैन' },
  wardAggregateTitle: { en: 'Ward-wise summary (CSV)', ne: 'वडागत सारांश (CSV)' },
  wardAggregateDesc: { en: 'Population, target, doses and progress % for all 131 wards — one row per ward', ne: '१३१ वडाको जनसंख्या, लक्ष्य, खोप संख्या र प्रगति % — एक पंक्ति प्रति वडा' },
  fullDetailTitle: { en: 'Full report detail (CSV)', ne: 'पूर्ण प्रतिवेदन विवरण (CSV)' },
  fullDetailDesc: { en: 'Every facility, every day\'s report — with age/sex, commodities, and AEFI', ne: 'हरेक संस्था, हरेक दिनको प्रतिवेदन — उमेर/लिङ्ग, सामग्री, र AEFI सहित' },
  excelMirrorTitle: { en: 'Download in JE-083_84.xlsx format', ne: 'JE-083_84.xlsx ढाँचामा डाउनलोड' },
  excelMirrorDesc: { en: 'Coming soon — an Excel file in the exact format the Health Office currently uses', ne: 'निर्माणाधीन — हाल स्वास्थ्य कार्यालयले प्रयोग गर्ने ठ्याक्कै उही ढाँचामा एक्सेल तयार हुनेछ' },

  // Language toggle
  langToggleLabel: { en: 'Language', ne: 'भाषा' },
} as const

export type TranslationKey = keyof typeof translations

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Looks up `key` and replaces any {placeholder} tokens with `vars`. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang)

  useEffect(() => {
    document.documentElement.lang = lang === 'ne' ? 'ne' : 'en'
  }, [lang])

  function setLang(next: Lang) {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore - storage may be unavailable
    }
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>) {
    let s: string = translations[key][lang]
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(`{${k}}`, String(v))
      }
    }
    return s
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}
