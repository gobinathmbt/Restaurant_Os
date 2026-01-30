import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  Search,
  ChevronDown,
  Store,
  Utensils,
  Receipt,
  Wallet,
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
import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface MenuItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const menuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'POS',
    href: '/pos',
    icon: ShoppingCart,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin', 'employee'],
  },
  {
    title: 'Orders',
    href: '/orders',
    icon: Receipt,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin', 'employee'],
  },
  {
    title: 'Menu',
    href: '/menu',
    icon: Utensils,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin'],
  },
  {
    title: 'Inventory',
    href: '/inventory',
    icon: Package,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin'],
  },
  {
    title: 'Customers',
    href: '/customers',
    icon: Users,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin'],
  },
  {
    title: 'Staff',
    href: '/staff',
    icon: Users,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin'],
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin'],
  },
  {
    title: 'Billing',
    href: '/billing',
    icon: FileText,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin'],
  },
  {
    title: 'Branches',
    href: '/branches',
    icon: Store,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary'],
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['company_super_admin_primary', 'company_super_admin_secondary'],
  },
];

export default function CompanyLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const hasAccess = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true;
    return roles.includes(user?.role || '');
  };

  const filteredMenuItems = menuItems.filter(item => hasAccess(item.roles));

  const handleLogout = () => {
    logout();
  };

  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      company_super_admin_primary: 'Super Admin',
      company_super_admin_secondary: 'Super Admin',
      company_admin: 'Admin',
      employee: 'Employee',
    };
    return roleMap[role] || role;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-neutral-950 border-r border-border px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">RestaurantOS</h1>
                <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {user?.companyName || 'Company'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {filteredMenuItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <li key={item.title}>
                        <Link
                          to={item.href}
                          className={cn(
                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors',
                            isActive
                              ? 'bg-primary-500 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-neutral-900'
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
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
        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-neutral-950 border-r border-border">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">RestaurantOS</h1>
                <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {user?.companyName || 'Company'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white"
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
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-neutral-900'
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
      <div className="lg:pl-64">
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
                placeholder="Search orders, items, customers..."
                className="block w-full rounded-md border-0 bg-muted py-1.5 pl-10 pr-3 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary-500 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            {/* Notifications */}
            <NotificationBell />

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profilePicture} />
                    <AvatarFallback className="bg-primary-500 text-white">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getRoleDisplay(user?.role || '')}
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
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Wallet className="mr-2 h-4 w-4" />
                  Subscription
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
