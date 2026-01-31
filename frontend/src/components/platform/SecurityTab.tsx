import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SecurityTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
        <CardDescription>
          Manage your password, two-factor authentication, and security preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Security settings coming soon...</p>
      </CardContent>
    </Card>
  );
}
