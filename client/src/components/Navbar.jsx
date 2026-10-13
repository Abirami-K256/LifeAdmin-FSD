import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Upload,
  LayoutDashboard,
  LogOut,
  BellRing,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import api from '../api/axios';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [triggeringReminder, setTriggeringReminder] = useState(false);
  const [reminderMsg, setReminderMsg] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleTriggerReminders = async () => {
    setTriggeringReminder(true);
    setReminderMsg(null);
    try {
      const res = await api.post('/reminders/trigger');
      const sentCount = res.data.summary ? res.data.summary.sent : 0;
      setReminderMsg(`Reminder check finished: ${sentCount} email(s) sent.`);
      setTimeout(() => setReminderMsg(null), 4000);
    } catch (err) {
      setReminderMsg('Failed to trigger reminders.');
      setTimeout(() => setReminderMsg(null), 4000);
    } finally {
      setTriggeringReminder(false);
    }
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Upload', path: '/upload', icon: Upload },
    { name: 'Documents', path: '/documents', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">
                Life<span className="text-blue-600">Admin</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-500">
                Document Vault & Reminders
              </span>
            </div>
          </Link>

          {/* Navigation links for logged-in users */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Reminder Trigger Test Button */}
            {isAuthenticated && (
              <button
                onClick={handleTriggerReminders}
                disabled={triggeringReminder}
                title="Run daily reminder email check manually"
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <BellRing className={`w-3.5 h-3.5 ${triggeringReminder ? 'animate-bounce' : ''}`} />
                {triggeringReminder ? 'Sending...' : 'Test Reminders'}
              </button>
            )}

            {/* User profile / Logout */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                <span className="hidden sm:inline-block text-xs font-semibold text-slate-700">
                  {user?.name}
                </span>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-blue-600"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            {isAuthenticated && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-600 rounded-lg hover:bg-slate-100"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            )}
          </div>
        </div>

        {/* Status notification banner for test reminder */}
        {reminderMsg && (
          <div className="py-1 px-3 text-center text-xs font-medium bg-blue-100 text-blue-800 rounded my-1 animate-fade-in">
            {reminderMsg}
          </div>
        )}

        {/* Mobile dropdown menu */}
        {isAuthenticated && mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-200 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Icon className="w-5 h-5 text-blue-600" />
                  {link.name}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleTriggerReminders();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-amber-700 hover:bg-amber-50"
            >
              <BellRing className="w-5 h-5" />
              Run Reminder Job
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
