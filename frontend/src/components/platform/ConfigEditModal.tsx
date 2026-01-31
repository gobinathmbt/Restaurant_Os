import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface PlatformConfig {
  _id: string;
  configKey: string;
  configValue: any;
  description?: string;
  category: 'auth' | 'payment' | 'email' | 'storage' | 'api' | 'system' | 'sms' | 'notification';
  isSecret: boolean;
  isActive: boolean;
  isEditable: boolean;
  lastModifiedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ConfigEditModalProps {
  config: PlatformConfig | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, data: { configValue?: any; description?: string; isActive?: boolean }) => Promise<void>;
}

export default function ConfigEditModal({ config, open, onClose, onSave }: ConfigEditModalProps) {
  const [configValue, setConfigValue] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (config) {
      // Handle different value types
      if (config.configValue !== null && config.configValue !== undefined) {
        if (typeof config.configValue === 'object') {
          setConfigValue(JSON.stringify(config.configValue, null, 2));
        } else {
          setConfigValue(String(config.configValue));
        }
      } else {
        setConfigValue('');
      }
      setDescription(config.description || '');
      setIsActive(config.isActive);
      setShowSecret(false);
    }
  }, [config]);

  const handleSave = async () => {
    if (!config) return;

    setIsLoading(true);
    try {
      // Parse value based on type
      let parsedValue: any = configValue;
      
      // Try to parse as JSON for objects/arrays
      if (configValue.trim().startsWith('{') || configValue.trim().startsWith('[')) {
        try {
          parsedValue = JSON.parse(configValue);
        } catch {
          // Keep as string if JSON parse fails
        }
      } else if (configValue === 'true' || configValue === 'false') {
        parsedValue = configValue === 'true';
      } else if (!isNaN(Number(configValue)) && configValue.trim() !== '') {
        parsedValue = Number(configValue);
      }

      await onSave(config._id, {
        configValue: parsedValue,
        description,
        isActive,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!config) return null;

  const isSecretField = config.isSecret;
  const displayValue = isSecretField && !showSecret ? '***HIDDEN***' : configValue;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Configuration</DialogTitle>
          <DialogDescription>
            Update the platform configuration settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Config Key (Read-only) */}
          <div className="space-y-2">
            <Label>Configuration Key</Label>
            <Input value={config.configKey} disabled className="bg-muted" />
          </div>

          {/* Category Badge */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div>
              <Badge variant="outline" className="capitalize">
                {config.category}
              </Badge>
              {isSecretField && (
                <Badge variant="destructive" className="ml-2">
                  Secret
                </Badge>
              )}
            </div>
          </div>

          {/* Config Value */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="configValue">Configuration Value</Label>
              {isSecretField && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSecret(!showSecret)}
                  className="h-8"
                >
                  {showSecret ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Show
                    </>
                  )}
                </Button>
              )}
            </div>
            {configValue.includes('\n') || configValue.length > 100 ? (
              <Textarea
                id="configValue"
                value={displayValue}
                onChange={(e) => setConfigValue(e.target.value)}
                disabled={!config.isEditable}
                rows={6}
                className="font-mono text-sm"
              />
            ) : (
              <Input
                id="configValue"
                type={isSecretField && !showSecret ? 'password' : 'text'}
                value={displayValue}
                onChange={(e) => setConfigValue(e.target.value)}
                disabled={!config.isEditable}
                className="font-mono"
              />
            )}
            {!config.isEditable && (
              <p className="text-xs text-muted-foreground">
                This configuration is not editable
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this configuration..."
              rows={3}
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable this configuration
              </p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Last Modified Info */}
          {config.lastModifiedBy && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Last modified by: {config.lastModifiedBy.name} ({config.lastModifiedBy.email})
              </p>
              <p className="text-xs text-muted-foreground">
                Updated: {new Date(config.updatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !config.isEditable}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
