import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building2,
  Check,
  ChevronRight,
  FileText,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  Mail,
  PartyPopper,
  Receipt,
  Settings2,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { updateSettingsSchema, createClientSchema, CURRENCIES, PAYMENT_TERMS } from '@kivo/shared';
import type { UpdateSettings, CreateClient } from '@kivo/shared';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { markOnboardingComplete } from '@/components/layout/app-layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { settingsApi, clientsApi, onboardingApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Step = 'welcome' | 'business' | 'preferences' | 'first-client' | 'complete';

const STEPS: { key: Step; label: string }[] = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'business', label: 'Business' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'first-client', label: 'First Client' },
  { key: 'complete', label: 'All Set' },
];

// ─── Progress Indicator ───────────────────────────────────────

function StepProgress({ currentStep }: { currentStep: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isPast = idx < currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  isActive && 'bg-foreground text-background ring-2 ring-foreground/20',
                  isPast && 'bg-primary text-primary-foreground',
                  isFuture && 'bg-muted text-muted-foreground'
                )}
              >
                {isPast ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-xs hidden sm:block',
                  isActive && 'font-medium text-foreground',
                  isPast && 'text-primary',
                  isFuture && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
          style={{ width: `${(currentIndex / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── Welcome Step ─────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6 animate-fade-in-up">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h1 className="font-serif text-3xl md:text-4xl tracking-tight mb-3">
          Welcome to Kivo
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
          The simple way to create professional invoices and get paid faster. Let's get your business set up in just a few steps.
        </p>
      </div>

      <div className="grid gap-3 max-w-sm mx-auto text-left">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
          <Receipt className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Professional invoices</p>
            <p className="text-xs text-muted-foreground">Branded with your logo and business details</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
          <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Send & track</p>
            <p className="text-xs text-muted-foreground">Email invoices and see when clients view them</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
          <Settings2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Get paid online</p>
            <p className="text-xs text-muted-foreground">Accept card payments directly from your invoices</p>
          </div>
        </div>
      </div>

      <Button size="lg" onClick={onNext} className="mt-4">
        Let's get started
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Business Step ────────────────────────────────────────────

function BusinessStep({
  onNext,
  onBack,
  defaultValues,
}: {
  onNext: (data: UpdateSettings & { logoFile?: File }) => void;
  onBack: () => void;
  defaultValues: Partial<UpdateSettings>;
}) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<UpdateSettings>({
    resolver: zodResolver(
      updateSettingsSchema.pick({
        business_name: true,
        business_email: true,
        business_address: true,
      })
    ),
    mode: 'onChange',
    defaultValues: {
      business_name: defaultValues.business_name || '',
      business_email: defaultValues.business_email || '',
      business_address: defaultValues.business_address || '',
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be smaller than 2MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="animate-slide-in-right">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-serif text-2xl tracking-tight">Tell us about your business</h2>
        <p className="text-muted-foreground mt-1">
          This information appears on every invoice you send
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Form */}
        <form
          id="business-form"
          onSubmit={handleSubmit((data) => onNext({ ...data, logoFile: logoFile || undefined }))}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="business_name">
              Business name <span className="text-status-overdue">*</span>
            </Label>
            <Input
              id="business_name"
              placeholder="e.g. Acme Design Studio"
              {...register('business_name')}
            />
            {errors.business_name && (
              <p className="text-xs text-status-overdue">{errors.business_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_email">
              Business email <span className="text-status-overdue">*</span>
            </Label>
            <Input
              id="business_email"
              type="email"
              placeholder="hello@yourbusiness.com"
              {...register('business_email')}
            />
            {errors.business_email && (
              <p className="text-xs text-status-overdue">{errors.business_email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_address">Business address</Label>
            <Textarea
              id="business_address"
              placeholder="Street, city, postal code, country..."
              rows={3}
              {...register('business_address')}
            />
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-16 w-16 object-contain rounded-lg border bg-white"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
              <div className="text-sm">
                <p className="font-medium">Upload your logo</p>
                <p className="text-muted-foreground text-xs">PNG, JPG or SVG. Max 2MB.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
          </div>
        </form>

        {/* Live Preview */}
        <div className="hidden lg:block">
          <div className="sticky top-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Invoice preview
            </p>
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  {logoPreview ? (
                    <img src={logoPreview} alt="" className="h-10 object-contain mb-2" />
                  ) : (
                    <div className="h-10 w-24 bg-muted rounded mb-2" />
                  )}
                  <p className="font-semibold text-sm">{register('business_name').value || 'Your Business Name'}</p>
                  <p className="text-xs text-muted-foreground">{register('business_email').value || 'hello@example.com'}</p>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                    {register('business_address').value || 'Your address will appear here'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">INVOICE</p>
                  <p className="text-xl font-bold text-foreground">#001</p>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Billed to</p>
                  <p className="font-medium">Client Name</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Amount due</p>
                  <p className="text-lg font-bold">$0.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" form="business-form" disabled={!isValid}>
          Continue
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Preferences Step ────────────────────────────────────────

function PreferencesStep({
  onNext,
  onBack,
  defaultValues,
}: {
  onNext: (data: UpdateSettings) => void;
  onBack: () => void;
  defaultValues: Partial<UpdateSettings>;
}) {
  const [currency, setCurrency] = useState(defaultValues.default_currency || 'USD');
  const [terms, setTerms] = useState(defaultValues.default_payment_terms || 'net_30');
  const [prefix, setPrefix] = useState(defaultValues.invoice_prefix || 'INV');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({
      default_currency: currency as any,
      default_payment_terms: terms as any,
      invoice_prefix: prefix,
    });
  };

  const termLabels: Record<string, string> = {
    due_on_receipt: 'Due immediately',
    net_7: 'Due in 7 days',
    net_14: 'Due in 14 days',
    net_30: 'Due in 30 days',
    net_60: 'Due in 60 days',
    net_90: 'Due in 90 days',
  };

  return (
    <div className="animate-slide-in-right">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
          <Receipt className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-serif text-2xl tracking-tight">Invoice preferences</h2>
        <p className="text-muted-foreground mt-1">
          You can always change these later in Settings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-6">
        <div className="space-y-2">
          <Label>Default currency</Label>
          <p className="text-xs text-muted-foreground">
            The currency most of your invoices will use
          </p>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Default payment terms</Label>
          <p className="text-xs text-muted-foreground">
            How long clients have to pay by default
          </p>
          <Select value={terms} onValueChange={setTerms}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_TERMS.map((t) => (
                <SelectItem key={t} value={t}>
                  {termLabels[t] || t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prefix">Invoice prefix</Label>
          <p className="text-xs text-muted-foreground">
            Appears before the invoice number, e.g. INV-001
          </p>
          <Input
            id="prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase().slice(0, 10))}
            maxLength={10}
            className="max-w-[120px]"
          />
        </div>

        {/* Preview */}
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Your next invoice will be numbered</p>
          <p className="text-xl font-bold font-mono tracking-tight">
            {prefix}-001
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button type="submit">
            Continue
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── First Client Step ────────────────────────────────────────

function FirstClientStep({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: (client: CreateClient) => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateClient>({
    resolver: zodResolver(createClientSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      company: '',
      address: '',
      notes: '',
    },
  });

  return (
    <div className="animate-slide-in-right">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
          <UserPlus className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-serif text-2xl tracking-tight">Add your first client</h2>
        <p className="text-muted-foreground mt-1">
          You need at least one client to create an invoice
        </p>
      </div>

      <form
        id="client-form"
        onSubmit={handleSubmit(onNext)}
        className="max-w-lg mx-auto space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="name">
            Client name <span className="text-status-overdue">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g. Sarah Johnson"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-xs text-status-overdue">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email address <span className="text-status-overdue">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="sarah@example.com"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-status-overdue">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">Company (optional)</Label>
          <Input
            id="company"
            placeholder="e.g. Johnson Consulting Ltd"
            {...register('company')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address (optional)</Label>
          <Textarea
            id="address"
            placeholder="Client's billing address..."
            rows={3}
            {...register('address')}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
            <Button type="submit" disabled={!isValid}>
              Save client
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Complete Step ───────────────────────────────────────────

function CompleteStep({
  businessName,
  onCreateInvoice,
  onGoToDashboard,
}: {
  businessName: string;
  onCreateInvoice: () => void;
  onGoToDashboard: () => void;
}) {
  return (
    <div className="text-center space-y-6 animate-scale-in">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-2">
        <PartyPopper className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h2 className="font-serif text-3xl tracking-tight mb-2">
          You're all set{businessName ? `, ${businessName}` : ''}!
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your business is configured and you're ready to start invoicing. Here's what you can do next:
        </p>
      </div>

      <div className="grid gap-4 max-w-md mx-auto">
        <button
          onClick={onCreateInvoice}
          className="group flex items-center gap-4 p-4 rounded-xl border-2 border-primary bg-primary/5 text-left hover:bg-primary/10 transition-colors"
        >
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold">Create your first invoice</p>
            <p className="text-sm text-muted-foreground">The fastest way to get paid</p>
          </div>
          <ChevronRight className="ml-auto h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <button
          onClick={onGoToDashboard}
          className="group flex items-center gap-4 p-4 rounded-xl border text-left hover:bg-muted/50 transition-colors"
        >
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">Go to dashboard</p>
            <p className="text-sm text-muted-foreground">Explore Kivo at your own pace</p>
          </div>
          <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    </div>
  );
}


// ─── Main Onboarding Page ────────────────────────────────────

export function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [businessData, setBusinessData] = useState<Partial<UpdateSettings> & { logoFile?: File }>({});
  const [prefsData, setPrefsData] = useState<Partial<UpdateSettings>>({});
  const [savedBusinessName, setSavedBusinessName] = useState('');

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: onboardingStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: onboardingApi.getStatus,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  useEffect(() => {
    if (onboardingStatus?.business_setup && step !== 'complete') {
      navigate({ to: '/dashboard' });
    }
  }, [onboardingStatus, step, navigate]);

  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.update,
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: settingsApi.uploadLogo,
    onError: (err: any) => {
      toast({ title: 'Could not upload logo', description: err.message, variant: 'destructive' });
    },
  });

  const createClientMutation = useMutation({
    mutationFn: clientsApi.create,
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleBusinessNext = async (data: UpdateSettings & { logoFile?: File }) => {
    setBusinessData(data);
    setSavedBusinessName(data.business_name || '');
    await updateSettingsMutation.mutateAsync({
      business_name: data.business_name,
      business_email: data.business_email,
      business_address: data.business_address,
    });
    if (data.logoFile) {
      await uploadLogoMutation.mutateAsync(data.logoFile);
    }
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    setStep('preferences');
  };

  const handlePrefsNext = async (data: UpdateSettings) => {
    setPrefsData(data);
    await updateSettingsMutation.mutateAsync(data);
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    setStep('first-client');
  };

  const handleClientNext = async (client: CreateClient) => {
    await createClientMutation.mutateAsync(client);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    setStep('complete');
  };

  const handleSkipClient = () => {
    queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    setStep('complete');
  };

  const handleCreateInvoice = () => {
    markOnboardingComplete();
    queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    navigate({ to: '/invoices/new' });
  };

  const handleGoToDashboard = () => {
    markOnboardingComplete();
    queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    navigate({ to: '/dashboard' });
  };

  const isLoading =
    statusLoading ||
    updateSettingsMutation.isPending ||
    uploadLogoMutation.isPending ||
    createClientMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Saving...</p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="md" />
        </div>

        {/* Progress */}
        {step !== 'complete' && <StepProgress currentStep={step} />}

        {/* Step Content */}
        {step === 'welcome' && <WelcomeStep onNext={() => setStep('business')} />}

        {step === 'business' && (
          <BusinessStep
            onNext={handleBusinessNext}
            onBack={() => setStep('welcome')}
            defaultValues={businessData}
          />
        )}

        {step === 'preferences' && (
          <PreferencesStep
            onNext={handlePrefsNext}
            onBack={() => setStep('business')}
            defaultValues={prefsData}
          />
        )}

        {step === 'first-client' && (
          <FirstClientStep
            onNext={handleClientNext}
            onBack={() => setStep('preferences')}
            onSkip={handleSkipClient}
          />
        )}

        {step === 'complete' && (
          <CompleteStep
            businessName={savedBusinessName}
            onCreateInvoice={handleCreateInvoice}
            onGoToDashboard={handleGoToDashboard}
          />
        )}
      </div>
    </div>
  );
}
