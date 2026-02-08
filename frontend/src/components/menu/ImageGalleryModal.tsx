import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, ArrowUp, ArrowDown, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { imageUploadServices, menuItemServices } from '@/api/services';
import { ProxiedImage } from '@/components/common/ProxiedImage';

interface MenuItemImage {
  url: string;
  displayOrder: number;
  uploadedAt?: Date;
}

interface ImageGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItemId: string;
  images: MenuItemImage[];
  onUpdate: () => void;
}

export default function ImageGalleryModal({
  isOpen,
  onClose,
  menuItemId,
  images: initialImages,
  onUpdate,
}: ImageGalleryModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<MenuItemImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Update local images when prop changes
  useEffect(() => {
    if (initialImages) {
      // Sort by display order
      const sortedImages = [...initialImages].sort(
        (a, b) => a.displayOrder - b.displayOrder
      );
      setImages(sortedImages);
    }
  }, [initialImages]);

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a JPEG, PNG, or WebP image',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'File Too Large',
        description: 'Image must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Upload to S3
      const formData = new FormData();
      formData.append('image', file);

      const uploadResponse = await imageUploadServices.uploadImage(formData);
      const imageUrl = uploadResponse.data.data.url;

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Add image to menu item
      await menuItemServices.addImage(menuItemId, imageUrl);

      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
        variant: 'success',
      });

      // Refresh images
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description:
          error.response?.data?.message ||
          'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle delete confirmation
  const handleDeleteClick = (imageUrl: string) => {
    setImageToDelete(imageUrl);
    setDeleteConfirmOpen(true);
  };

  // Handle delete image
  const handleDeleteConfirm = async () => {
    if (!imageToDelete) return;

    try {
      setIsDeleting(true);

      await menuItemServices.removeImage(menuItemId, imageToDelete);

      toast({
        title: 'Success',
        description: 'Image deleted successfully',
        variant: 'success',
      });

      // Refresh images
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description:
          error.response?.data?.message ||
          'Failed to delete image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setImageToDelete(null);
    }
  };

  // Handle move image up
  const handleMoveUp = async (index: number) => {
    if (index === 0) return; // Already at top

    const newImages = [...images];
    // Swap with previous image
    [newImages[index - 1], newImages[index]] = [
      newImages[index],
      newImages[index - 1],
    ];

    // Update display orders
    const imageOrder = newImages.map((img, idx) => ({
      url: img.url,
      displayOrder: idx,
    }));

    await handleReorder(imageOrder, newImages);
  };

  // Handle move image down
  const handleMoveDown = async (index: number) => {
    if (index === images.length - 1) return; // Already at bottom

    const newImages = [...images];
    // Swap with next image
    [newImages[index], newImages[index + 1]] = [
      newImages[index + 1],
      newImages[index],
    ];

    // Update display orders
    const imageOrder = newImages.map((img, idx) => ({
      url: img.url,
      displayOrder: idx,
    }));

    await handleReorder(imageOrder, newImages);
  };

  // Handle reorder API call
  const handleReorder = async (
    imageOrder: Array<{ url: string; displayOrder: number }>,
    newImages: MenuItemImage[]
  ) => {
    try {
      setIsReordering(true);

      await menuItemServices.reorderImages(menuItemId, imageOrder);

      // Update local state
      setImages(newImages);

      toast({
        title: 'Success',
        description: 'Images reordered successfully',
        variant: 'success',
      });

      // Refresh images from server
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Reorder Failed',
        description:
          error.response?.data?.message ||
          'Failed to reorder images. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Images</DialogTitle>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4">
              {/* Upload Section */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading... {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Supported formats: JPEG, PNG, WebP (Max 5MB)
                </p>
              </div>

              {/* Images Grid */}
              {images.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No images uploaded yet</p>
                  <p className="text-sm mt-2">
                    Click the upload button above to add images
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((image, index) => (
                    <div
                      key={image.url}
                      className="relative group border rounded-lg overflow-hidden bg-gray-50"
                    >
                      {/* Image */}
                      <div className="aspect-square">
                        <ProxiedImage
                          src={image.url}
                          alt={`Menu item image ${index + 1}`}
                          className="w-full h-full object-cover"
                          fallback="/placeholder.svg"
                        />
                      </div>

                      {/* Display Order Badge */}
                      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        #{index + 1}
                      </div>

                      {/* Action Buttons */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {/* Move Up */}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0 || isReordering}
                          title="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>

                        {/* Move Down */}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === images.length - 1 || isReordering}
                          title="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>

                        {/* Delete */}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(image.url)}
                          disabled={isDeleting}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
