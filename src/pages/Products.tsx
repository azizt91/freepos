import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product, type Category, type ProductVariant } from '@/lib/db';
import { useState, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Package as PackageIcon, Camera, X, ScanBarcode } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-utils';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { History, Info } from 'lucide-react';

export default function Produk() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [price, setPrice] = useState('');
  const [hpp, setHpp] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [barcode, setBarcode] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<Partial<ProductVariant>[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());

  const filtered = products?.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'all' || p.categoryId === Number(filterCategory);
    return matchSearch && matchCategory;
  }) ?? [];

  const selectedHppHistory = useLiveQuery(() => 
    editProduct ? db.hppHistory.where('productId').equals(editProduct.id!).reverse().toArray() : Promise.resolve([])
  , [editProduct]);

  const getCategoryName = (catId: number) => categories?.find(c => c.id === catId)?.name ?? '-';
  const getCategoryColor = (catId: number) => categories?.find(c => c.id === catId)?.color ?? '#999';

  const openAdd = () => {
    setEditProduct(null);
    setName(''); setSku(''); setCategoryId(categories?.[0]?.id?.toString() ?? ''); setPrice(''); setHpp(''); setStock(''); setUnit('pcs'); setBarcode(''); setPhoto(undefined);
    setHasVariants(false);
    setVariants([]);
    setDialogOpen(true);
  };

  const openEdit = async (p: Product) => {
    setEditProduct(p);
    setName(p.name); setSku(p.sku); setCategoryId(p.categoryId.toString()); setPrice(p.price.toString()); setHpp(p.hpp.toString()); setStock(p.stock.toString()); setUnit(p.unit); setBarcode(p.barcode ?? ''); setPhoto(p.photo);
    setHasVariants(p.hasVariants === 1);
    
    if (p.hasVariants === 1) {
      const vars = await db.productVariants.where('productId').equals(p.id!).toArray();
      setVariants(vars);
    } else {
      setVariants([]);
    }
    
    setDialogOpen(true);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch {
      toast.error('Gagal memproses gambar');
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addVariant = () => {
    setVariants([...variants, { name: '', price: Number(price) || 0, hpp: Number(hpp) || 0, stock: 0, sku: '', barcode: '' }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const handleSave = async () => {
    if (!name.trim() || !categoryId) return;
    const data = {
      name: name.trim(),
      sku: sku.trim(),
      categoryId: Number(categoryId),
      price: Number(price) || 0,
      hpp: Number(hpp) || 0,
      stock: Number(stock) || 0,
      unit: unit.trim() || 'pcs',
      barcode: barcode.trim() || undefined,
      photo: photo || undefined,
      updatedAt: new Date(),
      hasVariants: hasVariants ? 1 : 0,
    };

    let productId: number;
    if (editProduct?.id) {
      productId = editProduct.id;
      // Record HPP history if changed manually (only for non-variant products)
      if (!hasVariants && editProduct.hpp !== Number(hpp)) {
        await db.hppHistory.add({
          productId,
          oldHpp: editProduct.hpp,
          newHpp: Number(hpp) || 0,
          source: 'manual',
          date: new Date(),
        });
      }
      await db.products.update(productId, data);
    } else {
      productId = await db.products.add({ ...data, createdAt: new Date(), isDeleted: 0, deletedAt: null } as Product) as number;
      // Record initial HPP
      if (!hasVariants) {
        await db.hppHistory.add({
          productId,
          oldHpp: 0,
          newHpp: Number(hpp) || 0,
          source: 'manual',
          date: new Date(),
        });
      }
    }

    // Handle Variants
    if (hasVariants) {
      // Get current variants to handle deletions
      const existingVariants = await db.productVariants.where('productId').equals(productId).toArray();
      const existingIds = existingVariants.map(v => v.id);
      const currentIds = variants.filter(v => v.id).map(v => v.id);
      const toDelete = existingIds.filter(id => id !== undefined && !currentIds.includes(id));

      // Delete removed variants (soft delete)
      for (const id of toDelete) {
        await db.productVariants.update(id!, { isDeleted: 1, deletedAt: new Date() });
      }

      // Save/Update current variants
      for (const v of variants) {
        const varData = {
          productId,
          name: v.name || '',
          sku: v.sku || '',
          barcode: v.barcode || undefined,
          price: Number(v.price) || 0,
          hpp: Number(v.hpp) || 0,
          stock: Number(v.stock) || 0,
          isDeleted: 0,
          deletedAt: null,
        };

        if (v.id) {
          await db.productVariants.update(v.id, varData);
        } else {
          await db.productVariants.add(varData as ProductVariant);
        }
      }
    } else {
      // If switched from variants to non-variants, soft delete all variants
      await db.productVariants.where('productId').equals(productId).modify({ isDeleted: 1, deletedAt: new Date() });
    }

    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await db.products.update(deleteId, { isDeleted: 1, deletedAt: new Date() });
      setDeleteId(null);
    }
  };

  const handleScan = (code: string) => {
    setBarcode(code);
    setScannerOpen(false);
    toast.success('Barcode berhasil dipindai');
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PackageIcon className="w-5 h-5 text-primary" />
          Produk
        </h1>
        <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
          <Plus className="w-4 h-4" />
          Tambah
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[120px] h-10">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            {categories?.map(c => (
              <SelectItem key={c.id} value={c.id!.toString()}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product count */}
      <p className="text-xs text-muted-foreground">{filtered.length} produk ditemukan</p>

      {/* Product List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <PackageIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Belum ada produk</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Tambah Produk
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Product thumbnail */}
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {p.photo ? (
                      <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <PackageIcon className="w-5 h-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                      <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: getCategoryColor(p.categoryId), color: getCategoryColor(p.categoryId) }}>
                        {getCategoryName(p.categoryId)}
                      </Badge>
                      {p.hasVariants === 1 && (
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          Varian
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">SKU: {p.sku || '-'}</p>
                    {p.hasVariants === 0 ? (
                      <>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-sm font-bold text-primary">Rp {p.price.toLocaleString('id-ID')}</span>
                          <span className="text-xs text-muted-foreground">HPP: Rp {p.hpp.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', p.stock <= 5 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
                            Stok: {p.stock} {p.unit}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="mt-1.5">
                        <p className="text-[10px] text-muted-foreground">Kelola stok & harga per varian</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id!)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Photo picker */}
            <div className="space-y-1.5">
              <Label>Foto Produk</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photo ? (
                    <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {photo ? 'Ganti Foto' : 'Pilih Foto'}
                  </Button>
                  {photo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive gap-1.5"
                      onClick={() => setPhoto(undefined)}
                    >
                      <X className="w-3.5 h-3.5" />
                      Hapus Foto
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nama Produk *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Nasi Goreng" className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="NG001" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Kategori *</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id!.toString()}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-b">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Gunakan Varian</Label>
                <p className="text-[10px] text-muted-foreground">Aktifkan jika produk memiliki ukuran/warna berbeda</p>
              </div>
              <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
            </div>

            {!hasVariants ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Harga Jual *</Label>
                    <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="15000" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>HPP (Modal)</Label>
                      {editProduct && (
                        <button type="button" onClick={() => setHistoryOpen(true)} className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                          <History className="w-3 h-3" /> Riwayat
                        </button>
                      )}
                    </div>
                    <Input type="number" value={hpp} onChange={e => setHpp(e.target.value)} placeholder="10000" className="h-11" />
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" /> Koreksi jika HPP otomatis salah
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Stok Awal</Label>
                    <Input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Satuan</Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['pcs', 'kg', 'gram', 'liter', 'ml', 'porsi', 'cup', 'botol', 'bungkus'].map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Barcode</Label>
                  <div className="flex gap-2">
                    <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Opsional" className="h-11" />
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setScannerOpen(true)}>
                      <ScanBarcode className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daftar Varian</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addVariant} className="h-7 text-[10px] gap-1">
                    <Plus className="w-3 h-3" /> Tambah Varian
                  </Button>
                </div>
                
                {variants.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed rounded-xl">
                    <p className="text-xs text-muted-foreground">Belum ada varian. Klik tambah.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {variants.map((v, i) => (
                      <Card key={i} className="border shadow-none overflow-hidden">
                        <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
                          <span className="text-[10px] font-bold text-muted-foreground">VARIAN #{i + 1}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeVariant(i)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        <CardContent className="p-3 space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nama Varian (Contoh: Merah, S)</Label>
                            <Input value={v.name} onChange={e => updateVariant(i, 'name', e.target.value)} placeholder="Nama" className="h-9 text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Harga Jual</Label>
                              <Input type="number" value={v.price} onChange={e => updateVariant(i, 'price', e.target.value)} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">HPP (Modal)</Label>
                              <Input type="number" value={v.hpp} onChange={e => updateVariant(i, 'hpp', e.target.value)} className="h-9 text-sm" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Stok</Label>
                              <Input type="number" value={v.stock} onChange={e => updateVariant(i, 'stock', e.target.value)} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">SKU</Label>
                              <Input value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)} className="h-9 text-sm" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Barcode</Label>
                            <Input value={v.barcode} onChange={e => updateVariant(i, 'barcode', e.target.value)} className="h-9 text-sm" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave} disabled={!name.trim() || !categoryId}>
              {editProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
            <AlertDialogDescription>Produk yang dihapus tidak bisa dikembalikan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      {/* HPP History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-[90vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <History className="w-4 h-4" /> Riwayat HPP: {editProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 max-h-[60vh] overflow-y-auto pr-1">
            {selectedHppHistory?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Belum ada riwayat perubahan HPP</p>
            ) : (
              selectedHppHistory?.map(h => (
                <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                  <div>
                    <p className="text-xs font-semibold">Rp {h.newHpp.toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {h.source === 'stock_in' ? 'Otomatis (Stok Masuk)' : 'Koreksi Manual'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground italic">Sebelumnya: Rp {h.oldHpp.toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(h.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button variant="outline" className="w-full h-10 mt-2" onClick={() => setHistoryOpen(false)}>Tutup</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
