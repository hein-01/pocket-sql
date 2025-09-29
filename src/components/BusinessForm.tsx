import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Building2, Upload, MapPin, Phone, Globe, Facebook, Music, DollarSign, CreditCard, X, Camera } from "lucide-react";

interface BusinessFormData {
  name: string;
  description: string;
  phone: string;
  address: string;
  towns: string;
  province_district: string;
  zipCode: string;
  website: string;
  informationWebsite: string;
  facebookPage: string;
  tiktokUrl: string;
  startingPrice: string;
  numberOfFields: string;
  fieldDetails: Array<{ name: string; price: string }>;
  paymentMethods: string[];
  facilities: string[];
  options: string[];
  onlineShopOption: string;
  paymentOption: string;
  openingHours: {
    [key: string]: { open: string; close: string; closed: boolean };
  };
}

const BUSINESS_OPTIONS = [
  "Cash on Delivery",
  "Pickup In-Store", 
  "Free Wifi",
  "Next-Day Delivery",
  "We Sell Online",
  "Online Payments"
];

const BUSINESS_CATEGORIES = [
  "Restaurant",
  "Retail Store",
  "Service Business",
  "Healthcare",
  "Beauty & Salon",
  "Technology",
  "Automotive",
  "Real Estate",
  "Education",
  "Entertainment",
  "Other"
];

const PREDEFINED_PRODUCTS = [
  "Espresso Latte",
  "Cappuccino",
  "Cold Brew",
  "Tea",
  "Pastries",
  "Sandwiches"
];

interface BusinessFormProps {
  onSuccess?: () => void;
  editingBusiness?: any;
}

export default function BusinessForm({ onSuccess, editingBusiness }: BusinessFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [productImages, setProductImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(editingBusiness?.product_images || []);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [listingPrice, setListingPrice] = useState<string>("");
  const [odooPrice, setOdooPrice] = useState<string>("");
  const [locations, setLocations] = useState<Array<{ id: string; province_district: string; towns: string[] }>>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>(editingBusiness?.province_district || "");
  const [availableTowns, setAvailableTowns] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<BusinessFormData>({
    name: editingBusiness?.name || "",
    description: editingBusiness?.description || "",
    phone: editingBusiness?.phone || "",
    address: editingBusiness?.address || "",
    towns: editingBusiness?.towns || "",
    province_district: editingBusiness?.province_district || "",
    zipCode: editingBusiness?.zip_code || "",
    website: editingBusiness?.website || "",
    informationWebsite: editingBusiness?.information_website || "",
    facebookPage: editingBusiness?.facebook_page || "",
    tiktokUrl: editingBusiness?.tiktok_url || "",
    startingPrice: editingBusiness?.starting_price || "",
    numberOfFields: editingBusiness?.number_of_fields || "1",
    fieldDetails: editingBusiness?.field_details || [{ name: "", price: "" }],
    paymentMethods: editingBusiness?.payment_methods || [],
    facilities: editingBusiness?.facilities || [],
    options: editingBusiness?.business_options || [],
    onlineShopOption: "sure",
    paymentOption: "bank",
    openingHours: editingBusiness?.opening_hours ? JSON.parse(editingBusiness.opening_hours) : {
      monday: { open: "09:00", close: "17:00", closed: false },
      tuesday: { open: "09:00", close: "17:00", closed: false },
      wednesday: { open: "09:00", close: "17:00", closed: false },
      thursday: { open: "09:00", close: "17:00", closed: false },
      friday: { open: "09:00", close: "17:00", closed: false },
      saturday: { open: "09:00", close: "17:00", closed: false },
      sunday: { open: "09:00", close: "17:00", closed: true }
    }
  });


  // Sort locations to prioritize Yangon and Mandalay at the top
  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      const aName = a.province_district;
      const bName = b.province_district;
      
      // Check if Yangon (with or without Myanmar text)
      const aIsYangon = aName.toLowerCase().includes("yangon");
      const bIsYangon = bName.toLowerCase().includes("yangon");
      
      // Check if Mandalay (with or without Myanmar text)
      const aIsMandalay = aName.toLowerCase().includes("mandalay");
      const bIsMandalay = bName.toLowerCase().includes("mandalay");
      
      // Yangon comes first
      if (aIsYangon && !bIsYangon) return -1;
      if (bIsYangon && !aIsYangon) return 1;
      
      // Mandalay comes second (after Yangon)
      if (aIsMandalay && !bIsMandalay && !bIsYangon) return -1;
      if (bIsMandalay && !aIsMandalay && !aIsYangon) return 1;
      
      // For all others, sort alphabetically
      return aName.localeCompare(bName);
    });
  }, [locations]);

  // Calculate total price based on selected options
  const calculateTotalPrice = () => {
    const listingPriceNum = parseFloat(listingPrice.replace(/[^0-9.]/g, '')) || 0;
    const odooPriceNum = parseFloat(odooPrice.replace(/[^0-9.]/g, '')) || 0;
    
    if (formData.onlineShopOption === 'sure') {
      return listingPriceNum + odooPriceNum;
    } else {
      return listingPriceNum;
    }
  };

  // Fetch plan prices and locations when component mounts
  useEffect(() => {
    const fetchPlanPrices = async () => {
      try {
        const { data, error } = await supabase
          .from('plans')
          .select('name, pricing, currency_symbol, duration');

        if (error) {
          console.error('Error fetching plan prices:', error);
          return;
        }

        const normalize = (s: string | null | undefined) =>
          (s ?? '').toLowerCase().replace(/[^a-z0-9+\s]/g, '');

        const listingPlan = data?.find((plan: any) =>
          normalize(plan.name).includes('listing')
        );

        const odooPlan = data?.find((plan: any) => {
          const n = normalize(plan.name);
          return n.includes('odoo') || n.includes('pos') || n.includes('website');
        });

        const formatPrice = (plan: any) => {
          if (!plan) return '';
          const symbol = plan.currency_symbol || '';
          const price = plan.pricing || '';
          const duration = plan.duration || '';
          return `${symbol}${price}${duration}`.trim();
        };

        setListingPrice(formatPrice(listingPlan));
        setOdooPrice(formatPrice(odooPlan));
      } catch (error) {
        console.error('Error:', error);
      }
    };

    const fetchLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('id, province_district, towns')
          .order('province_district');

        if (error) throw error;

        setLocations(data || []);
        
        // If editing and has existing province_district, set up towns
        if (editingBusiness?.province_district) {
          const location = data?.find(loc => loc.province_district === editingBusiness.province_district);
          if (location) {
            setAvailableTowns(location.towns || []);
          }
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };

    fetchPlanPrices();
    fetchLocations();
  }, [editingBusiness?.province_district]);

  const handleInputChange = (field: keyof BusinessFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleOpeningHoursChange = (day: string, field: 'open' | 'close', value: string) => {
    setFormData(prev => ({
      ...prev,
      openingHours: {
        ...prev.openingHours,
        [day]: {
          ...prev.openingHours[day],
          [field]: value
        }
      }
    }));
  };

  const handleDayClosedChange = (day: string, closed: boolean) => {
    setFormData(prev => ({
      ...prev,
      openingHours: {
        ...prev.openingHours,
        [day]: {
          ...prev.openingHours[day],
          closed
        }
      }
    }));
  };

  const handleProvinceChange = (province: string) => {
    setSelectedProvince(province);
    setFormData(prev => ({ ...prev, province_district: province, towns: "" }));
    
    // Find towns for selected province
    const location = locations.find(loc => loc.province_district === province);
    setAvailableTowns(location?.towns || []);
  };

  const handleFieldDetailsChange = (index: number, field: 'name' | 'price', value: string) => {
    setFormData(prev => {
      const newFieldDetails = [...prev.fieldDetails];
      newFieldDetails[index] = { ...newFieldDetails[index], [field]: value };
      return { ...prev, fieldDetails: newFieldDetails };
    });
  };

  // Update field details array when numberOfFields changes
  useEffect(() => {
    const numFields = parseInt(formData.numberOfFields) || 1;
    const currentFieldsCount = formData.fieldDetails.length;
    
    if (numFields !== currentFieldsCount) {
      setFormData(prev => {
        const newFieldDetails = [...prev.fieldDetails];
        if (numFields > currentFieldsCount) {
          // Add new fields
          for (let i = currentFieldsCount; i < numFields; i++) {
            newFieldDetails.push({ name: "", price: "" });
          }
        } else {
          // Remove excess fields
          newFieldDetails.splice(numFields);
        }
        return { ...prev, fieldDetails: newFieldDetails };
      });
    }
  }, [formData.numberOfFields]);

  const handleOptionChange = (option: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      options: checked 
        ? [...prev.options, option]
        : prev.options.filter(opt => opt !== option)
    }));
  };

  const handlePaymentMethodChange = (method: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: checked 
        ? [...prev.paymentMethods, method]
        : prev.paymentMethods.filter(m => m !== method)
    }));
  };

  const handleFacilityChange = (facility: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      facilities: checked 
        ? [...prev.facilities, facility]
        : prev.facilities.filter(f => f !== facility)
    }));
  };



  const handleProductImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const maxSize = 1 * 1024 * 1024; // 1MB in bytes
      const maxFiles = 3;
      const availableSlots = maxFiles - existingImages.length;
      
      // Check if adding new files would exceed limit
      if (files.length > availableSlots) {
        toast({
          title: "Too Many Files",
          description: `You can only add ${availableSlots} more image(s). You already have ${existingImages.length} existing image(s).`,
          variant: "destructive",
        });
        e.target.value = ''; // Clear the input
        return;
      }
      
      // Check file sizes
      const oversizedFiles = files.filter(file => file.size > maxSize);
      if (oversizedFiles.length > 0) {
        toast({
          title: "Files Too Large",
          description: `Each product image must be smaller than 1MB. ${oversizedFiles.length} file(s) exceed this limit.`,
          variant: "destructive",
        });
        e.target.value = ''; // Clear the input
        return;
      }
      
      setProductImages(files);
    }
  };

  const removeExistingImage = (imageUrl: string) => {
    setExistingImages(prev => prev.filter(img => img !== imageUrl));
  };

  const removeNewImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSize = 1 * 1024 * 1024; // 1MB in bytes
      
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: "Receipt file must be smaller than 1MB. Please choose a smaller file.",
          variant: "destructive",
        });
        e.target.value = ''; // Clear the input
        return;
      }
      
      setReceiptFile(file);
    }
  };

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);
    
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to list your business.",
        variant: "destructive",
      });
      navigate('/auth/signin');
      return;
    }


    setLoading(true);

    try {
      let logoUrl = "";
      let imageUrls: string[] = [];
      let receiptUrl = "";


      // Upload product images if provided
      if (productImages.length > 0) {
        const uploadPromises = productImages.map((file, index) => {
          const imagePath = `products/${user.id}/${Date.now()}_${index}_${file.name}`;
          return uploadFile(file, 'business-assets', imagePath);
        });
        imageUrls = await Promise.all(uploadPromises);
      }

      // Combine existing and new product images
      const allProductImages = [...existingImages, ...imageUrls];

      // Upload receipt if bank payment option is selected
      if (formData.paymentOption === 'bank' && receiptFile) {
        const receiptPath = `receipts/${user.id}/${Date.now()}_${receiptFile.name}`;
        receiptUrl = await uploadFile(receiptFile, 'business-assets', receiptPath);
      }

      // Create or update business listing
      const businessData = {
        owner_id: user.id,
        name: formData.name,
        description: formData.description,
        category: "Futsal Court Rental",
        phone: formData.phone,
        address: formData.address,
        towns: formData.towns,
        province_district: formData.province_district,
        zip_code: formData.zipCode,
        website: formData.website,
        information_website: formData.informationWebsite || null,
        
        facebook_page: formData.facebookPage || null,
        tiktok_url: formData.tiktokUrl || null,
        starting_price: formData.startingPrice || null,
        number_of_fields: parseInt(formData.numberOfFields),
        payment_methods: formData.paymentMethods.length > 0 ? formData.paymentMethods : null,
        facilities: formData.facilities.length > 0 ? formData.facilities : null,
        business_options: formData.options.length > 0 ? formData.options : null,
        opening_hours: JSON.stringify(formData.openingHours),
        product_images: allProductImages.length > 0 ? allProductImages : null,
        receipt_url: receiptUrl || editingBusiness?.receipt_url || null,
        payment_status: receiptUrl ? 'to_be_confirmed' : (editingBusiness?.payment_status || 'to_be_confirmed'),
        last_payment_date: receiptUrl ? new Date().toISOString() : editingBusiness?.last_payment_date,
        "POS+Website": formData.onlineShopOption === 'sure' ? 1 : 0
      };

      const { error } = editingBusiness 
        ? await supabase
            .from('businesses')
            .update(businessData)
            .eq('id', editingBusiness.id)
        : await supabase
            .from('businesses')
            .insert(businessData);

      if (error) throw error;

      toast({
        title: "Success!",
        description: editingBusiness ? "Your business has been updated successfully." : "Your business has been listed successfully.",
      });

      // Call onSuccess callback if provided, otherwise navigate to dashboard
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Error listing business:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to list business. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-border/60 shadow-xl bg-gradient-to-br from-card to-accent/20 backdrop-blur-sm">
      <CardHeader className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-dashboard-gradient-end/5">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Building2 className="h-6 w-6 text-primary" />
          Business Information
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          {/* Business Name - Full Width */}
          <div className="space-y-3">
            <Label htmlFor="name" className="text-sm font-medium text-foreground">Business Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter your business name"
              required
              className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80"
            />
          </div>

          {/* Number of Fields */}
          <div className="space-y-3">
            <Label htmlFor="numberOfFields" className="text-sm font-medium text-foreground">How many fields can be rented at your location? *</Label>
            <Select value={formData.numberOfFields} onValueChange={(value) => handleInputChange('numberOfFields', value)}>
              <SelectTrigger className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 transition-all duration-200 hover:border-border/80">
                <SelectValue placeholder="Select number of fields" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Field Details */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-foreground">
              Give each field a unique name (e.g., Field 1, Futsal 1, Grass Field, 11-a-side Pitch) and set its hourly price. This is essential for tracking your bookings and revenue per field.
            </Label>
            <div className="space-y-4 p-4 border-2 border-border/60 rounded-lg bg-card">
              {formData.fieldDetails.map((field, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`field-name-${index}`} className="text-xs text-muted-foreground">
                      Field {index + 1} Name *
                    </Label>
                    <Input
                      id={`field-name-${index}`}
                      value={field.name}
                      onChange={(e) => handleFieldDetailsChange(index, 'name', e.target.value)}
                      placeholder={`e.g., Field ${index + 1} or Futsal ${index + 1}`}
                      className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`field-price-${index}`} className="text-xs text-muted-foreground">
                      Hourly Price *
                    </Label>
                    <Input
                      id={`field-price-${index}`}
                      value={field.price}
                      onChange={(e) => handleFieldDetailsChange(index, 'price', e.target.value)}
                      placeholder="e.g., $50 or 50,000 MMK"
                      className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opening Hours */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-foreground">Opening Hours *</Label>
            <div className="space-y-4 p-4 border-2 border-border/60 rounded-lg bg-card">
              {Object.entries(formData.openingHours).map(([day, hours]) => (
                <div key={day} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm font-medium capitalize min-w-[80px]">{day}:</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`${day}-closed`}
                      checked={hours.closed}
                      onCheckedChange={(checked) => handleDayClosedChange(day, checked as boolean)}
                      className="border-2 border-border/60"
                    />
                    <Label htmlFor={`${day}-closed`} className="text-sm">Closed</Label>
                  </div>
                  {!hours.closed && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Open</Label>
                        <Input
                          type="time"
                          value={hours.open}
                          onChange={(e) => handleOpeningHoursChange(day, 'open', e.target.value)}
                          className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Close</Label>
                        <Input
                          type="time"
                          value={hours.close}
                          onChange={(e) => handleOpeningHoursChange(day, 'close', e.target.value)}
                          className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods for Bookings */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-foreground">Which payment methods do you accept for bookings?</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-2 border-border/60 rounded-lg bg-card">
              {['Cash on Arrival', 'WeChat Pay', 'KPay', 'Paylah'].map((method) => (
                <div key={method} className="flex items-center space-x-2">
                  <Checkbox
                    id={method}
                    checked={formData.paymentMethods.includes(method)}
                    onCheckedChange={(checked) => handlePaymentMethodChange(method, checked as boolean)}
                    className="border-2 border-border/60"
                  />
                  <Label htmlFor={method} className="text-sm">
                    {method}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Facilities and Rules */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-foreground">Please list the rules and regulations for players</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-2 border-border/60 rounded-lg bg-card">
              {[
                'Changing Rooms /Locker Rooms',
                'Equipment Rental (Futsal shoes, ball rental)',
                'Shop / Kiosk (selling drinks, snacks, sports gear)',
                'Drinking Water',
                'First Aid Kit',
                'CCTV Security',
                'Toilets',
                'Car Parking',
                'Free Wi-Fi',
                'Floodlights (for night games)',
                'Seating Area / Bleachers',
                'Near Metro/Bus Stop'
              ].map((facility) => (
                <div key={facility} className="flex items-center space-x-2">
                  <Checkbox
                    id={facility}
                    checked={formData.facilities.includes(facility)}
                    onCheckedChange={(checked) => handleFacilityChange(facility, checked as boolean)}
                    className="border-2 border-border/60"
                  />
                  <Label htmlFor={facility} className="text-sm">
                    {facility}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-medium text-foreground">Business Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe your business, services, and what makes you unique..."
              rows={4}
              required
              className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80 resize-none"
            />
          </div>


          {/* Product Images */}
          <div className="space-y-4">
            <Label htmlFor="productImages">Product Images (Max 3)</Label>
            
            {/* Existing Images Display */}
            {existingImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Existing images:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {existingImages.map((imageUrl, index) => (
                    <div key={index} className="relative">
                      <img
                        src={imageUrl}
                        alt={`Product ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeExistingImage(imageUrl)}
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p className="text-sm text-blue-700">
                    Existing images: {existingImages.length} / 3
                  </p>
                </div>
              </div>
            )}

            {/* New Images Display */}
            {productImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">New images to upload:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Array.from(productImages).map((file, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`New product ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeNewImage(index)}
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-sm text-green-700">
                    Selected: {productImages.length} new image(s)
                  </p>
                </div>
              </div>
            )}
            
            <div className="relative">
              <input
                id="productImages"
                type="file"
                accept="image/*"
                multiple
                onChange={handleProductImagesChange}
                className="sr-only"
              />
              <label
                htmlFor="productImages"
                className="flex items-center justify-center gap-3 w-full p-8 border-2 border-dashed border-blue-400/50 rounded-xl bg-gradient-to-br from-blue-50/80 to-blue-100/50 hover:from-blue-100/90 hover:to-blue-200/60 hover:border-blue-500/60 transition-all duration-300 cursor-pointer group shadow-sm hover:shadow-md"
              >
                <Camera className="h-7 w-7 text-blue-600 group-hover:text-blue-700 transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-blue-700 group-hover:text-blue-800 mb-1">
                    Choose Product Images
                  </p>
                  <p className="text-xs text-blue-600">
                    {(existingImages.length + productImages.length) < 3 ? 
                      `Add ${3 - (existingImages.length + productImages.length)} more images (PNG, JPG, max 1MB each)` :
                      'Maximum 3 images reached'
                    }
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <div className="space-y-3">
              <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone Number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  required
                  className="pl-10 border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80"
                />
              </div>
            </div>
            
          </div>

          {/* Location Information */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-primary" />
              <Label className="text-base font-semibold text-foreground">Business Address</Label>
            </div>
            
            <div className="space-y-3">
              <Input
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Street address"
                className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">Province/District/State</Label>
                <Select value={selectedProvince} onValueChange={handleProvinceChange}>
                  <SelectTrigger className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80">
                    <SelectValue placeholder="Select province/district/state" />
                  </SelectTrigger>
                  <SelectContent className="border-2 border-border/60 bg-card shadow-lg">
                    {sortedLocations.map((location) => (
                      <SelectItem key={location.id} value={location.province_district} className="hover:bg-accent focus:bg-accent">
                        {location.province_district}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">Town</Label>
                <Select value={formData.towns} onValueChange={(value) => handleInputChange('towns', value)}>
                  <SelectTrigger className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80">
                    <SelectValue placeholder="Select a town" />
                  </SelectTrigger>
                  <SelectContent className="border-2 border-border/60 bg-card shadow-lg">
                    {availableTowns.map((town) => (
                      <SelectItem key={town} value={town} className="hover:bg-accent focus:bg-accent">
                        {town}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">Zip Code</Label>
                <Input
                  value={formData.zipCode}
                  onChange={(e) => handleInputChange('zipCode', e.target.value)}
                  placeholder="ZIP code"
                  className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80"
                />
              </div>
            </div>
          </div>

          {/* Online Presence */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <Label htmlFor="website" className="text-sm font-medium text-foreground">Online Shop Website</Label>
                </div>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="https://your-website.com"
                  className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Facebook className="h-5 w-5 text-blue-600" />
                  <Label htmlFor="facebookPage" className="text-sm font-medium text-foreground">Facebook Page</Label>
                </div>
                <Input
                  id="facebookPage"
                  value={formData.facebookPage}
                  onChange={(e) => handleInputChange('facebookPage', e.target.value)}
                  placeholder="https://facebook.com/yourpage"
                  className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-pink-600" />
                  <Label htmlFor="tiktokUrl" className="text-sm font-medium text-foreground">TikTok</Label>
                </div>
                <Input
                  id="tiktokUrl"
                  value={formData.tiktokUrl}
                  onChange={(e) => handleInputChange('tiktokUrl', e.target.value)}
                  placeholder="https://tiktok.com/@yourusername"
                  className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <Label htmlFor="informationWebsite" className="text-sm font-medium text-foreground">Information Website</Label>
                </div>
                <Input
                  id="informationWebsite"
                  value={formData.informationWebsite}
                  onChange={(e) => handleInputChange('informationWebsite', e.target.value)}
                  placeholder="https://your-info-website.com"
                  className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80"
                />
              </div>
            </div>
          </div>

          {/* Plan Prices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="listingPrice">Listing Price</Label>
              </div>
              <Input
                id="listingPrice"
                value={listingPrice}
                readOnly
                className="bg-muted cursor-not-allowed"
                placeholder="Loading..."
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="odooPrice">Odoo Price</Label>
              </div>
              <Input
                id="odooPrice"
                value={odooPrice}
                readOnly
                className="bg-muted cursor-not-allowed"
                placeholder="Loading..."
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <Label htmlFor="startingPrice" className="text-sm font-medium text-foreground">Starting Price</Label>
            </div>
            <Input
              id="startingPrice"
              value={formData.startingPrice}
              onChange={(e) => handleInputChange('startingPrice', e.target.value)}
              placeholder="$20, From $50, etc."
              className="border-2 border-border/60 bg-card shadow-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200 hover:border-border/80"
            />
          </div>

          {/* Business Options */}
          <div className="space-y-4">
            <Label>Business Options</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BUSINESS_OPTIONS.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={option}
                    checked={formData.options.includes(option)}
                    onCheckedChange={(checked) => handleOptionChange(option, checked as boolean)}
                  />
                  <Label htmlFor={option} className="text-sm">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </div>


          {/* Payment Options */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Options *
            </Label>
            <RadioGroup
              value={formData.paymentOption}
              onValueChange={(value) => handleInputChange('paymentOption', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="stripe" id="stripe" />
                <Label htmlFor="stripe">Stripe</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bank" id="bank" />
                <Label htmlFor="bank">Bank/Digital Payments</Label>
              </div>
            </RadioGroup>

            {formData.paymentOption === 'bank' && (
              <div className="space-y-4 ml-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium text-primary">
                  The total is ${calculateTotalPrice().toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Please make payment to Bank ABC 1234567, or True Money 610123456
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="receipt">Upload your receipt *</Label>
                  <div className="relative">
                    <input
                      id="receipt"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleReceiptChange}
                      className="sr-only"
                      required={formData.paymentOption === 'bank'}
                    />
                    <label
                      htmlFor="receipt"
                      className="flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed border-orange-300 rounded-lg bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-all duration-200 cursor-pointer group"
                    >
                      <Upload className="h-5 w-5 text-orange-600 group-hover:text-orange-700 transition-colors" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-orange-700 group-hover:text-orange-800">
                          Choose Receipt File
                        </p>
                        <p className="text-xs text-orange-600 mt-1">
                          PNG, JPG, or PDF (max 1MB)
                        </p>
                      </div>
                    </label>
                  </div>
                  {receiptFile && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <p className="text-sm text-green-700">Selected: {receiptFile.name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>


          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            disabled={loading}
          >
            {loading ? (editingBusiness ? "Updating Business..." : "Creating Listing...") : (editingBusiness ? "Update My Business Info" : "List My Business")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}