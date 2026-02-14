import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Settings,
  BarChart3,
  Menu,
  X,
  LogOut,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeToggleDropdown } from '@/components/theme/ThemeToggleDropdown';

interface MenuItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions?: string[];
}

const menuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    href: '/platform/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Companies',
    href: '/platform/companies',
    icon: Building2,
    permissions: ['manage_companies'],
  },
  {
    title: 'Subscriptions',
    href: '/platform/subscriptions',
    icon: CreditCard,
    permissions: ['manage_subscriptions'],
  },
  {
    title: 'Analytics',
    href: '/platform/analytics',
    icon: BarChart3,
    permissions: ['view_analytics'],
  },
  {
    title: 'Admins',
    href: '/platform/admins',
    icon: Users,
    permissions: ['manage_admins'],
  },
  {
    title: 'Settings',
    href: '/platform/settings',
    icon: Settings,
    permissions: ['manage_platform_config'],
  },
];

export default function PlatformAdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Read from cookie on initial load
    const cookies = document.cookie.split(';');
    const collapsedCookie = cookies.find(c => c.trim().startsWith('sidebar-collapsed='));
    return collapsedCookie ? collapsedCookie.split('=')[1] === 'true' : false;
  });
  const location = useLocation();
  const { user, logout } = useAuth();

  // Save to cookie whenever state changes
  useEffect(() => {
    document.cookie = `sidebar-collapsed=${sidebarCollapsed}; path=/; max-age=31536000`; // 1 year
  }, [sidebarCollapsed]);

  const hasPermission = (permissions?: string[]) => {
    if (!permissions || permissions.length === 0) return true;
    if (user?.platformAdminPrimary) return true;
    return permissions.some(p => user?.permissions?.includes(p));
  };

  const filteredMenuItems = menuItems.filter(item => hasPermission(item.permissions));

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside 
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-secondary border-r border-border pb-4">
          {/* Logo */}
          <div className={cn(
            "flex h-16 shrink-0 items-center transition-all duration-300",
            sidebarCollapsed ? "justify-center px-2" : "px-6"
          )}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-secondary-foreground font-bold text-lg">R</span>
              </div>
              {!sidebarCollapsed && (
                <div className="overflow-hidden transition-all duration-300">
                  <h1 className="text-secondary-foreground font-bold text-lg whitespace-nowrap">RestaurantOS</h1>
                  <p className="text-xs text-muted-foreground">Platform Admin</p>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Button */}
          <div className={cn(
            "transition-all duration-300",
            sidebarCollapsed ? "px-2" : "px-4"
          )}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                "w-full text-muted-foreground hover:text-secondary-foreground hover:bg-secondary/80 transition-all duration-300",
                sidebarCollapsed && "justify-center px-0"
              )}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  <span className="text-xs">Collapse</span>
                </>
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className={cn(
                  "space-y-1 transition-all duration-300",
                  sidebarCollapsed ? "px-2" : "-mx-2 px-4"
                )}>
                  <TooltipProvider delayDuration={0}>
                    {filteredMenuItems.map((item) => {
                      const isActive = location.pathname === item.href;
                      const linkContent = (
                        <Link
                          to={item.href}
                          className={cn(
                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-all duration-300',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-secondary-foreground hover:bg-secondary/80',
                            sidebarCollapsed && 'justify-center'
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {!sidebarCollapsed && (
                            <span className="transition-opacity duration-300">{item.title}</span>
                          )}
                        </Link>
                      );

                      return (
                        <li key={item.title}>
                          {sidebarCollapsed ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {linkContent}
                              </TooltipTrigger>
                              <TooltipContent side="right" className="font-semibold">
                                {item.title}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            linkContent
                          )}
                        </li>
                      );
                    })}
                  </TooltipProvider>
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
      >
        <div className="fixed inset-0 bg-black/80" onClick={() => setSidebarOpen(false)} />
        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-secondary border-r border-border">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-secondary-foreground font-bold text-lg">R</span>
              </div>
              <div>
                <h1 className="text-secondary-foreground font-bold text-lg">RestaurantOS</h1>
                <p className="text-xs text-muted-foreground">Platform Admin</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="text-muted-foreground hover:text-secondary-foreground"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
          <nav className="px-4 py-4">
            <ul role="list" className="space-y-1">
              {filteredMenuItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.title}>
                    <Link
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-secondary-foreground hover:bg-secondary/80'
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      </div>

      {/* Main content */}
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          {/* Search */}
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="relative flex flex-1 items-center">
              <Search className="pointer-events-none absolute left-3 h-5 w-5 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search..."
                className="block w-full rounded-md border-0 bg-muted py-1.5 pl-10 pr-3 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary-500 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            {/* Notifications */}
            <NotificationBell />

            {/* Theme Toggle */}
            <ThemeToggleDropdown />

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profilePicture} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.platformAdminPrimary ? 'Primary Admin' : 'Admin'}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
