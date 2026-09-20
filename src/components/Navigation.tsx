import React, { useState, useEffect } from 'react';
import { LayoutDashboard, MessageSquare, Clock, TrendingUp, UserCheck } from 'lucide-react';

export type NavTab = 'dashboard' | 'chat' | 'history' | 'progress' | 'profile';

interface NavigationProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingOffersCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  pendingOffersCount = 0,
}) => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

   useEffect(() => {
    const initialHeight = window.screen.height;

    const handleViewportChange = () => {
      if (window.visualViewport) {
        // Compare visualViewport directly to physical screen height
        const keyboardActive = window.visualViewport.height < initialHeight * 0.75;
        setIsKeyboardOpen(keyboardActive);
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
  }, []);

  const tabs = [
    { id: 'dashboard' as NavTab, label: 'Today', icon: LayoutDashboard },
    {
      id: 'chat' as NavTab,
      label: 'AI Chat',
      icon: MessageSquare,
      badge: pendingOffersCount > 0 ? pendingOffersCount : undefined,
    },
    { id: 'history' as NavTab, label: 'History', icon: Clock },
    { id: 'progress' as NavTab, label: 'Progress', icon: TrendingUp },
    { id: 'profile' as NavTab, label: 'Profile', icon: UserCheck },
  ];

  // If the keyboard is up while in chat mode, hide the navigation completely
  if (activeTab === 'chat' && isKeyboardOpen) {
    return null;
  }

  return (
    <nav
      id="mobile-navigation"
      className="fixed bottom-4 left-4 right-4 md:bottom-0 md:left-0 md:right-0 z-30 bg-white/60 dark:bg-[#151d18]/80 backdrop-blur-[10px] md:backdrop-blur-none border border-stone-200/60 dark:border-stone-800 shadow-xl rounded-full md:rounded-none md:border-t md:border-b-0 md:border-x-0 md:bg-white/95 md:dark:bg-[#151d18] md:border-stone-200 md:shadow-lg transition-all duration-200 block"
    >
      <div className="max-w-md mx-auto px-4 flex items-center justify-around pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-3 min-w-[64px] min-h-[54px] rounded-xl transition-all ${
                isActive
                  ? 'nav-item-active text-emerald-800 dark:text-[#10B981] font-semibold bg-emerald-50 dark:bg-[#10B981]/15'
                  : 'nav-item-inactive text-stone-700 dark:text-[#A8B5AF] hover:text-stone-900 dark:hover:text-[#F1F5F3] hover:bg-stone-50 dark:hover:bg-[#202925]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 bg-emerald-700 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-0.5 tracking-tight ${isActive ? 'dark:text-[#E8F3EE]' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="w-4 h-0.5 bg-emerald-700 dark:bg-[#10B981] rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
