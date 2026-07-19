import { CheckCircle2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { generateThermalReceipt, type InvoiceData } from '@/lib/utils/pdf';

interface SuccessDialogProps {
  open: boolean;
  onClose: () => void;
  wasOfflineSale: boolean;
  lastReceiptData: InvoiceData | null;
}

export function SuccessDialog({ open, onClose, wasOfflineSale, lastReceiptData }: SuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm text-center">
        <div className="py-6">
          <div className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 ${wasOfflineSale ? 'bg-amber-100' : 'bg-green-100'}`}>
            {wasOfflineSale
              ? <WifiOff className="h-10 w-10 text-amber-600" />
              : <CheckCircle2 className="h-10 w-10 text-green-600" />}
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {wasOfflineSale ? 'Vente enregistrée hors-ligne' : 'Vente enregistrée !'}
          </h3>
          {wasOfflineSale ? (
            <p className="text-sm text-gray-500 px-2">
              Vente enregistrée localement, elle sera confirmée dans le système dès le retour de la connexion. Le ticket imprimé maintenant porte un numéro provisoire.
            </p>
          ) : (
            lastReceiptData && <p className="text-sm text-gray-500 font-mono">N° {lastReceiptData.invoiceNumber}</p>
          )}
          {lastReceiptData && (
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => generateThermalReceipt(lastReceiptData, 58)}>
                Ticket 58mm
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => generateThermalReceipt(lastReceiptData, 80)}>
                Ticket 80mm
              </Button>
            </div>
          )}
          <Button onClick={onClose} className="mt-3 w-full bg-primary-600 hover:bg-primary-700 h-12 text-lg font-bold">
            Nouvelle vente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
