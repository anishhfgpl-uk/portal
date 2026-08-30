import React, { useState, useRef } from 'react';
import {
  Package,
  Search,
  Plus,
  ArrowDownToLine,
  FileCode,
  Upload,
  Trash2,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { StockItem } from '../types';
import { generateTallyStockItemXML, parseStockItemsXML } from '../services/tallyService';

interface ItemMasterViewProps {
  stockItems: StockItem[];
  onAddItem: (item: StockItem) => void;
  onUpdateItem: (item: StockItem) => void;
  onDeleteItem: (id: string) => void;
  onImportFromTally: () => void;
  onOpenXmlPaste: () => void;
  onLoadSampleItems: () => void;
  isImporting: boolean;
}

export const ItemMasterView: React.FC<ItemMasterViewProps> = ({
  stockItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onImportFromTally,
  onOpenXmlPaste,
  onLoadSampleItems,
  isImporting,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formHsn, setFormHsn] = useState('');
  const [formGst, setFormGst] = useState<number>(18);
  const [formUnit, setFormUnit] = useState('Nos');
  const [formRate, setFormRate] = useState<number>(0);
  const [formDesc, setFormDesc] = useState('');

  const filteredItems = stockItems.filter((item) => {
    return (
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.hsn && item.hsn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.unit && item.unit.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormHsn('');
    setFormGst(18);
    setFormUnit('Nos');
    setFormRate(0);
    setFormDesc('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: StockItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormHsn(item.hsn || '');
    setFormGst(Number(item.gst) || 18);
    setFormUnit(item.unit || 'Nos');
    setFormRate(item.rate || 0);
    setFormDesc(item.description || '');
    setIsModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingItem) {
      const updated: StockItem = {
        ...editingItem,
        name: formName.trim(),
        hsn: formHsn.trim(),
        gst: formGst,
        unit: formUnit,
        rate: formRate,
        description: formDesc.trim(),
      };
      onUpdateItem(updated);
    } else {
      const newItem: StockItem = {
        id: `item-${Date.now()}`,
        name: formName.trim(),
        hsn: formHsn.trim(),
        gst: formGst,
        unit: formUnit,
        rate: formRate,
        description: formDesc.trim(),
      };
      onAddItem(newItem);
    }
    setIsModalOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseStockItemsXML(text);
        if (parsed.length > 0) {
          parsed.forEach((item) => onAddItem(item));
          alert(`✅ Successfully imported ${parsed.length} stock items from XML file!`);
        } else {
          alert('No Stock Items found in the uploaded XML file.');
        }
      } catch (err: any) {
        alert(`XML Parse Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleExportItemXml = (item: StockItem) => {
    const xml = generateTallyStockItemXML(item);
    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tally_Item_${item.name.replace(/[^a-zA-Z0-9]/g, '_')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span>Stock Items & Services Catalog</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {stockItems.length} inventory products & services available for billing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Load Sample Items */}
          <button
            onClick={onLoadSampleItems}
            className="flex items-center space-x-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Load Sample Items</span>
          </button>

          {/* Import from Tally Direct */}
          <button
            onClick={onImportFromTally}
            disabled={isImporting}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <ArrowDownToLine className={`w-3.5 h-3.5 ${isImporting ? 'animate-bounce' : ''}`} />
            <span>{isImporting ? 'Reading Tally...' : '📥 Import From Tally'}</span>
          </button>

          {/* Upload XML */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Tally XML</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xml"
            className="hidden"
          />

          {/* Add New Item */}
          <button
            onClick={openAddModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by stock item name, HSN code, or unit..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-700">No Stock Items Found</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Import Stock Items from Tally Prime using the "Import From Tally" button or add items manually.
            </p>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
            >
              Add Item Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Item Name / Description</th>
                  <th className="py-3 px-3">HSN / SAC</th>
                  <th className="py-3 px-3">GST Rate</th>
                  <th className="py-3 px-3">Base Unit</th>
                  <th className="py-3 px-3 text-right">Standard Rate (₹)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{item.name}</div>
                      {item.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.description}</div>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                      {item.hsn || <span className="text-slate-400 font-normal italic">N/A</span>}
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {item.gst}% GST
                      </span>
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {item.unit || 'Nos'}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                      {item.rate ? `₹${item.rate.toLocaleString('en-IN')}` : '-'}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleExportItemXml(item)}
                          title="Export Tally Stock Item XML"
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                        >
                          <FileCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          title="Edit Item"
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          title="Delete Item"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Stock Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingItem ? 'Edit Stock Item' : 'Add New Stock Item'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dell 24 inch IPS Monitor"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    value={formHsn}
                    onChange={(e) => setFormHsn(e.target.value)}
                    placeholder="e.g. 85285200"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    GST Rate (%)
                  </label>
                  <select
                    value={formGst}
                    onChange={(e) => setFormGst(parseFloat(e.target.value) || 18)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                  >
                    <option value="0">0% (Nil Rated / Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Base Unit
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                  >
                    <option value="Nos">Nos (Numbers)</option>
                    <option value="Pcs">Pcs (Pieces)</option>
                    <option value="Box">Box</option>
                    <option value="Kg">Kg (Kilograms)</option>
                    <option value="Mtr">Mtr (Meters)</option>
                    <option value="Roll">Roll</option>
                    <option value="Set">Set</option>
                    <option value="Ltr">Ltr (Litres)</option>
                    <option value="Pack">Pack</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Default Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formRate || ''}
                    onChange={(e) => setFormRate(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Description / Specifications
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Optional item details..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
