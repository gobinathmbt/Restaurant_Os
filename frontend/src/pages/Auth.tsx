import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Mail, 
  Lock, 
  User, 
  Building2, 
  Phone, 
  MapPin,
  FileText,
  ChefHat,
  CheckCircle2,
  Star,
  Loader2
} from 'lucide-react';

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  adminName: string;
  email: string;
  password: string;
  companyName: string;
  phone: string;
  address: string;
  gstNumber: string;
  fssaiLicense: string;
}

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, googleLogin } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form state
  const [loginData, setLoginData] = useState<LoginData>({
    email: '',
    password: '',
  });

  // Register form state
  const [registerData, setRegisterData] = useState<RegisterData>({
    adminName: '',
    email: '',
    password: '',
    companyName: '',
    phone: '',
    address: '',
    gstNumber: '',
    fssaiLicense: '',
  });

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(loginData.email, loginData.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(registerData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // TODO: Implement Google OAuth flow
      // For now, show a placeholder message
      setError('Google OAuth integration coming soon!');
    } catch (err) {
      setError('Google login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Section - 70% - Green Info Section */}
      <div className="hidden lg:flex lg:w-[70%] bg-primary-500 text-white p-12 flex-col justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-12">
            <ChefHat className="w-10 h-10" />
            <span className="text-3xl font-bold">RestaurantOS</span>
          </div>

          <h1 className="text-5xl font-bold mb-6">
            Transform Your Restaurant Operations
          </h1>
          <p className="text-xl text-primary-50 mb-12">
            Complete management system with billing, inventory, CRM, and analytics.
          </p>

          {/* Benefits List */}
          <div className="space-y-6 mb-12">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Smart Billing & KOT</h3>
                <p className="text-primary-50">Fast and accurate billing with kitchen order tracking</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Inventory Management</h3>
                <p className="text-primary-50">Track stock levels and get low-stock alerts automatically</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Customer CRM & Loyalty</h3>
                <p className="text-primary-50">Build relationships with loyalty programs and feedback</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Real-time Analytics</h3>
                <p className="text-primary-50">Make data-driven decisions with powerful insights</p>
              </div>
            </div>
          </div>

          {/* Testimonial */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="flex gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-white text-white" />
              ))}
            </div>
            <p className="text-primary-50 mb-4">
              "RestaurantOS has completely transformed how we manage our restaurant. The billing system is incredibly fast and saves us hours every week."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-semibold">
                RK
              </div>
              <div>
                <p className="font-semibold">Rajesh Kumar</p>
                <p className="text-sm text-primary-50">Owner, Spice Garden</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-primary-50 text-sm">
          <p>30-day free trial • No credit card required • Cancel anytime</p>
        </div>
      </div>

      {/* Right Section - 30% - Form Section */}
      <div className="w-full lg:w-[30%] bg-white p-8 flex flex-col justify-center overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center space-x-2 mb-8">
            <ChefHat className="w-8 h-8 text-primary-500" />
            <span className="text-2xl font-bold text-neutral-950">RestaurantOS</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-neutral-950 mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Get Started'}
            </h2>
            <p className="text-gray-600">
              {mode === 'login' 
                ? 'Sign in to your account to continue' 
                : 'Create your account and start your free trial'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 text-white py-3 rounded-lg hover:bg-primary-600 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>

              <p className="text-center text-sm text-gray-600 mt-6">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-primary-500 font-semibold hover:text-primary-600"
                >
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Admin Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={registerData.adminName}
                    onChange={(e) => setRegisterData({ ...registerData, adminName: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Company Details */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Company Information</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={registerData.companyName}
                    onChange={(e) => setRegisterData({ ...registerData, companyName: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Your Restaurant Name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    required
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    required
                    value={registerData.address}
                    onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Restaurant address"
                    rows={2}
                  />
                </div>
              </div>

              {/* Optional Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST Number <span className="text-gray-400">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={registerData.gstNumber}
                    onChange={(e) => setRegisterData({ ...registerData, gstNumber: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  FSSAI License <span className="text-gray-400">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={registerData.fssaiLicense}
                    onChange={(e) => setRegisterData({ ...registerData, fssaiLicense: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="12345678901234"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 text-white py-3 rounded-lg hover:bg-primary-600 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </button>

              <p className="text-center text-sm text-gray-600 mt-6">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-primary-500 font-semibold hover:text-primary-600"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
