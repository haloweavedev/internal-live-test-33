'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // Import DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateCommunityConfiguration } from './actions'; // Server Action we'll create next
import { Loader2, Pencil } from 'lucide-react';

// Define the shape of the community prop (matching selection in page.tsx)
interface CommunityData {
  id: number;
  name: string;
  slug: string;
  circleSpaceId: number | null; // Allow null if DB allows
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnually: string | null;
}

interface EditCommunityButtonProps {
  community: CommunityData;
}

export default function EditCommunityButton({ community }: EditCommunityButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    circleSpaceId: community.circleSpaceId?.toString() ?? '',
    stripePriceIdMonthly: community.stripePriceIdMonthly ?? '',
    stripePriceIdAnnually: community.stripePriceIdAnnually ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
     // Clear specific error when user types
     setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const validateForm = (): boolean => {
      const newErrors: Record<string, string | undefined> = {};
      const spaceIdNum = Number(formData.circleSpaceId);

      if (!formData.circleSpaceId || Number.isNaN(spaceIdNum) || !Number.isInteger(spaceIdNum) || spaceIdNum <= 0) {
          newErrors.circleSpaceId = 'Circle Space ID must be a positive whole number.';
      }
      if (formData.stripePriceIdMonthly && !formData.stripePriceIdMonthly.startsWith('price_')) {
          newErrors.stripePriceIdMonthly = 'Monthly Price ID should start with "price_". Leave blank if none.';
      }
      if (formData.stripePriceIdAnnually && !formData.stripePriceIdAnnually.startsWith('price_')) {
          newErrors.stripePriceIdAnnually = 'Annual Price ID should start with "price_". Leave blank if none.';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0; // True if no errors
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) {
        toast.error("Please fix the errors in the form.");
        return;
    }
    setIsSubmitting(true);
    setErrors({}); // Clear previous errors

    try {
      const result = await updateCommunityConfiguration({
        communityId: community.id,
        circleSpaceId: formData.circleSpaceId ? Number.parseInt(formData.circleSpaceId, 10) : null, // Send null if empty
        stripePriceIdMonthly: formData.stripePriceIdMonthly || null, // Send null if empty
        stripePriceIdAnnually: formData.stripePriceIdAnnually || null, // Send null if empty
      });

      if (result.success) {
        toast.success(`Configuration updated for ${community.name}.`);
        setIsOpen(false); // Close dialog on success
        // Revalidation/refresh will be handled by the Server Action potentially
      } else {
        toast.error(`Update failed: ${result.error}`);
         // Optionally set form-level errors if the action provides them
         if (result.errors) {
             setErrors(result.errors);
         }
      }
    } catch (error) {
      console.error("Error calling update action:", error);
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Configuration for {community.name}</DialogTitle>
          <DialogDescription>
            Update the Circle Space ID and Stripe Price IDs associated with this community. Make sure these IDs are correct.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="circleSpaceId" className="text-right">
              Circle Space ID
            </Label>
            <Input
              id="circleSpaceId"
              name="circleSpaceId"
              type="number"
              value={formData.circleSpaceId}
              onChange={handleInputChange}
              className="col-span-3"
              aria-invalid={!!errors.circleSpaceId}
            />
             {errors.circleSpaceId && <p className="col-span-4 text-sm text-red-600 text-right">{errors.circleSpaceId}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stripePriceIdMonthly" className="text-right">
              Stripe Monthly ID
            </Label>
            <Input
              id="stripePriceIdMonthly"
              name="stripePriceIdMonthly"
              value={formData.stripePriceIdMonthly}
              onChange={handleInputChange}
              placeholder="price_..."
              className="col-span-3"
              aria-invalid={!!errors.stripePriceIdMonthly}
            />
             {errors.stripePriceIdMonthly && <p className="col-span-4 text-sm text-red-600 text-right">{errors.stripePriceIdMonthly}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stripePriceIdAnnually" className="text-right">
              Stripe Annual ID
            </Label>
            <Input
              id="stripePriceIdAnnually"
              name="stripePriceIdAnnually"
              value={formData.stripePriceIdAnnually}
              onChange={handleInputChange}
              placeholder="price_..."
              className="col-span-3"
               aria-invalid={!!errors.stripePriceIdAnnually}
            />
             {errors.stripePriceIdAnnually && <p className="col-span-4 text-sm text-red-600 text-right">{errors.stripePriceIdAnnually}</p>}
          </div>
           <DialogFooter>
             <DialogClose asChild>
               <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
             </DialogClose>
             <Button type="submit" disabled={isSubmitting}>
               {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
               Save Changes
             </Button>
           </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 