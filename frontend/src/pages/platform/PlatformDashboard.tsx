import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, CreditCard, TrendingUp } from 'lucide-react';

export default function PlatformDashboard() {
  const stats = [
    {
      title: 'Total Companies',
      value: '156',
      change: '+12%',
      icon: Building2,
      color: 'text-primary-500',
    },
    {
      title: 'Active Users',
      value: '2,847',
      change: '+18%',
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Monthly Revenue',
      value: '₹12.5L',
      change: '+23%',
      icon: CreditCard,
      color: 'text-green-500',
    },
    {
      title: 'Growth Rate',
      value: '34%',
      change: '+5%',
      icon: TrendingUp,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all companies and platform metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-card hover:bg-card-hover transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-primary-500">{stat.change}</span> from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Companies</CardTitle>
            <CardDescription>Latest company registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Company Name {i}</p>
                      <p className="text-xs text-muted-foreground">Registered 2 days ago</p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">Trial</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Subscription Overview</CardTitle>
            <CardDescription>Active subscriptions by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">Trial</div>
                <div className="text-sm font-medium">45 companies</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">Basic</div>
                <div className="text-sm font-medium">67 companies</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">Professional</div>
                <div className="text-sm font-medium">32 companies</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">Enterprise</div>
                <div className="text-sm font-medium">12 companies</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
