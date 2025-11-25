"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  logInventoryUsage,
} from "@/lib/db";
import { useProjects } from "@/lib/db/hooks";
import type { InventoryItem, InventoryCategory } from "@/types";

const CATEGORIES: { value: InventoryCategory; label: string; icon: string }[] = [
  { value: "cable", label: "Cable", icon: "🔌" },
  { value: "enclosure", label: "Enclosures", icon: "📦" },
  { value: "connector", label: "Connectors", icon: "🔗" },
  { value: "splice-tray", label: "Splice Trays", icon: "📋" },
  { value: "splice-sleeve", label: "Splice Sleeves", icon: "🧪" },
  { value: "tools", label: "Tools", icon: "🔧" },
  { value: "consumables", label: "Consumables", icon: "🧴" },
  { value: "other", label: "Other", icon: "📁" },
];

export default function InventoryList() {
  const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showUsageForm, setShowUsageForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItemForUsage, setSelectedItemForUsage] = useState<InventoryItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    category: "cable" as InventoryCategory,
    name: "",
    partNumber: "",
    manufacturer: "",
    quantity: "",
    unit: "pcs",
    minStock: "",
    unitCost: "",
    location: "",
    notes: "",
  });

  // Usage form state
  const [usageQuantity, setUsageQuantity] = useState("");
  const [usageProjectId, setUsageProjectId] = useState<number | null>(null);
  const [usageNotes, setUsageNotes] = useState("");

  // Get inventory data
  const inventory = useLiveQuery(async () => {
    let items = await db.inventory.toArray();

    // Filter by category
    if (selectedCategory !== "all") {
      items = items.filter((item) => item.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.partNumber?.toLowerCase().includes(query) ||
          item.manufacturer?.toLowerCase().includes(query)
      );
    }

    return items;
  }, [selectedCategory, searchQuery]);

  // Get low stock items
  const lowStockItems = useLiveQuery(async () => {
    const items = await db.inventory.toArray();
    return items.filter((item) => item.quantity <= item.minStock);
  }, []);

  // Get projects for usage logging
  const projects = useProjects();

  // Handlers
  const handleCreateItem = async () => {
    await createInventoryItem({
      category: formData.category,
      name: formData.name,
      partNumber: formData.partNumber || undefined,
      manufacturer: formData.manufacturer || undefined,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      minStock: parseFloat(formData.minStock) || 0,
      unitCost: formData.unitCost ? parseFloat(formData.unitCost) : undefined,
      location: formData.location || undefined,
      notes: formData.notes || undefined,
    });
    resetForm();
    setShowForm(false);
  };

  const handleUpdateItem = async () => {
    if (!editingItem?.id) return;
    await updateInventoryItem(editingItem.id, {
      category: formData.category,
      name: formData.name,
      partNumber: formData.partNumber || undefined,
      manufacturer: formData.manufacturer || undefined,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      minStock: parseFloat(formData.minStock) || 0,
      unitCost: formData.unitCost ? parseFloat(formData.unitCost) : undefined,
      location: formData.location || undefined,
      notes: formData.notes || undefined,
    });
    resetForm();
    setEditingItem(null);
    setShowForm(false);
  };

  const handleDeleteItem = async (id: number) => {
    if (confirm("Delete this inventory item?")) {
      await deleteInventoryItem(id);
    }
  };

  const handleLogUsage = async () => {
    if (!selectedItemForUsage?.id || !usageProjectId) return;

    await logInventoryUsage({
      inventoryId: selectedItemForUsage.id,
      projectId: usageProjectId,
      quantity: parseFloat(usageQuantity) || 0,
      date: new Date(),
      notes: usageNotes || undefined,
    });

    setSelectedItemForUsage(null);
    setUsageQuantity("");
    setUsageProjectId(null);
    setUsageNotes("");
    setShowUsageForm(false);
  };

  const startEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      name: item.name,
      partNumber: item.partNumber || "",
      manufacturer: item.manufacturer || "",
      quantity: item.quantity.toString(),
      unit: item.unit,
      minStock: item.minStock.toString(),
      unitCost: item.unitCost?.toString() || "",
      location: item.location || "",
      notes: item.notes || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      category: "cable",
      name: "",
      partNumber: "",
      manufacturer: "",
      quantity: "",
      unit: "pcs",
      minStock: "",
      unitCost: "",
      location: "",
      notes: "",
    });
  };

  const openAddForm = () => {
    resetForm();
    setEditingItem(null);
    setShowForm(true);
  };

  const openUsageForm = (item: InventoryItem) => {
    setSelectedItemForUsage(item);
    setUsageQuantity("");
    setUsageNotes("");
    setShowUsageForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Low Stock Alert */}
      {lowStockItems && lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="font-semibold text-red-800">Low Stock Alert</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((item) => (
              <span
                key={item.id}
                className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
              >
                {item.name} ({item.quantity} {item.unit})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Inventory</h2>
          <button
            onClick={openAddForm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add Item
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedCategory === cat.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, part number, or manufacturer..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
          />
        </div>

        {/* Inventory List */}
        {inventory && inventory.length > 0 ? (
          <div className="space-y-3">
            {inventory.map((item) => {
              const isLowStock = item.quantity <= item.minStock;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border-2 ${
                    isLowStock ? "border-red-200 bg-red-50" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span>
                          {CATEGORIES.find((c) => c.value === item.category)?.icon}
                        </span>
                        <span className="font-medium text-gray-800">{item.name}</span>
                        {isLowStock && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                            Low Stock
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {item.partNumber && <span>PN: {item.partNumber} | </span>}
                        {item.manufacturer && <span>{item.manufacturer} | </span>}
                        {item.location && <span>Location: {item.location}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-800">
                          {item.quantity}
                        </div>
                        <div className="text-sm text-gray-500">{item.unit}</div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openUsageForm(item)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Log usage"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => startEdit(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id!)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? "No items match your search" : "No inventory items yet"}
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editingItem ? "Edit Item" : "Add Item"}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as InventoryCategory })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  >
                    <option value="pcs">Pieces</option>
                    <option value="meters">Meters</option>
                    <option value="feet">Feet</option>
                    <option value="rolls">Rolls</option>
                    <option value="boxes">Boxes</option>
                    <option value="bags">Bags</option>
                    <option value="sets">Sets</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  placeholder="e.g., 144F Single Mode Cable"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
                  <input
                    type="text"
                    value={formData.partNumber}
                    onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                    placeholder="Alert threshold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  placeholder="e.g., Warehouse A, Shelf 3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingItem(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingItem ? handleUpdateItem : handleCreateItem}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingItem ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Log Modal */}
      {showUsageForm && selectedItemForUsage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Log Usage</h3>

            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <div className="font-medium text-gray-800">{selectedItemForUsage.name}</div>
              <div className="text-sm text-gray-500">
                Current stock: {selectedItemForUsage.quantity} {selectedItemForUsage.unit}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <select
                  value={usageProjectId || ""}
                  onChange={(e) => setUsageProjectId(parseInt(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                >
                  <option value="">Select project...</option>
                  {projects?.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity Used ({selectedItemForUsage.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={selectedItemForUsage.quantity}
                  value={usageQuantity}
                  onChange={(e) => setUsageQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={usageNotes}
                  onChange={(e) => setUsageNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUsageForm(false);
                  setSelectedItemForUsage(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogUsage}
                disabled={!usageProjectId || !usageQuantity}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Log Usage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
