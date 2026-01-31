import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AppearanceTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance Settings</CardTitle>
        <CardDescription>
          Customize the look and feel of your platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Appearance settings coming soon...</p>
      </CardContent>
    </Card>
  );
}
