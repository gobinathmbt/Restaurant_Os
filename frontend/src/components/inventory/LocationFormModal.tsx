import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { locationServices } from '@/api/services';
import { Loader2 } from 'lucide-react';

interface LocationFormModalProps {
  open: boolean;
  onClose: () => void;
  locationId?: string;
  onSuccess: () => void;
}

// Validation schema
const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  code: z.string()
    .min(1, 'Location code is required')
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  type: z.enum(['branch', 'warehouse', 'central_kitchen', 'cloud_kitchen'], {
    required_error: 'Location type is required',
  }),
  capabilities: z.object({
    canProcureDirectly: z.boolean(),
    canDispatchStock: z.boolean(),
    canReceiveStock: z.boolean(),
    isProductionUnit: z.boolean(),
    allowsCustomerOrders: z.boolean(),
  }),
  preferredWarehouse: z.string().optional(),
  // Branch-specific fields (conditional)
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  contact: z.object({
    phone: z.string()
      .optional()
      .refine(
        (phone) => {
          if (!phone) return true;
          // Accept 10-digit number or +91 followed by 10 digits
          const cleanPhone = phone.replace(/[^\d]/g, '');
          return cleanPhone.length === 10 || (cleanPhone.length === 12 && cleanPhone.startsWith('91'));
        },
        'Phone must be a valid 10-digit Indian phone number (with or without +91)'
      ),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    manager: z.string().optional(),
  }).optional(),
  gstNumber: z.string().optional(),
  fssaiLicense: z.string().optional(),
  timezone: z.string().optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface Warehouse {
  _id: string;
  name: string;
  code: string;
}

export default function LocationFormModal({
  open,
  onClose,
  locationId,
  onSuccess,
}: LocationFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [backendErrors, setBackendErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: '',
      code: '',
      type: 'branch',
      capabilities: {
        canProcureDirectly: false,
        canDispatchStock: false,
        canReceiveStock: false,
        isProductionUnit: false,
        allowsCustomerOrders: false,
      },
      preferredWarehouse: '',
      address: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India',
      },
      contact: {
        phone: '',
        email: '',
        manager: '',
      },
      gstNumber: '',
      fssaiLicense: '',
      timezone: 'Asia/Kolkata',
    },
  });

  const selectedType = watch('type');
  const locationName = watch('name');

  // Fetch warehouses for preferred warehouse dropdown
  useEffect(() => {
    if (open) {
      fetchWarehouses();
    }
  }, [open]);

  // Fetch location data for edit mode
  useEffect(() => {
    if (open && locationId) {
      fetchLocationData();
    } else if (open && !locationId) {
      reset({
        name: '',
        code: '',
        type: 'branch',
        capabilities: {
          canProcureDirectly: false,
          canDispatchStock: false,
          canReceiveStock: false,
          isProductionUnit: false,
          allowsCustomerOrders: false,
        },
        preferredWarehouse: '',
        address: {
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'India',
        },
        contact: {
          phone: '',
          email: '',
          manager: '',
        },
        gstNumber: '',
        fssaiLicense: '',
        timezone: 'Asia/Kolkata',
      });
    }
  }, [open, locationId, reset]);

  // Auto-generate location code suggestion
  useEffect(() => {
    if (!locationId && locationName && selectedType) {
      const suggestion = generateLocationCode(locationName, selectedType);
      setValue('code', suggestion);
    }
  }, [locationName, selectedType, locationId, setValue]);

  const fetchWarehouses = async () => {
    try {
      const response = await locationServices.getLocations({
        type: 'warehouse',
        isActive: true,
        limit: 100,
      });
      setWarehouses(response.data.data.locations || []);
    } catch (error: any) {
      console.error('Failed to fetch warehouses:', error);
    }
  };

  const fetchLocationData = async () => {
    if (!locationId) return;

    try {
      setFetchingLocation(true);
      const response = await locationServices.getLocation(locationId);
      const location = response.data.data.location;

      reset({
        name: location.name || '',
        code: location.code || '',
        type: location.type || 'branch',
        capabilities: {
          canProcureDirectly: location.capabilities?.canProcureDirectly || false,
          canDispatchStock: location.capabilities?.canDispatchStock || false,
          canReceiveStock: location.capabilities?.canReceiveStock || false,
          isProductionUnit: location.capabilities?.isProductionUnit || false,
          allowsCustomerOrders: location.capabilities?.allowsCustomerOrders || false,
        },
        preferredWarehouse: location.preferredWarehouse?._id || location.preferredWarehouse || '',
        address: {
          street: location.address?.street || '',
          city: location.address?.city || '',
          state: location.address?.state || '',
          postalCode: location.address?.postalCode || '',
          country: location.address?.country || 'India',
        },
        contact: {
          phone: location.contact?.phone || '',
          email: location.contact?.email || '',
          manager: location.contact?.manager || '',
        },
        gstNumber: location.gstNumber || '',
        fssaiLicense: location.fssaiLicense || '',
        timezone: location.timezone || 'Asia/Kolkata',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch location data',
        variant: 'destructive',
      });
    } finally {
      setFetchingLocation(false);
    }
  };

  const generateLocationCode = (name: string, type: string): string => {
    if (!name) return '';

    const typePrefix = {
      branch: 'BR',
      warehouse: 'WH',
      central_kitchen: 'CK',
      cloud_kitchen: 'CL',
    }[type] || 'LOC';

    // Take first 3 letters of name, uppercase, remove spaces
    const namePrefix = name
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 3)
      .toUpperCase();

    // Add random 3-digit number
    const randomNum = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');

    return `${typePrefix}-${namePrefix}-${randomNum}`;
  };

  const clearBackendError = (field: string) => {
    setBackendErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const onSubmit = async (data: LocationFormData) => {
    try {
      setLoading(true);
      setBackendErrors({}); // Clear previous backend errors

      // Clean up data - remove empty optional fields
      const submitData: any = {
        name: data.name,
        code: data.code,
        type: data.type,
        capabilities: data.capabilities,
      };

      if (data.preferredWarehouse) {
        submitData.preferredWarehouse = data.preferredWarehouse;
      }

      // Add branch-specific fields only if type is branch
      if (data.type === 'branch') {
        if (data.address && Object.values(data.address).some((v) => v)) {
          submitData.address = data.address;
        }
        if (data.contact && Object.values(data.contact).some((v) => v)) {
          submitData.contact = data.contact;
        }
        if (data.gstNumber) submitData.gstNumber = data.gstNumber;
        if (data.fssaiLicense) submitData.fssaiLicense = data.fssaiLicense;
      }

      if (data.timezone) submitData.timezone = data.timezone;

      if (locationId) {
        await locationServices.updateLocation(locationId, submitData);
        toast({
          title: 'Success',
          description: 'Location updated successfully',
          variant: 'success',
        });
      } else {
        await locationServices.createLocation(submitData);
        toast({
          title: 'Success',
          description: 'Location created successfully',
          variant: 'success',
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      const errorMessage = errorData?.message || error.message || 'Failed to save location';

      // Handle validation errors with field-level details
      if (status === 400 && errorData?.errors && Array.isArray(errorData.errors)) {
        const fieldErrors: Record<string, string> = {};
        
        errorData.errors.forEach((err: any) => {
          if (err.field) {
            fieldErrors[err.field] = err.message || 'Validation error';
          }
        });
        
        setBackendErrors(fieldErrors);
        
        toast({
          title: 'Validation Error',
          description: 'Please check the form for errors',
          variant: 'destructive',
        });
      } else if (status === 409) {
        toast({
          title: 'Conflict',
          description: errorMessage || 'Location code already exists',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const isBranch = selectedType === 'branch';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {locationId ? 'Edit Location' : 'Create New Location'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          {fetchingLocation ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <form id="location-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">
                      Location Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder="Main Branch"
                      aria-invalid={errors.name ? 'true' : 'false'}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                    />
                    {errors.name && (
                      <p id="name-error" className="text-sm text-destructive mt-1" role="alert">
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="code">
                      Location Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="code"
                      {...register('code')}
                      placeholder="BR-MAI-001"
                      className="uppercase"
                      aria-invalid={errors.code ? 'true' : 'false'}
                      aria-describedby={errors.code ? 'code-error' : undefined}
                    />
                    {errors.code && (
                      <p id="code-error" className="text-sm text-destructive mt-1" role="alert">
                        {errors.code.message}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="type">
                      Location Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={selectedType}
                      onValueChange={(value) => setValue('type', value as any)}
                    >
                      <SelectTrigger id="type" aria-label="Select location type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="branch">Branch</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                        <SelectItem value="central_kitchen">Central Kitchen</SelectItem>
                        <SelectItem value="cloud_kitchen">Cloud Kitchen</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.type && (
                      <p className="text-sm text-destructive mt-1" role="alert">
                        {errors.type.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Capabilities */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Capabilities</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canProcureDirectly"
                      checked={watch('capabilities.canProcureDirectly')}
                      onCheckedChange={(checked) =>
                        setValue('capabilities.canProcureDirectly', checked as boolean)
                      }
                      aria-label="Can procure directly"
                    />
                    <Label htmlFor="canProcureDirectly" className="cursor-pointer">
                      Can Procure Directly
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canDispatchStock"
                      checked={watch('capabilities.canDispatchStock')}
                      onCheckedChange={(checked) =>
                        setValue('capabilities.canDispatchStock', checked as boolean)
                      }
                      aria-label="Can dispatch stock"
                    />
                    <Label htmlFor="canDispatchStock" className="cursor-pointer">
                      Can Dispatch Stock
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canReceiveStock"
                      checked={watch('capabilities.canReceiveStock')}
                      onCheckedChange={(checked) =>
                        setValue('capabilities.canReceiveStock', checked as boolean)
                      }
                      aria-label="Can receive stock"
                    />
                    <Label htmlFor="canReceiveStock" className="cursor-pointer">
                      Can Receive Stock
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isProductionUnit"
                      checked={watch('capabilities.isProductionUnit')}
                      onCheckedChange={(checked) =>
                        setValue('capabilities.isProductionUnit', checked as boolean)
                      }
                      aria-label="Is production unit"
                    />
                    <Label htmlFor="isProductionUnit" className="cursor-pointer">
                      Is Production Unit
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowsCustomerOrders"
                      checked={watch('capabilities.allowsCustomerOrders')}
                      onCheckedChange={(checked) =>
                        setValue('capabilities.allowsCustomerOrders', checked as boolean)
                      }
                      aria-label="Allows customer orders"
                    />
                    <Label htmlFor="allowsCustomerOrders" className="cursor-pointer">
                      Allows Customer Orders
                    </Label>
                  </div>
                </div>
              </div>

              {/* Preferred Warehouse */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Warehouse Settings</h3>
                <div>
                  <Label htmlFor="preferredWarehouse">Preferred Warehouse</Label>
                  <Select
                    value={watch('preferredWarehouse') || 'none'}
                    onValueChange={(value) => setValue('preferredWarehouse', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger id="preferredWarehouse" aria-label="Select preferred warehouse">
                      <SelectValue placeholder="Select warehouse (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse._id} value={warehouse._id}>
                          {warehouse.name} ({warehouse.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Branch-Specific Fields */}
              {isBranch && (
                <>
                  {/* Address */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Address</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="street">Street</Label>
                        <Input
                          id="street"
                          {...register('address.street')}
                          placeholder="123 Main Street"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            {...register('address.city')}
                            placeholder="Mumbai"
                          />
                        </div>
                        <div>
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            {...register('address.state')}
                            placeholder="Maharashtra"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="postalCode">Postal Code</Label>
                          <Input
                            id="postalCode"
                            {...register('address.postalCode')}
                            placeholder="400001"
                          />
                        </div>
                        <div>
                          <Label htmlFor="country">Country</Label>
                          <Input
                            id="country"
                            {...register('address.country')}
                            placeholder="India"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Contact Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          {...register('contact.phone', {
                            onChange: () => clearBackendError('contact.phone'),
                          })}
                          placeholder="9876543210"
                          aria-invalid={errors.contact?.phone || backendErrors['contact.phone'] ? 'true' : 'false'}
                          aria-describedby={errors.contact?.phone || backendErrors['contact.phone'] ? 'phone-error' : undefined}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Enter 10-digit number (e.g., 9876543210)</p>
                        {(errors.contact?.phone || backendErrors['contact.phone']) && (
                          <p id="phone-error" className="text-sm text-destructive mt-1" role="alert">
                            {errors.contact?.phone?.message || backendErrors['contact.phone']}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="manager">Manager</Label>
                        <Input
                          id="manager"
                          {...register('contact.manager')}
                          placeholder="John Doe"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        {...register('contact.email')}
                        placeholder="branch@restaurant.com"
                        aria-invalid={errors.contact?.email || backendErrors['contact.email'] ? 'true' : 'false'}
                        aria-describedby={errors.contact?.email || backendErrors['contact.email'] ? 'email-error' : undefined}
                      />
                      {(errors.contact?.email || backendErrors['contact.email']) && (
                        <p id="email-error" className="text-sm text-destructive mt-1" role="alert">
                          {errors.contact?.email?.message || backendErrors['contact.email']}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Legal Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Legal Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="gstNumber">GST Number</Label>
                        <Input
                          id="gstNumber"
                          {...register('gstNumber')}
                          placeholder="22AAAAA0000A1Z5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="fssaiLicense">FSSAI License</Label>
                        <Input
                          id="fssaiLicense"
                          {...register('fssaiLicense')}
                          placeholder="12345678901234"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Timezone */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Settings</h3>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    {...register('timezone')}
                    placeholder="Asia/Kolkata"
                  />
                </div>
              </div>
            </form>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading || fetchingLocation}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="location-form"
            disabled={loading || fetchingLocation}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Saving...' : locationId ? 'Update Location' : 'Create Location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
