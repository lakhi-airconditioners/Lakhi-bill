import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Zap,
  FileCheck2,
  Receipt,
  Boxes,
  Truck,
  Users,
  Scale,
  Clock,
  Palette,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Search,
  LayoutGrid,
  Columns,
  Sparkles,
  X,
  Menu,
  Layers,
  ArrowRight,
} from 'lucide-react';

export interface StaffNavItem {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeColor?: string;
  groupId: string;
  hotkey?: string;
}

export interface StaffNavGroup {
  id: string;
  name: string;
  shortName: string;
  icon: React.ComponentType<{ className?: string }>;
  items: StaffNavItem[];
}

interface StaffNavigationProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  pendingClaimsCount?: number;
  layoutMode: 'top' | 'sidebar';
  onToggleLayoutMode: (mode: 'top' | 'sidebar') => void;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onOpenAiAssistant?: () => void;
}

export const StaffNavigation: React.FC<StaffNavigationProps> = ({
  activeTab,
  onSelectTab,
  pendingClaimsCount = 0,
  layoutMode,
  onToggleLayoutMode,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
  onOpenAiAssistant,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group definitions
  const navGroups: StaffNavGroup[] = useMemo(() => [
    {
      id: 'sales',
      name: 'Sales & Billing',
      shortName: 'Billing',
      icon: Receipt,
      items: [
        {
          id: 'quotations',
          label: 'Quotations & Estimates (Q...)',
          shortLabel: 'Quotes',
          description: 'Create & send price quotations, convert to invoices',
          icon: FileCheck2,
          groupId: 'sales',
          hotkey: '2',
        },
        {
          id: 'invoices',
          label: 'Tax Invoices & Billing (I...)',
          shortLabel: 'Invoices',
          description: 'GST tax bills, instant PDF download & print',
          icon: Receipt,
          groupId: 'sales',
          hotkey: '3',
        },
        {
          id: 'khata',
          label: 'Who Owes Who (Dues & Khata)',
          shortLabel: 'Dues & Khata',
          description: 'Customer balances, overdue payments & reminders',
          icon: Scale,
          groupId: 'sales',
          hotkey: '8',
        },
      ],
    },
    {
      id: 'logistics',
      name: 'Inventory & Dispatch',
      shortName: 'Inventory',
      icon: Boxes,
      items: [
        {
          id: 'inventory',
          label: 'Store Stock & Godown (STK)',
          shortLabel: 'Stock Godown',
          description: 'AC inventory, indoor/outdoor serials, barcode scans',
          icon: Boxes,
          groupId: 'logistics',
          hotkey: '4',
        },
        {
          id: 'shipments',
          label: 'Deliveries & Tracking (D...)',
          shortLabel: 'Deliveries',
          description: 'Delivery challans, vehicles, driver assignments',
          icon: Truck,
          groupId: 'logistics',
          hotkey: '6',
        },
        {
          id: 'claims',
          label: '72h Claims & Returns',
          shortLabel: 'Claims',
          description: 'Customer claims, replacements & approvals',
          icon: Clock,
          badge: pendingClaimsCount > 0 ? pendingClaimsCount : undefined,
          badgeColor: 'bg-amber-500 text-white',
          groupId: 'logistics',
          hotkey: '9',
        },
      ],
    },
    {
      id: 'hub',
      name: 'Parties & Data Hub',
      shortName: 'Parties & Data',
      icon: Users,
      items: [
        {
          id: 'customers',
          label: 'Customers & Ledger (C / T...)',
          shortLabel: 'Customers',
          description: 'Directory, ledger history & direct transactions',
          icon: Users,
          groupId: 'hub',
          hotkey: '7',
        },
        {
          id: 'lead_hub',
          label: '⚡ LA-D Data Hub',
          shortLabel: 'LA-D Hub',
          description: 'Import/Export LA-D files, automatic bill & DIV sync',
          icon: Zap,
          groupId: 'hub',
          hotkey: '5',
        },
      ],
    },
    {
      id: 'settings',
      name: 'Admin & Settings',
      shortName: 'Admin',
      icon: ShieldCheck,
      items: [
        {
          id: 'branding',
          label: 'Brand Logos & Artwork',
          shortLabel: 'Brand Logos',
          description: 'Store logos, wordmark branding & invoice watermarks',
          icon: Palette,
          groupId: 'settings',
          hotkey: '0',
        },
        {
          id: 'admins',
          label: 'Admin Access UIDs',
          shortLabel: 'Admin UIDs',
          description: 'Manage authorized Google Firebase admin credentials',
          icon: ShieldCheck,
          groupId: 'settings',
          hotkey: 'U',
        },
      ],
    },
  ], [pendingClaimsCount]);

  // Quick mode standalone item
  const quickModeItem: StaffNavItem = {
    id: 'quick',
    label: '⚡ Quick Mode (POS)',
    shortLabel: 'Quick Mode',
    description: 'Fast-counter billing, quick quotes, stock & scanner',
    icon: Zap,
    groupId: 'main',
    hotkey: '1',
  };

  // Flattened all items for lookup
  const allItems = useMemo(() => {
    return [quickModeItem, ...navGroups.flatMap((g) => g.items)];
  }, [navGroups, quickModeItem]);

  // Active item and parent group
  const activeItem = allItems.find((i) => i.id === activeTab) || quickModeItem;
  const activeGroup = navGroups.find((g) => g.items.some((i) => i.id === activeTab));

  // Search filter
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.shortLabel.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        item.hotkey?.toLowerCase() === query
    );
  }, [searchQuery, allItems]);

  // Reset selected search index when results change
  useEffect(() => {
    setSearchSelectedIndex(0);
  }, [filteredItems.length]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listener for search '/' (when not typing elsewhere)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search input keydown handler (Arrow keys & Enter)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = filteredItems[searchSelectedIndex];
      if (current) {
        onSelectTab(current.id);
        setSearchQuery('');
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    }
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // ==========================================
  // TOP BAR LAYOUT (GROUPED WITH DROPDOWNS & TABS)
  // ==========================================
  if (layoutMode === 'top') {
    return (
      <div className="space-y-2">
        {/* Main Grouped Top Bar */}
        <div 
          ref={dropdownRef} 
          className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap md:flex-nowrap items-center justify-between gap-1.5 transition-colors"
        >
          {/* Left: Quick Mode + Group Buttons */}
          <div className="flex items-center gap-1 overflow-visible flex-wrap md:flex-nowrap w-full md:w-auto">
            {/* Quick Mode Button */}
            <button
              onClick={() => {
                onSelectTab('quick');
                setActiveDropdown(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === 'quick'
                  ? 'bg-red-600 text-white shadow-xs shadow-red-600/30'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Fast POS Counter & Dashboard"
            >
              <Zap className={`w-3.5 h-3.5 ${activeTab === 'quick' ? 'text-amber-300' : 'text-amber-500'}`} />
              <span>Quick Mode</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0 hidden sm:block" />

            {/* Grouped Category Buttons */}
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = activeGroup?.id === group.id;
              const isDropdownOpen = activeDropdown === group.id;
              const groupBadgeCount = group.items.reduce((acc, curr) => acc + (curr.badge || 0), 0);

              return (
                <div key={group.id} className="relative shrink-0">
                  <button
                    onClick={() => {
                      if (activeDropdown === group.id) {
                        setActiveDropdown(null);
                      } else {
                        setActiveDropdown(group.id);
                        // Auto-select first item in group if group not currently active
                        if (!group.items.some((i) => i.id === activeTab)) {
                          onSelectTab(group.items[0].id);
                        }
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isGroupActive
                        ? 'bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 font-extrabold ring-1 ring-red-200 dark:ring-red-900/50'
                        : isDropdownOpen
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <GroupIcon className={`w-3.5 h-3.5 ${isGroupActive ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
                    <span>{group.shortName}</span>
                    {groupBadgeCount > 0 && (
                      <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        {groupBadgeCount}
                      </span>
                    )}
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {group.name}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">Select view</span>
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          const isItemActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                onSelectTab(item.id);
                                setActiveDropdown(null);
                              }}
                              className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                                isItemActive
                                  ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <ItemIcon className={`w-4 h-4 mt-0.5 shrink-0 ${isItemActive ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate">{item.label}</span>
                                  {item.badge && (
                                    <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shrink-0">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 line-clamp-1 leading-normal font-normal">
                                  {item.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Quick Search + Layout Toggle */}
          <div className="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-end">
            {/* Quick Search */}
            <div className="relative flex-1 md:w-48 lg:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Jump to module... (/)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 focus:bg-white dark:focus:bg-slate-900 border border-transparent focus:border-red-500 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 transition-all outline-none"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden lg:inline absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 pointer-events-none">
                  /
                </kbd>
              )}

              {/* Search Results Dropdown */}
              {isSearchFocused && filteredItems.length > 0 && (
                <div 
                  className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 z-50"
                  onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                >
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                    <span>Matching Modules ({filteredItems.length})</span>
                    <span className="font-mono text-[9px]">↑↓ navigate · ↵ select</span>
                  </div>
                  <div className="space-y-0.5 max-h-60 overflow-y-auto">
                    {filteredItems.map((item, idx) => {
                      const ItemIcon = item.icon;
                      const isHighlighted = idx === searchSelectedIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onSelectTab(item.id);
                            setSearchQuery('');
                            setIsSearchFocused(false);
                          }}
                          onMouseEnter={() => setSearchSelectedIndex(idx)}
                          className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                            isHighlighted
                              ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <ItemIcon className={`w-4 h-4 shrink-0 ${isHighlighted ? 'text-red-600' : 'text-slate-400'}`} />
                          <div className="flex-1 truncate font-medium">
                            {item.label}
                          </div>
                          {item.hotkey && (
                            <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                              Alt+{item.hotkey}
                            </kbd>
                          )}
                          <ArrowRight className={`w-3 h-3 ${isHighlighted ? 'text-red-500' : 'text-slate-300'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Layout Mode Toggle (Top vs Sidebar) */}
            <button
              onClick={() => onToggleLayoutMode('sidebar')}
              title="Switch to Vertical Left Sidebar"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Sidebar Mode</span>
            </button>
          </div>
        </div>

        {/* Sibling Sub-Bar: Instant 1-Click Access for Items inside Active Group */}
        {activeGroup && (
          <div className="bg-slate-100/80 dark:bg-slate-900/60 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
              <Layers className="w-3 h-3 text-red-500" />
              <span>{activeGroup.name}:</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {activeGroup.items.map((item) => {
                const ItemIcon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <ItemIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
                    <span>{item.shortLabel}</span>
                    {item.badge && (
                      <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="hidden lg:flex items-center text-[11px] text-slate-400 font-normal ml-auto shrink-0 truncate max-w-xs">
              {activeItem.description}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VERTICAL SIDEBAR LAYOUT (EXPANDABLE/COLLAPSIBLE)
  // ==========================================
  return (
    <aside
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col transition-all duration-200 shrink-0 ${
        isSidebarCollapsed ? 'w-18' : 'w-64 lg:w-72'
      }`}
    >
      {/* Sidebar Header & Controls */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1">
        {!isSidebarCollapsed ? (
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-red-600" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Staff Tools
            </span>
          </div>
        ) : (
          <LayoutGrid className="w-4 h-4 text-red-600 mx-auto" />
        )}

        <div className="flex items-center gap-0.5">
          {/* Collapse/Expand Sidebar */}
          <button
            onClick={onToggleSidebarCollapse}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse to Mini Rail'}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 -rotate-90" />}
          </button>

          {/* Toggle back to Top Bar */}
          {!isSidebarCollapsed && (
            <button
              onClick={() => onToggleLayoutMode('top')}
              title="Switch back to Top Nav Bar"
              className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Columns className="w-4 h-4 rotate-90" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Search in Sidebar */}
      {!isSidebarCollapsed && (
        <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tools... (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-red-500 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none transition-all"
            />
          </div>
        </div>
      )}

      {/* Navigation Groups List */}
      <div className="p-2 space-y-3 overflow-y-auto max-h-[calc(100vh-240px)] scrollbar-none flex-1">
        {/* Quick Mode Pin */}
        <div>
          <button
            onClick={() => onSelectTab('quick')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'quick'
                ? 'bg-red-600 text-white shadow-xs shadow-red-600/30'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            } ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
            title="⚡ Quick Mode (POS Counter)"
          >
            <Zap className={`w-4 h-4 shrink-0 ${activeTab === 'quick' ? 'text-amber-300' : 'text-amber-500'}`} />
            {!isSidebarCollapsed && (
              <div className="flex-1 text-left truncate">
                <span>Quick Mode (POS)</span>
              </div>
            )}
          </button>
        </div>

        {/* Categorized Groups */}
        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const isCollapsed = collapsedGroups[group.id];
          const hasMatchingItems = !searchQuery || group.items.some((item) =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.shortLabel.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (!hasMatchingItems) return null;

          return (
            <div key={group.id} className="space-y-1">
              {!isSidebarCollapsed ? (
                <button
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <GroupIcon className="w-3 h-3 text-slate-400" />
                    <span>{group.name}</span>
                  </div>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>
              ) : (
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />
              )}

              {/* Group items (shown if not collapsed) */}
              {(!isCollapsed || isSidebarCollapsed) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isItemActive = activeTab === item.id;
                    const matchesSearch = !searchQuery || 
                      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      item.shortLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      item.description.toLowerCase().includes(searchQuery.toLowerCase());

                    if (!matchesSearch) return null;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectTab(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
                          isItemActive
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold ring-1 ring-red-200 dark:ring-red-900/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                        } ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                        title={`${item.label} - ${item.description}`}
                      >
                        <ItemIcon className={`w-4 h-4 shrink-0 ${isItemActive ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
                        {!isSidebarCollapsed && (
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate">{item.shortLabel}</span>
                              {item.badge && (
                                <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shrink-0">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {isSidebarCollapsed && item.badge && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer */}
      {!isSidebarCollapsed && onOpenAiAssistant && (
        <div className="p-2.5 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onOpenAiAssistant}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-linear-to-r from-red-600 to-indigo-600 hover:from-red-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Lakhi AI Assistant</span>
          </button>
        </div>
      )}
    </aside>
  );
};
