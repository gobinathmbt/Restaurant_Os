import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { 
  Receipt, 
  ChefHat, 
  BarChart3, 
  Users,
  Smartphone,
  Zap
} from 'lucide-react';

const showcases = [
  {
    title: "Lightning-Fast POS Billing",
    description: "Process orders in seconds with our intuitive touch-optimized interface. Split bills, apply discounts, and accept multiple payment methods seamlessly.",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80",
    icon: Receipt,
    features: ["Touch-optimized interface", "Split billing", "Multiple payments", "Instant receipts"],
    gradient: "from-green-500 to-emerald-500"
  },
  {
    title: "Kitchen Order Tracking (KOT)",
    description: "Real-time order management from table to kitchen. Track preparation status, manage multiple stations, and reduce wait times significantly.",
    image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&q=80",
    icon: ChefHat,
    features: ["Real-time updates", "Multi-station support", "Order prioritization", "Kitchen display"],
    gradient: "from-emerald-500 to-teal-500"
  },
  {
    title: "Smart Inventory Management",
    description: "Never run out of ingredients again. Automated stock alerts, supplier management, recipe costing, and waste tracking all in one place.",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80",
    icon: BarChart3,
    features: ["Auto stock alerts", "Recipe costing", "Supplier management", "Waste tracking"],
    gradient: "from-teal-500 to-cyan-500"
  },
  {
    title: "Customer Relationship Management",
    description: "Build lasting relationships with your customers. Track preferences, send personalized offers, collect feedback, and create loyalty programs.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80",
    icon: Users,
    features: ["Customer profiles", "Loyalty programs", "Feedback system", "SMS campaigns"],
    gradient: "from-cyan-500 to-blue-500"
  },
  {
    title: "Real-Time Analytics Dashboard",
    description: "Make data-driven decisions with comprehensive insights. Track sales, monitor staff performance, analyze trends, and forecast demand.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
    icon: BarChart3,
    features: ["Sales analytics", "Staff performance", "Trend analysis", "Demand forecasting"],
    gradient: "from-blue-500 to-indigo-500"
  },
  {
    title: "Multi-Platform Access",
    description: "Access your restaurant data anywhere, anytime. Desktop app for offline mode, web dashboard for remote management, and mobile-responsive design.",
    image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80",
    icon: Smartphone,
    features: ["Offline mode", "Cloud sync", "Mobile responsive", "Remote access"],
    gradient: "from-indigo-500 to-purple-500"
  }
];

const ShowcaseSection = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1
  });

  return (
    <section ref={ref} className="py-24 bg-gradient-to-b from-background to-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">Powerful Features</span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mt-3 mb-4">
            Everything Your Restaurant
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald to-mint">
              Needs to Succeed
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From billing to analytics, we've got you covered with industry-leading features
          </p>
        </motion.div>

        <div className="space-y-32">
          {showcases.map((showcase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`flex flex-col ${
                index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              } gap-12 items-center`}
            >
              {/* Image Side */}
              <motion.div
                className="flex-1 relative group"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <img
                    src={showcase.image}
                    alt={showcase.title}
                    className="w-full h-[400px] object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  
                  {/* Floating Icon */}
                  <motion.div
                    className={`absolute top-6 left-6 w-16 h-16 bg-gradient-to-br ${showcase.gradient} rounded-2xl flex items-center justify-center shadow-lg`}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <showcase.icon className="w-8 h-8 text-white" />
                  </motion.div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Decorative Elements */}
                <div className={`absolute -z-10 top-8 ${index % 2 === 0 ? '-right-8' : '-left-8'} w-72 h-72 bg-gradient-to-br ${showcase.gradient} rounded-full blur-3xl opacity-20`} />
              </motion.div>

              {/* Content Side */}
              <div className="flex-1 space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${showcase.gradient} rounded-xl flex items-center justify-center`}>
                      <showcase.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-3xl font-bold text-foreground">{showcase.title}</h3>
                  </div>
                  
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {showcase.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mt-6">
                    {showcase.features.map((feature, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
                        className="flex items-center gap-2 bg-card/50 backdrop-blur-sm border border-border rounded-lg p-3"
                      >
                        <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ShowcaseSection;
