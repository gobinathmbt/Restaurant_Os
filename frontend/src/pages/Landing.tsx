import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ChefHat, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  Smartphone, 
  Shield,
  TrendingUp,
  CheckCircle2,
  Star,
  ArrowRight
} from 'lucide-react';

const Landing = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ChefHat className="w-8 h-8 text-primary-500" />
              <span className="text-2xl font-bold text-neutral-950">RestaurantOS</span>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-primary-500 transition">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-primary-500 transition">Pricing</a>
              <a href="#testimonials" className="text-gray-600 hover:text-primary-500 transition">About</a>
              <a href="#contact" className="text-gray-600 hover:text-primary-500 transition">Contact</a>
            </nav>

            <div className="flex items-center space-x-4">
              <Link 
                to="/login" 
                className="text-gray-600 hover:text-primary-500 transition font-medium"
              >
                Login
              </Link>
              <Link 
                to="/register" 
                className="bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition font-medium"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-neutral-950 mb-6">
              Transform Your Restaurant Operations
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Complete restaurant management system with billing, inventory, CRM, and analytics. 
              Start your 30-day free trial today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to="/register" 
                className="bg-primary-500 text-white px-8 py-4 rounded-lg hover:bg-primary-600 transition font-semibold text-lg flex items-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button className="border-2 border-primary-500 text-primary-500 px-8 py-4 rounded-lg hover:bg-primary-50 transition font-semibold text-lg">
                Watch Demo
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              No credit card required • 30-day free trial • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-neutral-950 mb-4">
              Everything You Need to Run Your Restaurant
            </h2>
            <p className="text-xl text-gray-600">
              Powerful features designed for modern restaurants
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Card 1 */}
            <div className="p-6 border border-gray-200 rounded-xl hover:shadow-lg transition">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <ShoppingCart className="w-6 h-6 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-950 mb-2">Smart Billing</h3>
              <p className="text-gray-600">
                Fast and accurate billing with KOT management, table tracking, and multiple payment options.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="p-6 border border-gray-200 rounded-xl hover:shadow-lg transition">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-950 mb-2">Inventory Management</h3>
              <p className="text-gray-600">
                Track stock levels, manage suppliers, and get low-stock alerts automatically.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="p-6 border border-gray-200 rounded-xl hover:shadow-lg transition">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-950 mb-2">Customer CRM</h3>
              <p className="text-gray-600">
                Build customer relationships with loyalty programs, feedback management, and personalized offers.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div className="p-6 border border-gray-200 rounded-xl hover:shadow-lg transition">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-950 mb-2">Analytics & Reports</h3>
              <p className="text-gray-600">
                Real-time insights on sales, inventory, and customer behavior to make data-driven decisions.
              </p>
            </div>

            {/* Feature Card 5 */}
            <div className="p-6 border border-gray-200 rounded-xl hover:shadow-lg transition">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-950 mb-2">Desktop & Web</h3>
              <p className="text-gray-600">
                Access from anywhere with our desktop app for offline mode and web app for remote access.
              </p>
            </div>

            {/* Feature Card 6 */}
            <div className="p-6 border border-gray-200 rounded-xl hover:shadow-lg transition">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-950 mb-2">Secure & Reliable</h3>
              <p className="text-gray-600">
                Bank-level security with automatic backups and 99.9% uptime guarantee.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-neutral-950 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              One plan with everything included
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="bg-white border-2 border-primary-500 rounded-2xl p-8 shadow-xl">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-neutral-950 mb-2">Professional Plan</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-primary-500">₹3,999</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">Billed monthly • Cancel anytime</p>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Unlimited billing & invoicing</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Complete inventory management</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Customer CRM & loyalty programs</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Advanced analytics & reports</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Desktop & web access</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Unlimited users & branches</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">24/7 customer support</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Free updates & new features</span>
                </li>
              </ul>

              <Link 
                to="/register" 
                className="block w-full bg-primary-500 text-white text-center px-8 py-4 rounded-lg hover:bg-primary-600 transition font-semibold text-lg"
              >
                Start 30-Day Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-neutral-950 mb-4">
              Trusted by Restaurant Owners
            </h2>
            <p className="text-xl text-gray-600">
              See what our customers have to say
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary-500 text-primary-500" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "RestaurantOS has completely transformed how we manage our restaurant. The billing system is incredibly fast and the inventory tracking saves us hours every week."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                  RK
                </div>
                <div>
                  <p className="font-semibold text-neutral-950">Rajesh Kumar</p>
                  <p className="text-sm text-gray-600">Owner, Spice Garden</p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary-500 text-primary-500" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "The analytics feature gives us insights we never had before. We can now make data-driven decisions about our menu and pricing. Highly recommended!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                  PS
                </div>
                <div>
                  <p className="font-semibold text-neutral-950">Priya Sharma</p>
                  <p className="text-sm text-gray-600">Manager, Cafe Delight</p>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary-500 text-primary-500" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "Best investment we've made for our restaurant chain. Managing multiple branches is now effortless. The support team is also very responsive."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                  AM
                </div>
                <div>
                  <p className="font-semibold text-neutral-950">Amit Mehta</p>
                  <p className="text-sm text-gray-600">CEO, Food Paradise Group</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-500">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to Transform Your Restaurant?
            </h2>
            <p className="text-xl text-primary-50 mb-8">
              Join hundreds of restaurants already using RestaurantOS. Start your free trial today.
            </p>
            <Link 
              to="/register" 
              className="inline-block bg-white text-primary-500 px-8 py-4 rounded-lg hover:bg-gray-100 transition font-semibold text-lg"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-neutral-950 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <ChefHat className="w-6 h-6 text-primary-500" />
                <span className="text-xl font-bold">RestaurantOS</span>
              </div>
              <p className="text-gray-400">
                Complete restaurant management solution for modern businesses.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-primary-500 transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary-500 transition">Pricing</a></li>
                <li><a href="#" className="hover:text-primary-500 transition">Demo</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-primary-500 transition">About Us</a></li>
                <li><a href="#" className="hover:text-primary-500 transition">Contact</a></li>
                <li><a href="#" className="hover:text-primary-500 transition">Support</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-primary-500 transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-primary-500 transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2026 RestaurantOS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
