import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Building2, 
  MapPin, 
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase, CurrentUserProfile, setCachedProfile } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: CurrentUserProfile) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<'admin' | 'vendor' | 'user'>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset modal state whenever it is opened/closed or toggled
  useEffect(() => {
    if (isOpen) {
      setIsSignUp(false);
      setRole('user');
      setEmail('');
      setPassword('');
      setName('');
      setVendorName('');
      setStoreLocation('');
      setShowPassword(false);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    // Validates basic format check matching standard name@something.com requirements
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid business email address (e.g., name@something.com).');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // --- PURE SUPABASE SIGN UP ---
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name: name.trim(),
              role: role,
              vendorName: role === 'vendor' ? vendorName.trim() : undefined,
              storeLocation: role === 'vendor' ? storeLocation.trim() : undefined
            }
          }
        });
        
        if (signUpError) {
          throw signUpError;
        }

        const authUser = data.user;
        if (!authUser) {
          throw new Error('No user returned from registration service.');
        }

        // Save entry directly to 'users' table
        const { error: userDbError } = await supabase.from('users').insert([{
          user_id: authUser.id,
          user_name: name.trim(),
          user_email: normalizedEmail,
          role: role
        }]);
        
        if (userDbError) {
          throw userDbError;
        }
        
        // Save entry directly to 'vendors' table if user is a vendor
        if (role === 'vendor') {
          const { error: vendorDbError } = await supabase.from('vendors').insert([{
            vendor_id: authUser.id,
            vendor_name: vendorName.trim(),
            vendor_details: { location: storeLocation.trim() },
            status: 'active'
          }]);
          
          if (vendorDbError) {
            throw vendorDbError;
          }
        }

        const profile: CurrentUserProfile = {
          id: authUser.id,
          email: normalizedEmail,
          name: name.trim(),
          role: role,
          vendorName: role === 'vendor' ? vendorName.trim() : undefined,
          storeLocation: role === 'vendor' ? storeLocation.trim() : undefined
        };

        setSuccessMessage('Account registered successfully!');
        setCachedProfile(profile);
        
        setTimeout(() => {
          onAuthSuccess(profile);
          onClose();
        }, 1200);

      } else {
        // --- PURE SUPABASE SIGN IN ---
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        
        if (signInError) {
          throw signInError;
        }

        const authUser = data.user;
        if (!authUser) {
          throw new Error('Authentication returned with empty credentials.');
        }

        const meta = authUser.user_metadata || {};
        let userRole: 'admin' | 'vendor' | 'user' = meta.role || role || 'user';
        let userName = meta.name || normalizedEmail.split('@')[0] || 'Member';
        let vName = meta.vendorName;
        let vLoc = meta.storeLocation;

        // Try querying public user profile to respect actual DB records if they exist
        try {
          const { data: dbUser } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', authUser.id)
            .single();
          if (dbUser) {
            userRole = (dbUser.role as any) || userRole;
            userName = dbUser.user_name || userName;
          }
        } catch (dbErr) {
          console.warn('Silent skip of user profile table query:', dbErr);
        }

        const profile: CurrentUserProfile = {
          id: authUser.id,
          email: authUser.email || normalizedEmail,
          name: userName,
          role: userRole,
          vendorName: vName,
          storeLocation: vLoc
        };

        setCachedProfile(profile);
        onAuthSuccess(profile);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div 
        className="w-full max-w-[380px] flex flex-col items-stretch"
        id="auth-modal-card-container"
      >
        {/* Amazon-style brand identity header block representation */}
        <div className="flex flex-col items-center justify-center mb-5 relative">
          <div className="text-3xl font-bold tracking-tight text-white select-none flex flex-col items-center">
            <span className="font-sans">tile<span className="text-amber-400 font-extrabold font-serif">clearance</span></span>
            <div className="w-16 h-1 bg-amber-400 rounded-full -mt-0.5 transform -skew-x-12"></div>
          </div>
          {/* Close button at top corner */}
          <button 
            onClick={onClose}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            id="dismiss-auth-button"
            title="Close Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form card wrapper with Amazon-like styling */}
        <div className="bg-white border border-slate-300 rounded-[8px] p-6 shadow-md text-slate-900">
          <h2 className="text-2xl font-normal text-slate-950 mb-4 tracking-tight">
            {isSignUp ? 'Create account' : 'Sign in'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business Domain Selector tab style */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                User Role Type
              </label>
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-[3px]">
                <button
                  type="button"
                  onClick={() => setRole('user')}
                  className={`py-1 rounded-[3px] text-xs font-medium cursor-pointer transition ${
                    role === 'user' 
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-350' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => setRole('vendor')}
                  className={`py-1 rounded-[3px] text-xs font-medium cursor-pointer transition ${
                    role === 'vendor' 
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-350' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Vendor
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`py-1 rounded-[3px] text-xs font-medium cursor-pointer transition ${
                    role === 'admin' 
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-350' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>

            {/* Error logs formatting */}
            {errorMessage && (
              <div className="flex gap-2 p-3 rounded-[3px] bg-rose-50 border border-rose-100 text-xs text-rose-750">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success logs formatting */}
            {successMessage && (
              <div className="flex gap-2 p-3 rounded-[3px] bg-emerald-50 border border-emerald-100 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Registration Inputs */}
            {isSignUp && (
              <div className="animate-in fade-in duration-150">
                <label className="block text-xs font-bold text-slate-900 mb-1">Your Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="First and last name"
                    className="w-full pl-8.5 pr-3 py-1.5 border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-[3px] text-sm text-slate-950 bg-white shadow-inner focus:outline-none transition duration-100"
                  />
                </div>
              </div>
            )}

            {isSignUp && role === 'vendor' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Company / Showroom Brand</label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={vendorName}
                      onChange={e => setVendorName(e.target.value)}
                      placeholder="e.g. Horizon Ceramic Slabs"
                      className="w-full pl-8.5 pr-3 py-1.5 border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-[3px] text-sm text-slate-950 bg-white shadow-inner focus:outline-none transition duration-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Distribution Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={storeLocation}
                      onChange={e => setStoreLocation(e.target.value)}
                      placeholder="e.g. Rome Premium Warehouse"
                      className="w-full pl-8.5 pr-3 py-1.5 border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-[3px] text-sm text-slate-950 bg-white shadow-inner focus:outline-none transition duration-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">Business Email Address</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@something.com"
                  className="w-full pl-8.5 pr-3 py-1.5 border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-[3px] text-sm text-slate-950 bg-white shadow-inner focus:outline-none transition duration-100"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">Access Password</label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-8.5 pr-10 py-1.5 border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-[3px] text-sm text-slate-950 bg-white shadow-inner focus:outline-none transition duration-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Dynamic Button styled with Amazon amber/yellow buybox gradient style */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-1.5 mt-2 bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] border border-[#a88734] hover:bg-gradient-to-b hover:from-[#f5d78e] hover:to-[#eeb933] active:from-[#f0c14b] active:to-[#eeb933] text-[#111111] text-xs font-semibold rounded-[3px] shadow-sm active:shadow-inner transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              id="auth-submit-button"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                isSignUp ? 'Register Account' : 'Login'
              )}
            </button>
          </form>

          {/* Amazon-style footer divider / Create Account trigger */}
          {!isSignUp ? (
            <div className="mt-6 flex flex-col items-center">
              <div className="w-full border-t border-slate-200 relative mb-4 text-center">
                <span className="bg-white px-2 text-slate-500 text-[11px] font-sans absolute -top-2.5 left-1/2 transform -translate-x-1/2 block whitespace-nowrap">
                  New to tileclearance?
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="w-full py-1.5 bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-300 hover:from-slate-100 hover:to-slate-150 text-slate-800 text-xs font-semibold rounded-[3px] shadow-sm transition cursor-pointer"
                id="toggle-auth-state-button"
              >
                Create your tileclearance account
              </button>
            </div>
          ) : (
            <div className="mt-5 pt-4 border-t border-slate-200 text-xs text-slate-700">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-semibold inline-block ml-0.5"
                id="toggle-auth-state-button"
              >
                Sign in
              </button>
            </div>
          )}
        </div>

        {/* Amazon-style bottom footer list */}
        <div className="mt-5 text-center px-4">
          <div className="flex justify-center gap-4 text-[10px] text-slate-400 font-sans">
            <a href="#" className="hover:underline hover:text-slate-300">Conditions of Use</a>
            <a href="#" className="hover:underline hover:text-slate-300">Privacy Notice</a>
            <a href="#" className="hover:underline hover:text-slate-300">Help</a>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-sans font-normal balance">
            &copy; 2011-2026, TileClearance.com, Inc. or its affiliates
          </p>
        </div>

      </div>
    </div>
  );
}
