import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ProductVariant } from '@/lib/db';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpFromLine, Plus, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const REASONS = ['Rusak', 'Hilang', 'Kadaluarsa', 'Retur ke Supplier', 'Pemakaian Sendiri', 'Lainnya'];

export default function StockOutPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [variantId, setVariantId] = useState<string>('');
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);

  const stockOuts = useLiveQuery(() => db.stockOuts.orderBy('date').reverse().toArray());
  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());

  const getProductName = (pid: number) => products?.find(p => p.id === pid)?.name ?? '-';
  const selectedProduct = products?.find(p => p.id === Number(productId));
  const selectedVariant = productVariants.find(v => v.id === Number(variantId));
  const currentStock = selectedVariant ? selectedVariant.stock : (selectedProduct?.stock ?? 0);

  const openAdd = () => {
    setProductId(''); setVariantId(''); setQuantity(''); setReason(''); setNotes('');
    setProductVariants([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const qty = Number(quantity);
    if (!productId || qty <= 0 || !reason) {
      toast.error('Lengkapi semua field');
      return;
    }

    const product = products?.find(p => p.id === Number(productId));
    if (!product) return;

    if (product.hasVariants === 1 && !variantId) {
      toast.error('Pilih varian produk');
      return;
    }

    const variant = productVariants.find(v => v.id === Number(variantId));
    const stockToCheck = variant ? variant.stock : product.stock;

    if (qty > stockToCheck) {
      toast.error('Jumlah melebihi stok yang tersedia');
      return;
    }

    await db.stockOuts.add({
      productId: Number(productId),
      quantity: qty,
      reason,
      date: new Date(),
      notes: notes.trim(),
      variantId: variant?.id,
      variantName: variant?.name,
    });

    if (variant) {
      await db.productVariants.update(variant.id!, {
        stock: variant.stock - qty,
      });
      toast.success(`Stok ${product.name} (${variant.name}) berkurang ${qty}`);
    } else {
      await db.products.update(product.id!, {
        stock: product.stock - qty,
        updatedAt: new Date(),
      });
      toast.success(`Stok ${product.name} berkurang ${qty}`);
    }

    setDialogOpen(false);
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-destructive" />
            Stock Out
          </h1>
        </div>
        <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
          <Plus className="w-4 h-4" /> Tambah
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{stockOuts?.length ?? 0} catatan</p>

      {(!stockOuts || stockOuts.length === 0) ? (
        <div className="text-center py-12">
          <ArrowUpFromLine className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Belum ada data stock out</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stockOuts.map(so => (
            <Card key={so.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {getProductName(so.productId)}
                      {so.variantName && <span className="text-primary ml-1">({so.variantName})</span>}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded">-{so.quantity}</span>
                      <span className="text-xs text-muted-foreground">{so.reason}</span>
                    </div>
                    {so.notes && <p className="text-xs text-muted-foreground mt-1 italic">{so.notes}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(so.date), 'dd MMM yy', { locale: id })}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>Tambah Stock Out</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Produk *</Label>
              <Select value={productId} onValueChange={async (val) => {
                setProductId(val);
                setVariantId('');
                const p = products?.find(p => p.id === Number(val));
                if (p?.hasVariants === 1) {
                  const vars = await db.productVariants.where('productId').equals(Number(val)).toArray();
                  setProductVariants(vars);
                } else {
                  setProductVariants([]);
                }
              }}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {productVariants.length > 0 && (
              <div className="space-y-1.5">
                <Label>Varian *</Label>
                <Select value={variantId} onValueChange={setVariantId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Pilih varian" /></SelectTrigger>
                  <SelectContent>
                    {productVariants.map(v => (
                      <SelectItem key={v.id} value={v.id!.toString()}>{v.name} (stok: {v.stock})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jumlah *</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1" className="h-11" max={currentStock} />
              </div>
              <div className="space-y-1.5">
                <Label>Alasan *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>{REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {(selectedProduct || selectedVariant) && quantity && (
              <div className="bg-muted/50 p-3 rounded-xl text-sm">
                <span className="text-muted-foreground">Stok setelah: </span>
                <span className="font-bold">{currentStock - Number(quantity)} {selectedProduct?.unit}</span>
              </div>
            )}
            <div className="space-y-1.5"><Label>Catatan</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional" className="h-11" /></div>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave}>Simpan Stock Out</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
