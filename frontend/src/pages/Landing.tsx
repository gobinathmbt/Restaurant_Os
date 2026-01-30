import { useEffect } from 'react';
import Header from '@/components/landing/Header';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import ShowcaseSection from '@/components/landing/ShowcaseSection';
import StatsSection from '@/components/landing/StatsSection';
import PricingSection from '@/components/landing/PricingSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';
import ScrollToTop from '@/components/landing/ScrollToTop';

const Landing = () => {
  // SEO Optimization
  useEffect(() => {
    // Set page title
    document.title = 'RestaurantOS - Best Restaurant POS & Billing Software | Top Restaurant Management System';
    
    // Set meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'RestaurantOS is the top restaurant POS system with smart billing, inventory management, KOT, CRM, and real-time analytics. Best restaurant billing application for modern food businesses. Start free trial today!');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'RestaurantOS is the top restaurant POS system with smart billing, inventory management, KOT, CRM, and real-time analytics. Best restaurant billing application for modern food businesses. Start free trial today!';
      document.head.appendChild(meta);
    }

    // Set keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    const keywords = 'restaurant pos, restaurant billing software, restaurant management system, pos system, restaurant billing application, food billing software, kitchen order tracking, restaurant inventory management, restaurant crm, best pos for restaurants, restaurant software, billing system, kot system, restaurant analytics, cloud pos, restaurant point of sale';
    if (metaKeywords) {
      metaKeywords.setAttribute('content', keywords);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'keywords';
      meta.content = keywords;
      document.head.appendChild(meta);
    }

    // Open Graph tags for social sharing
    const ogTags = [
      { property: 'og:title', content: 'RestaurantOS - Best Restaurant POS & Billing Software' },
      { property: 'og:description', content: 'Complete restaurant management system with POS, billing, inventory, KOT, and analytics. Start your free trial today!' },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80' },
    ];

    ogTags.forEach(tag => {
      let element = document.querySelector(`meta[property="${tag.property}"]`);
      if (element) {
        element.setAttribute('content', tag.content);
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', tag.property);
        meta.content = tag.content;
        document.head.appendChild(meta);
      }
    });

    // Twitter Card tags
    const twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'RestaurantOS - Best Restaurant POS & Billing Software' },
      { name: 'twitter:description', content: 'Complete restaurant management system with POS, billing, inventory, KOT, and analytics.' },
    ];

    twitterTags.forEach(tag => {
      let element = document.querySelector(`meta[name="${tag.name}"]`);
      if (element) {
        element.setAttribute('content', tag.content);
      } else {
        const meta = document.createElement('meta');
        meta.name = tag.name;
        meta.content = tag.content;
        document.head.appendChild(meta);
      }
    });

    // Structured data for SEO
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "RestaurantOS",
      "applicationCategory": "BusinessApplication",
      "description": "Complete restaurant POS and billing software with inventory management, KOT, CRM, and analytics",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "priceValidUntil": "2026-12-31",
        "description": "30-day free trial"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "ratingCount": "500"
      }
    };

    let scriptTag = document.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(structuredData);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <div id="features">
        <FeaturesSection />
      </div>
      <ShowcaseSection />
      <StatsSection />
      <div id="pricing">
        <PricingSection />
      </div>
      <div id="testimonials">
        <TestimonialsSection />
      </div>
      <CTASection />
      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default Landing;
