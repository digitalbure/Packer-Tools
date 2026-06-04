import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { Project, UserProfile, BuildItem } from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  DollarSign,
  TrendingUp,
  PieChart,
  BarChart3,
  Plus,
  Trash2,
  Receipt,
  Truck,
  Calculator,
  ArrowUpRight,
  Target,
  History,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

interface ProjectCost {
  id: string;
  projectId: string;
  name: string;
  amount: number;
  category: "gear" | "labor" | "travel" | "shipping" | "contingency" | "other";
  status: "estimated" | "actual" | "invoiced" | "paid";
  date: string;
}

interface CostWidgetProps {
  project: Project;
  user: UserProfile;
  items?: any[];
}

export default function CostWidget({
  project,
  user,
  items: passedItems,
}: CostWidgetProps) {
  const [costs, setCosts] = useState<ProjectCost[]>([]);
  const [buildItems, setBuildItems] = useState<BuildItem[]>([]);
  const [budget, setBudget] = useState(10000); // Default placeholder
  const [isAdding, setIsAdding] = useState(false);
  const [newCost, setNewCost] = useState<Partial<ProjectCost>>({
    name: "",
    amount: 0,
    category: "other",
    status: "estimated",
  });

  // Dynamic Resource calculations from actual packing lists associated with this project
  const [listItems, setListItems] = useState<any[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [taxRate, setTaxRate] = useState(0.08); // Customizable tax rate
  const [shippingRatePerUnit, setShippingRatePerUnit] = useState(2.25); // Shipping weight rate ($2.25 per lb/kg equivalent)

  useEffect(() => {
    // Project specific costs
    const q = query(
      collection(db, "projectCosts"),
      where("projectId", "==", project.id),
      where("ownerId", "==", user.uid),
    );
    const unsubCosts = onSnapshot(q, (snap) => {
      setCosts(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProjectCost),
      );
    });

    if (passedItems) {
      setBuildItems(passedItems);
      return () => {
        unsubCosts();
      };
    }

    // Sandbox items for auto-calculation
    const qBuild = query(
      collection(db, "buildItems"),
      where("projectId", "==", project.id),
      where("ownerId", "==", user.uid),
    );
    const unsubBuild = onSnapshot(qBuild, (snap) => {
      setBuildItems(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BuildItem),
      );
    });

    return () => {
      unsubCosts();
      unsubBuild();
    };
  }, [project.id, user.uid, passedItems]);

  // Unified loader to pull all packing items across all lists referencing this project
  useEffect(() => {
    if (!project.listIds || project.listIds.length === 0) {
      setListItems([]);
      return;
    }

    setIsLoadingLists(true);
    let active = true;

    const fetchAllListItems = async () => {
      try {
        const itemPromises = project.listIds.map(async (listId) => {
          const itemsSnap = await getDocs(
            collection(db, "packingLists", listId, "items"),
          );
          return itemsSnap.docs.map((doc) => ({
            id: doc.id,
            listId,
            ...doc.data(),
          }));
        });

        const allResults = await Promise.all(itemPromises);
        const unifiedItems = allResults.flat();

        if (active) {
          setListItems(unifiedItems);
        }
      } catch (err) {
        console.error(
          "Error loading packing list resources for Cost Estimator:",
          err,
        );
      } finally {
        if (active) {
          setIsLoadingLists(false);
        }
      }
    };

    fetchAllListItems();

    return () => {
      active = false;
    };
  }, [project.listIds]);

  // Weight parsing & normalization
  const getWeightInKg = (item: any) => {
    const w = parseFloat(item.weight) || 0;
    const unit = (item.weightUnit || "kg").toLowerCase();
    if (unit === "g") return w / 1000;
    if (unit === "lb" || unit === "lbs") return w * 0.453592;
    if (unit === "oz") return w * 0.0283495;
    return w; // default kg
  };

  const totalWeightKg = listItems.reduce(
    (sum, item) => sum + getWeightInKg(item),
    0,
  );

  // Real equipment logistic costs calculation: baseline handling fee ($50) plus proportional shipping weight rate
  const calculatedShippingCost =
    listItems.length > 0
      ? Math.max(
          25,
          Number((50 + totalWeightKg * shippingRatePerUnit).toFixed(2)),
        )
      : 0;

  // Real gear replacement value summation from active packing lists items value
  const totalGearItemsValue = listItems.reduce(
    (sum, item) => sum + (parseFloat(item.price || item.replacementCost) || 0),
    0,
  );

  const totalEstimated =
    costs.reduce(
      (sum, c) => sum + (c.status === "estimated" ? c.amount : 0),
      0,
    ) +
    buildItems.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0) +
    totalGearItemsValue +
    calculatedShippingCost;

  const totalActual = costs.reduce(
    (sum, c) => sum + (c.status !== "estimated" ? c.amount : 0),
    0,
  );
  const totalProjected = totalEstimated + totalActual;

  const handleAddCost = async (data: Partial<ProjectCost>) => {
    try {
      await addDoc(collection(db, "projectCosts"), {
        ...data,
        projectId: project.id,
        ownerId: user.uid,
        date: new Date().toISOString(),
      });
      toast.success("Cost entry recorded");
    } catch (e) {
      toast.error("Failed to add cost entry");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "projectCosts", id));
      toast.success("Entry removed");
    } catch (e) {
      toast.error("Failed to remove entry");
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black uppercase tracking-tighter">
              Financial Analysis
            </h3>
            <span className="font-mono text-[9px] text-[#ff4f3a] bg-[#ff4f3a]/10 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
              v1.2.0
            </span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
            Total project spend and budget tracking
          </p>
        </div>
        <div className="flex bg-neutral-100 p-1 rounded-2xl">
          <button className="px-4 py-2 bg-white text-primary text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm transition">
            Report
          </button>
          <button className="px-4 py-2 text-neutral-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:text-neutral-600 transition">
            Forecast
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-neutral-900 rounded-[2.5rem] p-8 text-white space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <DollarSign size={20} className="text-primary" />
            </div>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">
              Total Projected
            </p>
            <h4 className="text-3xl font-black tracking-tighter">
              ${totalProjected.toLocaleString()}
            </h4>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center text-primary">
              <Target size={20} />
            </div>
            <span className="text-[9px] font-black text-neutral-300 uppercase tracking-widest">
              v{project.version || 1}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-neutral-400 text-[9px] font-black uppercase tracking-widest">
              Active Budget
            </p>
            <div className="flex items-baseline gap-2">
              <h4 className="text-3xl font-black tracking-tighter text-primary">
                ${budget.toLocaleString()}
              </h4>
              <button
                onClick={() => setBudget((b) => b + 5000)}
                className="text-neutral-300 hover:text-primary transition"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center text-emerald-500">
              <Receipt size={20} />
            </div>
            <ArrowUpRight size={16} className="text-emerald-500" />
          </div>
          <div className="space-y-1">
            <p className="text-neutral-400 text-[9px] font-black uppercase tracking-widest">
              Actual Spend
            </p>
            <h4 className="text-3xl font-black tracking-tighter text-emerald-600">
              ${totalActual.toLocaleString()}
            </h4>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center text-primary">
              <PieChart size={20} />
            </div>
            <div
              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${totalProjected > budget ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-500"}`}
            >
              {Math.round((totalProjected / budget) * 100)}% Used
            </div>
          </div>
          <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${totalProjected > budget ? "bg-red-500" : "bg-primary"}`}
              style={{
                width: `${Math.min(100, (totalProjected / budget) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400">
              Ledger Exports
            </h4>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[9px] hover:scale-105 transition"
            >
              <Plus size={14} />
              <span>New Entry</span>
            </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50/50">
                  <th className="px-8 py-6 text-[9px] font-black uppercase tracking-widest text-neutral-400">
                    Entry
                  </th>
                  <th className="px-8 py-6 text-[9px] font-black uppercase tracking-widest text-neutral-400">
                    Category
                  </th>
                  <th className="px-8 py-6 text-[9px] font-black uppercase tracking-widest text-neutral-400">
                    Status
                  </th>
                  <th className="px-8 py-6 text-[9px] font-black uppercase tracking-widest text-neutral-400 text-right">
                    Amount
                  </th>
                  <th className="px-8 py-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {costs.map((c) => (
                  <tr
                    key={c.id}
                    className="group hover:bg-neutral-50/50 transition"
                  >
                    <td className="px-8 py-5">
                      <div className="font-bold text-sm">{c.name}</div>
                      <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-tight">
                        {new Date(c.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-neutral-100 rounded-full text-[9px] font-black uppercase tracking-widest text-neutral-500">
                        {c.category}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          c.status === "paid"
                            ? "bg-emerald-50 text-emerald-500"
                            : c.status === "actual"
                              ? "bg-blue-50 text-blue-500"
                              : "bg-neutral-100 text-neutral-400"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right font-black font-mono text-sm">
                      ${c.amount.toLocaleString()}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-2 text-neutral-200 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {listItems.length > 0 && (
                  <tr className="bg-neutral-50/70 border-t border-neutral-100">
                    <td className="px-8 py-5">
                      <div className="font-bold text-sm text-neutral-800">
                        Physical Equipment Inventory
                      </div>
                      <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-tight">
                        Active items value from {project.listIds?.length || 0} lists
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-neutral-100 rounded-full text-[9px] font-black uppercase tracking-widest text-neutral-500">
                        Gear Resource
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                        Calculated
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right font-black font-mono text-sm text-neutral-800">
                      ${totalGearItemsValue.toLocaleString()}
                    </td>
                    <td className="px-8 py-5"></td>
                  </tr>
                )}
                {calculatedShippingCost > 0 && (
                  <tr className="bg-neutral-50/70">
                    <td className="px-8 py-5">
                      <div className="font-bold text-sm text-neutral-800">
                        Dynamic Equipment Cargo Shipping
                      </div>
                      <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-tight">
                        Estimated from total weight: {totalWeightKg.toFixed(2)} kg
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-neutral-100 rounded-full text-[9px] font-black uppercase tracking-widest text-neutral-500">
                        Freight
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                        Estimator
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right font-black font-mono text-sm text-neutral-800">
                      ${calculatedShippingCost.toLocaleString()}
                    </td>
                    <td className="px-8 py-5"></td>
                  </tr>
                )}
                {buildItems.length > 0 && (
                  <tr className="bg-amber-50/30">
                    <td
                      className="px-8 py-5 italic text-[10px] text-amber-600 font-bold uppercase"
                      colSpan={3}
                    >
                      Sandbox Projections ({buildItems.length} items)
                    </td>
                    <td className="px-8 py-5 text-right font-black font-mono text-sm text-amber-600">
                      $
                      {buildItems
                        .reduce(
                          (s, i) => s + (i.price || 0) * (i.quantity || 1),
                          0,
                        )
                        .toLocaleString()}
                    </td>
                    <td className="px-8 py-5"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-neutral-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3">
              <Calculator className="text-primary" />
              <h4 className="font-black uppercase tracking-tighter italic">
                Optimizer
              </h4>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                  Avg Cost / Component
                </p>
                <p className="text-xl font-bold font-mono">
                  $
                  {(
                    totalProjected /
                    ((buildItems.length || 0) + (listItems.length || 0) || 1)
                  ).toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                <div className="flex flex-col gap-2 pb-2 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                      Tax Provision ({(taxRate * 100).toFixed(0)}%)
                    </p>
                    <p className="text-sm font-bold font-mono text-emerald-400">
                      ${(totalProjected * taxRate).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.01"
                      max="0.25"
                      step="0.01"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                    <span className="text-[8px] font-mono font-bold text-neutral-400">
                      Rate
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                        Freight Shipping
                      </p>
                      <p className="text-[8px] text-neutral-400 italic">
                        Rate: ${shippingRatePerUnit}/kg
                      </p>
                    </div>
                    <p className="text-sm font-bold font-mono text-emerald-400">
                      ${calculatedShippingCost.toLocaleString()}
                    </p>
                  </div>
                  {listItems.length > 0 && (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.5"
                        max="10.0"
                        step="0.25"
                        value={shippingRatePerUnit}
                        onChange={(e) =>
                          setShippingRatePerUnit(parseFloat(e.target.value))
                        }
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                      <span className="text-[8px] font-mono font-bold text-neutral-400">
                        Adjust
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary/10 rounded-[2.5rem] p-8 border border-primary/20 space-y-4">
            <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-tighter">
              <BarChart3 size={18} />
              <span>Plan Requirement</span>
            </div>
            <p className="text-[10px] font-bold text-primary/60 leading-relaxed uppercase tracking-widest">
              Advanced financial modeling is active for your account. Export
              high-resolution CSVs for accounting sync.
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 shadow-2xl space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black uppercase tracking-tighter">
                  Record Cost
                </h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">
                    Entry Name
                  </label>
                  <input
                    value={newCost.name}
                    onChange={(e) =>
                      setNewCost({ ...newCost, name: e.target.value })
                    }
                    placeholder="e.g. VENUE DEPOSIT"
                    className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      value={newCost.amount}
                      onChange={(e) =>
                        setNewCost({
                          ...newCost,
                          amount: Number(e.target.value),
                        })
                      }
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">
                      Category
                    </label>
                    <select
                      value={newCost.category}
                      onChange={(e) =>
                        setNewCost({
                          ...newCost,
                          category: e.target.value as any,
                        })
                      }
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none"
                    >
                      <option value="gear">Gear</option>
                      <option value="labor">Labor</option>
                      <option value="travel">Travel</option>
                      <option value="shipping">Shipping</option>
                      <option value="contingency">Contingency</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">
                    Status
                  </label>
                  <select
                    value={newCost.status}
                    onChange={(e) =>
                      setNewCost({ ...newCost, status: e.target.value as any })
                    }
                    className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none"
                  >
                    <option value="estimated">Estimated</option>
                    <option value="actual">Actual (Incurred)</option>
                    <option value="invoiced">Invoiced</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  handleAddCost(newCost);
                  setIsAdding(false);
                }}
                className="w-full py-5 bg-neutral-900 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition"
              >
                Log Entry
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const X = ({ size, className }: { size: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
