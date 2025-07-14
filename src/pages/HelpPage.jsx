// src/pages/HelpPage.jsx
// Help page with Kyndryl styling - no authentication required

import React from 'react';
import { Link } from 'react-router-dom';
import kyndrylLogo from '../assets/kyndryl_logo.svg';

const HelpPage = () => {
  const helpItems = [
    {
      title: "Open Support Case",
      description: "Submit a new support ticket for technical assistance",
      link: "https://placeholder1.com",
      icon: "🎫"
    },
    {
      title: "Access Documentation",
      description: "View comprehensive user guides and documentation",
      link: "https://placeholder2.com",
      icon: "📚"
    },
    {
      title: "blablabla 2",
      description: "Check current blablabla 2",
      link: "https://placeholder3.com",
      icon: "📊"
    },
    {
      title: "FAQ & Troubleshooting",
      description: "Find answers to frequently asked questions",
      link: "https://placeholder4.com",
      icon: "❓"
    },
    {
      title: "Send an email to US Automation teamr",
      description: "Get in touch with the team",
      link: "mailto:admin@placeholder.com",
      icon: "👨‍💼"
    },
    {
      title: "Training Resources or documentation",
      description: "Access training materials and video tutorials",
      link: "https://placeholder5.com",
      icon: "🎓"
    }
  ];

  return (
    <div className="min-h-screen bg-kyndryl-gray flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center">
            <img
              src={kyndrylLogo}
              alt="Kyndryl"
              className="h-12 w-auto"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Page Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-kyndryl-orange rounded-full mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-kyndryl-black mb-4">
              Need Help?
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Find the support and resources you need quick access to documentation, support, and training materials.
            </p>
          </div>

          {/* Help Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {helpItems.map((item, index) => (
              <a
                key={index}
                href={item.link}
                target={item.link.startsWith('http') ? '_blank' : '_self'}
                rel={item.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-200 hover:border-kyndryl-orange group"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <span className="text-3xl">{item.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-kyndryl-black group-hover:text-kyndryl-orange transition-colors duration-200 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-kyndryl-orange text-sm font-medium">
                  <span>Learn more</span>
                  <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </a>
            ))}
          </div>


        </div>
      </main>

      {/* Footer with Return Button */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Link
            to="/login"
            className="inline-flex items-center px-6 py-3 bg-kyndryl-orange text-white font-medium rounded-md hover:bg-opacity-90 transition-colors duration-200"
          >
            <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Return to Login Page
          </Link>
          
          <div className="mt-4 text-sm text-gray-500">
            <p>&copy; 2025 Kyndryl. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HelpPage;
