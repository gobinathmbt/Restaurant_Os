import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Users, TrendingUp, Package } from 'lucide-react';

export default function CompanyDashboard() {
  const stats = [
    {
      title: "Today's Sales",
      value: '₹45,231',
      change: '+20.1%',
      icon: TrendingUp,
      color: 'text-primary-500',
    },
    {
      title: 'Total Orders',
      value: '234',
      change: '+12%',
      icon: ShoppingCart,
      color: 'text-blue-500',
    },
    {
      title: 'Customers',
      value: '1,234',
      change: '+8%',
      icon: Users,
      color: 'text-green-500',
    },
    {
      title: 'Low Stock Items',
      value: '12',
      change: '-3',
      icon: Package,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening today.
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
                <span className="text-primary-500">{stat.change}</span> from yesterday
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders & Top Items */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest orders from your restaurant</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-primary-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Order #{1000 + i}</p>
                      <p className="text-xs text-muted-foreground">Table {i} • 5 mins ago</p>
                    </div>
                  </div>
                  <div className="text-sm font-medium">₹{(Math.random() * 1000 + 500).toFixed(0)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
            <CardDescription>Most popular items today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['Butter Chicken', 'Paneer Tikka', 'Biryani', 'Dal Makhani', 'Naan'].map((item, i) => (
                <div key={item} className="flex items-center justify-between">
                  <div className="text-sm">{item}</div>
                  <div className="text-sm font-medium">{45 - i * 5} orders</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
