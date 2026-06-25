'use client';

import { Bell, Menu, Search, Settings, Store, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils/helpers';
import { useAuthStore, useNotificationStore, useUIStore } from '@/hooks/store';

export function Header() {
  const { user, tenant, currentStore, stores, setCurrentStore } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Store selector */}
        {stores.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <Store className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                {currentStore?.name || 'Sélectionner un magasin'}
              </span>
              <svg
                className={cn('h-4 w-4 text-gray-400 transition-transform', storeDropdownOpen && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {storeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStoreDropdownOpen(false)} />
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                  {stores.map((store) => (
                    <button
                      key={store.id}
                      onClick={() => {
                        setCurrentStore(store);
                        setStoreDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2',
                        currentStore?.id === store.id && 'bg-primary-50 text-primary-600'
                      )}
                    >
                      <Store className="h-4 w-4" />
                      <div>
                        <p className="font-medium">{store.name}</p>
                        <p className="text-xs text-gray-500">{store.city || store.address || 'Adresse non définie'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          {searchOpen ? (
            <div className="flex items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher produits, clients, ventes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 lg:w-96 pl-10 pr-10 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-5 w-5 bg-danger-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Settings */}
        {user?.role && ['SUPER_ADMIN', 'OWNER'].includes(user.role) && (
          <Link
            href="/settings"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <Settings className="h-5 w-5" />
          </Link>
        )}

        {/* User avatar (mobile) */}
        <div className="lg:hidden p-2">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary-600">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
