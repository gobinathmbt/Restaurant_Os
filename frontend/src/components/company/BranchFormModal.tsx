import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { branchServices } from '@/api/services';

interface BranchFormModalProps {
  open: boolean;
  onClose: () => void;
  branch: any | null;
  onSuccess: () => void;
}

export default function BranchFormModal({ open, onClose, branch, onSuccess }: BranchFormModalProps) {
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
    settings: {
      currency: 'INR',
      timezone: 'Asia/Kolkata',
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
        settings: {
          currency: branch.settings?.currency || 'INR',
          timezone: branch.settings?.timezone || 'Asia/Kolkata',
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
        settings: {
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          billPrefix: '',
          kotPrefix: ''
        }
      });
    }
  }, [branch, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code) {
      toast.error('Name and code are required');
      return;
    }

    try {
      setLoading(true);
      
      if (branch) {
        await branchServices.updateBranch(branch._id, formData);
        toast.success('Branch updated successfully');
      } else {
        await branchServices.createBranch(formData);
        toast.success('Branch created successfully');
      }
      
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to ${branch ? 'update' : 'create'} branch`);
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
