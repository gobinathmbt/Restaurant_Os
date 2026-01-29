import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { 
  ShoppingCart, 
  BarChart3, 
  Users, 
  TrendingUp, 
  Smartphone, 
  Shield,
  Zap,
  Clock
} from 'lucide-react';

const features = [
  {
    icon: ShoppingCart,
    title: 'Smart Billing & KOT',
    description: 'Lightning-fast billing with kitchen order tracking, table management, and multiple payment options.',
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: BarChart3,
    title: 'Inventory Management',
    description: 'Real-time stock tracking, automated alerts, supplier management, and waste reduction analytics.',
    color: 'from-emerald-500 to-teal-500'
  },
  {
    icon: Users,
    title: 'Customer CRM',
    description: 'Build loyalty with customer profiles, feedback management, and personalized marketing campaigns.',
    color: 'from-teal-500 to-cyan-500'
  },
  {
    icon: TrendingUp,
    title: 'Advanced Analytics',
    description: 'Real-time insights on sales, inventory, staff performance, and customer behavior patterns.',
    color: 'from-cyan-500 to-blue-500'
  },
  {
    icon: Smartphone,
    title: 'Multi-Platform Access',
    description: 'Desktop app for offline mode, web dashboard for remote access, and mobile-responsive design.',
    color: 'from-blue-500 to-indigo-500'
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Bank-level encryption, role-based access control, automatic backups, and 99.9% uptime.',
    color: 'from-indigo-500 to-purple-500'
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Optimized for speed with instant order processing, quick search, and smooth navigation.',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: Clock,
    title: '24/7 Support',
    description: 'Round-the-clock customer support, comprehensive documentation, and video tutorials.',
    color: 'from-pink-500 to-rose-500'
  }
];

const FeaturesSection = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1
  });

  return (
    <section ref={ref} className="py-20 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">Features</span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mt-3 mb-4">
            Everything You Need to
            <span className="block text-primary">Run Your Restaurant</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed for modern restaurants, cafes, and food businesses
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="group relative"
            >
              <div className="h-full p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} p-0.5 mb-4`}>
                  <div className="w-full h-full bg-card rounded-lg flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover effect */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
