'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  Package,
  CreditCard,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ONBOARDING_STEPS = [
  { id: 'company', title: 'Informations entreprise', icon: Building2 },
  { id: 'stores', title: 'Magasins', icon: Store },
  { id: 'users', title: 'Utilisateurs', icon: Users },
  { id: 'plan', title: 'Plan d\'abonnement', icon: CreditCard },
];

const SUBSCRIPTION_PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 25000,
    features: ['1 magasin', '3 utilisateurs', '500 produits', 'POS inclus', 'Support email'],
    recommended: false,
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: 75000,
    features: ['3 magasins', '10 utilisateurs', '5 000 produits', 'Analytics avancés', 'Multi-magasins', 'Support prioritaire'],
    recommended: true,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 200000,
    features: ['Magasins illimités', 'Utilisateurs illimités', 'Produits illimités', 'API accès', 'Formation incluse', 'Support dédié 24/7'],
    recommended: false,
  },
];

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [companyData, setCompanyData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Mali',
    rccm: '',
    nif: '',
    currency: 'XOF',
  });

  const [storeData, setStoreData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    phone: '',
  });

  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [selectedPlan, setSelectedPlan] = useState('BUSINESS');

  const handleNext = () => {
    setError(null);
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In production, this would create the tenant, user, store, and subscription
      router.push('/login?registered=true');
    } catch (err) {
      setError('Une erreur est survenue lors de la création du compte');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return companyData.name && companyData.email && companyData.phone;
      case 1:
        return storeData.name && storeData.code;
      case 2:
        return userData.firstName && userData.lastName && userData.email && userData.password && userData.password === userData.confirmPassword;
      case 3:
        return selectedPlan;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="companyName">Nom de l'entreprise *</Label>
                <Input
                  id="companyName"
                  placeholder="Ex: Quincaillerie du Sud"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Email professionnel *</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  placeholder="contact@entreprise.com"
                  value={companyData.email}
                  onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyPhone">Téléphone *</Label>
                <Input
                  id="companyPhone"
                  type="tel"
                  placeholder="+223 XX XX XX XX"
                  value={companyData.phone}
                  onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="companyAddress">Adresse</Label>
                <Input
                  id="companyAddress"
                  placeholder="Adresse complète"
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyCity">Ville</Label>
                <Input
                  id="companyCity"
                  placeholder="Bamako"
                  value={companyData.city}
                  onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyCountry">Pays</Label>
                <Select value={companyData.country} onValueChange={(v) => setCompanyData({ ...companyData, country: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mali">Mali</SelectItem>
                    <SelectItem value="Senegal">Sénégal</SelectItem>
                    <SelectItem value="Burkina Faso">Burkina Faso</SelectItem>
                    <SelectItem value="Côte d'Ivoire">Côte d'Ivoire</SelectItem>
                    <SelectItem value="Guinea">Guinée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rccm">RCCM</Label>
                  <Input
                    id="rccm"
                    placeholder="Registre du Commerce"
                    value={companyData.rccm}
                    onChange={(e) => setCompanyData({ ...companyData, rccm: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nif">NIF</Label>
                  <Input
                    id="nif"
                    placeholder="Numéro Fiscal"
                    value={companyData.nif}
                    onChange={(e) => setCompanyData({ ...companyData, nif: e.target.value })}
                  />
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="currency">Devise</Label>
                <Select value={companyData.currency} onValueChange={(v) => setCompanyData({ ...companyData, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XOF">FCFA - Franc CFA</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="USD">USD - Dollar US</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              Configurez votre premier point de vente. Vous pourrez en ajouter d'autres plus tard.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="storeName">Nom du magasin *</Label>
                <Input
                  id="storeName"
                  placeholder="Ex: Magasin Principal"
                  value={storeData.name}
                  onChange={(e) => setStoreData({ ...storeData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storeCode">Code court *</Label>
                <Input
                  id="storeCode"
                  placeholder="Ex: MAG1"
                  value={storeData.code}
                  onChange={(e) => setStoreData({ ...storeData, code: e.target.value.toUpperCase() })}
                  maxLength={5}
                />
                <p className="text-xs text-gray-400">5 caractères max</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="storePhone">Téléphone</Label>
                <Input
                  id="storePhone"
                  type="tel"
                  placeholder="+223 XX XX XX XX"
                  value={storeData.phone}
                  onChange={(e) => setStoreData({ ...storeData, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="storeAddress">Adresse</Label>
                <Input
                  id="storeAddress"
                  placeholder="Adresse du magasin"
                  value={storeData.address}
                  onChange={(e) => setStoreData({ ...storeData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storeCity">Ville</Label>
                <Input
                  id="storeCity"
                  placeholder="Bamako"
                  value={storeData.city}
                  onChange={(e) => setStoreData({ ...storeData, city: e.target.value })}
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              Créez votre compte administrateur. Vous pourrez ajouter d'autres utilisateurs plus tard.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  placeholder="Prénom"
                  value={userData.firstName}
                  onChange={(e) => setUserData({ ...userData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  placeholder="Nom"
                  value={userData.lastName}
                  onChange={(e) => setUserData({ ...userData, lastName: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="userEmail">Email *</Label>
                <Input
                  id="userEmail"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userPhone">Téléphone</Label>
                <Input
                  id="userPhone"
                  type="tel"
                  placeholder="+223 XX XX XX XX"
                  value={userData.phone}
                  onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle</Label>
                <Input
                  id="role"
                  value="Propriétaire"
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={userData.password}
                  onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={userData.confirmPassword}
                  onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                />
              </div>
              {userData.password && userData.confirmPassword && userData.password !== userData.confirmPassword && (
                <div className="col-span-2">
                  <p className="text-sm text-danger-500">Les mots de passe ne correspondent pas</p>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 mb-4">
              Choisissez le plan adapté à votre entreprise. Essai gratuit de 14 jours.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedPlan === plan.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {plan.recommended && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-600 text-white text-xs font-medium rounded-full">
                      Recommandé
                    </span>
                  )}
                  <div className="text-center mb-4">
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    <div className="mt-1">
                      <span className="text-2xl font-bold">{plan.price.toLocaleString()}</span>
                      <span className="text-gray-500 text-sm"> FCFA/mois</span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-4">
            <Store className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configuration de votre entreprise</h1>
          <p className="text-primary-200 mt-1">Créez votre compte ProAlpha ERP</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {ONBOARDING_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                    isActive
                      ? 'bg-white text-primary-600'
                      : isCompleted
                      ? 'bg-success-500 text-white'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div
                    className={`w-12 h-1 mx-2 rounded ${
                      index < currentStep ? 'bg-success-500' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Form Card */}
        <Card className="border-0 shadow-2xl">
          <CardHeader>
            <CardTitle>{ONBOARDING_STEPS[currentStep].title}</CardTitle>
            <CardDescription>
              Étape {currentStep + 1} sur {ONBOARDING_STEPS.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {renderStepContent()}

            <div className="flex gap-3 mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed() || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : currentStep === ONBOARDING_STEPS.length - 1 ? (
                  'Terminer'
                ) : (
                  <>
                    Suivant
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-primary-200 mt-6">
          Déjà un compte ?{' '}
          <a href="/login" className="text-white hover:underline font-medium">
            Se connecter
          </a>
        </p>
      </div>
    </div>
  );
}
