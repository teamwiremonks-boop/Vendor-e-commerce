import React, { useState } from 'react';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  Building2,
  Clock,
  CheckCircle2
} from 'lucide-react';

export default function Footer() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
      setTimeout(() => setSubmitted(false), 5000);
    }, 800);
  };

  return (
    <footer id="contact" className="bg-white border-t border-slate-200 text-slate-600 mt-auto select-none">
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        
        {/* Marketplace Identity column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <span className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center text-white text-xs font-black tracking-tighter">
              TC
            </span>
            <span className="tracking-tight font-extrabold text-slate-950">
              TileClearance<span className="text-slate-500 font-normal">.B2B</span>
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 max-w-sm">
            The premier clearance and batch-liquidation contracting portal. We source excess, discontinued, and end-of-run ceramic slabs, marbles, and porcelain tiles directly from global manufacturing ports, delivering premium materials at deep trade discounts.
          </p>
          
          <div className="space-y-2.5 pt-2 text-slate-500">
            <div className="flex items-center gap-3 text-xs">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <span>+39 (06) 555-TILE (Contractors Direct Hotline)</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span>b2b-procurement@tileclearance.com</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Central Showroom: Via dell'Archeologia 20, Rome, Italy</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Logistics operational: Monday - Friday, 07:00 - 18:00 UTC</span>
            </div>
          </div>
        </div>

        {/* Trade platform quick links */}
        <div className="lg:col-span-3 space-y-4">
          <h4 className="text-xs font-bold text-slate-900 tracking-wider uppercase">Trade Resources</h4>
          <ul className="space-y-2 text-xs text-slate-500">
            <li>
              <a href="#" className="hover:text-slate-900 transition">Clearance Catalog Index</a>
            </li>
            <li>
              <a href="#" className="hover:text-slate-900 transition">Minimum Order Policies (MOQ)</a>
            </li>
            <li>
              <a href="#" className="hover:text-slate-900 transition">Multi-Fulfillment Dispatch Handlers</a>
            </li>
            <li>
              <a href="#" className="hover:text-slate-900 transition">Direct Ex-Works Shipping Guides</a>
            </li>
            <li>
              <a href="#" className="hover:text-slate-900 transition">Quality Grading Frameworks</a>
            </li>
          </ul>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 max-w-xs mt-2">
            <h5 className="text-[10px] text-slate-900 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" /> Dispatch Policy
            </h5>
            <p className="text-[10px] text-slate-500 leading-normal">
              Due to physical material weights, lot clearance items are shrink-wrapped in sturdy wooden pallet cases for safe trans-port container shipping.
            </p>
          </div>
        </div>

        {/* Contact Form column */}
        <div className="lg:col-span-4 space-y-4">
          <h4 className="text-xs font-bold text-slate-900 tracking-wider uppercase">Contact Trade Desk</h4>
          
          {submitted ? (
            <div className="p-4 rounded-xl bg-[#f4fbf7] border border-emerald-100 text-emerald-800 text-xs space-y-1.5 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Inquiry Logged
              </div>
              <p className="leading-relaxed text-slate-650">
                Your specifications inquiry has been transmitted to our trade specialists. We will issue delivery estimates and pricing confirmations shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  required
                  placeholder="Your Name / Company"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 transition placeholder-slate-400"
                />
              </div>
              <div>
                <input
                  type="email"
                  required
                  placeholder="Business Email Address"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 transition placeholder-slate-400"
                />
              </div>
              <div>
                <textarea
                  required
                  rows={3}
                  placeholder="Requested SKUs, dimensions and required square footage (Sqm)..."
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 resize-none transition placeholder-slate-400"
                ></textarea>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    Submit Specifications
                    <Send className="w-3 h-3" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

      </div>

      {/* Trademark compliance bar */}
      <div className="border-t border-slate-100 py-6 text-center text-xs text-slate-400 bg-slate-50/50">
        <p>© 2026 TileClearance.B2B Registry SpA & Partners. All Rights Reserved.</p>
        <p className="mt-1 text-[10px] text-slate-450 font-mono">Inventory channels synced with multi-tenant Supabase database.</p>
      </div>
    </footer>
  );
}
