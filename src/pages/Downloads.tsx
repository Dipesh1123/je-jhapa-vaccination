import { FileSpreadsheet, FileText, Clock } from 'lucide-react'

export function Downloads() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">डाउनलोड</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          सबै डाटा सार्वजनिक छ — कुनै लगइन आवश्यक पर्दैन
        </p>
      </div>

      <a
        href="/api/export-aggregate"
        className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
      >
        <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <FileSpreadsheet size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">वडागत सारांश (CSV)</p>
          <p className="text-xs text-slate-500 mt-0.5">
            १३१ वडाको जनसंख्या, लक्ष्य, खोप संख्या र प्रगति % — एक पंक्ति प्रति वडा
          </p>
        </div>
      </a>

      <a
        href="/api/export-detail"
        className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
      >
        <div className="h-10 w-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
          <FileText size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">पूर्ण प्रतिवेदन विवरण (CSV)</p>
          <p className="text-xs text-slate-500 mt-0.5">
            हरेक संस्था, हरेक दिनको प्रतिवेदन — उमेर/लिङ्ग, सामग्री, र AEFI सहित
          </p>
        </div>
      </a>

      <div className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-200 border-dashed p-4">
        <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
          <Clock size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">JE-083_84.xlsx ढाँचामा डाउनलोड</p>
          <p className="text-xs text-slate-400 mt-0.5">
            निर्माणाधीन — हाल स्वास्थ्य कार्यालयले प्रयोग गर्ने ठ्याक्कै उही ढाँचामा एक्सेल तयार हुनेछ
          </p>
        </div>
      </div>
    </div>
  )
}
