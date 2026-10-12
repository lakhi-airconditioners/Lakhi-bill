import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  MapPin,
  Phone,
  CheckCircle2,
  Navigation,
  Clock,
  Send,
  MessageSquare,
  FileText,
  Link as LinkIcon,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
  Building,
  User,
  Copy,
  Edit2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Shipment, ShipmentStatus, Invoice, Customer } from '../../types';
import { generateInvoicePdf } from '../../utils/pdfGenerator';
import { PdfPreviewModal } from '../common/PdfPreviewModal';
import { CustomerModal } from '../common/CustomerModal';
import { CustomerSelectBox } from '../common/CustomerSelectBox';

interface ShipmentTrackerProps {
  initialInvoiceToShip?: Invoice | null;
  onClearInitialInvoice?: () => void;
}

const STAGES: { status: ShipmentStatus; stepNumber: number; title: string; subtitle: string; color: string }[] = [
  { status: 'ORDER_PLACED', stepNumber: 1, title: 'Order Placed', subtitle: 'Sourcing registered', color: 'blue' },
  { status: 'ORDER_CONFIRMED', stepNumber: 2, title: 'Order Confirmed', subtitle: 'Stock reserved', color: 'indigo' },
  { status: 'IN_TRANSIT', stepNumber: 3, title: 'In Transit', subtitle: 'En route to store', color: 'amber' },
  { status: 'ARRIVED_AT_STORE', stepNumber: 4, title: 'Arrived at Store', subtitle: 'Received & inspected', color: 'purple' },
  { status: 'OUT_FOR_DELIVERY', stepNumber: 5, title: 'Out for Delivery', subtitle: 'Driver dispatched', color: 'rose' },
  { status: 'DELIVERED_INSTALLED', stepNumber: 6, title: 'Delivered & Installed', subtitle: 'Setup verified', color: 'emerald' },
];

export const ShipmentTracker: React.FC<ShipmentTrackerProps> = ({
  initialInvoiceToShip,
  onClearInitialInvoice,
}) => {
  const {
    shipments,
    invoices,
    customers,
    addShipment,
    addShipmentTrackingUpdate,
    updateShipmentStatus,
    linkInvoicesToShipment,
  } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(!!initialInvoiceToShip);

  // Status & Tracking Update Modal
  const [selectedShipmentForUpdate, setSelectedShipmentForUpdate] = useState<Shipment | null>(null);
  const [newUpdateMessage, setNewUpdateMessage] = useState('');
  const [newUpdateLocation, setNewUpdateLocation] = useState('');
  const [newUpdateTimestamp, setNewUpdateTimestamp] = useState('');
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);

  // Link Invoices Later Modal State
  const [selectedShipmentForLinking, setSelectedShipmentForLinking] = useState<Shipment | null>(null);
  const [linkedInvoicesDraft, setLinkedInvoicesDraft] = useState<string[]>([]);
  const [customInvoiceIdInput, setCustomInvoiceIdInput] = useState('');
  const [isLinkingInvoices, setIsLinkingInvoices] = useState(false);

  // Status Change State
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editStatus, setEditStatus] = useState<ShipmentStatus>('ORDER_PLACED');
  const [editStatusTimestamp, setEditStatusTimestamp] = useState('');
  const [editOutForDelivery, setEditOutForDelivery] = useState(false);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editStoreContactPhone, setEditStoreContactPhone] = useState('+91 99980 21446');
  const [editCustomNote, setEditCustomNote] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // Create Form State
  const [formCustomerId, setFormCustomerId] = useState(initialInvoiceToShip?.customerId || '');
  const [formCustomerName, setFormCustomerName] = useState(initialInvoiceToShip?.customerExternalName || '');
  const [formCustomerPhone, setFormCustomerPhone] = useState(initialInvoiceToShip?.customerPhone || '');
  const [formSelectedInvoiceIds, setFormSelectedInvoiceIds] = useState<string[]>(
    initialInvoiceToShip ? [initialInvoiceToShip.id] : []
  );
  const [formBillingAddress, setFormBillingAddress] = useState(initialInvoiceToShip?.billingAddress || '');
  const [formInstallationAddress, setFormInstallationAddress] = useState(
    initialInvoiceToShip?.installationAddress || initialInvoiceToShip?.billingAddress || ''
  );
  const [formItemsSummary, setFormItemsSummary] = useState(
    initialInvoiceToShip
      ? initialInvoiceToShip.items.map((it) => `${it.quantity}x ${it.name || it.type} (${it.modelNo || 'Std'})`).join(', ')
      : ''
  );
  const [formOutForDelivery, setFormOutForDelivery] = useState(false);
  const [formDriverName, setFormDriverName] = useState('');
  const [formDriverPhone, setFormDriverPhone] = useState('');
  const [formStoreContactPhone, setFormStoreContactPhone] = useState('+91 99980 21446');
  const [formLiveRoute, setFormLiveRoute] = useState('');
  const [formCustomIdText, setFormCustomIdText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add / Edit Customer Modal State from Select Customer
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEditModal, setCustomerToEditModal] = useState<Customer | null>(null);
  const [customerModalInitialQuery, setCustomerModalInitialQuery] = useState('');

  // Invoice PDF View Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfFilename, setPreviewPdfFilename] = useState('');
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleSelectCustomer = (custId: string) => {
    setFormCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setFormCustomerName(found.externalName);
      setFormCustomerPhone(found.phone);
      setFormBillingAddress(found.billingAddress || '');
      setFormInstallationAddress(found.installationAddress || found.billingAddress || '');
    }
  };

  const handleToggleInvoiceSelection = (invId: string) => {
    setFormSelectedInvoiceIds((prev) => {
      const exists = prev.includes(invId);
      const next = exists ? prev.filter((id) => id !== invId) : [...prev, invId];
      if (!exists) {
        const found = invoices.find((i) => i.id === invId);
        if (found) {
          if (!formCustomerId || formCustomerId === 'WALK-IN') {
            setFormCustomerId(found.customerId);
            setFormCustomerName(found.customerExternalName);
            setFormCustomerPhone(found.customerPhone);
            setFormBillingAddress(found.billingAddress || '');
            setFormInstallationAddress(found.installationAddress || found.billingAddress || '');
          }
          if (!formItemsSummary) {
            setFormItemsSummary(
              found.items.map((it) => `${it.quantity}x ${it.name || it.type} (${it.modelNo || 'Std'})`).join(', ')
            );
          }
        }
      }
      return next;
    });
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addShipment(
        {
          customerId: formCustomerId || 'WALK-IN',
          customerExternalName: formCustomerName || 'Customer Walk-In',
          customerPhone: formCustomerPhone || '',
          billingAddress: formBillingAddress,
          deliveryAddress: formInstallationAddress || formBillingAddress || 'Store Pickup',
          installationAddress: formInstallationAddress,
          itemsSummary: formItemsSummary || 'Appliance Delivery & Installation',
          invoiceId: formSelectedInvoiceIds[0] || undefined,
          invoiceIds: formSelectedInvoiceIds,
          outForDeliveryEnabled: formOutForDelivery,
          driverName: formDriverName,
          driverPhone: formDriverPhone,
          storeContactPhone: formStoreContactPhone,
          liveRouteLink: formLiveRoute,
        },
        formCustomIdText || undefined
      );

      setIsCreateOpen(false);
      setFormCustomerId('');
      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormSelectedInvoiceIds([]);
      setFormBillingAddress('');
      setFormInstallationAddress('');
      setFormItemsSummary('');
      setFormDriverName('');
      setFormDriverPhone('');
      setFormLiveRoute('');
      setFormCustomIdText('');
      if (onClearInitialInvoice) onClearInitialInvoice();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Advance Status Handler
  const handleQuickAdvance = async (shipment: Shipment) => {
    const currentIndex = STAGES.findIndex((s) => s.status === shipment.status);
    if (currentIndex >= 0 && currentIndex < STAGES.length - 1) {
      const nextStage = STAGES[currentIndex + 1];
      if (nextStage.status === 'OUT_FOR_DELIVERY' && (!shipment.driverName || !shipment.driverPhone)) {
        // Open edit status modal to specify driver contact info
        openEditStatusModal(shipment, 'OUT_FOR_DELIVERY');
        return;
      }
      await updateShipmentStatus(
        shipment.id,
        nextStage.status,
        nextStage.status === 'OUT_FOR_DELIVERY' ? true : shipment.outForDeliveryEnabled,
        shipment.driverName,
        shipment.driverPhone,
        shipment.storeContactPhone || '+91 99980 21446'
      );
    }
  };

  const handleFinishDelivery = async (shipment: Shipment) => {
    try {
      await updateShipmentStatus(
        shipment.id,
        'DELIVERED_INSTALLED',
        shipment.outForDeliveryEnabled,
        shipment.driverName,
        shipment.driverPhone,
        shipment.storeContactPhone || '+91 99980 21446',
        'Delivery & installation finished and completed at customer site',
        shipment.deliveryAddress
      );
    } catch (err) {
      console.error('Error completing delivery:', err);
    }
  };

  const handleStopOrReopenDelivery = async (shipment: Shipment) => {
    try {
      await updateShipmentStatus(
        shipment.id,
        'OUT_FOR_DELIVERY',
        true,
        shipment.driverName,
        shipment.driverPhone,
        shipment.storeContactPhone || '+91 99980 21446',
        'Delivery completed status stopped / reopened for ongoing follow-up',
        shipment.deliveryAddress
      );
    } catch (err) {
      console.error('Error reopening delivery:', err);
    }
  };

  const openEditStatusModal = (shipment: Shipment, targetStatus?: ShipmentStatus) => {
    setEditingShipment(shipment);
    setEditStatus(targetStatus || shipment.status);
    setEditStatusTimestamp(new Date().toISOString().slice(0, 16));
    setEditOutForDelivery(targetStatus === 'OUT_FOR_DELIVERY' ? true : shipment.outForDeliveryEnabled);
    setEditDriverName(shipment.driverName || '');
    setEditDriverPhone(shipment.driverPhone || '');
    setEditStoreContactPhone(shipment.storeContactPhone || '+91 99980 21446');
    setEditCustomNote('');
    setEditLocation(shipment.deliveryAddress || '');
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShipment) return;
    try {
      await updateShipmentStatus(
        editingShipment.id,
        editStatus,
        editStatus === 'OUT_FOR_DELIVERY' ? true : editOutForDelivery,
        editDriverName,
        editDriverPhone,
        editStoreContactPhone,
        editCustomNote.trim() || undefined,
        editLocation.trim() || undefined,
        editStatusTimestamp ? new Date(editStatusTimestamp).toISOString() : undefined
      );
      setEditingShipment(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Open Link Invoices Modal
  const openLinkInvoicesModal = (shipment: Shipment) => {
    setSelectedShipmentForLinking(shipment);
    const existing = shipment.invoiceIds && shipment.invoiceIds.length > 0
      ? shipment.invoiceIds
      : shipment.invoiceId
      ? [shipment.invoiceId]
      : [];
    setLinkedInvoicesDraft(existing);
    setCustomInvoiceIdInput('');
  };

  const handleSaveLinkedInvoices = async () => {
    if (!selectedShipmentForLinking) return;
    setIsLinkingInvoices(true);
    try {
      const allToLink = Array.from(
        new Set([
          ...linkedInvoicesDraft,
          customInvoiceIdInput.trim().toUpperCase(),
        ].filter(Boolean))
      );
      await linkInvoicesToShipment(selectedShipmentForLinking.id, allToLink);
      setSelectedShipmentForLinking(null);
      setLinkedInvoicesDraft([]);
      setCustomInvoiceIdInput('');
    } finally {
      setIsLinkingInvoices(false);
    }
  };

  const handleAddTrackingUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentForUpdate || !newUpdateMessage.trim()) return;
    setIsAddingUpdate(true);
    try {
      await addShipmentTrackingUpdate(
        selectedShipmentForUpdate.id,
        newUpdateMessage.trim(),
        newUpdateLocation.trim() || undefined,
        newUpdateTimestamp ? new Date(newUpdateTimestamp).toISOString() : undefined
      );
      setNewUpdateMessage('');
      setNewUpdateLocation('');
      setNewUpdateTimestamp('');
      const updated = shipments.find((s) => s.id === selectedShipmentForUpdate.id);
      if (updated) setSelectedShipmentForUpdate(updated);
    } finally {
      setIsAddingUpdate(false);
    }
  };

  const handleOpenInvoicePdf = (inv: Invoice) => {
    const { url, filename } = generateInvoicePdf(inv);
    setPreviewPdfUrl(url);
    setPreviewPdfFilename(filename);
    setPreviewPdfTitle(`Tax Invoice: ${inv.id}`);
    setIsPreviewOpen(true);
  };

  const filteredShipments = shipments.filter((s) => {
    const matchesSearch =
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.customerExternalName.toLowerCase().includes(search.toLowerCase()) ||
      s.customerPhone.includes(search) ||
      (s.invoiceId && s.invoiceId.toLowerCase().includes(search.toLowerCase())) ||
      (s.invoiceIds && s.invoiceIds.some((id) => id.toLowerCase().includes(search.toLowerCase()))) ||
      s.deliveryAddress.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStageBadgeColor = (status: ShipmentStatus) => {
    switch (status) {
      case 'ORDER_PLACED':
        return 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900';
      case 'ORDER_CONFIRMED':
        return 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900';
      case 'IN_TRANSIT':
        return 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900';
      case 'ARRIVED_AT_STORE':
        return 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-900';
      case 'OUT_FOR_DELIVERY':
        return 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900 animate-pulse';
      case 'DELIVERED_INSTALLED':
        return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getStageIndex = (status: ShipmentStatus) => {
    return STAGES.findIndex((s) => s.status === status);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Delivery System & Shipment Dispatch (D...)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create deliveries now and link invoice(s) later • 5-Stage Live Milestones: Order Placed → Order Confirmed → In Transit → Arrived at Store → Out for Delivery
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-red-600/30 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          + Create New Delivery
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search D-ID, linked invoice, customer, address..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All ({shipments.length})
          </button>
          {STAGES.map((stg) => (
            <button
              key={stg.status}
              onClick={() => setStatusFilter(stg.status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === stg.status
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {stg.stepNumber}. {stg.title}
            </button>
          ))}
        </div>
      </div>

      {/* Deliveries Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredShipments.length === 0 ? (
          <div className="col-span-full p-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <Truck className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">No delivery records found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create a delivery dispatch now. Invoices can be created and linked later whenever ready.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              + Create First Delivery
            </button>
          </div>
        ) : (
          filteredShipments.map((s) => {
            const currentStageIndex = getStageIndex(s.status);
            const allLinkedInvoices = Array.from(
              new Set([
                ...(s.invoiceIds || []),
                s.invoiceId ? s.invoiceId : '',
              ].filter(Boolean))
            );

            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5 flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-red-600 dark:text-red-400 text-base">
                          {s.id}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(s.id);
                            setCopiedId(s.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md"
                          title="Copy Delivery ID"
                        >
                          {copiedId === s.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
                        {s.customerExternalName}
                      </h3>
                      <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <a href={`tel:${s.customerPhone}`} className="hover:underline">
                          {s.customerPhone}
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wide ${getStageBadgeColor(
                          s.status
                        )}`}
                      >
                        {STAGES.find((st) => st.status === s.status)?.stepNumber || ''}. {s.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {s.createdAt.slice(0, 10)}
                      </span>
                    </div>
                  </div>

                  {/* 5-Stage Visual Stepper */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Delivery Milestones</span>
                      <span className="text-red-600 dark:text-red-400 font-mono">
                        Step {currentStageIndex + 1} of {STAGES.length}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-red-600 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(12, ((currentStageIndex + 1) / STAGES.length) * 100)}%`,
                        }}
                      />
                    </div>

                    {/* Stage Pills */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-1 text-center">
                      {STAGES.map((stg, idx) => {
                        const isDone = idx < currentStageIndex;
                        const isCurrent = idx === currentStageIndex;
                        return (
                          <div
                            key={stg.status}
                            onClick={() => openEditStatusModal(s, stg.status)}
                            className={`p-1.5 rounded-xl cursor-pointer transition-all text-[10px] font-bold ${
                              isCurrent
                                ? 'bg-red-600 text-white shadow-xs'
                                : isDone
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200'
                            }`}
                            title={`Click to set status to ${stg.title}`}
                          >
                            <div className="truncate">{stg.stepNumber}. {stg.title.split(' ')[0]}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* LINKED INVOICES SECTION (Can be linked later!) */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span>Linked Invoices ({allLinkedInvoices.length})</span>
                      </div>
                      <button
                        onClick={() => openLinkInvoicesModal(s)}
                        className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 hover:underline flex items-center gap-1"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        {allLinkedInvoices.length === 0 ? '+ Link Invoice(s)' : 'Manage Links'}
                      </button>
                    </div>

                    {allLinkedInvoices.length === 0 ? (
                      <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                        <span>No invoice linked yet. Click "+ Link Invoice(s)" anytime.</span>
                        <button
                          onClick={() => openLinkInvoicesModal(s)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold"
                        >
                          Link Now
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {allLinkedInvoices.map((invId) => {
                          const matchedInv = invoices.find((i) => i.id === invId);
                          return (
                            <div
                              key={invId}
                              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs flex items-center gap-2 shadow-xs"
                            >
                              <span className="font-mono font-bold text-red-600 dark:text-red-400">
                                {invId}
                              </span>
                              {matchedInv && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  ₹{matchedInv.totalAmount.toLocaleString()} ({matchedInv.paymentStatus})
                                </span>
                              )}
                              {matchedInv && (
                                <button
                                  onClick={() => handleOpenInvoicePdf(matchedInv)}
                                  className="text-slate-400 hover:text-red-600"
                                  title="View Tax Invoice PDF"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Two Address Fields Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Billing Address:
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block line-clamp-2">
                        {s.billingAddress || 'Store / Site Walk-In'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Installation / Delivery Site:
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block font-medium line-clamp-2">
                        {s.installationAddress || s.deliveryAddress}
                      </span>
                    </div>
                  </div>

                  {/* Items Description */}
                  <div className="text-xs">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                      Dispatched Items & Units:
                    </span>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      {s.itemsSummary}
                    </p>
                  </div>

                  {/* Contact Information & Out for Delivery Details */}
                  <div className="p-3.5 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/40 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-red-900 dark:text-red-300 uppercase tracking-wider flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-red-600" />
                        Contact & Driver Info
                      </span>
                      {s.storeContactPhone && (
                        <a
                          href={`tel:${s.storeContactPhone}`}
                          className="text-[11px] font-bold text-red-700 dark:text-red-400 hover:underline"
                        >
                          Store: {s.storeContactPhone}
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {s.driverName || 'Driver Not Assigned Yet'}
                          </div>
                          {s.driverPhone ? (
                            <a
                              href={`tel:${s.driverPhone}`}
                              className="text-[11px] text-red-600 dark:text-red-400 font-mono hover:underline"
                            >
                              📞 {s.driverPhone}
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No driver phone</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        {s.liveRouteLink ? (
                          <a
                            href={s.liveRouteLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            Live Maps Route
                          </a>
                        ) : (
                          <button
                            onClick={() => openEditStatusModal(s)}
                            className="text-[11px] text-slate-500 hover:text-red-600 underline font-medium"
                          >
                            + Assign Driver / Route
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Latest Milestone Update Preview */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-500 font-bold uppercase text-[10px]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-red-600" />
                        Latest Update ({s.trackingUpdates?.length || 0})
                      </span>
                      <button
                        onClick={() => setSelectedShipmentForUpdate(s)}
                        className="text-red-600 dark:text-red-400 hover:underline font-bold"
                      >
                        + Add Custom Note
                      </button>
                    </div>
                    {s.trackingUpdates && s.trackingUpdates.length > 0 ? (
                      <div className="text-slate-700 dark:text-slate-300 italic">
                        "{s.trackingUpdates[s.trackingUpdates.length - 1].message}"
                        <span className="text-slate-400 ml-1 text-[10px] font-mono not-italic">
                          ({s.trackingUpdates[s.trackingUpdates.length - 1].timestamp.slice(11, 16)})
                        </span>
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No milestone updates logged yet.</div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openLinkInvoicesModal(s)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      title="Link or Unlink Invoices"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      Invoices
                    </button>
                    <button
                      onClick={() => setSelectedShipmentForUpdate(s)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      title="Add or View Tracking Milestones"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Updates
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {s.status !== 'DELIVERED_INSTALLED' ? (
                      <button
                        onClick={() => handleFinishDelivery(s)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                        title="Finish delivery and mark as completed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Delivery Finished</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStopOrReopenDelivery(s)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                        title="Stop / unmark completed delivery and reopen"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Stop / Reopen Delivery</span>
                      </button>
                    )}
                    {currentStageIndex < STAGES.length - 1 && (
                      <button
                        onClick={() => handleQuickAdvance(s)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                        title="Advance to next tracking stage"
                      >
                        <span>Next: {STAGES[currentStageIndex + 1].title.split(' ')[0]}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openEditStatusModal(s)}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: LINK INVOICE(S) TO DELIVERY (div) LATER */}
      {selectedShipmentForLinking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-red-600" />
                  Link Invoices to Delivery {selectedShipmentForLinking.id}
                </h3>
                <p className="text-xs text-slate-500">
                  Customer: <strong>{selectedShipmentForLinking.customerExternalName}</strong> ({selectedShipmentForLinking.customerPhone})
                </p>
              </div>
              <button
                onClick={() => setSelectedShipmentForLinking(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Currently Linked Invoices List */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Currently Linked Invoices:
              </label>
              {linkedInvoicesDraft.length === 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 text-center">
                  No invoices linked yet. Select below or enter custom ID.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {linkedInvoicesDraft.map((id) => (
                    <span
                      key={id}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60 rounded-xl text-xs font-mono font-bold flex items-center gap-2"
                    >
                      {id}
                      <button
                        type="button"
                        onClick={() => setLinkedInvoicesDraft((prev) => prev.filter((x) => x !== id))}
                        className="hover:text-red-900 dark:hover:text-red-100"
                        title="Unlink"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Select from existing customer invoices */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Invoices for this customer:
              </label>
              {invoices.filter((i) => i.customerId === selectedShipmentForLinking.customerId).length === 0 ? (
                <div className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No invoices recorded yet for this customer profile ({selectedShipmentForLinking.customerId}). You can enter an invoice ID manually below.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {invoices
                    .filter((i) => i.customerId === selectedShipmentForLinking.customerId)
                    .map((inv) => {
                      const isLinked = linkedInvoicesDraft.includes(inv.id);
                      return (
                        <div
                          key={inv.id}
                          onClick={() => {
                            setLinkedInvoicesDraft((prev) =>
                              isLinked ? prev.filter((x) => x !== inv.id) : [...prev, inv.id]
                            );
                          }}
                          className={`p-3 rounded-2xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            isLinked
                              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                          }`}
                        >
                          <div>
                            <div className="font-mono font-bold">{inv.id}</div>
                            <div className="text-[11px] text-slate-500">
                              {inv.items.map((i) => `${i.quantity}x ${i.name || i.type}`).join(', ')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">₹{inv.totalAmount.toLocaleString()}</div>
                            <span className="text-[10px] font-mono uppercase text-slate-400">
                              {inv.paymentStatus}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Manual Custom Invoice ID input */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Or Enter Any Invoice ID Manually:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInvoiceIdInput}
                    onChange={(e) => setCustomInvoiceIdInput(e.target.value.toUpperCase())}
                    placeholder="e.g. I202610099927"
                    className="flex-1 text-xs font-mono uppercase px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customInvoiceIdInput.trim()) {
                        setLinkedInvoicesDraft((prev) =>
                          Array.from(new Set([...prev, customInvoiceIdInput.trim().toUpperCase()]))
                        );
                        setCustomInvoiceIdInput('');
                      }
                    }}
                    className="px-4 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedShipmentForLinking(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLinkingInvoices}
                onClick={handleSaveLinkedInvoices}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-red-600/30"
              >
                {isLinkingInvoices ? 'Saving...' : 'Save Linked Invoices'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: UPDATE DELIVERY STATUS & CONTACT INFO */}
      {editingShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg my-8 overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Update Delivery Milestones</h3>
                <p className="text-xs text-slate-500 font-mono">D-ID: {editingShipment.id}</p>
              </div>
              <button
                onClick={() => setEditingShipment(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStatus} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Milestone Stage:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STAGES.map((stg) => (
                    <button
                      key={stg.status}
                      type="button"
                      onClick={() => {
                        setEditStatus(stg.status);
                        if (stg.status === 'OUT_FOR_DELIVERY') {
                          setEditOutForDelivery(true);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        editStatus === stg.status
                          ? 'bg-red-50 dark:bg-red-950/50 border-red-500 text-red-900 dark:text-red-200 font-bold ring-2 ring-red-500/20'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs">{stg.stepNumber}. {stg.title}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{stg.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact Information (Driver & Store Helpline) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="font-bold text-slate-900 dark:text-white block text-xs">
                  Contact Information & Delivery Personnel:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Driver Name:</label>
                    <input
                      type="text"
                      value={editDriverName}
                      onChange={(e) => setEditDriverName(e.target.value)}
                      placeholder="e.g. Vikramjit Singh"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Driver Phone:</label>
                    <input
                      type="tel"
                      value={editDriverPhone}
                      onChange={(e) => setEditDriverPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Store Helpline / Dispatch Contact:
                    </label>
                    <input
                      type="tel"
                      value={editStoreContactPhone}
                      onChange={(e) => setEditStoreContactPhone(e.target.value)}
                      placeholder="+91 99980 21446"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Milestone Timestamp / Timing:
                  </label>
                  <input
                    type="datetime-local"
                    value={editStatusTimestamp}
                    onChange={(e) => setEditStatusTimestamp(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Custom Milestone Note (Optional):
                  </label>
                  <input
                    type="text"
                    value={editCustomNote}
                    onChange={(e) => setEditCustomNote(e.target.value)}
                    placeholder="e.g. Copper piping kit loaded"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingShipment(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-sm shadow-red-600/30"
                >
                  Save Milestone Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DISPATCH NEW DELIVERY (div) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl my-4 sm:my-8 overflow-hidden border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Create New Delivery (D...)</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Initial milestone will be <strong>1. Order Placed</strong>. Invoice(s) can be selected now or linked later at any time!
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Customer Selection */}
                <CustomerSelectBox
                  value={formCustomerId}
                  onChange={(custId) => handleSelectCustomer(custId)}
                  label="Select Customer:"
                  allowWalkIn={true}
                  walkInLabel="-- Direct / Walk-In Customer --"
                  onOpenNewCustomer={(initialQuery) => {
                    setCustomerToEditModal(null);
                    setCustomerModalInitialQuery(initialQuery || '');
                    setIsCustomerModalOpen(true);
                  }}
                  onOpenEditCustomer={(cust) => {
                    setCustomerToEditModal(cust);
                    setCustomerModalInitialQuery('');
                    setIsCustomerModalOpen(true);
                  }}
                />

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Name:</label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    placeholder="Recipient / Customer Name"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Phone:</label>
                  <input
                    type="tel"
                    required
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Custom ID Middle Text:</label>
                  <input
                    type="text"
                    value={formCustomIdText}
                    onChange={(e) => setFormCustomIdText(e.target.value.toUpperCase())}
                    placeholder="e.g. VIP-DELIVERY"
                    className="w-full font-mono uppercase px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                {/* INVOICE LINKING: CLEARLY OPTIONAL */}
                <div className="sm:col-span-2 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-red-600" />
                      Link Invoice(s) — Optional (Can Link Later):
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formSelectedInvoiceIds.length} invoice(s) selected
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    You can dispatch a delivery immediately even without any invoice created yet. When the tax bill is generated, simply click "Link Invoice(s)" on the card.
                  </p>

                  {invoices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
                      {invoices.slice(0, 10).map((inv) => {
                        const isSelected = formSelectedInvoiceIds.includes(inv.id);
                        return (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => handleToggleInvoiceSelection(inv.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                              isSelected
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {inv.id} ({inv.customerExternalName.split(' ')[0]} - ₹{inv.totalAmount})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Two Address Fields */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Billing Address:</label>
                  <input
                    type="text"
                    value={formBillingAddress}
                    onChange={(e) => setFormBillingAddress(e.target.value)}
                    placeholder="Billing Address"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">Installation Address:</label>
                    <button
                      type="button"
                      onClick={() => setFormInstallationAddress(formBillingAddress)}
                      className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                    >
                      📋 Same as Billing Address
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formInstallationAddress}
                    onChange={(e) => setFormInstallationAddress(e.target.value)}
                    placeholder="Delivery & Installation Site"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Items Summary:</label>
                  <input
                    type="text"
                    required
                    value={formItemsSummary}
                    onChange={(e) => setFormItemsSummary(e.target.value)}
                    placeholder="e.g. 2x 1.5T Inverter Split AC + Copper Piping Kit"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Store Helpline / Dispatch Contact:
                  </label>
                  <input
                    type="tel"
                    value={formStoreContactPhone}
                    onChange={(e) => setFormStoreContactPhone(e.target.value)}
                    placeholder="+91 99980 21446"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enable-driver-create"
                    checked={formOutForDelivery}
                    onChange={(e) => setFormOutForDelivery(e.target.checked)}
                    className="accent-red-600"
                  />
                  <label htmlFor="enable-driver-create" className="font-bold text-slate-700 dark:text-slate-300">
                    Assign Driver Details Now (Can also assign later at Out for Delivery stage)
                  </label>
                </div>

                {formOutForDelivery && (
                  <>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Driver Name:</label>
                      <input
                        type="text"
                        value={formDriverName}
                        onChange={(e) => setFormDriverName(e.target.value)}
                        placeholder="e.g. Vikramjit Singh"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Driver Phone:</label>
                      <input
                        type="tel"
                        value={formDriverPhone}
                        onChange={(e) => setFormDriverPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Live Route Link (Optional Maps URL):</label>
                      <input
                        type="url"
                        value={formLiveRoute}
                        onChange={(e) => setFormLiveRoute(e.target.value)}
                        placeholder="https://maps.google.com/..."
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-sm shadow-red-600/30"
                >
                  {isSubmitting ? 'Dispatching...' : 'Dispatch Delivery (1. Order Placed)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VIEW / ADD TRACKING MILESTONES */}
      {selectedShipmentForUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Tracking Milestones & Updates</h3>
                <p className="text-xs text-slate-500 font-mono">Delivery ID: {selectedShipmentForUpdate.id}</p>
              </div>
              <button
                onClick={() => setSelectedShipmentForUpdate(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* List of existing updates */}
            <div className="space-y-2 overflow-y-auto max-h-60 pr-1 flex-1">
              {selectedShipmentForUpdate.trackingUpdates?.map((upd, idx) => (
                <div
                  key={upd.id || idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
                    <span>{upd.timestamp.slice(0, 16).replace('T', ' ')}</span>
                    {upd.location && <span className="text-red-600 dark:text-red-400">📍 {upd.location}</span>}
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white">{upd.message}</div>
                </div>
              ))}
            </div>

            {/* Add new update */}
            <form onSubmit={handleAddTrackingUpdate} className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Add Milestone / Location Note:
                </label>
                <input
                  type="text"
                  required
                  value={newUpdateMessage}
                  onChange={(e) => setNewUpdateMessage(e.target.value)}
                  placeholder="e.g. Technician arrived at location for AC mounting"
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Current Hub / Location (Optional):
                  </label>
                  <input
                    type="text"
                    value={newUpdateLocation}
                    onChange={(e) => setNewUpdateLocation(e.target.value)}
                    placeholder="e.g. Sector 18 Store or Customer Site"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Custom Update Timing (Optional):
                  </label>
                  <input
                    type="datetime-local"
                    value={newUpdateTimestamp}
                    onChange={(e) => setNewUpdateTimestamp(e.target.value)}
                    className="w-full text-xs font-mono px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedShipmentForUpdate(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isAddingUpdate}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-red-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isAddingUpdate ? 'Adding...' : 'Post Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewPdfUrl}
        filename={previewPdfFilename}
        title={previewPdfTitle}
      />

      {/* Customer Modal for Add/Edit Customer */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customerToEdit={customerToEditModal}
        initialQuery={customerModalInitialQuery}
        onSaved={(c) => {
          handleSelectCustomer(c.id);
          setCustomerModalInitialQuery('');
        }}
      />
    </div>
  );
};
