import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { branchServices } from '@/api/services';

interface BranchFormModalProps {
  open: boolean;
  onClose: () => void;
  branch: any | null;
  onSuccess: () => void;
}

export default function BranchFormModal({ open, onClose, branch, onSuccess }: BranchFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    },
    contact: {
      phone: '',
      email: '',
      alternatePhone: ''
    },
    gstNumber: '',
    fssaiLicense: '',
    operatingHours: {
      monday: { open: '09:00', close: '22:00', isOpen: true },
      tuesday: { open: '09:00', close: '22:00', isOpen: true },
      wednesday: { open: '09:00', close: '22:00', isOpen: true },
      thursday: { open: '09:00', close: '22:00', isOpen: true },
      friday: { open: '09:00', close: '22:00', isOpen: true },
      saturday: { open: '09:00', close: '22:00', isOpen: true },
      sunday: { open: '09:00', close: '22:00', isOpen: true }
    },
    settings: {
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      taxSettings: {
        cgst: 0,
        sgst: 0,
        igst: 0,
        serviceCharge: 0
      },
      billPrefix: '',
      kotPrefix: ''
    }
  });

  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name || '',
        code: branch.code || '',
        address: {
          street: branch.address?.street || '',
          city: branch.address?.city || '',
          state: branch.address?.state || '',
          pincode: branch.address?.pincode || '',
          country: branch.address?.country || 'India'
        },
        contact: {
          phone: branch.contact?.phone || '',
          email: branch.contact?.email || '',
          alternatePhone: branch.contact?.alternatePhone || ''
        },
        gstNumber: branch.gstNumber || '',
        fssaiLicense: branch.fssaiLicense || '',
        operatingHours: {
          monday: branch.operatingHours?.monday || { open: '09:00', close: '22:00', isOpen: true },
          tuesday: branch.operatingHours?.tuesday || { open: '09:00', close: '22:00', isOpen: true },
          wednesday: branch.operatingHours?.wednesday || { open: '09:00', close: '22:00', isOpen: true },
          thursday: branch.operatingHours?.thursday || { open: '09:00', close: '22:00', isOpen: true },
          friday: branch.operatingHours?.friday || { open: '09:00', close: '22:00', isOpen: true },
          saturday: branch.operatingHours?.saturday || { open: '09:00', close: '22:00', isOpen: true },
          sunday: branch.operatingHours?.sunday || { open: '09:00', close: '22:00', isOpen: true }
        },
        settings: {
          currency: branch.settings?.currency || 'INR',
          timezone: branch.settings?.timezone || 'Asia/Kolkata',
          taxSettings: {
            cgst: branch.settings?.taxSettings?.cgst || 0,
            sgst: branch.settings?.taxSettings?.sgst || 0,
            igst: branch.settings?.taxSettings?.igst || 0,
            serviceCharge: branch.settings?.taxSettings?.serviceCharge || 0
          },
          billPrefix: branch.settings?.billPrefix || '',
          kotPrefix: branch.settings?.kotPrefix || ''
        }
      });
    } else {
      // Reset form for new branch
      setFormData({
        name: '',
        code: '',
        address: {
          street: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India'
        },
        contact: {
          phone: '',
          email: '',
          alternatePhone: ''
        },
        gstNumber: '',
        fssaiLicense: '',
        operatingHours: {
          monday: { open: '09:00', close: '22:00', isOpen: true },
          tuesday: { open: '09:00', close: '22:00', isOpen: true },
          wednesday: { open: '09:00', close: '22:00', isOpen: true },
          thursday: { open: '09:00', close: '22:00', isOpen: true },
          friday: { open: '09:00', close: '22:00', isOpen: true },
          saturday: { open: '09:00', close: '22:00', isOpen: true },
          sunday: { open: '09:00', close: '22:00', isOpen: true }
        },
        settings: {
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          taxSettings: {
            cgst: 0,
            sgst: 0,
            igst: 0,
            serviceCharge: 0
          },
          billPrefix: '',
          kotPrefix: ''
        }
      });
    }
  }, [branch, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code) {
      toast({
        title: "Validation Error",
        description: "Name and code are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      if (branch) {
        await branchServices.updateBranch(branch._id, formData);
        toast({
          title: "Success",
          description: "Branch updated successfully",
          variant: "success",
        });
      } else {
        await branchServices.createBranch(formData);
        toast({
          title: "Success",
          description: "Branch created successfully",
          variant: "success",
        });
      }
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || `Failed to ${branch ? 'update' : 'create'} branch`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{branch ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Branch Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Main Branch"
                  required
                />
              </div>
              <div>
                <Label htmlFor="code">Branch Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="MB001"
                  required
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h3 className="font-semibold">Address</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="street">Street</Label>
                <Input
                  id="street"
                  value={formData.address.street}
                  onChange={(e) => setFormData({
                    ...formData,
                    address: { ...formData.address, street: e.target.value }
                  })}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.address.city}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, city: e.target.value }
                    })}
                    placeholder="Mumbai"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.address.state}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, state: e.target.value }
                    })}
                    placeholder="Maharashtra"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={formData.address.pincode}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, pincode: e.target.value }
                    })}
                    placeholder="400001"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.address.country}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, country: e.target.value }
                    })}
                    placeholder="India"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.contact.phone}
                  onChange={(e) => setFormData({
                    ...formData,
                    contact: { ...formData.contact, phone: e.target.value }
                  })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <Label htmlFor="alternatePhone">Alternate Phone</Label>
                <Input
                  id="alternatePhone"
                  value={formData.contact.alternatePhone}
                  onChange={(e) => setFormData({
                    ...formData,
                    contact: { ...formData.contact, alternatePhone: e.target.value }
                  })}
                  placeholder="+91 98765 43211"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.contact.email}
                onChange={(e) => setFormData({
                  ...formData,
                  contact: { ...formData.contact, email: e.target.value }
                })}
                placeholder="branch@restaurant.com"
              />
            </div>
          </div>

          {/* Legal Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Legal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input
                  id="gstNumber"
                  value={formData.gstNumber}
                  onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div>
                <Label htmlFor="fssaiLicense">FSSAI License</Label>
                <Input
                  id="fssaiLicense"
                  value={formData.fssaiLicense}
                  onChange={(e) => setFormData({ ...formData, fssaiLicense: e.target.value })}
                  placeholder="12345678901234"
                />
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <Accordion type="single" collapsible className="border rounded-lg">
            <AccordionItem value="operating-hours" className="border-0">
              <AccordionTrigger className="px-4 hover:no-underline">
                <h3 className="font-semibold">Operating Hours</h3>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                    <div key={day} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex items-center gap-2 w-32">
                        <Checkbox
                          id={`${day}-open`}
                          checked={formData.operatingHours[day as keyof typeof formData.operatingHours].isOpen}
                          onCheckedChange={(checked) => setFormData({
                            ...formData,
                            operatingHours: {
                              ...formData.operatingHours,
                              [day]: { ...formData.operatingHours[day as keyof typeof formData.operatingHours], isOpen: checked as boolean }
                            }
                          })}
                        />
                        <Label htmlFor={`${day}-open`} className="capitalize cursor-pointer">
                          {day}
                        </Label>
                      </div>
                      {formData.operatingHours[day as keyof typeof formData.operatingHours].isOpen && (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={formData.operatingHours[day as keyof typeof formData.operatingHours].open}
                            onChange={(e) => setFormData({
                              ...formData,
                              operatingHours: {
                                ...formData.operatingHours,
                                [day]: { ...formData.operatingHours[day as keyof typeof formData.operatingHours], open: e.target.value }
                              }
                            })}
                            className="w-32"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={formData.operatingHours[day as keyof typeof formData.operatingHours].close}
                            onChange={(e) => setFormData({
                              ...formData,
                              operatingHours: {
                                ...formData.operatingHours,
                                [day]: { ...formData.operatingHours[day as keyof typeof formData.operatingHours], close: e.target.value }
                              }
                            })}
                            className="w-32"
                          />
                        </div>
                      )}
                      {!formData.operatingHours[day as keyof typeof formData.operatingHours].isOpen && (
                        <span className="text-sm text-muted-foreground">Closed</span>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold">Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={formData.settings.currency}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, currency: e.target.value }
                  })}
                  placeholder="INR"
                />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={formData.settings.timezone}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, timezone: e.target.value }
                  })}
                  placeholder="Asia/Kolkata"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="billPrefix">Bill Prefix</Label>
                <Input
                  id="billPrefix"
                  value={formData.settings.billPrefix}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, billPrefix: e.target.value }
                  })}
                  placeholder="BILL-"
                />
              </div>
              <div>
                <Label htmlFor="kotPrefix">KOT Prefix</Label>
                <Input
                  id="kotPrefix"
                  value={formData.settings.kotPrefix}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, kotPrefix: e.target.value }
                  })}
                  placeholder="KOT-"
                />
              </div>
            </div>
          </div>

          {/* Tax Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold">Tax Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cgst">CGST (%)</Label>
                <Input
                  id="cgst"
                  type="number"
                  step="0.01"
                  value={formData.settings.taxSettings.cgst}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      taxSettings: { ...formData.settings.taxSettings, cgst: parseFloat(e.target.value) || 0 }
                    }
                  })}
                  placeholder="2.5"
                />
              </div>
              <div>
                <Label htmlFor="sgst">SGST (%)</Label>
                <Input
                  id="sgst"
                  type="number"
                  step="0.01"
                  value={formData.settings.taxSettings.sgst}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      taxSettings: { ...formData.settings.taxSettings, sgst: parseFloat(e.target.value) || 0 }
                    }
                  })}
                  placeholder="2.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="igst">IGST (%)</Label>
                <Input
                  id="igst"
                  type="number"
                  step="0.01"
                  value={formData.settings.taxSettings.igst}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      taxSettings: { ...formData.settings.taxSettings, igst: parseFloat(e.target.value) || 0 }
                    }
                  })}
                  placeholder="5"
                />
              </div>
              <div>
                <Label htmlFor="serviceCharge">Service Charge (%)</Label>
                <Input
                  id="serviceCharge"
                  type="number"
                  step="0.01"
                  value={formData.settings.taxSettings.serviceCharge}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      taxSettings: { ...formData.settings.taxSettings, serviceCharge: parseFloat(e.target.value) || 0 }
                    }
                  })}
                  placeholder="10"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : branch ? 'Update Branch' : 'Create Branch'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
