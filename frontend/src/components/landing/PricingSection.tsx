import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import { CheckCircle2, Sparkles } from 'lucide-react';

const features = [
  'Unlimited billing & invoicing',
  'Complete inventory management',
  'Customer CRM & loyalty programs',
  'Advanced analytics & reports',
  'Desktop & web access',
  'Unlimited users & branches',
  'Multi-location support',
  '24/7 customer support',
  'Free updates & new features',
  'Data backup & security'
];

const PricingSection = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1
  });

  return (
    <section ref={ref} className="py-20 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">Pricing</span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mt-3 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            One plan with everything included. No hidden fees.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative">
            {/* Popular badge */}
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="px-4 py-2 bg-gradient-to-r from-primary to-emerald text-white text-sm font-semibold rounded-full flex items-center gap-2 shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                Most Popular
              </motion.div>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-card border-2 border-primary rounded-3xl p-8 md:p-12 shadow-2xl shadow-primary/20"
            >
              <div className="text-center mb-8">
                <h3 className="text-3xl font-bold text-foreground mb-4">Professional Plan</h3>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-6xl font-bold text-primary">₹3,999</span>
                  <span className="text-xl text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground">Billed monthly • Cancel anytime</p>
              </div>

              <div className="space-y-4 mb-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </motion.div>
                ))}
              </div>

              <Link
                to="/auth?mode=register"
                className="block w-full bg-gradient-to-r from-primary to-emerald text-white text-center px-8 py-4 rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold text-lg"
              >
                Start 30-Day Free Trial
              </Link>

              <p className="text-center text-sm text-muted-foreground mt-4">
                No credit card required • Full access during trial
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
