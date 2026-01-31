import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
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
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

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
  const { login, register, googleLogin: googleLoginContext, isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  
  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [loading, setLoading] = useState(false);

  // Redirect when authentication state changes
  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirect immediately when authenticated
      const timer = setTimeout(() => {
        if (user.userType === 'platform') {
          navigate('/platform/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, navigate]);

  const [loginData, setLoginData] = useState<LoginData>({
    email: '',
    password: '',
  });

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
    e.stopPropagation(); // Prevent event bubbling
    
    // Prevent any default form behavior
    if (loading) return;
    
    setLoading(true);

    try {
      await login(loginData.email, loginData.password);
      
      toast({
        title: "Login Successful",
        description: "Welcome back!",
        variant: "success",
      });
      
      // Don't set loading to false here - let the redirect happen
      // Form will be cleared by navigation, no need to manually reset
      // Redirect will happen via useEffect when isAuthenticated changes
    } catch (err: any) {
      console.error('Login error caught in component:', err);
      
      // Extract error message from various possible structures
      let errorMessage = 'Login failed. Please try again.';
      
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.data?.message) {
        errorMessage = err.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      // IMPORTANT: Keep form data intact on error - do NOT reset loginData
      // Only reset loading state
      setLoading(false);
    } finally {
      // Ensure loading is reset even if something unexpected happens
      if (!isAuthenticated) {
        setLoading(false);
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    // Prevent any default form behavior
    if (loading) return;
    
    setLoading(true);

    try {
      await register(registerData);
      
      toast({
        title: "Registration Successful",
        description: "Your account has been created. 30-day trial activated!",
        variant: "info",
      });
      
      // Don't set loading to false here - let the redirect happen
      // Form will be cleared by navigation, no need to manually reset
      // Redirect will happen via useEffect when isAuthenticated changes
    } catch (err: any) {
      console.error('Registration error caught in component:', err);
      
      // Check for validation errors from backend
      const responseData = err?.response?.data || err?.data;
      
      if (responseData?.errors && Array.isArray(responseData.errors)) {
        // Map validation errors to readable format
        const validationErrors = responseData.errors
          .map((error: any) => `${error.path || error.field || 'Field'}: ${error.msg || error.message}`)
          .join(', ');
        
        toast({
          title: "Validation Error",
          description: validationErrors,
          variant: "destructive",
        });
      } else {
        // General error - extract message from various possible structures
        let errorMessage = 'Registration failed. Please try again.';
        
        if (responseData?.message) {
          errorMessage = responseData.message;
        } else if (err?.message) {
          errorMessage = err.message;
        }
        
        toast({
          title: "Registration Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      
      // IMPORTANT: Keep form data intact on error - do NOT reset registerData
      // Only reset loading state
      setLoading(false);
    } finally {
      // Ensure loading is reset even if something unexpected happens
      if (!isAuthenticated) {
        setLoading(false);
      }
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);

      try {
        // Use the googleLogin function from auth context
        await googleLoginContext(tokenResponse.access_token);
        
        toast({
          title: "Google Login Successful",
          description: "Welcome back!",
          variant: "success",
        });
        
        // Don't set loading to false here - let the redirect happen
        // Redirect will happen via useEffect when isAuthenticated changes
      } catch (loginError: any) {
        // If user doesn't exist (404), show registration form with pre-filled data
        if (loginError.status === 404 || loginError.message?.includes('No account found')) {
          // Get user info from Google for pre-filling
          try {
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: {
                Authorization: `Bearer ${tokenResponse.access_token}`,
              },
            });
            
            const userInfo = await userInfoResponse.json();
            
            setMode('register');
            setRegisterData({
              ...registerData,
              adminName: userInfo.name || '',
              email: userInfo.email || '',
            });
            
            toast({
              title: "Account Not Found",
              description: "Please complete your registration to continue.",
              variant: "info",
            });
          } catch (err) {
            console.error('Failed to get user info:', err);
          }
        } else {
          const errorMessage = loginError.message || 'Google login failed. Please try again.';
          toast({
            title: "Google Login Failed",
            description: errorMessage,
            variant: "destructive",
          });
        }
        setLoading(false);
      } finally {
        // Ensure loading is reset even if something unexpected happens
        // But only if authentication failed
        if (!isAuthenticated) {
          setLoading(false);
        }
      }
    },
    onError: () => {
      toast({
        title: "Google Login Cancelled",
        description: "Google login was cancelled or failed.",
        variant: "destructive",
      });
      setLoading(false);
    },
  });

  return (
    <div className="min-h-screen h-screen flex overflow-hidden">
      {/* Left Section - Info Panel */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-[50%] bg-gradient-to-br from-black via-forest-dark to-black text-white p-8 flex-col justify-between relative overflow-hidden"
      >
        {/* Animated background */}
        <div className="absolute inset-0 opacity-20">
          <motion.div
            className="absolute top-20 left-10 w-72 h-72 bg-primary rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-20 right-10 w-96 h-96 bg-emerald rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.5, 0.3, 0.5],
            }}
            transition={{ duration: 10, repeat: Infinity }}
          />
        </div>

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 mb-8 group">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 bg-gradient-to-br from-primary to-emerald rounded-lg flex items-center justify-center"
            >
              <ChefHat className="w-6 h-6 text-white" />
            </motion.div>
            <span className="text-2xl font-bold">RestaurantOS</span>
          </Link>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-3xl font-bold mb-3 leading-tight">
              Transform Your
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald to-mint">
                Restaurant Operations
              </span>
            </h1>
            <p className="text-base text-gray-300 mb-8">
              Complete POS system with billing, inventory, CRM, and real-time analytics.
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              { icon: CheckCircle2, title: 'Smart Billing & KOT', desc: 'Lightning-fast billing with kitchen order tracking' },
              { icon: CheckCircle2, title: 'Inventory Management', desc: 'Real-time stock tracking and automated alerts' },
              { icon: CheckCircle2, title: 'Customer CRM', desc: 'Build loyalty with personalized campaigns' }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="w-8 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">{item.title}</h3>
                  <p className="text-gray-400 text-xs">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
          >
            <div className="flex gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-primary text-primary" />
              ))}
            </div>
            <p className="text-gray-300 text-xs mb-3 italic">
              "RestaurantOS has completely transformed how we manage our restaurant. The billing system is incredibly fast!"
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-emerald rounded-full flex items-center justify-center text-xs font-semibold">
                RK
              </div>
              <div>
                <p className="font-semibold text-sm">Rajesh Kumar</p>
                <p className="text-xs text-gray-400">Owner, Spice Garden</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="text-gray-400 text-xs relative z-10">
          <p>✓ 30-day free trial  ✓ No credit card required  ✓ Cancel anytime</p>
        </div>
      </motion.div>

      {/* Right Section - Form */}
      <div className="w-full lg:w-[50%] bg-background flex flex-col h-screen">
        {/* Mobile Header */}
        <div className="lg:hidden p-6 border-b border-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-emerald rounded-lg flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">RestaurantOS</span>
          </Link>
        </div>

        {/* Form Container - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto w-full p-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mb-6"
            >
              <h2 className="text-2xl font-bold text-foreground mb-1">
                {mode === 'login' ? 'Welcome Back' : 'Get Started'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === 'login' 
                  ? 'Sign in to your account to continue' 
                  : 'Create your account and start your free trial'}
              </p>
            </motion.div>

            {/* Login Form */}
            {mode === 'login' && (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleLoginSubmit}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary to-emerald text-white py-2.5 text-sm rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGoogleLogin()}
                  disabled={loading}
                  className="w-full border-2 border-border text-foreground py-3 rounded-lg hover:bg-muted transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              </motion.form>
            )}

            {/* Register Form */}
            {mode === 'register' && (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleRegisterSubmit}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      value={registerData.adminName}
                      onChange={(e) => setRegisterData({ ...registerData, adminName: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <h3 className="text-xs font-semibold text-foreground mb-2">Company Information</h3>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      value={registerData.companyName}
                      onChange={(e) => setRegisterData({ ...registerData, companyName: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Your Restaurant Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      value={registerData.phone}
                      onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <textarea
                      required
                      value={registerData.address}
                      onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Restaurant address"
                      rows={2}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    GST Number <span className="text-muted-foreground">(Optional)</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={registerData.gstNumber}
                      onChange={(e) => setRegisterData({ ...registerData, gstNumber: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    FSSAI License <span className="text-muted-foreground">(Optional)</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={registerData.fssaiLicense}
                      onChange={(e) => setRegisterData({ ...registerData, fssaiLicense: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="12345678901234"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary to-emerald text-white py-2.5 text-sm rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGoogleLogin()}
                  disabled={loading}
                  className="w-full border-2 border-border text-foreground py-3 rounded-lg hover:bg-muted transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign up with Google
                </button>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </motion.form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
